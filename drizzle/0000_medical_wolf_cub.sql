CREATE TABLE "admin_login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"attempted_at" text NOT NULL,
	"successful" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" text PRIMARY KEY NOT NULL,
	"object_key" text NOT NULL,
	"alt_text" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"source" text NOT NULL,
	"source_path" text NOT NULL,
	"stored_key" text,
	"confidence" double precision NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"added" integer NOT NULL,
	"updated" integer NOT NULL,
	"duplicates" integer NOT NULL,
	"hardware_skipped" integer NOT NULL,
	"review" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"customer_name" text NOT NULL,
	"contact" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" text NOT NULL,
	"responded_at" text
);
--> statement-breakpoint
CREATE TABLE "product_deletions" (
	"product_id" text PRIMARY KEY NOT NULL,
	"deleted_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"upc" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"category" text NOT NULL,
	"flavour" text,
	"price" double precision NOT NULL,
	"image_key" text,
	"visible" integer DEFAULT 1 NOT NULL,
	"featured" integer DEFAULT 0 NOT NULL,
	"missing_review" integer DEFAULT 0 NOT NULL,
	"manual_name" integer DEFAULT 0 NOT NULL,
	"manual_brand" integer DEFAULT 0 NOT NULL,
	"manual_category" integer DEFAULT 0 NOT NULL,
	"manual_image" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_products" (
	"promotion_id" text NOT NULL,
	"product_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"banner_key" text,
	"promotional_price" double precision NOT NULL,
	"starts_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"approved" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_login_attempts_ip_time_idx" ON "admin_login_attempts" USING btree ("ip_hash","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_hash_unique" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "banners_object_key_unique" ON "banners" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "image_assets_object_key_unique" ON "image_assets" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "inquiries_ip_created_idx" ON "inquiries" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_upc_unique" ON "products" USING btree ("upc");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_unique" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand");