import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { webhookRoutes } from './routes/webhook';
import { ticketRoutes } from './routes/tickets';
import { dashboardRoutes } from './routes/dashboard';
import { userRoutes } from './routes/users';
import { settingsRoutes } from './routes/settings';
import { startJobs } from './lib/jobs';
import { upgradeWebSocket, websocket } from './lib/websocket';

startJobs();

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// WebSocket Route
app.get(
    '/ws',
    upgradeWebSocket((_c) => {
        return {
            onMessage(event, _ws) {
                console.log(`WS Message: ${event.data}`);
            },
        };
    })
);

// Routes
app.route('/api/webhook', webhookRoutes);
app.route('/api/tickets', ticketRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/users', userRoutes);
app.route('/api/settings', settingsRoutes);

// Error Handling
app.onError((err, c) => {
    console.error(`${err}`);
    return c.json({
        success: false,
        message: err.message || 'Internal Server Error'
    }, 500);
});

// Root route
app.get('/', (c) => {
    return c.json({
        success: true,
        message: 'Maintenance Monitor API is running'
    });
});

export default {
    port: 8787,
    fetch: app.fetch,
    websocket,
};
