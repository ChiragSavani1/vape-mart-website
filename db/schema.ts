import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  upc: text("upc").notNull().unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  flavour: text("flavour"),
  price: real("price").notNull(),
  imageKey: text("image_key"),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  missingReview: integer("missing_review", { mode: "boolean" }).notNull().default(false),
  manualName: integer("manual_name", { mode: "boolean" }).notNull().default(false),
  manualBrand: integer("manual_brand", { mode: "boolean" }).notNull().default(false),
  manualCategory: integer("manual_category", { mode: "boolean" }).notNull().default(false),
  manualImage: integer("manual_image", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});

export const inquiries = sqliteTable("inquiries", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  customerName: text("customer_name").notNull(),
  contact: text("contact").notNull(),
  status: text("status").notNull().default("Pending"),
  ipHash: text("ip_hash").notNull(),
  createdAt: text("created_at").notNull(),
  respondedAt: text("responded_at"),
});

export const importRuns = sqliteTable("import_runs", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  added: integer("added").notNull(),
  updated: integer("updated").notNull(),
  duplicates: integer("duplicates").notNull(),
  hardwareSkipped: integer("hardware_skipped").notNull(),
  review: integer("review").notNull(),
  createdAt: text("created_at").notNull(),
});

export const imageMatches = sqliteTable("image_matches", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  source: text("source").notNull(),
  sourcePath: text("source_path").notNull(),
  storedKey: text("stored_key"),
  confidence: real("confidence").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("Pending"),
  createdAt: text("created_at").notNull(),
});

export const promotions = sqliteTable("promotions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  bannerKey: text("banner_key"),
  promotionalPrice: real("promotional_price").notNull(),
  startsAt: text("starts_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const promotionProducts = sqliteTable("promotion_products", {
  promotionId: text("promotion_id").notNull(),
  productId: text("product_id").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
