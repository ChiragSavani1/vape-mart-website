import { env } from "cloudflare:workers";

export function getD1(): D1Database {
  if (!env.DB) throw new Error("Database binding DB is unavailable.");
  return env.DB as D1Database;
}

export function getStorage(): R2Bucket {
  if (!env.STORAGE) throw new Error("Object storage binding STORAGE is unavailable.");
  return env.STORAGE as R2Bucket;
}

let initialized = false;
export async function ensureDatabase() {
  if (initialized) return getD1();
  const db = getD1();
  const statements = [
    `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, upc TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, brand TEXT NOT NULL, category TEXT NOT NULL, flavour TEXT, price REAL NOT NULL, image_key TEXT, visible INTEGER NOT NULL DEFAULT 1, featured INTEGER NOT NULL DEFAULT 0, missing_review INTEGER NOT NULL DEFAULT 0, manual_name INTEGER NOT NULL DEFAULT 0, manual_brand INTEGER NOT NULL DEFAULT 0, manual_category INTEGER NOT NULL DEFAULT 0, manual_image INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS products_category_idx ON products(category)`,
    `CREATE INDEX IF NOT EXISTS products_brand_idx ON products(brand)`,
    `CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, product_name TEXT NOT NULL, customer_name TEXT NOT NULL, contact TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', ip_hash TEXT NOT NULL, created_at TEXT NOT NULL, responded_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS inquiries_ip_created_idx ON inquiries(ip_hash, created_at)`,
    `CREATE TABLE IF NOT EXISTS import_runs (id TEXT PRIMARY KEY, filename TEXT NOT NULL, added INTEGER NOT NULL, updated INTEGER NOT NULL, duplicates INTEGER NOT NULL, hardware_skipped INTEGER NOT NULL, review INTEGER NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS image_matches (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, source TEXT NOT NULL, source_path TEXT NOT NULL, stored_key TEXT, confidence REAL NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS promotions (id TEXT PRIMARY KEY, name TEXT NOT NULL, banner_key TEXT, promotional_price REAL NOT NULL, starts_at TEXT NOT NULL, expires_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS promotion_products (promotion_id TEXT NOT NULL, product_id TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS product_deletions (product_id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS banners (id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, alt_text TEXT NOT NULL, position INTEGER NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS image_assets (id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, normalized_name TEXT NOT NULL, created_at TEXT NOT NULL)`,
  ];
  await db.batch(statements.map(sql => db.prepare(sql)));
  initialized = true;
  return db;
}

export async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}
