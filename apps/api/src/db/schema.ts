import { pgTable, varchar, integer, boolean, timestamp, text, pgEnum, index, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'pm', 'maintenance']);
export const ticketCategoryEnum = pgEnum('ticket_category', ['login_issue', 'system_down', 'bug', 'performance', 'data_issue', 'feature_request', 'other']);
export const ticketPriorityEnum = pgEnum('ticket_priority', ['critical', 'high', 'medium', 'low']);
export const ticketStatusEnum = pgEnum('ticket_status', ['open', 'acknowledged', 'in_progress', 'resolved', 'closed']);
export const uptimeStatusEnum = pgEnum('uptime_status', ['up', 'down']);

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    whatsappJid: varchar('whatsapp_jid', { length: 50 }).notNull().unique(),
    phone: varchar('phone', { length: 20 }),
    role: userRoleEnum('role').default('maintenance'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

export const tickets = pgTable('tickets', {
    id: serial('id').primaryKey(),
    ticketNumber: varchar('ticket_number', { length: 20 }).notNull().unique(),
    whatsappMessageId: varchar('whatsapp_message_id', { length: 100 }),
    reporterName: varchar('reporter_name', { length: 100 }).notNull(),
    reporterJid: varchar('reporter_jid', { length: 50 }).notNull(),
    groupJid: varchar('group_jid', { length: 50 }),
    groupName: varchar('group_name', { length: 200 }),

    subject: varchar('subject', { length: 300 }).notNull(),
    description: text('description').notNull(),
    category: ticketCategoryEnum('category').default('other'),
    priority: ticketPriorityEnum('priority').default('medium'),

    status: ticketStatusEnum('status').default('open'),
    assignedTo: integer('assigned_to'),

    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),

    slaResponseTargetMinutes: integer('sla_response_target_minutes').notNull().default(120),
    slaResolutionTargetMinutes: integer('sla_resolution_target_minutes').notNull().default(1440),
    slaResponseBreached: boolean('sla_response_breached').default(false),
    slaResolutionBreached: boolean('sla_resolution_breached').default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => {
    return {
        statusIdx: index("idx_tickets_status").on(table.status),
        reportedAtIdx: index("idx_tickets_reported_at").on(table.reportedAt),
        priorityIdx: index("idx_tickets_priority").on(table.priority),
        assignedToIdx: index("idx_tickets_assigned_to").on(table.assignedTo),
    };
});

export const ticketMessages = pgTable('ticket_messages', {
    id: serial('id').primaryKey(),
    ticketId: integer('ticket_id').notNull(),
    senderJid: varchar('sender_jid', { length: 50 }).notNull(),
    senderName: varchar('sender_name', { length: 100 }).notNull(),
    messageText: text('message_text').notNull(),
    whatsappMessageId: varchar('whatsapp_message_id', { length: 100 }),
    isFromTeam: boolean('is_from_team').default(false),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => {
    return {
        ticketIdIdx: index("idx_ticket_messages_ticket_id").on(table.ticketId),
        sentAtIdx: index("idx_ticket_messages_sent_at").on(table.sentAt),
    };
});

export const uptimeLogs = pgTable('uptime_logs', {
    id: serial('id').primaryKey(),
    serviceName: varchar('service_name', { length: 100 }).notNull().default('main_app'),
    status: uptimeStatusEnum('status').notNull(),
    responseTimeMs: integer('response_time_ms'),
    statusCode: integer('status_code'),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull()
}, (table) => {
    return {
        serviceCheckedIdx: index("idx_uptime_logs_service_checked").on(table.serviceName, table.checkedAt),
        statusIdx: index("idx_uptime_logs_status").on(table.status),
    };
});

export const downtimeIncidents = pgTable('downtime_incidents', {
    id: serial('id').primaryKey(),
    serviceName: varchar('service_name', { length: 100 }).notNull().default('main_app'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationMinutes: integer('duration_minutes'),
    rootCause: text('root_cause'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => {
    return {
        serviceStartedIdx: index("idx_downtime_incidents_service_started").on(table.serviceName, table.startedAt),
    };
});

export const slaConfigs = pgTable('sla_configs', {
    id: serial('id').primaryKey(),
    priority: ticketPriorityEnum('priority').notNull().unique(),
    responseTargetMinutes: integer('response_target_minutes').notNull(),
    responseMaxMinutes: integer('response_max_minutes').notNull(),
    resolutionTargetMinutes: integer('resolution_target_minutes').notNull(),
    resolutionMaxMinutes: integer('resolution_max_minutes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

export const usersRelations = relations(users, ({ many }) => ({
    tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
    assignee: one(users, {
        fields: [tickets.assignedTo],
        references: [users.id],
    }),
    messages: many(ticketMessages),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
    ticket: one(tickets, {
        fields: [ticketMessages.ticketId],
        references: [tickets.id],
    }),
}));
