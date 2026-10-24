SET LOCAL ROLE sprout_schema_owner;
--> statement-breakpoint
CREATE TABLE "private"."saved_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"submission_id" uuid NOT NULL,
	"original_text" text NOT NULL,
	"submitted_intent" text,
	"retained_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_item_owner_submission" UNIQUE("owner_user_id","submission_id"),
	CONSTRAINT "saved_item_owner_identity" UNIQUE("owner_user_id","id"),
	CONSTRAINT "saved_item_original_size" CHECK (octet_length("private"."saved_item"."original_text") between 1 and 65536),
	CONSTRAINT "saved_item_intent_size" CHECK ("private"."saved_item"."submitted_intent" is null or octet_length("private"."saved_item"."submitted_intent") <= 4096)
);
--> statement-breakpoint
ALTER TABLE "private"."saved_item" ADD CONSTRAINT "saved_item_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_item_owner_recent" ON "private"."saved_item" USING btree ("owner_user_id","retained_at","id");
--> statement-breakpoint
ALTER TABLE private.saved_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.saved_item FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.saved_item FROM PUBLIC, sprout_api, sprout_auth, sprout_worker;
GRANT SELECT ON private.saved_item TO sprout_web;
GRANT INSERT (id, owner_user_id, submission_id, original_text, submitted_intent)
  ON private.saved_item TO sprout_web;
CREATE POLICY saved_item_read ON private.saved_item FOR SELECT TO sprout_web
  USING (owner_user_id = private.current_owner_id());
CREATE POLICY saved_item_insert ON private.saved_item FOR INSERT TO sprout_web
  WITH CHECK (owner_user_id = private.current_owner_id());
RESET ROLE;
