import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { getPool } from "./runtime";

export function getDb() {
  return drizzle(getPool(), { schema });
}
