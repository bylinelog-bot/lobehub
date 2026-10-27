CREATE TABLE IF NOT EXISTS "task_number_namespaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"workspace_id" text,
	"prefix" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_number_namespaces_owner_check" CHECK (("task_number_namespaces"."user_id" IS NULL) <> ("task_number_namespaces"."workspace_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "namespace_id" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "namespace_id" uuid;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "default_namespace_id" uuid;
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "default_namespace_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.task_number_namespaces'::regclass AND conname = 'task_number_namespaces_user_id_users_id_fk') THEN
ALTER TABLE "task_number_namespaces" ADD CONSTRAINT "task_number_namespaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.task_number_namespaces'::regclass AND conname = 'task_number_namespaces_workspace_id_workspaces_id_fk') THEN
ALTER TABLE "task_number_namespaces" ADD CONSTRAINT "task_number_namespaces_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_number_namespaces_user_prefix_unique" ON "task_number_namespaces" USING btree ("user_id","prefix") WHERE "task_number_namespaces"."user_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_number_namespaces_workspace_prefix_unique" ON "task_number_namespaces" USING btree ("workspace_id","prefix") WHERE "task_number_namespaces"."workspace_id" is not null;
--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.projects'::regclass AND conname = 'projects_namespace_id_task_number_namespaces_id_fk') THEN
ALTER TABLE "projects" ADD CONSTRAINT "projects_namespace_id_task_number_namespaces_id_fk" FOREIGN KEY ("namespace_id") REFERENCES "public"."task_number_namespaces"("id") ON DELETE no action ON UPDATE no action NOT VALID;
END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.tasks'::regclass AND conname = 'tasks_namespace_id_task_number_namespaces_id_fk') THEN
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_namespace_id_task_number_namespaces_id_fk" FOREIGN KEY ("namespace_id") REFERENCES "public"."task_number_namespaces"("id") ON DELETE no action ON UPDATE no action NOT VALID;
END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND conname = 'users_default_namespace_id_task_number_namespaces_id_fk') THEN
ALTER TABLE "users" ADD CONSTRAINT "users_default_namespace_id_task_number_namespaces_id_fk" FOREIGN KEY ("default_namespace_id") REFERENCES "public"."task_number_namespaces"("id") ON DELETE no action ON UPDATE no action NOT VALID;
END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.workspaces'::regclass AND conname = 'workspaces_default_namespace_id_task_number_namespaces_id_fk') THEN
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_default_namespace_id_task_number_namespaces_id_fk" FOREIGN KEY ("default_namespace_id") REFERENCES "public"."task_number_namespaces"("id") ON DELETE no action ON UPDATE no action NOT VALID;
END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_namespace_seq_unique" ON "tasks" USING btree ("namespace_id","seq") WHERE "tasks"."namespace_id" is not null;
