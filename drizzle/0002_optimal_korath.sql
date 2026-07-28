ALTER TABLE "banners" ADD COLUMN "original_filename" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "temporary_path" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "public_url" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "image_status" text DEFAULT 'missing' NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "source_type" text DEFAULT 'admin_upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "github_path" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "github_commit_sha" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "archived_at" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "hidden_from_admin" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "dismissed_at" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "dismissed_by" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "last_failure_reason" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "updated_at" text;--> statement-breakpoint
ALTER TABLE "product_image_states" ADD COLUMN "github_path" text;--> statement-breakpoint
ALTER TABLE "product_image_states" ADD COLUMN "github_commit_sha" text;--> statement-breakpoint
ALTER TABLE "product_image_states" ADD COLUMN "archived_at" text;--> statement-breakpoint
ALTER TABLE "product_image_states" ADD COLUMN "hidden_from_admin" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_image_states" ADD COLUMN "dismissed_at" text;--> statement-breakpoint
ALTER TABLE "product_image_states" ADD COLUMN "dismissed_by" text;--> statement-breakpoint
CREATE INDEX "banners_image_status_idx" ON "banners" USING btree ("image_status");