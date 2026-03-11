import { mysqlTable, varchar, int, boolean, timestamp, text, mysqlEnum, index } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

export const users = mysqlTable('users', {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 100 }).notNull(),
    whatsappJid: varchar('whatsapp_jid', { length: 50 }).notNull().unique(),
    phone: varchar('phone', { length: 20 }),
    role: mysqlEnum('role', ['admin', 'pm', 'maintenance']).default('maintenance'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow()
});

export const tickets = mysqlTable('tickets', {
    id: int('id').primaryKey().autoincrement(),
    ticketNumber: varchar('ticket_number', { length: 20 }).notNull().unique(),
    whatsappMessageId: varchar('whatsapp_message_id', { length: 100 }),
    reporterName: varchar('reporter_name', { length: 100 }).notNull(),
    reporterJid: varchar('reporter_jid', { length: 50 }).notNull(),
    groupJid: varchar('group_jid', { length: 50 }),
    groupName: varchar('group_name', { length: 200 }),

    subject: varchar('subject', { length: 300 }).notNull(),
    description: text('description').notNull(),
    category: mysqlEnum('category', ['login_issue', 'system_down', 'bug', 'performance', 'data_issue', 'feature_request', 'other']).default('other'),
    priority: mysqlEnum('priority', ['critical', 'high', 'medium', 'low']).default('medium'),

    status: mysqlEnum('status', ['open', 'acknowledged', 'in_progress', 'resolved', 'closed']).default('open'),
    assignedTo: int('assigned_to'),

    reportedAt: timestamp('reported_at').notNull(),
    firstResponseAt: timestamp('first_response_at'),
    resolvedAt: timestamp('resolved_at'),
    closedAt: timestamp('closed_at'),

    slaResponseTargetMinutes: int('sla_response_target_minutes').notNull().default(120),
    slaResolutionTargetMinutes: int('sla_resolution_target_minutes').notNull().default(1440),
    slaResponseBreached: boolean('sla_response_breached').default(false),
    slaResolutionBreached: boolean('sla_resolution_breached').default(false),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow()
}, (table) => {
    return {
        statusIdx: index("idx_status").on(table.status),
        reportedAtIdx: index("idx_reported_at").on(table.reportedAt),
        priorityIdx: index("idx_priority").on(table.priority),
        assignedToIdx: index("idx_assigned_to").on(table.assignedTo),
    };
});

export const ticketMessages = mysqlTable('ticket_messages', {
    id: int('id').primaryKey().autoincrement(),
    ticketId: int('ticket_id').notNull(),
    senderJid: varchar('sender_jid', { length: 50 }).notNull(),
    senderName: varchar('sender_name', { length: 100 }).notNull(),
    messageText: text('message_text').notNull(),
    whatsappMessageId: varchar('whatsapp_message_id', { length: 100 }),
    isFromTeam: boolean('is_from_team').default(false),
    sentAt: timestamp('sent_at').notNull(),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => {
    return {
        ticketIdIdx: index("idx_ticket_id").on(table.ticketId),
        sentAtIdx: index("idx_sent_at").on(table.sentAt),
    };
});

export const uptimeLogs = mysqlTable('uptime_logs', {
    id: int('id').primaryKey().autoincrement(),
    serviceName: varchar('service_name', { length: 100 }).notNull().default('main_app'),
    status: mysqlEnum('status', ['up', 'down']).notNull(),
    responseTimeMs: int('response_time_ms'),
    statusCode: int('status_code'),
    checkedAt: timestamp('checked_at').notNull()
}, (table) => {
    return {
        serviceCheckedIdx: index("idx_service_checked").on(table.serviceName, table.checkedAt),
        statusIdx: index("idx_status").on(table.status),
    };
});

export const downtimeIncidents = mysqlTable('downtime_incidents', {
    id: int('id').primaryKey().autoincrement(),
    serviceName: varchar('service_name', { length: 100 }).notNull().default('main_app'),
    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at'),
    durationMinutes: int('duration_minutes'),
    rootCause: text('root_cause'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow()
}, (table) => {
    return {
        serviceStartedIdx: index("idx_service_started").on(table.serviceName, table.startedAt),
    };
});

export const slaConfigs = mysqlTable('sla_configs', {
    id: int('id').primaryKey().autoincrement(),
    priority: mysqlEnum('priority', ['critical', 'high', 'medium', 'low']).notNull().unique(),
    responseTargetMinutes: int('response_target_minutes').notNull(),
    responseMaxMinutes: int('response_max_minutes').notNull(),
    resolutionTargetMinutes: int('resolution_target_minutes').notNull(),
    resolutionMaxMinutes: int('resolution_max_minutes').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow()
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
