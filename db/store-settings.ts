import { defaultStoreHours, type StoreHours } from "../app/data";
import { ensureDatabase } from "./runtime";

export type { StoreHours };

const settingKeys:Record<keyof StoreHours,string> = {
  weekdays:"store_hours_weekdays",
  saturday:"store_hours_saturday",
  sunday:"store_hours_sunday",
};

export async function loadStoreHours():Promise<StoreHours> {
  try {
    const db=await ensureDatabase();
    const rows=await db.prepare(
      "SELECT key,value FROM settings WHERE key IN (?,?,?)"
    ).bind(settingKeys.weekdays,settingKeys.saturday,settingKeys.sunday).all<{key:string;value:string}>();
    const values=new Map((rows.results||[]).map(row=>[row.key,row.value]));
    return {
      weekdays:values.get(settingKeys.weekdays)||defaultStoreHours.weekdays,
      saturday:values.get(settingKeys.saturday)||defaultStoreHours.saturday,
      sunday:values.get(settingKeys.sunday)||defaultStoreHours.sunday,
    };
  } catch (error) {
    console.error("store_hours_load_failed",error);
    return defaultStoreHours;
  }
}

export async function saveStoreHours(hours:StoreHours) {
  const db=await ensureDatabase();
  const updatedAt=new Date().toISOString();
  await db.batch((Object.keys(settingKeys) as Array<keyof StoreHours>).map(key=>
    db.prepare(
      "INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at"
    ).bind(settingKeys[key],hours[key],updatedAt)
  ));
  return hours;
}
