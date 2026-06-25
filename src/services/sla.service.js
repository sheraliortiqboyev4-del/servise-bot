import cron from 'node-cron';
import { getOverdueOpenRequests, markSlaNotified } from './request.service.js';
import { getSlaMinutes, getSetting } from './settings.service.js';
import { getAdmins } from './user.service.js';
import { reassignKeyboard } from '../bot/keyboards/index.js';

// Har daqiqada SLA muddati o'tgan ochiq zayavkalarni tekshiradi
export function startSlaWatcher(telegram) {
  cron.schedule('* * * * *', async () => {
    try {
      await checkOverdue(telegram);
    } catch (err) {
      console.error('SLA watcher xatosi:', err);
    }
  });
  console.log('⏱ SLA watcher ishga tushdi (har daqiqa).');
}

async function checkOverdue(telegram) {
  const slaMinutes = await getSlaMinutes();
  const overdue = await getOverdueOpenRequests(slaMinutes);
  if (overdue.length === 0) return;

  const groupId = await getSetting('group_id');
  const admins = await getAdmins();

  for (const req of overdue) {
    const text =
      `⚠\ufe0f *SLA ogohlantirish!*\n\n` +
      `${req.code} so\'rov ${slaMinutes} daqiqadan beri qabul qilinmadi.\n` +
      `Type: ${req.request_type} | Priority: ${req.priority}`;

    // Guruhga eslatma
    if (groupId) {
      await telegram
        .sendMessage(groupId, text, { parse_mode: 'Markdown', ...reassignKeyboard(req.id) })
        .catch(() => {});
    }
    // Adminlarga eslatma
    for (const admin of admins) {
      await telegram
        .sendMessage(admin.telegram_id, text, { parse_mode: 'Markdown' })
        .catch(() => {});
    }

    await markSlaNotified(req.id);
  }
}
