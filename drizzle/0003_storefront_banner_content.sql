ALTER TABLE "banners" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "subtitle" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "cta_text" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "cta_url" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "active" integer DEFAULT 1 NOT NULL;
