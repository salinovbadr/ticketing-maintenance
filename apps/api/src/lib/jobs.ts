import { db } from '../db';
import { tickets, uptimeLogs } from '../db/schema';
import { eq, and, sql, lt } from 'drizzle-orm';

export async function checkSLABreaches() {
    console.log('[Job] Checking SLA Breaches...');
    const now = new Date();

    // 1. Check Response Breach
    const responseBreaches = await (db as any).update(tickets)
        .set({ slaResponseBreached: true })
        .where(and(
            eq(tickets.status, 'open'),
            eq(tickets.slaResponseBreached, false),
            sql`reported_at + (sla_response_target_minutes || ' minutes')::interval < ${now}`
        ));

    // 2. Check Resolution Breach
    const resolutionBreaches = await (db as any).update(tickets)
        .set({ slaResolutionBreached: true })
        .where(and(
            sql`status != 'resolved' AND status != 'closed'`,
            eq(tickets.slaResolutionBreached, false),
            sql`reported_at + (sla_resolution_target_minutes || ' minutes')::interval < ${now}`
        ));

    console.log('[Job] SLA Check complete.');
}

export async function syncUptime() {
    console.log('[Job] Syncing Uptime...');
    const apiKey = process.env.UPTIMEROBOT_API_KEY;

    if (!apiKey || apiKey === '...') {
        console.log('[Job] UptimeRobot API Key not set, using simulation.');
        const status = Math.random() > 0.05 ? 'up' : 'down';
        const responseTime = status === 'up' ? Math.floor(Math.random() * 200) + 50 : null;

        await (db as any).insert(uptimeLogs).values({
            serviceName: 'main_app',
            status,
            responseTimeMs: responseTime,
            statusCode: status === 'up' ? 200 : 500,
            checkedAt: new Date(),
        });
        return;
    }

    try {
        const response = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `api_key=${apiKey}&format=json`
        });

        const data: any = await response.json();
        if (data.stat === 'ok' && data.monitors?.length > 0) {
            const monitor = data.monitors[0]; // Get the first monitor
            // UptimeRobot Statuses: 2 = Up, 9 = Down
            const status = monitor.status === 2 ? 'up' : 'down';

            await (db as any).insert(uptimeLogs).values({
                serviceName: monitor.friendly_name || 'main_app',
                status,
                responseTimeMs: monitor.average_response_time ? parseFloat(monitor.average_response_time) : null,
                statusCode: status === 'up' ? 200 : 500,
                checkedAt: new Date(),
            });
        }
    } catch (error) {
        console.error('[Job] UptimeRobot Error:', error);
    }

    console.log('[Job] Uptime sync complete.');
}

export function startJobs() {
    // Run every 5 minutes
    setInterval(checkSLABreaches, 5 * 60 * 1000);
    // Run every 10 minutes
    setInterval(syncUptime, 10 * 60 * 1000);

    // Initial run
    checkSLABreaches();
    syncUptime();
}
