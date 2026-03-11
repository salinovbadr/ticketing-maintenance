# Implementation Plan: AI-Powered Ticket Extraction from WhatsApp
## Webhook Modification — Gemini Classification + Silent Logging

> **Context**: Project sudah ada di `monitoring-maintenance/` monorepo. OpenClaw sudah running dan terhubung ke WhatsApp. Backend menggunakan Bun + Hono + Drizzle. File target utama: `apps/api/src/routes/webhook.ts`
>
> **Perubahan kunci**: Ganti keyword-based `classifyMessage()` dengan Gemini AI classification. Bot hanya react 👀 tanpa membalas. Semua grup yang bot di-add akan dimonitor.

---

## Arsitektur Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  WhatsApp Grup (semua grup yang bot di-add)                     │
│  User mengirim pesan: "Aplikasi SMILE error 500 pas login"      │
└────────────────────┬────────────────────────────────────────────┘
                     │ (WhatsApp Web Protocol / Baileys)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenClaw Gateway (self-hosted)                                 │
│  - Mendengar semua pesan dari semua grup                        │
│  - React 👀 ke setiap pesan yang masuk                          │
│  - TIDAK membalas / auto-reply apapun                           │
│  - Forward pesan ke Backend API via HTTP POST                   │
└────────────────────┬────────────────────────────────────────────┘
                     │ POST /api/webhook/openclaw
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend API (Bun + Hono)                                       │
│  webhook.ts menerima payload lalu:                              │
│                                                                 │
│  1. Validasi payload (sender, message, group)                   │
│  2. Kirim message text ke Gemini 2.5 Flash API                  │
│  3. Gemini return JSON: { isReport, category, priority, ... }   │
│  4. IF isReport === true → INSERT ke tabel tickets              │
│  5. IF isReport === false → INSERT ke tabel message_logs (opsional) │
│  6. Return 200 OK ke OpenClaw                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  MySQL Database                                                 │
│  - tickets (laporan yang terklasifikasi)                        │
│  - ticket_messages (thread pesan per tiket)                     │
│  - message_logs (semua pesan mentah untuk audit trail)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pre-Requisites Checklist

Sebelum mulai, pastikan hal berikut sudah ready:

- [ ] OpenClaw sudah running dan terhubung ke WhatsApp (QR code sudah di-scan)
- [ ] `GEMINI_API_KEY` sudah ada dan valid (test dulu di Google AI Studio)
- [ ] Database MySQL sudah bisa diakses dari backend
- [ ] File `apps/api/src/routes/webhook.ts` sudah ada (akan dimodifikasi)
- [ ] Drizzle schema sudah ada untuk tabel `tickets` dan `ticket_messages`

---

## STEP 1: Install Dependency — Google GenAI SDK
**File target: `apps/api/package.json`**

```bash
cd apps/api
bun add @google/genai
```

Tambahkan ke `.env`:
```env
GEMINI_API_KEY=your-gemini-api-key-here
```

**Acceptance criteria:**
- [ ] `@google/genai` terinstall di `apps/api/node_modules`
- [ ] `GEMINI_API_KEY` ada di `.env` dan bisa dibaca via `process.env.GEMINI_API_KEY`

---

## STEP 2: Buat Gemini Classifier Service
**Buat file baru: `apps/api/src/services/gemini-classifier.ts`**

Service ini menangani komunikasi dengan Gemini API untuk mengklasifikasikan pesan WhatsApp.

```typescript
// apps/api/src/services/gemini-classifier.ts

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Interface untuk hasil klasifikasi
export interface ClassificationResult {
  isReport: boolean;         // true jika ini laporan masalah/bug/error/keluhan
  category: "login_issue" | "system_down" | "bug" | "performance" | "data_issue" | "feature_request" | "other";
  priority: "critical" | "high" | "medium" | "low";
  subject: string;           // Ringkasan singkat 1 baris (max 100 karakter)
  description: string;       // Deskripsi lengkap masalah
  confidence: number;        // 0-1, seberapa yakin AI dengan klasifikasi ini
}

// Fallback jika Gemini gagal atau rate-limited
const FALLBACK_RESULT: ClassificationResult = {
  isReport: false,
  category: "other",
  priority: "low",
  subject: "",
  description: "",
  confidence: 0,
};

export async function classifyMessage(messageText: string, senderName: string, groupName: string): Promise<ClassificationResult> {
  // Skip pesan yang terlalu pendek (emoji, sticker, "ok", "siap" dll)
  if (!messageText || messageText.trim().length < 10) {
    return FALLBACK_RESULT;
  }

  // Skip media-only placeholders dari OpenClaw
  if (messageText.startsWith("[Image]") || messageText.startsWith("[Video]") || messageText.startsWith("[Audio]") || messageText.startsWith("[Sticker]")) {
    // Kecuali ada caption yang cukup panjang setelah placeholder
    const caption = messageText.replace(/^\[(?:Image|Video|Audio|Sticker)\]\s*/i, "");
    if (caption.trim().length < 10) {
      return FALLBACK_RESULT;
    }
  }

  const prompt = `Kamu adalah sistem klasifikasi pesan WhatsApp untuk tim maintenance software.
Tugasmu adalah menentukan apakah sebuah pesan dari user adalah LAPORAN MASALAH (bug, error, keluhan, gangguan, request perbaikan) atau BUKAN LAPORAN (chat biasa, sapaan, diskusi, pertanyaan umum, ucapan terima kasih, candaan).

KONTEKS:
- Pesan ini dikirim di grup WhatsApp bernama: "${groupName}"
- Pengirim: ${senderName}
- Ini adalah grup support/maintenance dimana user melaporkan masalah aplikasi

PESAN YANG DIANALISIS:
"""
${messageText}
"""

INSTRUKSI KLASIFIKASI:
1. isReport = true HANYA jika pesan mengandung keluhan, laporan error, bug, gangguan sistem, fitur tidak berfungsi, atau request perbaikan yang spesifik.
2. isReport = false untuk: sapaan (halo, pagi, siang), ucapan terima kasih, pertanyaan umum yang bukan keluhan, diskusi, candaan, pesan pendek tanpa konteks masalah.
3. Jika ragu antara laporan atau bukan, set isReport = true dengan confidence rendah (lebih baik tercatat daripada terlewat).

RULES UNTUK PRIORITY:
- critical: Sistem/aplikasi down total, tidak bisa diakses sama sekali, data hilang/corrupt
- high: Fitur utama error/tidak bisa dipakai, banyak user terdampak
- medium: Fitur tertentu bermasalah tapi ada workaround, error intermittent
- low: Cosmetic issue, typo, suggestion, minor inconvenience

RULES UNTUK CATEGORY:
- login_issue: Masalah login, lupa password, akun terkunci, SSO error
- system_down: Aplikasi tidak bisa diakses, server down, 502/503 error
- bug: Fitur tidak berjalan sesuai expected behavior
- performance: Aplikasi lambat, loading lama, timeout
- data_issue: Data salah, data hilang, laporan tidak akurat
- feature_request: Permintaan fitur baru atau perubahan
- other: Tidak masuk kategori di atas

RESPOND HANYA DALAM FORMAT JSON BERIKUT, TANPA MARKDOWN BACKTICKS, TANPA TEKS LAIN:
{"isReport":boolean,"category":"string","priority":"string","subject":"string max 100 karakter","description":"string","confidence":number 0-1}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,  // Low temperature untuk konsistensi klasifikasi
        maxOutputTokens: 300,
      },
    });

    const text = response.text?.trim();
    if (!text) return FALLBACK_RESULT;

    // Parse JSON — bersihkan markdown fences jika ada
    const clean = text.replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(clean) as ClassificationResult;

    // Validasi fields
    if (typeof parsed.isReport !== "boolean") return FALLBACK_RESULT;
    if (!parsed.category || !parsed.priority) return FALLBACK_RESULT;

    return parsed;
  } catch (error) {
    console.error("[Gemini Classifier] Error:", error);
    // Jangan crash webhook, return fallback
    return FALLBACK_RESULT;
  }
}
```

**Acceptance criteria:**
- [ ] File `gemini-classifier.ts` terbuat dengan export `classifyMessage()` dan interface `ClassificationResult`
- [ ] Ada pre-filter untuk pesan pendek (<10 karakter) dan media-only → langsung return `isReport: false`
- [ ] Prompt dalam Bahasa Indonesia karena pesan user akan dalam Bahasa Indonesia
- [ ] Error handling: jika Gemini gagal/timeout, return fallback (tidak crash webhook)
- [ ] Temperature di-set rendah (0.1) untuk konsistensi klasifikasi
- [ ] Response di-parse sebagai JSON, dengan fallback jika parsing gagal

---

## STEP 3: Buat Message Log Table (Opsional tapi Direkomendasikan)
**File target: Drizzle schema file (e.g. `apps/api/src/db/schema.ts`)**

Tabel ini menyimpan SEMUA pesan mentah dari WhatsApp sebelum klasifikasi. Berguna untuk audit trail dan re-training AI di kemudian hari.

```sql
CREATE TABLE IF NOT EXISTS message_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  whatsapp_message_id VARCHAR(100) UNIQUE COMMENT 'Deduplikasi: message ID dari WhatsApp',
  sender_jid VARCHAR(50) NOT NULL,
  sender_name VARCHAR(100) NOT NULL,
  group_jid VARCHAR(50),
  group_name VARCHAR(200),
  message_text TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' COMMENT 'text, image, video, document, etc',
  
  -- Hasil klasifikasi AI
  is_report BOOLEAN DEFAULT false,
  ai_category VARCHAR(30) NULL,
  ai_priority VARCHAR(10) NULL,
  ai_subject VARCHAR(300) NULL,
  ai_confidence DECIMAL(3,2) NULL COMMENT '0.00 - 1.00',
  ticket_id INT NULL COMMENT 'FK ke tickets.id jika is_report = true',
  
  -- Metadata
  received_at TIMESTAMP NOT NULL COMMENT 'Waktu pesan masuk di WhatsApp',
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu diproses oleh sistem',
  
  INDEX idx_group_jid (group_jid),
  INDEX idx_received_at (received_at),
  INDEX idx_is_report (is_report),
  INDEX idx_message_id (whatsapp_message_id)
);
```

Buat Drizzle schema yang sesuai di file schema.ts:

```typescript
// Tambahkan ke schema.ts
export const messageLogs = mysqlTable("message_logs", {
  id: int("id").autoincrement().primaryKey(),
  whatsappMessageId: varchar("whatsapp_message_id", { length: 100 }).unique(),
  senderJid: varchar("sender_jid", { length: 50 }).notNull(),
  senderName: varchar("sender_name", { length: 100 }).notNull(),
  groupJid: varchar("group_jid", { length: 50 }),
  groupName: varchar("group_name", { length: 200 }),
  messageText: text("message_text").notNull(),
  messageType: varchar("message_type", { length: 20 }).default("text"),
  isReport: boolean("is_report").default(false),
  aiCategory: varchar("ai_category", { length: 30 }),
  aiPriority: varchar("ai_priority", { length: 10 }),
  aiSubject: varchar("ai_subject", { length: 300 }),
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
  ticketId: int("ticket_id"),
  receivedAt: timestamp("received_at").notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
});
```

**Acceptance criteria:**
- [ ] Tabel `message_logs` terbuat di database
- [ ] Drizzle schema sinkron dengan SQL di atas
- [ ] Ada `whatsapp_message_id` UNIQUE untuk deduplikasi (cegah pesan diproses 2x)
- [ ] Migration berhasil dijalankan

---

## STEP 4: Modifikasi webhook.ts — Logic Utama
**File target: `apps/api/src/routes/webhook.ts`**

Ini adalah perubahan inti. Hapus/replace fungsi `classifyMessage()` yang lama (keyword-based) dengan Gemini classifier.

### 4A: Payload yang Diterima dari OpenClaw

OpenClaw mengirim pesan WhatsApp ke webhook kita dengan format envelope seperti ini. Sesuaikan parsing dengan payload yang sebenarnya diterima oleh project ini (cek console log dari pesan yang sudah masuk sebelumnya):

```typescript
// Expected payload dari OpenClaw webhook/skill
interface OpenClawInboundPayload {
  // Sesuaikan field names dengan payload aktual dari OpenClaw
  data: {
    message: {
      id: string;              // WhatsApp message ID
      text: string;            // Isi pesan (atau caption untuk media)
      timestamp: number;       // Unix timestamp
      type: string;            // "text", "image", "video", etc
    };
    sender: {
      jid: string;             // Format: 628xxx@s.whatsapp.net
      name: string;            // Push name / display name
      phone: string;           // Phone number
    };
    group?: {
      jid: string;             // Format: 628xxx-xxx@g.us
      name: string;            // Nama grup
    };
    quotedMessage?: {          // Pesan yang di-reply (jika ada)
      id: string;
      text: string;
      senderJid: string;
    };
  };
}
```

> **PENTING**: Payload di atas adalah perkiraan. Cek log request yang masuk dari OpenClaw untuk melihat struktur payload yang sebenarnya. Tambahkan `console.log(JSON.stringify(req.body, null, 2))` di awal handler untuk capture payload aktual.

### 4B: Flow Logic webhook.ts yang Baru

```typescript
// apps/api/src/routes/webhook.ts

import { Hono } from "hono";
import { db } from "../db";
import { tickets, ticketMessages, messageLogs } from "../db/schema";
import { classifyMessage } from "../services/gemini-classifier";
import { eq } from "drizzle-orm";

const webhook = new Hono();

// ============================================================
// MAIN WEBHOOK: Menerima pesan dari OpenClaw
// ============================================================
webhook.post("/openclaw", async (c) => {
  try {
    const payload = await c.req.json();

    // ── STEP 1: Parse & Validate ──
    // PENTING: Sesuaikan parsing ini dengan payload aktual dari OpenClaw
    // Uncomment baris ini saat development untuk melihat struktur payload:
    // console.log("[Webhook] Raw payload:", JSON.stringify(payload, null, 2));

    const messageText = payload?.data?.message?.text || "";
    const messageId = payload?.data?.message?.id || "";
    const messageType = payload?.data?.message?.type || "text";
    const timestamp = payload?.data?.message?.timestamp;
    const senderJid = payload?.data?.sender?.jid || "";
    const senderName = payload?.data?.sender?.name || "Unknown";
    const groupJid = payload?.data?.group?.jid || null;
    const groupName = payload?.data?.group?.name || null;

    // Skip jika tidak ada teks untuk dianalisis
    if (!messageText || messageText.trim().length === 0) {
      return c.json({ success: true, action: "skipped", reason: "empty_message" });
    }

    // Deduplikasi: cek apakah message ID sudah pernah diproses
    if (messageId) {
      const existing = await db.select()
        .from(messageLogs)
        .where(eq(messageLogs.whatsappMessageId, messageId))
        .limit(1);
      
      if (existing.length > 0) {
        return c.json({ success: true, action: "skipped", reason: "duplicate" });
      }
    }

    // Parse timestamp
    const receivedAt = timestamp
      ? new Date(typeof timestamp === "number" ? timestamp * 1000 : timestamp)
      : new Date();

    // ── STEP 2: Klasifikasi dengan Gemini AI ──
    const classification = await classifyMessage(
      messageText,
      senderName,
      groupName || "Unknown Group"
    );

    // ── STEP 3: Log SEMUA pesan ke message_logs ──
    const [logEntry] = await db.insert(messageLogs).values({
      whatsappMessageId: messageId || null,
      senderJid,
      senderName,
      groupJid,
      groupName,
      messageText,
      messageType,
      isReport: classification.isReport,
      aiCategory: classification.category,
      aiPriority: classification.priority,
      aiSubject: classification.subject || null,
      aiConfidence: classification.confidence?.toString() || null,
      receivedAt,
    });

    // ── STEP 4: Jika ini laporan, buat tiket ──
    if (classification.isReport) {
      // Generate ticket number: TKT-YYYYMMDD-XXXX
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
      
      // Hitung tiket hari ini untuk auto-increment
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 86400000);
      
      const todayTickets = await db.select()
        .from(tickets)
        .where(
          // Sesuaikan query ini dengan Drizzle syntax yang dipakai di project
          // Intinya: WHERE reported_at >= todayStart AND reported_at < todayEnd
        );
      
      const seq = String(todayTickets.length + 1).padStart(4, "0");
      const ticketNumber = `TKT-${dateStr}-${seq}`;

      // Ambil SLA config berdasarkan priority
      // Jika tabel sla_configs belum ada, gunakan default values
      const slaDefaults: Record<string, { response: number; resolution: number }> = {
        critical: { response: 15, resolution: 120 },
        high: { response: 30, resolution: 480 },
        medium: { response: 120, resolution: 4320 },
        low: { response: 1440, resolution: 7200 },
      };
      const sla = slaDefaults[classification.priority] || slaDefaults.medium;

      // Insert tiket
      const [newTicket] = await db.insert(tickets).values({
        ticketNumber,
        whatsappMessageId: messageId || null,
        reporterName: senderName,
        reporterJid: senderJid,
        groupJid,
        groupName,
        subject: classification.subject || messageText.substring(0, 200),
        description: classification.description || messageText,
        category: classification.category,
        priority: classification.priority,
        status: "open",
        reportedAt: receivedAt,
        slaResponseTargetMinutes: sla.response,
        slaResolutionTargetMinutes: sla.resolution,
      });

      // Insert pesan awal ke ticket_messages
      await db.insert(ticketMessages).values({
        ticketId: newTicket.insertId,   // Sesuaikan dengan return type Drizzle
        senderJid,
        senderName,
        messageText,
        whatsappMessageId: messageId || null,
        isFromTeam: false,
        sentAt: receivedAt,
      });

      // Update message_log dengan ticket_id
      if (logEntry?.insertId) {
        await db.update(messageLogs)
          .set({ ticketId: newTicket.insertId })
          .where(eq(messageLogs.id, logEntry.insertId));
      }

      console.log(`[Webhook] ✅ Ticket created: ${ticketNumber} | Priority: ${classification.priority} | Subject: ${classification.subject}`);

      return c.json({
        success: true,
        action: "ticket_created",
        ticket: {
          id: newTicket.insertId,
          number: ticketNumber,
          priority: classification.priority,
          category: classification.category,
          subject: classification.subject,
        },
      });
    }

    // ── STEP 5: Bukan laporan → hanya log, tidak buat tiket ──
    console.log(`[Webhook] 💬 Non-report message from ${senderName} in ${groupName || "DM"} (confidence: ${classification.confidence})`);

    return c.json({
      success: true,
      action: "logged_only",
      isReport: false,
      confidence: classification.confidence,
    });

  } catch (error) {
    console.error("[Webhook] ❌ Error processing message:", error);
    // Return 200 supaya OpenClaw tidak retry terus-menerus
    return c.json({ success: false, error: "Internal processing error" }, 200);
  }
});

// ============================================================
// HEALTH CHECK endpoint
// ============================================================
webhook.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "maintenance-monitor-webhook",
    timestamp: new Date().toISOString(),
  });
});

export default webhook;
```

**Acceptance criteria:**
- [ ] Fungsi `classifyMessage()` yang lama (keyword-based) sudah dihapus/diganti
- [ ] Webhook menerima payload dari OpenClaw, parsing field yang benar
- [ ] Setiap pesan masuk → log ke `message_logs` (baik laporan maupun bukan)
- [ ] Deduplikasi: pesan dengan `whatsapp_message_id` yang sama tidak diproses ulang
- [ ] Hanya pesan dengan `isReport === true` yang membuat tiket baru
- [ ] Ticket number di-generate dengan format `TKT-YYYYMMDD-XXXX`
- [ ] SLA target otomatis diisi berdasarkan priority
- [ ] Pesan awal otomatis dicatat di `ticket_messages`
- [ ] Error handling: webhook selalu return 200 (supaya OpenClaw tidak retry)
- [ ] Console log yang jelas untuk debugging

---

## STEP 5: Konfigurasi OpenClaw — Silent Listener Mode
**File target: `openclaw.json` atau OpenClaw config**

Konfigurasi agar OpenClaw:
1. Mendengar pesan dari SEMUA grup yang bot di-add
2. React 👀 ke pesan yang masuk
3. TIDAK membalas / auto-reply apapun
4. Forward pesan ke backend API kita

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "groupPolicy": "open",
      "dmPolicy": "allowlist",
      "allowFrom": [],
      "ackReaction": {
        "emoji": "👀",
        "direct": false,
        "group": "always"
      },
      "configWrites": false
    }
  }
}
```

### OpenClaw Skill/Plugin untuk Forward Pesan

Buat skill atau gunakan webhook hook mapping agar setiap pesan dari grup di-forward ke backend API. Ada 2 pendekatan:

**Pendekatan A: Via OpenClaw Hooks (Recommended)**

Konfigurasi hook mapping di `openclaw.json`:
```json
{
  "hooks": {
    "enabled": true,
    "token": "your-secret-token-here",
    "mappings": [
      {
        "match": { "source": "whatsapp-inbound" },
        "action": "forward",
        "target": "http://localhost:8787/api/webhook/openclaw"
      }
    ]
  }
}
```

**Pendekatan B: Via Custom Skill**

Jika hook mapping tidak mendukung auto-forward, buat custom skill yang menggunakan `fetch()` untuk POST ke backend API setiap kali ada pesan masuk. Instruksi di SKILL.md:

```markdown
# WhatsApp Ticket Logger Skill

## Purpose
Forward all incoming WhatsApp group messages to the maintenance monitoring backend API.

## Behavior
- On every incoming group message, POST the message data to the backend webhook
- Do NOT generate any reply or response to the user
- Only perform the HTTP POST, nothing else

## Execution
For every incoming WhatsApp group message, run:

fetch("http://localhost:8787/api/webhook/openclaw", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    data: {
      message: { id: messageId, text: messageText, timestamp: timestamp, type: messageType },
      sender: { jid: senderJid, name: senderName, phone: senderPhone },
      group: { jid: groupJid, name: groupName },
      quotedMessage: quotedMessage || null
    }
  })
})
```

**Acceptance criteria:**
- [ ] `groupPolicy` di-set ke `"open"` → bot mendengar dari semua grup
- [ ] `ackReaction.group` di-set ke `"always"` → react 👀 ke semua pesan grup
- [ ] `ackReaction.direct` di-set ke `false` → tidak react di DM
- [ ] Bot TIDAK membalas pesan apapun (tidak ada auto-reply)
- [ ] Setiap pesan grup di-forward ke `POST /api/webhook/openclaw`
- [ ] Payload yang di-forward mengandung: message (id, text, timestamp, type), sender (jid, name), group (jid, name)

---

## STEP 6: Tracking Response Time Tim Maintenance
**File target: `apps/api/src/routes/webhook.ts` (tambahan)**

Selain mencatat laporan user, kita juga perlu mendeteksi ketika anggota tim maintenance merespon di WhatsApp agar bisa menghitung Response Time.

**Logikanya:**
- Sistem sudah tahu siapa saja anggota tim maintenance (dari tabel `users` dengan `role = 'maintenance'`)
- Ketika ada pesan masuk dari JID yang terdaftar sebagai tim maintenance
- DAN pesan tersebut adalah reply (quoted message) ke pesan yang sudah tercatat sebagai tiket
- → Update `first_response_at` di tiket tersebut (jika belum terisi)

Tambahkan logic ini di dalam handler webhook yang sama:

```typescript
// Tambahkan di dalam webhook.post("/openclaw") SEBELUM klasifikasi Gemini

// ── CHECK: Apakah ini respons dari tim maintenance? ──
const isTeamMember = await db.select()
  .from(users)
  .where(eq(users.whatsappJid, senderJid))
  .limit(1);

if (isTeamMember.length > 0 && payload?.data?.quotedMessage?.id) {
  // Cari tiket yang terkait dengan pesan yang di-reply
  const relatedTicket = await db.select()
    .from(tickets)
    .where(eq(tickets.whatsappMessageId, payload.data.quotedMessage.id))
    .limit(1);

  if (relatedTicket.length > 0 && !relatedTicket[0].firstResponseAt) {
    // Update first_response_at
    const responseTime = new Date();
    const reportedAt = new Date(relatedTicket[0].reportedAt);
    const diffMinutes = Math.round((responseTime.getTime() - reportedAt.getTime()) / 60000);
    
    // Cek SLA breach
    const slaBreached = diffMinutes > relatedTicket[0].slaResponseTargetMinutes;

    await db.update(tickets)
      .set({
        firstResponseAt: responseTime,
        slaResponseBreached: slaBreached,
        assignedTo: isTeamMember[0].id,
        status: "acknowledged",
      })
      .where(eq(tickets.id, relatedTicket[0].id));

    // Log pesan tim ke ticket_messages
    await db.insert(ticketMessages).values({
      ticketId: relatedTicket[0].id,
      senderJid,
      senderName,
      messageText,
      whatsappMessageId: messageId || null,
      isFromTeam: true,
      sentAt: receivedAt,
    });

    console.log(`[Webhook] 🔧 Team response recorded for ${relatedTicket[0].ticketNumber} | Response time: ${diffMinutes} min | SLA breached: ${slaBreached}`);

    return c.json({
      success: true,
      action: "team_response_recorded",
      ticketNumber: relatedTicket[0].ticketNumber,
      responseTimeMinutes: diffMinutes,
      slaBreached,
    });
  }
}

// ... lanjut ke klasifikasi Gemini seperti biasa
```

**Acceptance criteria:**
- [ ] Tabel `users` sudah berisi JID WhatsApp tim maintenance
- [ ] Jika pengirim = tim maintenance DAN dia reply ke pesan tiket → `first_response_at` terisi
- [ ] Response time dihitung dalam menit
- [ ] `sla_response_breached` otomatis di-set berdasarkan perbandingan dengan target
- [ ] Status tiket berubah dari `open` ke `acknowledged`
- [ ] Pesan tim tercatat di `ticket_messages` dengan `is_from_team = true`
- [ ] Tim yang merespon otomatis di-assign ke tiket (`assigned_to`)

---

## STEP 7: Seed Data Tim Maintenance
**Jalankan via migration atau manual SQL**

```sql
-- Masukkan data anggota tim maintenance
-- Ganti JID dan nama dengan data yang sebenarnya
INSERT INTO users (name, whatsapp_jid, phone, role, is_active) VALUES
('Ahmad', '6281234567890@s.whatsapp.net', '081234567890', 'maintenance', true),
('Budi', '6289876543210@s.whatsapp.net', '089876543210', 'maintenance', true),
('Dewi', '6281122334455@s.whatsapp.net', '081122334455', 'maintenance', true);

-- Masukkan PM sebagai admin
INSERT INTO users (name, whatsapp_jid, phone, role, is_active) VALUES
('Badr', '62XXXXXXXXXXX@s.whatsapp.net', '08XXXXXXXXXX', 'pm', true);
```

**Acceptance criteria:**
- [ ] Semua anggota tim maintenance terdaftar di tabel `users` dengan JID yang benar
- [ ] Format JID: `628xxx@s.whatsapp.net` (tanpa +, tanpa 0 di depan)
- [ ] Role `maintenance` untuk tim, `pm` untuk PM

---

## STEP 8: Gemini Rate Limit Handling
**File target: `apps/api/src/services/gemini-classifier.ts` (tambahan)**

Gemini free tier punya limit ~1000 RPD untuk Flash. Untuk menghindari rate limit:

```typescript
// Tambahkan di gemini-classifier.ts

// Simple in-memory rate limiter
let requestCount = 0;
let resetTime = Date.now() + 60000; // Reset tiap menit
const MAX_RPM = 14; // Gemini free tier: ~15 RPM, beri buffer

async function rateLimitedClassify(
  messageText: string,
  senderName: string,
  groupName: string
): Promise<ClassificationResult> {
  const now = Date.now();
  if (now > resetTime) {
    requestCount = 0;
    resetTime = now + 60000;
  }

  if (requestCount >= MAX_RPM) {
    console.warn("[Gemini] Rate limit reached, using keyword fallback");
    return keywordFallbackClassify(messageText);
  }

  requestCount++;
  return classifyMessage(messageText, senderName, groupName);
}

// Keyword fallback jika Gemini rate-limited
function keywordFallbackClassify(text: string): ClassificationResult {
  const lower = text.toLowerCase();
  const reportKeywords = [
    "error", "gagal", "tidak bisa", "down", "mati", "crash", 
    "bug", "masalah", "gangguan", "lambat", "timeout", "500", 
    "502", "503", "404", "loading", "stuck", "hang", "blank",
    "tidak berfungsi", "tidak jalan", "bermasalah", "rusak",
    "tidak muncul", "hilang", "salah"
  ];

  const isReport = reportKeywords.some(kw => lower.includes(kw));

  if (!isReport) {
    return { isReport: false, category: "other", priority: "low", subject: "", description: "", confidence: 0.3 };
  }

  // Determine priority dari keywords
  let priority: "critical" | "high" | "medium" | "low" = "medium";
  if (lower.includes("down") || lower.includes("mati") || lower.includes("tidak bisa diakses")) {
    priority = "critical";
  } else if (lower.includes("error") || lower.includes("gagal") || lower.includes("crash")) {
    priority = "high";
  }

  return {
    isReport: true,
    category: "other",
    priority,
    subject: text.substring(0, 100),
    description: text,
    confidence: 0.5,  // Lower confidence karena keyword-based
  };
}

// Export ini sebagai pengganti classifyMessage di webhook
export { rateLimitedClassify };
```

**Acceptance criteria:**
- [ ] Rate limiter membatasi maks ~14 request/menit ke Gemini
- [ ] Jika rate limit tercapai, fallback ke keyword-based classification
- [ ] Keyword fallback tetap bisa mendeteksi laporan dasar (error, down, gagal, dll)
- [ ] Confidence di-set lebih rendah (0.5) untuk fallback agar bisa dibedakan di dashboard

---

## Verification Plan

### Test 1: Laporan Masalah (Harus Jadi Tiket)
Kirim pesan ini ke salah satu grup WhatsApp yang bot sudah di-add:

```
Aplikasi SMILE tidak bisa login sejak jam 9 pagi. Muncul error "500 Internal Server Error". Semua user di kantor saya mengalami hal yang sama.
```

**Expected:**
- [ ] Bot react 👀
- [ ] Bot TIDAK membalas
- [ ] Di database `message_logs`: ada record baru dengan `is_report = true`
- [ ] Di database `tickets`: ada tiket baru dengan priority `high` atau `critical`, category `login_issue` atau `system_down`
- [ ] Di dashboard: tiket muncul di list

### Test 2: Chat Biasa (TIDAK Boleh Jadi Tiket)
```
Halo selamat siang, apa kabar semua?
```

**Expected:**
- [ ] Bot react 👀
- [ ] Bot TIDAK membalas
- [ ] Di database `message_logs`: ada record dengan `is_report = false`
- [ ] Di database `tickets`: TIDAK ada tiket baru
- [ ] Console log: "Non-report message from ..."

### Test 3: Pesan Ambigu (Harusnya Tetap Tercatat)
```
Kok datanya beda ya sama yang kemarin? Aneh.
```

**Expected:**
- [ ] Gemini harusnya klasifikasi sebagai laporan (isReport = true) dengan confidence rendah (~0.5-0.7)
- [ ] Tiket terbuat dengan priority `low` atau `medium`, category `data_issue`

### Test 4: Response Tim Maintenance
Setelah Test 1 berhasil buat tiket, minta anggota tim maintenance reply pesan tersebut:
```
(reply ke pesan error) Baik mas, saya cek dulu servernya.
```

**Expected:**
- [ ] Tiket yang terkait: `first_response_at` terisi
- [ ] `status` berubah ke `acknowledged`
- [ ] `assigned_to` terisi dengan ID anggota tim yang merespon
- [ ] Response time terhitung dalam menit

### Test 5: Deduplikasi
Restart OpenClaw dan pastikan pesan yang sudah diproses sebelumnya tidak diproses ulang (karena OpenClaw mungkin re-send saat reconnect).

**Expected:**
- [ ] Pesan dengan `whatsapp_message_id` yang sama → return "skipped, duplicate"
- [ ] Tidak ada tiket duplikat

### Test 6: Gemini Down/Rate Limited
Matikan `GEMINI_API_KEY` (set ke string kosong) dan kirim pesan laporan:
```
Server down total, semua error 503
```

**Expected:**
- [ ] Webhook TIDAK crash (return 200)
- [ ] Fallback keyword classifier mendeteksi sebagai laporan
- [ ] Tiket tetap terbuat dengan confidence rendah (0.5)

---

## Catatan untuk AI Code Generator

1. **Jangan generate auto-reply code** — bot ini SILENT, hanya mencatat. Tidak ada `sendMessage()` atau reply ke WhatsApp dari backend.
2. **Sesuaikan payload parsing** — struktur payload OpenClaw mungkin berbeda dari interface di atas. Prioritaskan `console.log` payload mentah dulu, baru sesuaikan parsing.
3. **Gunakan `@google/genai`** bukan `@google/generative-ai` (itu SDK lama) — package yang benar: `@google/genai` versi terbaru.
4. **Model**: Gunakan `gemini-2.5-flash` (free tier, cukup cepat untuk klasifikasi).
5. **Timezone**: Semua timestamp di-store sebagai UTC di database. Konversi ke WIB (UTC+7) hanya di frontend/dashboard.
6. **Error = 200**: Webhook harus selalu return HTTP 200, bahkan saat error. Ini mencegah OpenClaw retry loop yang bisa spam server.
7. **Drizzle syntax**: Sesuaikan `db.insert().values()` dan `db.select().where()` dengan versi Drizzle yang terinstall di project.
