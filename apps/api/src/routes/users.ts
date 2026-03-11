import { Hono } from 'hono';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export const userRoutes = new Hono();

// Get current user (simulated as the first user for now)
userRoutes.get('/me', async (c) => {
    const result = await db.select().from(users).limit(1);
    return c.json({
        success: true,
        data: result[0] || null
    });
});

// Update user profile
userRoutes.patch('/me', async (c) => {
    const body = await c.req.json();
    const currentUser = await db.select().from(users).limit(1);

    if (currentUser.length === 0) {
        return c.json({ success: false, message: 'User not found' }, 404);
    }

    await db.update(users)
        .set({
            name: body.name,
            phone: body.phone,
            isActive: body.isActive
        })
        .where(eq(users.id, currentUser[0].id));

    return c.json({
        success: true,
        message: 'Profile updated'
    });
});
