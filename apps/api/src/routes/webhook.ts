import { Hono } from 'hono';
import { db } from '../db';
import { tickets, ticketMessages, slaConfigs, users } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { broadcast } from '../lib/websocket';
import { GoogleGenerativeAI } from '@google/generative-ai';

const webhookRoutes = new Hono();

// ─── Gemini AI Setup ────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ─── Valid DB Enum Values ───────────────────────────────────────────────────
const VALID_CATEGORIES = ['login_issue', 'system_down', 'bug', 'performance', 'data_issue', 'feature_request', 'other'] as const;
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

type Category = typeof VALID_CATEGORIES[number];
type Priority = typeof VALID_PRIORITIES[number];

// ─── Types ──────────────────────────────────────────────────────────────────
interface BufferedMessage {
    senderJid: string;
    senderName: string;
    text: string;
    messageId: string | null;
    timestamp: number;
}

interface MessageBuffer {
    groupJid: string;
    groupName: string | null;
    messages: BufferedMessage[];
    timer: ReturnType<typeof setTimeout>;
}

interface TicketGroup {
    subject: string;
    description: string;
    category: Category;
    priority: Priority;
    primarySenderJid: string;
    primarySenderName: string;
    primaryMessageId: string | null;
    messages: BufferedMessage[];
}

interface GroupingResult {
    groups: TicketGroup[];
}

// ─── In-Memory Message Buffer ───────────────────────────────────────────────
// Key: groupJid (or "dm:{senderJid}" for direct messages)
// Groups related messages with a 3-minute debounce before processing
const messageBuffers = new Map<string, MessageBuffer>();

const BUFFER_DEBOUNCE_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Add a message to the group buffer. Resets the debounce timer.
 * When the timer expires, processBuffer() is called to analyze and create tickets.
 */
function addToBuffer(params: {
    bufferKey: string;
    groupJid: string;
    groupName: string | null;
    msg: BufferedMessage;
}) {
    const { bufferKey, groupJid, groupName, msg } = params;

    const existing = messageBuffers.get(bufferKey);
    if (existing) {
        // Reset debounce timer — more messages may still come in
        clearTimeout(existing.timer);
        existing.messages.push(msg);
        existing.timer = setTimeout(() => processBuffer(bufferKey), BUFFER_DEBOUNCE_MS);
        console.log(`[Buffer] Added msg to existing buffer for ${bufferKey} (total: ${existing.messages.length} msgs)`);
    } else {
        // New buffer for this group
        const timer = setTimeout(() => processBuffer(bufferKey), BUFFER_DEBOUNCE_MS);
        messageBuffers.set(bufferKey, {
            groupJid,
            groupName,
            messages: [msg],
            timer,
        });
        console.log(`[Buffer] Created new buffer for ${bufferKey} with 1st message`);
    }
}

/**
 * Process a buffer: call Gemini to analyze all buffered messages,
 * group them into logical tickets, then create those tickets.
 */
async function processBuffer(bufferKey: string) {
    const buffer = messageBuffers.get(bufferKey);
    if (!buffer) return;
    messageBuffers.delete(bufferKey);

    const { groupJid, groupName, messages } = buffer;

    if (messages.length === 0) return;

    console.log(`[Buffer] Processing ${messages.length} buffered messages for ${bufferKey}...`);

    try {
        const groups = await groupMessagesWithGemini(messages, groupName);

        if (!groups || groups.length === 0) {
            console.log(`[Buffer] No report groups found in ${messages.length} messages — skipping.`);
            return;
        }

        console.log(`[Buffer] Gemini identified ${groups.length} ticket group(s).`);

        for (const group of groups) {
            await createTicketFromGroup(group, groupJid, groupName);
        }
    } catch (err: any) {
        console.error('[Buffer] Error processing buffer:', err.message);
    }
}

// ─── Gemini: Group messages into tickets ────────────────────────────────────
async function groupMessagesWithGemini(messages: BufferedMessage[], groupName: string | null): Promise<TicketGroup[]> {
    const messageLog = messages.map((m, i) =>
        `[${i + 1}] ${m.senderName} (${m.senderJid}): "${m.text}"`
    ).join('\n');

    const prompt = `
Kamu adalah asisten AI yang menganalisis percakapan grup WhatsApp dari tim monitoring IT/Puskesmas.

Daftar pesan berikut ini dikirim dalam satu grup dalam rentang waktu singkat (maks 3 menit):

${messageLog}

Tugasmu:
1. Identifikasi apakah ada laporan masalah/keluhan sistem di antara pesan-pesan tersebut.
2. Kelompokkan pesan yang berkaitan ke dalam satu tiket (contoh: gambar error + teks "masih belum bisa" = 1 tiket).
3. Abaikan pesan basa-basi, sapaan, atau percakapan yang bukan laporan masalah.
4. Jika ada 2+ masalah BERBEDA, buat tiket terpisah untuk masing-masing.

Pesan dianggap laporan jika:
- Menyebutkan error/bug/masalah pada aplikasi
- Sistem tidak bisa diakses
- Fitur tidak berfungsi
- Keluhan pengguna tentang gangguan teknis

Jawab HANYA dalam format JSON array berikut (tanpa teks lain):
[
  {
    "subject": "Judul singkat laporan (maks 80 karakter)",
    "description": "Deskripsi lengkap masalah, gabungkan semua konteks dari pesan terkait",
    "category": "login_issue" | "system_down" | "bug" | "performance" | "data_issue" | "feature_request" | "other",
    "priority": "critical" | "high" | "medium" | "low",
    "messageIndices": [1, 2, 3],
    "primarySenderIndex": 1
  }
]

Jika tidak ada laporan sama sekali, jawab: []

Panduan priority:
- critical: sistem mati total, seluruh user tidak bisa akses
- high: bug berdampak besar, fitur utama tidak berfungsi
- medium: bug yang mengganggu tapi ada workaround
- low: permintaan fitur baru atau masalah minor
`;

    try {
        const result = await geminiModel.generateContent(prompt);
        const responseText = result.response.text().trim();
        const cleaned = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        const parsed = JSON.parse(cleaned) as Array<{
            subject: string;
            description: string;
            category: Category;
            priority: Priority;
            messageIndices: number[];
            primarySenderIndex: number;
        }>;

        if (!Array.isArray(parsed) || parsed.length === 0) return [];

        return parsed.map(group => {
            const relatedMsgs = (group.messageIndices ?? [])
                .map(i => messages[i - 1])
                .filter((m): m is BufferedMessage => m !== undefined);
            const primaryIdx = (group.primarySenderIndex ?? 1) - 1;
            const primaryMsg = messages[primaryIdx] ?? messages[0];

            if (!primaryMsg) return null;

            const safeCategory = VALID_CATEGORIES.includes(group.category) ? group.category : 'other';
            const safePriority = VALID_PRIORITIES.includes(group.priority) ? group.priority : 'medium';

            const ticketGroup: TicketGroup = {
                subject: group.subject?.slice(0, 80) || relatedMsgs[0]?.text?.slice(0, 80) || 'Laporan dari WhatsApp',
                description: group.description || relatedMsgs.map(m => `${m.senderName}: ${m.text}`).join('\n'),
                category: safeCategory,
                priority: safePriority,
                primarySenderJid: primaryMsg.senderJid,
                primarySenderName: primaryMsg.senderName,
                primaryMessageId: primaryMsg.messageId,
                messages: relatedMsgs.length > 0 ? relatedMsgs : [primaryMsg],
            };
            return ticketGroup;
        }).filter((g): g is TicketGroup => g !== null);
    } catch (err: any) {
        console.error('[Gemini] Failed to group messages:', err.message);
        return [];
    }
}

// ─── Create ticket from a grouped analysis ──────────────────────────────────
async function createTicketFromGroup(group: TicketGroup, groupJid: string, groupName: string | null) {
    const slaRows: any[] = await (db as any).select().from(slaConfigs)
        .where(eq(slaConfigs.priority, group.priority as any))
        .limit(1);
    const sla = slaRows[0];

    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const ticketNumber = `TKT-${todayStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [insertResult] = await (db as any).insert(tickets).values({
        ticketNumber,
        subject: group.subject,
        description: group.description,
        status: 'open',
        priority: group.priority,
        category: group.category,
        reportedAt: new Date(),
        groupJid: groupJid || null,
        groupName: groupName || null,
        reporterName: group.primarySenderName,
        reporterJid: group.primarySenderJid,
        whatsappMessageId: group.primaryMessageId || `msg-${Date.now()}`,
        slaResponseTargetMinutes: sla?.responseTargetMinutes || 120,
        slaResolutionTargetMinutes: sla?.resolutionTargetMinutes || 1440,
    });

    const ticketId = (insertResult as any).insertId;

    // Insert all related messages as ticket messages
    for (const msg of group.messages) {
        await (db as any).insert(ticketMessages).values({
            ticketId,
            senderJid: msg.senderJid,
            senderName: msg.senderName,
            messageText: msg.text,
            whatsappMessageId: msg.messageId || `msg-${Date.now()}-${Math.random()}`,
            isFromTeam: false,
            sentAt: new Date(msg.timestamp),
        });
    }

    broadcast('NEW_TICKET', {
        ticketId,
        ticketNumber,
        subject: group.subject,
        priority: group.priority,
        category: group.category,
    });

    console.log(`[Webhook] ✅ Ticket ${ticketNumber} created (id: ${ticketId}) with ${group.messages.length} messages`);
    return { ticketId, ticketNumber };
}

// ─── Gemini: Single message classification (for DMs / immediate classification) ─
async function classifyMessageWithGemini(text: string): Promise<{ isReport: boolean; category: Category; priority: Priority; subject: string; description: string }> {
    const prompt = `
Kamu adalah asisten AI yang bertugas menganalisis pesan WhatsApp dari grup monitoring IT/Puskesmas.

Tugasmu: Analisis apakah pesan di bawah ini adalah LAPORAN MASALAH / GANGGUAN SISTEM yang perlu dibuatkan tiket.

Laporan yang valid misalnya:
- Error/bug aplikasi
- Sistem tidak bisa diakses
- Data tidak bisa diekspor
- Login gagal/error
- Tampilan website bermasalah
- Fitur tidak berfungsi
- Keluhan pengguna tentang aplikasi

Pesan yang BUKAN laporan (isReport=false):
- Sapaan / basa-basi biasa (halo, selamat pagi, makasih, dll)
- Pertanyaan umum yang tidak berkaitan dengan bug/masalah sistem
- Percakapan biasa

Jawab HANYA dalam format JSON berikut (tanpa teks/penjelasan lain):
{
  "isReport": true/false,
  "category": "login_issue" | "system_down" | "bug" | "performance" | "data_issue" | "feature_request" | "other",
  "priority": "critical" | "high" | "medium" | "low",
  "subject": "Judul singkat laporan (maks 80 karakter)",
  "description": "Deskripsi lengkap masalah yang dilaporkan"
}

Panduan priority:
- critical: sistem mati total, seluruh user tidak bisa akses
- high: bug berdampak besar, fitur utama tidak berfungsi
- medium: bug yang mengganggu tapi ada workaround
- low: permintaan fitur baru atau masalah minor

Pesan WhatsApp yang perlu dianalisis:
"${text.replace(/"/g, '\\"')}"
`;

    try {
        const result = await geminiModel.generateContent(prompt);
        const responseText = result.response.text().trim();
        const cleaned = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        const parsed = JSON.parse(cleaned);

        const safeCategory = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'other';
        const safePriority = VALID_PRIORITIES.includes(parsed.priority) ? parsed.priority : 'medium';

        return {
            isReport: Boolean(parsed.isReport),
            category: safeCategory,
            priority: safePriority,
            subject: parsed.subject?.slice(0, 80) || text.slice(0, 80),
            description: parsed.description || text,
        };
    } catch (err: any) {
        console.error('[Gemini] Failed to classify message, defaulting to non-report:', err.message);
        return { isReport: false, category: 'other', priority: 'medium', subject: text.slice(0, 80), description: text };
    }
}

// ─── Main Webhook Endpoint ──────────────────────────────────────────────────
webhookRoutes.post('/openclaw', async (c) => {
    try {
        const body = await c.req.json();
        console.debug('[Webhook] Received:', JSON.stringify(body).slice(0, 300));

        const { message, sender, group } = body;
        if (!message || !sender) return c.json({ success: false, error: 'Missing message or sender' });

        const whatsappJid = sender.jid;
        const groupJid = group?.jid || null;
        const groupName = group?.name || null;
        const text = typeof message === 'string' ? message : message.text;

        if (!text?.trim()) return c.json({ success: false, error: 'No text content' });

        // ── 1. Check if sender is a registered team member ──────────────────
        const [user]: any[] = await (db as any).select().from(users)
            .where(eq(users.whatsappJid, whatsappJid)).limit(1);

        if (user) {
            // Handle team member → update ticket status
            const lowerText = text.toLowerCase().trim();

            const [recentTicket]: any[] = await (db as any).select()
                .from(tickets)
                .where(groupJid ? eq(tickets.groupJid, groupJid) : sql`1=1`)
                .orderBy(desc(tickets.reportedAt))
                .limit(1);

            if (recentTicket && recentTicket.status !== 'resolved' && recentTicket.status !== 'closed') {
                let newStatus = recentTicket.status;
                let updatePayload: any = { updatedAt: new Date() };

                if (['ok', 'siap', 'copy', 'oke'].includes(lowerText)) {
                    newStatus = 'acknowledged';
                    if (!recentTicket.firstResponseAt) updatePayload.firstResponseAt = new Date();
                } else if (['done', 'selesai', 'fix', 'sudah selesai'].includes(lowerText)) {
                    newStatus = 'resolved';
                    updatePayload.resolvedAt = new Date();
                } else if (['on progress', 'on-progress', 'in progress'].includes(lowerText)) {
                    newStatus = 'in_progress';
                }

                if (newStatus !== recentTicket.status) {
                    await (db as any).update(tickets).set({
                        ...updatePayload,
                        status: newStatus,
                        assignedTo: user.id,
                    }).where(eq(tickets.id, recentTicket.id));
                    broadcast('TICKET_UPDATED', { ticketId: recentTicket.id, status: newStatus });
                }

                await (db as any).insert(ticketMessages).values({
                    ticketId: recentTicket.id,
                    senderJid: whatsappJid,
                    senderName: user.name,
                    messageText: text,
                    whatsappMessageId: body.message_id || `msg-${Date.now()}`,
                    isFromTeam: true,
                    sentAt: new Date(),
                });

                return c.json({ success: true, action: 'status_updated', status: newStatus });
            }
        }

        // ── 2. For regular users: add to group buffer for AI grouping ───────
        const bufferKey = groupJid ? `group:${groupJid}` : `dm:${whatsappJid}`;

        const bufferedMsg: BufferedMessage = {
            senderJid: whatsappJid,
            senderName: sender.name || 'WhatsApp User',
            text: text.trim(),
            messageId: body.message_id || null,
            timestamp: body.timestamp || Date.now(),
        };

        if (groupJid) {
            // Group message → buffer with debounce (multiple messages can form 1 ticket)
            addToBuffer({ bufferKey, groupJid, groupName, msg: bufferedMsg });
            const bufferSize = messageBuffers.get(bufferKey)?.messages.length ?? 1;
            console.log(`[Webhook] Message buffered for group ${groupName || groupJid} (${bufferSize} in buffer, processing in 3 mins)`);
            return c.json({ success: true, action: 'buffered', bufferSize });
        } else {
            // DM → classify immediately (no grouping needed)
            console.log(`[Webhook] DM from ${whatsappJid} — classifying immediately...`);
            const classification = await classifyMessageWithGemini(text);

            if (!classification.isReport) {
                return c.json({ success: true, action: 'ignored', reason: 'Not classified as a report' });
            }

            const ticketResult = await createTicketFromGroup({
                subject: classification.subject,
                description: classification.description,
                category: classification.category,
                priority: classification.priority,
                primarySenderJid: whatsappJid,
                primarySenderName: sender.name || 'WhatsApp User',
                primaryMessageId: body.message_id || null,
                messages: [bufferedMsg],
            }, whatsappJid, null);

            return c.json({ success: true, action: 'ticket_created', ...ticketResult });
        }

    } catch (err: any) {
        console.error('[Webhook Error]', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

// ─── Debug endpoint: view current buffers ──────────────────────────────────
webhookRoutes.get('/openclaw/buffers', async (c) => {
    const buffers: Record<string, any> = {};
    for (const [key, buf] of messageBuffers.entries()) {
        buffers[key] = {
            groupJid: buf.groupJid,
            groupName: buf.groupName,
            messageCount: buf.messages.length,
            messages: buf.messages.map(m => ({ sender: m.senderName, text: m.text.slice(0, 60) })),
        };
    }
    return c.json({ success: true, activeBuffers: Object.keys(buffers).length, buffers });
});

export { webhookRoutes };
