export type TicketStatus = 'open' | 'acknowledged' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Ticket {
    id: number;
    ticketNumber: string;
    subject: string;
    category: string;
    priority: TicketPriority;
    status: TicketStatus;
    reportedBy: string;
    assignedTo: number | null;
    reportedAt: string;
    acknowledgedAt: string | null;
    resolvedAt: string | null;
    slaResponseTargetMinutes: number;
    slaResolutionTargetMinutes: number;
    slaResponseBreached: boolean;
    slaResolutionBreached: boolean;
}

export interface TicketMessage {
    id: number;
    ticketId: number;
    senderName: string;
    senderNumber: string;
    messageText: string;
    isFromTeam: boolean;
    createdAt: string;
}

export interface TicketDetail extends Ticket {
    messages: TicketMessage[];
}

export interface DashboardStats {
    total: number;
    open: number;
    resolved: number;
    slaBreached: number;
}

export interface UptimeLog {
    id: number;
    serviceName: string;
    status: 'up' | 'down';
    responseTimeMs: number | null;
    statusCode: number | null;
    checkedAt: string;
}

export interface UptimeData {
    percentage: string;
    logs: UptimeLog[];
}
