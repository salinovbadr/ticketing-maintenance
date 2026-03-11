import { Hono } from 'hono';
import { db } from '../db';
import { tickets, users, ticketMessages } from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { broadcast } from '../lib/websocket';

const ticketRoutes = new Hono();

// 2.6 List Tickets
ticketRoutes.get('/', async (c) => {
    const status = c.req.query('status');
    const priority = c.req.query('priority');
    const search = c.req.query('search');

    const conditions = [];
    if (status) conditions.push(eq(tickets.status, status as any));
    if (priority) conditions.push(eq(tickets.priority, priority as any));
    if (search) {
        conditions.push(sql`(${tickets.subject} LIKE ${`%${search}%`} OR ${tickets.description} LIKE ${`%${search}%`})`);
    }

    const result = await (db as any).select().from(tickets)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(tickets.reportedAt));

    return c.json({ success: true, data: result });
});

// 2.7 Ticket Detail with Messages
ticketRoutes.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'));

    const [ticket]: any[] = await (db as any).select().from(tickets).where(eq(tickets.id, id)).limit(1);
    if (!ticket) return c.json({ success: false, message: 'Ticket not found' }, 404);

    const messages = await (db as any).select().from(ticketMessages)
        .where(eq(ticketMessages.ticketId, id))
        .orderBy(desc(ticketMessages.sentAt));

    return c.json({ success: true, data: { ...ticket, messages } });
});

// 2.8 Update Ticket
ticketRoutes.patch('/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    await (db as any).update(tickets).set({
        status: body.status,
        priority: body.priority,
        assignedTo: body.assignedTo,
        updatedAt: new Date(),
    }).where(eq(tickets.id, id));

    // Broadcast update
    broadcast('TICKET_UPDATED', { ticketId: id, status: body.status, assignedTo: body.assignedTo });

    return c.json({ success: true, message: 'Ticket updated' });
});

export { ticketRoutes };
