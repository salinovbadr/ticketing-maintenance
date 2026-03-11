/**
 * OpenClaw Log Monitor
 * 
 * Monitors the OpenClaw gateway log file for ALL inbound WhatsApp messages
 * and forwards them to the backend API for ticket creation.
 *
 * Works without requiring an AI session or mention —
 * ALL group messages are captured regardless of mention status.
 * The bot does NOT need to reply for this to work.
 *
 * Log format discovered from source:
 * {
 *   "1": { from, to, body, mediaType, mediaPath, ... },  // message data
 *   "2": "inbound web message",                           // type identifier
 *   "_meta": { date, ... }
 * }
 *
 * Run: bun run src/scripts/log-monitor.ts
 */

import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { join } from 'path';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8787/api/webhook/openclaw';
const LOG_DIR = '/tmp/openclaw';
const POLL_INTERVAL_MS = 1500;

function getTodayLogPath(): string {
    const today = new Date().toISOString().split('T')[0];
    return join(LOG_DIR, `openclaw-${today}.log`);
}

let lastPosition = 0;
let currentLogPath = getTodayLogPath();

async function getLogSize(path: string): Promise<number> {
    try {
        const info = await stat(path);
        return info.size;
    } catch {
        return 0;
    }
}

async function readNewLogContent(path: string): Promise<string> {
    const size = await getLogSize(path);
    if (size <= lastPosition) return '';

    const stream = createReadStream(path, {
        start: lastPosition,
        end: size - 1,
        encoding: 'utf-8',
    });

    const chunks: string[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk as string);
    }
    lastPosition = size;
    return chunks.join('');
}

async function forwardToBackend(payload: object): Promise<void> {
    try {
        const resp = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await resp.json();
        console.log(`[LogMonitor] ✅ Backend (${resp.status}):`, JSON.stringify(result));
    } catch (err: any) {
        console.error('[LogMonitor] ❌ Backend error:', err.message);
    }
}

/**
 * Parse the WhatsApp envelope body format:
 * "[WhatsApp GROUP_JID Wed 2026-03-11 11:13 GMT+7] Sender Name (+62xxx): message text"
 * Returns { senderName, senderJid, text } or null
 */
function parseEnvelopeBody(body: string): { senderName: string; senderJid: string; text: string } | null {
    // Match: "[WhatsApp ... ] SenderName (+62xxx): actual text"  
    const match = body.match(/^\[WhatsApp\s+[^\]]+\]\s+(.+?)\s+\((\+[\d]+)\):\s*(.+)$/s);
    if (match) {
        return {
            senderName: match[1].trim(),
            senderJid: `${match[2].replace(/\D/g, '')}@s.whatsapp.net`,
            text: match[3].trim(),
        };
    }
    // Fallback: no envelope, return body as-is
    return null;
}

/**
 * Parse a JSON log line. Returns a backend payload or null.
 */
function parseLogLine(line: string): object | null {
    if (!line.trim()) return null;

    let entry: any;
    try {
        entry = JSON.parse(line);
    } catch {
        return null;
    }

    // "inbound web message" entries have "2": "inbound web message"
    if (entry['2'] !== 'inbound web message') return null;

    const data = entry['1'];
    if (!data || !data.from) return null;

    const from: string = data.from || '';
    const to: string = data.to || '';
    const rawBody: string = data.body || '';
    const mediaType: string | null = data.mediaType || null;
    const mediaPath: string | null = data.mediaPath || null;

    // Determine if group or DM
    const isGroup = from.endsWith('@g.us');

    // Parse the envelope body to extract real sender + text
    const parsed = rawBody ? parseEnvelopeBody(rawBody) : null;

    let text = parsed?.text || rawBody;
    if (!text && mediaType) {
        text = `[Lampiran: ${mediaType}]`;
    }
    if (!text) return null;

    const senderName = parsed?.senderName || 'WhatsApp User';
    const senderJid = parsed?.senderJid || (isGroup ? 'unknown@s.whatsapp.net' : from);

    const payload = {
        message: { text },
        sender: {
            jid: senderJid,
            name: senderName,
        },
        group: isGroup ? {
            jid: from,
            name: null,
        } : null,
        message_id: data.correlationId || null,
        timestamp: entry['_meta']?.date ? new Date(entry['_meta'].date).getTime() : Date.now(),
        source: 'log-monitor',
    };

    return payload;
}

async function processNewLines(): Promise<void> {
    const todayLog = getTodayLogPath();
    if (todayLog !== currentLogPath) {
        console.log('[LogMonitor] 📅 New day — rolling log file to:', todayLog);
        currentLogPath = todayLog;
        lastPosition = 0;
    }

    const newContent = await readNewLogContent(currentLogPath);
    if (!newContent) return;

    const lines = newContent.split('\n');
    for (const line of lines) {
        const payload = parseLogLine(line);
        if (!payload) continue;

        const p = payload as any;
        const preview = (p.message?.text || '').slice(0, 80);
        console.log(`[LogMonitor] 📥 From: ${p.sender?.name} | Group: ${p.group?.jid || 'DM'} | "${preview}"`);
        await forwardToBackend(payload);
    }
}

async function main(): Promise<void> {
    console.log('[LogMonitor] 🚀 OpenClaw Log Monitor started');
    console.log(`[LogMonitor] 📂 Watching: ${currentLogPath}`);
    console.log(`[LogMonitor] 🌐 Forwarding to: ${BACKEND_URL}`);
    console.log(`[LogMonitor] ⏱️  Poll interval: ${POLL_INTERVAL_MS}ms\n`);

    // Start from current end of file (don't replay old messages)
    lastPosition = await getLogSize(currentLogPath);
    console.log(`[LogMonitor] ⏩ Starting from byte position: ${lastPosition}\n`);

    while (true) {
        await processNewLines();
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

main().catch(err => {
    console.error('[LogMonitor] Fatal:', err);
    process.exit(1);
});
