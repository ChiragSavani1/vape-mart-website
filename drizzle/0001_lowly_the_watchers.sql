CREATE TABLE "product_image_states" (
	"product_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'missing' NOT NULL,
	"sku" text,
	"upc" text NOT NULL,
	"previous_source_url" text,
	"temporary_path" text,
	"archived_url" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"retry_requested" integer DEFAULT 0 NOT NULL,
	"last_search_at" text,
	"last_failure_reason" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "product_image_states_status_idx" ON "product_image_states" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_image_states_retry_idx" ON "product_image_states" USING btree ("retry_requested","last_search_at");