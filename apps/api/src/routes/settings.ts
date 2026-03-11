import { Hono } from 'hono';
import { db } from '../db';
import { slaConfigs } from '../db/schema';
import { eq } from 'drizzle-orm';

export const settingsRoutes = new Hono();

// Get SLA configurations
settingsRoutes.get('/sla', async (c) => {
    const result = await db.select().from(slaConfigs);
    return c.json({
        success: true,
        data: result
    });
});

// Update SLA configuration
settingsRoutes.patch('/sla/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    await db.update(slaConfigs)
        .set({
            responseTargetMinutes: body.responseTargetMinutes,
            responseMaxMinutes: body.responseMaxMinutes,
            resolutionTargetMinutes: body.resolutionTargetMinutes,
            resolutionMaxMinutes: body.resolutionMaxMinutes
        })
        .where(eq(slaConfigs.id, id));

    return c.json({
        success: true,
        message: 'SLA configuration updated'
    });
});
