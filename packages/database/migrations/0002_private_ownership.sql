-- Custom SQL migration file, put your code below! --
-- Never grant auth-table access to private operations or trust a supplied owner ID.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sprout_private') THEN
    CREATE ROLE sprout_private NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint
GRANT sprout_private TO CURRENT_USER;
--> statement-breakpoint
CREATE FUNCTION public.private_session_owner() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT "userId" FROM public.session
  WHERE token = nullif(current_setting('sprout.session_token', true), '')
    AND "expiresAt" > statement_timestamp()
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.private_session_owner() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.private_session_owner() TO sprout_private;
--> statement-breakpoint
ALTER TABLE workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY workspace_owner ON workspace TO sprout_private
USING ("ownerId" = public.private_session_owner())
WITH CHECK ("ownerId" = public.private_session_owner());
--> statement-breakpoint
GRANT SELECT ON workspace TO sprout_private;
