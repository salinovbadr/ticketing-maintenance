"use client";

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8787/ws';

export function useRealtime() {
    const queryClient = useQueryClient();

    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const { type, payload } = JSON.parse(event.data);
            console.log('WS Event:', type, payload);

            switch (type) {
                case 'TICKET_CREATED':
                    queryClient.invalidateQueries({ queryKey: ['tickets'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
                    toast.info(`New Ticket: ${payload.ticketNumber}`, {
                        description: `Priority: ${payload.priority}`,
                    });
                    break;
                case 'TICKET_UPDATED':
                    queryClient.invalidateQueries({ queryKey: ['tickets'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
                    toast.success(`Ticket Updated`, {
                        description: `Status: ${payload.status}`,
                    });
                    break;
                case 'MESSAGE_CREATED':
                    queryClient.invalidateQueries({ queryKey: ['tickets', payload.ticketId] });
                    if (payload.isFromTeam) {
                        toast.success(`New Message from ${payload.senderName}`);
                    } else {
                        toast.info(`New Client Message`);
                    }
                    break;
                default:
                    console.log('Unknown WS event type:', type);
            }
        } catch (error) {
            console.error('Error parsing WS message:', error);
        }
    }, [queryClient]);

    useEffect(() => {
        let socket: WebSocket;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            socket = new WebSocket(WS_URL);

            socket.onopen = () => {
                console.log('Connected to WebSocket');
            };

            socket.onmessage = handleMessage;

            socket.onclose = () => {
                console.log('WebSocket disconnected, reconnecting...');
                reconnectTimeout = setTimeout(connect, 3000);
            };

            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                socket.close();
            };
        };

        connect();

        return () => {
            if (socket) socket.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, [handleMessage]);
}
