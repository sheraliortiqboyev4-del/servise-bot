import { query } from '../db/index.js';
import { ROLE, USER_STATUS } from '../constants/index.js';
import { invalidateUserCache } from '../bot/middlewares/auth.js';

export async function findByTelegramId(telegramId) {
  const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return rows[0] ?? null;
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function createUser({ telegramId, fullName, role, phone, location }) {
  const { rows } = await query(
    `INSERT INTO users(telegram_id, full_name, role, status, phone, location)
     VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
    [telegramId, fullName, role, USER_STATUS.PENDING, phone, location]
  );
  const user = rows[0];
  if (user) {
    invalidateUserCache(telegramId);
  }
  return user;
}

export async function setStatus(userId, status) {
  const user = await findById(userId);
  await query('UPDATE users SET status = $2 WHERE id = $1', [userId, status]);
  if (user) {
    invalidateUserCache(user.telegram_id);
  }
}

// Bloklash va blokdan ochish
export async function blockUser(userId) {
  return setStatus(userId, USER_STATUS.BLOCKED);
}

export async function unblockUser(userId) {
  return setStatus(userId, USER_STATUS.APPROVED);
}

// Barcha foydalanuvchilarni olish
export async function getAllUsers() {
  const { rows } = await query('SELECT * FROM users ORDER BY created_at DESC');
  return rows;
}

// Status va role bo'yicha filterlab olish
export async function getUsersByStatus(status) {
  const { rows } = await query('SELECT * FROM users WHERE status = $1 ORDER BY created_at DESC', [status]);
  return rows;
}

export async function getUsersByRole(role) {
  const { rows } = await query('SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC', [role]);
  return rows;
}

// Foydalanuvchi rolini o'zgartirish
export async function changeRole(userId, newRole) {
  const user = await findById(userId);
  await query('UPDATE users SET role = $2 WHERE id = $1', [userId, newRole]);
  if (user) {
    invalidateUserCache(user.telegram_id);
  }
  return findById(userId);
}

// Adminlikdan olib tashlash (driver/worker ga qaytarish)
export async function removeAdmin(userId) {
  const user = await findById(userId);
  await query('UPDATE users SET role = $2 WHERE id = $1', [userId, ROLE.WORKER]);
  if (user) {
    invalidateUserCache(user.telegram_id);
  }
  return findById(userId);
}

// Barcha tasdiqlangan ishchilar (zayavka xabari uchun)
export async function getApprovedWorkers() {
  const { rows } = await query(
    'SELECT * FROM users WHERE role = $1 AND status = $2',
    [ROLE.WORKER, USER_STATUS.APPROVED]
  );
  return rows;
}

// Barcha adminlar (tasdiq so'rovi va eslatmalar uchun)
export async function getAdmins() {
  const { rows } = await query('SELECT * FROM users WHERE role = $1', [ROLE.ADMIN]);
  return rows;
}

export async function getPendingUsers() {
  const { rows } = await query(
    'SELECT * FROM users WHERE status = $1 ORDER BY created_at',
    [USER_STATUS.PENDING]
  );
  return rows;
}

export async function makeAdmin(telegramId) {
  await query(
    `INSERT INTO users(telegram_id, full_name, role, status)
     VALUES($1, 'Admin', $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE SET role = $2, status = $3`,
    [telegramId, ROLE.ADMIN, USER_STATUS.APPROVED]
  );
  invalidateUserCache(telegramId);
}
