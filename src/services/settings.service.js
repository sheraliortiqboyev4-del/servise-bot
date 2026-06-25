import { query } from '../db/index.js';

// Bitta sozlamani olish
export async function getSetting(key) {
  const { rows } = await query('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

// Barcha sozlamalarni obyekt ko'rinishida olish
export async function getAllSettings() {
  const { rows } = await query('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Sozlamani o'rnatish (mavjud bo'lsa yangilaydi)
export async function setSetting(key, value) {
  await query(
    `INSERT INTO settings(key, value) VALUES($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [key, String(value)]
  );
}

// SLA daqiqasini son ko'rinishida olish
export async function getSlaMinutes() {
  const value = await getSetting('sla_minutes');
  return Number(value) || 20;
}
