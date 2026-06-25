// Foydalanuvchi rollari
export const ROLE = {
  DRIVER: 'driver',
  WORKER: 'worker',
  ADMIN: 'admin',
};

// Foydalanuvchi tasdiq holati
export const USER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  BLOCKED: 'blocked',
};

// Zayavka holati
export const REQUEST_STATUS = {
  OPEN: 'open',
  ACCEPTED: 'accepted',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

// Zayavka holatining ko'rinishi (kanal posti uchun)
export const STATUS_LABEL = {
  [REQUEST_STATUS.OPEN]: '🟢 Ochiq',
  [REQUEST_STATUS.ACCEPTED]: '🟡 Qabul qilingan',
  [REQUEST_STATUS.RESOLVED]: '🔵 Hal qilindi (tasdiq kutilmoqda)',
  [REQUEST_STATUS.CLOSED]: '🔴 Yopildi',
  [REQUEST_STATUS.CANCELLED]: '⚫ Bekor qilindi',
};

// Ustuvorlik darajalari
export const PRIORITIES = ['Low', 'Medium', 'High'];

// Zayavka turlari
export const REQUEST_TYPES = ['Remont', 'Texnik xizmat', 'Ehtiyot qism'];
