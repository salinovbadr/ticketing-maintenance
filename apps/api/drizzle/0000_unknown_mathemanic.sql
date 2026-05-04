CREATE TYPE "public"."ticket_category" AS ENUM('login_issue', 'system_down', 'bug', 'performance', 'data_issue', 'feature_request', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'acknowledged', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."uptime_status" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'pm', 'maintenance');--> statement-breakpoint
CREATE TABLE "downtime_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_name" varchar(100) DEFAULT 'main_app' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_minutes" integer,
	"root_cause" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sla_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"priority" "ticket_priority" NOT NULL,
	"response_target_minutes" integer NOT NULL,
	"response_max_minutes" integer NOT NULL,
	"resolution_target_minutes" integer NOT NULL,
	"resolution_max_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sla_configs_priority_unique" UNIQUE("priority")
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"sender_jid" varchar(50) NOT NULL,
	"sender_name" varchar(100) NOT NULL,
	"message_text" text NOT NULL,
	"whatsapp_message_id" varchar(100),
	"is_from_team" boolean DEFAULT false,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_number" varchar(20) NOT NULL,
	"whatsapp_message_id" varchar(100),
	"reporter_name" varchar(100) NOT NULL,
	"reporter_jid" varchar(50) NOT NULL,
	"group_jid" varchar(50),
	"group_name" varchar(200),
	"subject" varchar(300) NOT NULL,
	"description" text NOT NULL,
	"category" "ticket_category" DEFAULT 'other',
	"priority" "ticket_priority" DEFAULT 'medium',
	"status" "ticket_status" DEFAULT 'open',
	"assigned_to" integer,
	"reported_at" timestamp with time zone NOT NULL,
	"first_response_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"sla_response_target_minutes" integer DEFAULT 120 NOT NULL,
	"sla_resolution_target_minutes" integer DEFAULT 1440 NOT NULL,
	"sla_response_breached" boolean DEFAULT false,
	"sla_resolution_breached" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "uptime_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_name" varchar(100) DEFAULT 'main_app' NOT NULL,
	"status" "uptime_status" NOT NULL,
	"response_time_ms" integer,
	"status_code" integer,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"whatsapp_jid" varchar(50) NOT NULL,
	"phone" varchar(20),
	"role" "user_role" DEFAULT 'maintenance',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_whatsapp_jid_unique" UNIQUE("whatsapp_jid")
);
--> statement-breakpoint
CREATE INDEX "idx_downtime_incidents_service_started" ON "downtime_incidents" USING btree ("service_name","started_at");--> statement-breakpoint
CREATE INDEX "idx_ticket_messages_ticket_id" ON "ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_messages_sent_at" ON "ticket_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_tickets_status" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tickets_reported_at" ON "tickets" USING btree ("reported_at");--> statement-breakpoint
CREATE INDEX "idx_tickets_priority" ON "tickets" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_tickets_assigned_to" ON "tickets" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_uptime_logs_service_checked" ON "uptime_logs" USING btree ("service_name","checked_at");--> statement-breakpoint
CREATE INDEX "idx_uptime_logs_status" ON "uptime_logs" USING btree ("status");