import { doublePrecision, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: text("id").primaryKey(), upc: text("upc").notNull(), slug: text("slug").notNull(),
  name: text("name").notNull(), brand: text("brand").notNull(), category: text("category").notNull(),
  flavour: text("flavour"), price: doublePrecision("price").notNull(), imageKey: text("image_key"),
  visible: integer("visible").notNull().default(1), featured: integer("featured").notNull().default(0),
  missingReview: integer("missing_review").notNull().default(0), manualName: integer("manual_name").notNull().default(0),
  manualBrand: integer("manual_brand").notNull().default(0), manualCategory: integer("manual_category").notNull().default(0),
  manualImage: integer("manual_image").notNull().default(0), updatedAt: text("updated_at").notNull(),
}, table => [
  uniqueIndex("products_upc_unique").on(table.upc), uniqueIndex("products_slug_unique").on(table.slug),
  index("products_category_idx").on(table.category), index("products_brand_idx").on(table.brand),
]);

export const inquiries = pgTable("inquiries", {
  id:text("id").primaryKey(), productId:text("product_id").notNull(), productName:text("product_name").notNull(),
  customerName:text("customer_name").notNull(), contact:text("contact").notNull(), status:text("status").notNull().default("Pending"),
  ipHash:text("ip_hash").notNull(), createdAt:text("created_at").notNull(), respondedAt:text("responded_at"),
}, table => [index("inquiries_ip_created_idx").on(table.ipHash,table.createdAt)]);

export const importRuns=pgTable("import_runs",{id:text("id").primaryKey(),filename:text("filename").notNull(),added:integer("added").notNull(),updated:integer("updated").notNull(),duplicates:integer("duplicates").notNull(),hardwareSkipped:integer("hardware_skipped").notNull(),review:integer("review").notNull(),createdAt:text("created_at").notNull()});
export const imageMatches=pgTable("image_matches",{id:text("id").primaryKey(),productId:text("product_id").notNull(),source:text("source").notNull(),sourcePath:text("source_path").notNull(),storedKey:text("stored_key"),confidence:doublePrecision("confidence").notNull(),reason:text("reason").notNull(),status:text("status").notNull().default("Pending"),createdAt:text("created_at").notNull()});
export const promotions=pgTable("promotions",{id:text("id").primaryKey(),name:text("name").notNull(),bannerKey:text("banner_key"),promotionalPrice:doublePrecision("promotional_price").notNull(),startsAt:text("starts_at").notNull(),expiresAt:text("expires_at").notNull(),approved:integer("approved").notNull().default(0),createdAt:text("created_at").notNull()});
export const promotionProducts=pgTable("promotion_products",{promotionId:text("promotion_id").notNull(),productId:text("product_id").notNull()});
export const settings=pgTable("settings",{key:text("key").primaryKey(),value:text("value").notNull(),updatedAt:text("updated_at").notNull()});
export const productDeletions=pgTable("product_deletions",{productId:text("product_id").primaryKey(),deletedAt:text("deleted_at").notNull()});
export const banners=pgTable("banners",{id:text("id").primaryKey(),objectKey:text("object_key").notNull(),altText:text("alt_text").notNull(),position:integer("position").notNull(),createdAt:text("created_at").notNull()},table=>[uniqueIndex("banners_object_key_unique").on(table.objectKey)]);
export const imageAssets=pgTable("image_assets",{id:text("id").primaryKey(),objectKey:text("object_key").notNull(),originalName:text("original_name").notNull(),normalizedName:text("normalized_name").notNull(),createdAt:text("created_at").notNull()},table=>[uniqueIndex("image_assets_object_key_unique").on(table.objectKey)]);
export const productImageStates=pgTable("product_image_states",{
  productId:text("product_id").primaryKey(),
  status:text("status").notNull().default("missing"),
  sku:text("sku"),
  upc:text("upc").notNull(),
  previousSourceUrl:text("previous_source_url"),
  temporaryPath:text("temporary_path"),
  archivedUrl:text("archived_url"),
  retryCount:integer("retry_count").notNull().default(0),
  retryRequested:integer("retry_requested").notNull().default(0),
  lastSearchAt:text("last_search_at"),
  lastFailureReason:text("last_failure_reason"),
  updatedAt:text("updated_at").notNull(),
},table=>[
  index("product_image_states_status_idx").on(table.status),
  index("product_image_states_retry_idx").on(table.retryRequested,table.lastSearchAt),
]);
export const adminSessions=pgTable("admin_sessions",{id:text("id").primaryKey(),email:text("email").notNull(),tokenHash:text("token_hash").notNull(),createdAt:text("created_at").notNull(),expiresAt:text("expires_at").notNull()},table=>[uniqueIndex("admin_sessions_token_hash_unique").on(table.tokenHash),index("admin_sessions_expires_idx").on(table.expiresAt)]);
export const adminLoginAttempts=pgTable("admin_login_attempts",{id:text("id").primaryKey(),ipHash:text("ip_hash").notNull(),attemptedAt:text("attempted_at").notNull(),successful:integer("successful").notNull().default(0)},table=>[index("admin_login_attempts_ip_time_idx").on(table.ipHash,table.attemptedAt)]);
