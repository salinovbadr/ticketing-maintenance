import { createBunWebSocket } from 'hono/bun';
import type { ServerWebSocket } from 'bun';

// Simple set to track all active connections for broadcasting
const clients = new Set<ServerWebSocket>();

export const { upgradeWebSocket, websocket } = createBunWebSocket({
    onOpen(_event, ws) {
        clients.add(ws.raw as ServerWebSocket);
        console.log('WS Connection opened');
    },
    onClose(_event, ws) {
        clients.delete(ws.raw as ServerWebSocket);
        console.log('WS Connection closed');
    },
});

/**
 * Broadcasts a message to all connected clients.
 * Used to trigger real-time updates in the frontend.
 */
export const broadcast = (type: string, data: any = {}) => {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    for (const client of clients) {
        try {
            client.send(message);
        } catch (err) {
            console.error('WS Broadcast error:', err);
            clients.delete(client);
        }
    }
};
