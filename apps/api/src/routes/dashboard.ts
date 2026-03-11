import { Hono } from 'hono';
import { db } from '../db';
import { tickets, uptimeLogs, users } from '../db/schema';
import { eq, sql, gte, desc } from 'drizzle-orm';

const dashboardRoutes = new Hono();

dashboardRoutes.get('/stats', async (c) => {
    const [counts] = await (db as any).select({
        total: sql`count(*)`,
        open: sql`count(case when status = 'open' then 1 end)`,
        resolved: sql`count(case when status = 'resolved' then 1 end)`,
        slaBreached: sql`count(case when sla_response_breached = 1 or sla_resolution_breached = 1 then 1 end)`,
    }).from(tickets);

    return c.json({ success: true, data: counts });
});

dashboardRoutes.get('/uptime', async (c) => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const logs = await (db as any).select()
        .from(uptimeLogs)
        .where(gte(uptimeLogs.checkedAt, twentyFourHoursAgo))
        .orderBy(sql`checked_at asc`);

    const total = logs.length;
    const up = logs.filter((l: any) => l.status === 'up').length;
    const percentage = total > 0 ? (up / total) * 100 : 100;

    // 30-day overview for heatmap
    const dailyStats = await (db as any).select({
        day: sql`DATE(checked_at)`,
        upPercent: sql`count(case when status = 'up' then 1 end) / count(*) * 100`,
    }).from(uptimeLogs)
        .where(gte(uptimeLogs.checkedAt, thirtyDaysAgo))
        .groupBy(sql`DATE(checked_at)`)
        .orderBy(sql`DATE(checked_at)`);

    return c.json({
        success: true,
        data: {
            percentage: percentage.toFixed(2),
            logs,
            dailyStats
        }
    });
});

dashboardRoutes.get('/categories', async (c) => {
    const result = await (db as any).select({
        category: tickets.category,
        count: sql`count(*)`,
    }).from(tickets)
        .groupBy(tickets.category);

    return c.json({ success: true, data: result });
});

dashboardRoutes.get('/tickets-by-hour', async (c) => {
    const result = await (db as any).select({
        hour: sql`hour(reported_at)`,
        count: sql`count(*)`,
    }).from(tickets)
        .where(sql`reported_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`)
        .groupBy(sql`hour(reported_at)`)
        .orderBy(sql`hour(reported_at)`);

    return c.json({ success: true, data: result });
});

dashboardRoutes.get('/team-performance', async (c) => {
    const result = await (db as any).select({
        name: users.name,
        resolved: sql`count(*)`,
        avgResponseMinutes: sql`avg(timestampdiff(MINUTE, reported_at, first_response_at))`,
    }).from(tickets)
        .innerJoin(users, eq(tickets.assignedTo, users.id))
        .where(eq(tickets.status, 'resolved'))
        .groupBy(users.name);

    return c.json({ success: true, data: result });
});

export { dashboardRoutes };
