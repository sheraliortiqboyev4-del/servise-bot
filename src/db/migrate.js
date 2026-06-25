import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './index.js';
import { config, DEFAULT_SETTINGS } from '../config/index.js';
import { ROLE, USER_STATUS } from '../constants/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
  console.log('✅ Jadvallar yaratildi.');

  // Default sozlamalarni qo'yish (mavjud bo'lsa tegmaydi)
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await pool.query(
      'INSERT INTO settings(key, value) VALUES($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, value]
    );
  }
  console.log('✅ Default sozlamalar qo'yildi.');

  // Root adminni yaratish
  await pool.query(
    `INSERT INTO users(telegram_id, full_name, role, status)
     VALUES($1, $2, $3, $4)
     ON CONFLICT (telegram_id)
     DO UPDATE SET role = $3, status = $4`,
    [config.rootAdminId, 'Root Admin', ROLE.ADMIN, USER_STATUS.APPROVED]
  );
  console.log('✅ Root admin tayyor.');

  await pool.end();
  console.log('🎉 Migratsiya tugadi.');
}

migrate().catch((err) => {
  console.error('❌ Migratsiya xatosi:', err);
  process.exit(1);
});
