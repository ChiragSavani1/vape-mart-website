CREATE TABLE `image_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`source` text NOT NULL,
	`source_path` text NOT NULL,
	`stored_key` text,
	`confidence` real NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`added` integer NOT NULL,
	`updated` integer NOT NULL,
	`duplicates` integer NOT NULL,
	`hardware_skipped` integer NOT NULL,
	`review` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`customer_name` text NOT NULL,
	`contact` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`responded_at` text
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`upc` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`category` text NOT NULL,
	`flavour` text,
	`price` real NOT NULL,
	`image_key` text,
	`visible` integer DEFAULT true NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`missing_review` integer DEFAULT false NOT NULL,
	`manual_name` integer DEFAULT false NOT NULL,
	`manual_brand` integer DEFAULT false NOT NULL,
	`manual_category` integer DEFAULT false NOT NULL,
	`manual_image` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_upc_unique` ON `products` (`upc`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE TABLE `promotion_products` (
	`promotion_id` text NOT NULL,
	`product_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`banner_key` text,
	`promotional_price` real NOT NULL,
	`starts_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
