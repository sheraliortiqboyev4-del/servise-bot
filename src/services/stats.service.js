import { query } from '../db/index.js';
import { REQUEST_STATUS } from '../constants/index.js';

// Umumiy statistika: kunlik/haftalik soni, o'rtacha hal qilish vaqti, eng faol ishchi
export async function getStats() {
  const daily = await query(
    "SELECT COUNT(*)::int AS c FROM requests WHERE created_at > now() - interval '1 day'"
  );
  const weekly = await query(
    "SELECT COUNT(*)::int AS c FROM requests WHERE created_at > now() - interval '7 days'"
  );
  const total = await query('SELECT COUNT(*)::int AS c FROM requests');

  // Hal qilish vaqtlari (daqiqada): eng tez, eng sekin, o'rtacha
  const durations = await query(
    `SELECT
       MIN(EXTRACT(EPOCH FROM (closed_at - created_at))/60)::int AS fastest,
       MAX(EXTRACT(EPOCH FROM (closed_at - created_at))/60)::int AS slowest,
       AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/60)::int AS average
     FROM requests WHERE status = $1 AND closed_at IS NOT NULL`,
    [REQUEST_STATUS.CLOSED]
  );

  // Eng faol ishchi
  const topWorker = await query(
    `SELECT u.full_name, COUNT(*)::int AS c
     FROM requests r JOIN users u ON u.id = r.accepted_by
     WHERE r.accepted_by IS NOT NULL
     GROUP BY u.full_name ORDER BY c DESC LIMIT 1`
  );

  return {
    daily: daily.rows[0].c,
    weekly: weekly.rows[0].c,
    total: total.rows[0].c,
    fastest: durations.rows[0].fastest,
    slowest: durations.rows[0].slowest,
    average: durations.rows[0].average,
    topWorker: topWorker.rows[0] ?? null,
  };
}
