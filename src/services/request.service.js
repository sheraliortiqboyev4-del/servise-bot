import { query, withTransaction } from '../db/index.js';
import { REQUEST_STATUS } from '../constants/index.js';

// Keyingi REQ kodini generatsiya qiladi (REQ-1001 dan boshlab, id asosida)
async function nextCode(client) {
  // 1. Oldingi koddan raqamni olish yoki id dan foydalanish
  const { rows } = await client.query(`
    SELECT code FROM requests ORDER BY id DESC LIMIT 1
  `);
  
  let nextNum = 1001;
  if (rows.length > 0 && rows[0].code) {
    const match = rows[0].code.match(/REQ-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  return `REQ-${nextNum}`;
}

export async function createRequest(data) {
  return withTransaction(async (client) => {
    const code = await nextCode(client);
    const { rows } = await client.query(
      `INSERT INTO requests(
         code, driver_id, request_type, unit_number, trailer_number,
         driver_name, driver_phone, location, priority, description, notes, photo_file_ids
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING *`,
      [
        code, data.driverId, data.requestType, data.unitNumber, data.trailerNumber,
        data.driverName, data.driverPhone, data.location, data.priority,
        data.description, data.notes, JSON.stringify(data.photoFileIds),
      ]
    );
    return rows[0];
  });
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM requests WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Code bo'yicha topish (REQ-XXXX formatida)
export async function findByCode(code) {
  const { rows } = await query('SELECT * FROM requests WHERE code = $1', [code]);
  return rows[0] ?? null;
}

// DB-level lock: faqat birinchi qabul qilgan ishchi muvaffaqiyatli bo'ladi.
// Boshqasi bir vaqtda bossa, null qaytadi (allaqachon olingan).
export async function acceptRequest(requestId, workerId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM requests WHERE id = $1 FOR UPDATE',
      [requestId]
    );
    const req = rows[0];
    if (!req || req.status !== REQUEST_STATUS.OPEN) {
      return null; // allaqachon qabul qilingan yoki yopilgan
    }
    const updated = await client.query(
      `UPDATE requests SET status = $2, accepted_by = $3, accepted_at = now()
       WHERE id = $1 RETURNING *`,
      [requestId, REQUEST_STATUS.ACCEPTED, workerId]
    );
    return updated.rows[0];
  });
}

// Qayta tayinlash (reassign) — admin yoki boshqa ishchi oladi
export async function reassignRequest(requestId, workerId) {
  const { rows } = await query(
    `UPDATE requests SET accepted_by = $2, status = $3, accepted_at = now()
     WHERE id = $1 RETURNING *`,
    [requestId, workerId, REQUEST_STATUS.ACCEPTED]
  );
  return rows[0] ?? null;
}

export async function markResolved(requestId, photoFileIds) {
  const { rows } = await query(
    `UPDATE requests SET status = $2, resolved_photo_ids = $3::jsonb WHERE id = $1 RETURNING *`,
    [requestId, REQUEST_STATUS.RESOLVED, JSON.stringify(photoFileIds)]
  );
  return rows[0] ?? null;
}

export async function closeRequest(requestId) {
  const { rows } = await query(
    `UPDATE requests SET status = $2, closed_at = now() WHERE id = $1 RETURNING *`,
    [requestId, REQUEST_STATUS.CLOSED]
  );
  return rows[0] ?? null;
}

export async function cancelRequest(requestId, driverId) {
  const { rows } = await query(
    `UPDATE requests SET status = $3, closed_at = now()
     WHERE id = $1 AND driver_id = $2 AND status = $4 RETURNING *`,
    [requestId, driverId, REQUEST_STATUS.CANCELLED, REQUEST_STATUS.OPEN]
  );
  return rows[0] ?? null;
}

// Zayavkani bekor qilish (ishchi tomonidan) — yana OPEN ga qaytarish
export async function cancelByWorker(requestId, workerId, reason) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM requests WHERE id = $1 FOR UPDATE',
      [requestId]
    );
    const req = rows[0];
    if (!req || req.status !== REQUEST_STATUS.ACCEPTED || req.accepted_by !== workerId) {
      return null;
    }
    const updated = await client.query(
      `UPDATE requests 
       SET status = $2, accepted_by = NULL, accepted_at = NULL, cancel_reason = $3
       WHERE id = $1 RETURNING *`,
      [requestId, REQUEST_STATUS.OPEN, reason]
    );
    return updated.rows[0];
  });
}

// Zayavkani bekor qilish (driver tomonidan)
export async function cancelByDriver(requestId, driverId, reason) {
  const { rows } = await query(
    `UPDATE requests 
     SET status = $3, cancel_reason = $4
     WHERE id = $1 AND driver_id = $2 AND status IN ($5, $6) RETURNING *`,
    [requestId, driverId, REQUEST_STATUS.CANCELLED, reason, REQUEST_STATUS.OPEN, REQUEST_STATUS.ACCEPTED]
  );
  return rows[0] ?? null;
}

export async function setChannelMessage(requestId, channelMsgId) {
  await query('UPDATE requests SET channel_msg_id = $2 WHERE id = $1', [requestId, channelMsgId]);
}

export async function setGroupMessage(requestId, groupMsgId) {
  await query('UPDATE requests SET group_msg_id = $2 WHERE id = $1', [requestId, groupMsgId]);
}

export async function findByGroupMessage(groupMsgId) {
  const { rows } = await query('SELECT * FROM requests WHERE group_msg_id = $1', [groupMsgId]);
  return rows[0] ?? null;
}

export async function getDriverRequests(driverId, limit = 10) {
  const { rows } = await query(
    'SELECT * FROM requests WHERE driver_id = $1 ORDER BY created_at DESC LIMIT $2',
    [driverId, limit]
  );
  return rows;
}

// Ishchining qabul qilgan zayavkalari
export async function getWorkerRequests(workerId, limit = 20) {
  const { rows } = await query(
    'SELECT * FROM requests WHERE accepted_by = $1 ORDER BY created_at DESC LIMIT $2',
    [workerId, limit]
  );
  return rows;
}

// SLA: ochiq va hali eslatilmagan, muddati o'tgan zayavkalar
export async function getOverdueOpenRequests(slaMinutes) {
  const { rows } = await query(
    `SELECT * FROM requests
     WHERE status = $1 AND sla_notified = false
       AND created_at < now() - ($2 || ' minutes')::interval`,
    [REQUEST_STATUS.OPEN, String(slaMinutes)]
  );
  return rows;
}

export async function markSlaNotified(requestId) {
  await query('UPDATE requests SET sla_notified = true WHERE id = $1', [requestId]);
}

export async function getAllRequests() {
  const { rows } = await query('SELECT * FROM requests ORDER BY created_at DESC');
  return rows;
}
