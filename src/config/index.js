import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Muhit o'zgaruvchisi topilmadi: ${name}`);
  }
  return value;
}

export const config = {
  botToken: required('BOT_TOKEN'),
  databaseUrl: required('DATABASE_URL'),
  rootAdminId: Number(required('ROOT_ADMIN_ID')),
};

// Default sozlamalar (admin panel orqali bazada o'zgartiriladi)
export const DEFAULT_SETTINGS = {
  sla_minutes: '20',
  channel_id: '',
  group_id: '',
  rejected_can_reapply: 'true',
};
