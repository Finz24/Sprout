DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sprout_schema_owner') THEN
    EXECUTE 'CREATE ROLE sprout_schema_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sprout_resolver') THEN
    EXECUTE 'CREATE ROLE sprout_resolver NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sprout_web') THEN
    EXECUTE 'CREATE ROLE sprout_web NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sprout_maintenance') THEN
    EXECUTE 'CREATE ROLE sprout_maintenance NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sprout_auth') THEN
    EXECUTE 'CREATE ROLE sprout_auth NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sprout_api') THEN
    EXECUTE 'CREATE ROLE sprout_api NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sprout_worker') THEN
    EXECUTE 'CREATE ROLE sprout_worker NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE';
  END IF;
END
$roles$;
GRANT sprout_schema_owner TO sprout_maintenance WITH INHERIT FALSE, SET TRUE;
GRANT sprout_web TO sprout_api WITH INHERIT FALSE, SET TRUE;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA auth AUTHORIZATION sprout_schema_owner;
CREATE SCHEMA private AUTHORIZATION sprout_schema_owner;
SET LOCAL ROLE sprout_schema_owner;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"scope" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_provider_identity" UNIQUE("provider_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "private"."owner_settings" (
	"owner_user_id" text PRIMARY KEY NOT NULL,
	"library_view" text DEFAULT 'grid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_view" CHECK ("private"."owner_settings"."library_view" in ('grid', 'list'))
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "normalized_email" CHECK ("auth"."user"."email" = lower(btrim("auth"."user"."email")))
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."owner_settings" ADD CONSTRAINT "owner_settings_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");
--> statement-breakpoint
ALTER TABLE private.owner_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.owner_settings FORCE ROW LEVEL SECURITY;
CREATE FUNCTION private.current_owner_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT s.user_id FROM auth.session AS s
  WHERE s.token = NULLIF(current_setting('sprout.session_token', true), '')
    AND length(current_setting('sprout.session_token', true)) BETWEEN 1 AND 256
    AND s.expires_at > statement_timestamp()
$$;
REVOKE ALL ON FUNCTION private.current_owner_id() FROM PUBLIC;
CREATE POLICY owner_settings_read ON private.owner_settings FOR SELECT TO sprout_web
  USING (owner_user_id = private.current_owner_id());
CREATE POLICY owner_settings_update ON private.owner_settings FOR UPDATE TO sprout_web
  USING (owner_user_id = private.current_owner_id())
  WITH CHECK (owner_user_id = private.current_owner_id());
CREATE POLICY maintenance_read ON private.owner_settings FOR SELECT TO sprout_maintenance USING (true);
CREATE POLICY maintenance_insert ON private.owner_settings FOR INSERT TO sprout_maintenance WITH CHECK (true);
GRANT USAGE ON SCHEMA auth TO sprout_auth, sprout_maintenance, sprout_resolver;
GRANT SELECT ON auth."user", auth.account TO sprout_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.session TO sprout_auth;
GRANT SELECT (token, user_id, expires_at) ON auth.session TO sprout_resolver;
GRANT USAGE ON SCHEMA private TO sprout_web, sprout_maintenance;
GRANT SELECT ON private.owner_settings TO sprout_web;
GRANT UPDATE (library_view, updated_at) ON private.owner_settings TO sprout_web;
GRANT EXECUTE ON FUNCTION private.current_owner_id() TO sprout_web;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO sprout_maintenance;
GRANT SELECT, INSERT ON private.owner_settings TO sprout_maintenance;
GRANT INSERT ON auth."user", auth.account TO sprout_maintenance;
RESET ROLE;
ALTER FUNCTION private.current_owner_id() OWNER TO sprout_resolver;
GRANT USAGE ON SCHEMA drizzle TO sprout_api, sprout_worker;
GRANT SELECT ON drizzle.__drizzle_migrations TO sprout_api, sprout_worker;
