import { USER_STATUS } from '../../constants/index.js';
import { findById, setStatus } from '../../services/user.service.js';
import { requireAdmin } from '../middlewares/auth.js';

// Admin foydalanuvchini tasdiqlash/rad etish callbacklari
export function registerRegisterHandlers(bot) {
  bot.action(/^user:(approve|reject):(\d+)$/, requireAdmin(), async (ctx) => {
    const decision = ctx.match[1];
    const userId = Number(ctx.match[2]);
    const user = await findById(userId);
    if (!user) return ctx.answerCbQuery('⚠\ufe0f Foydalanuvchi topilmadi.', { show_alert: true });

    if (decision === 'approve') {
      await setStatus(userId, USER_STATUS.APPROVED);
      await ctx.editMessageText(`✅ Tasdiqlandi: ${user.full_name}`);
      await ctx.telegram
        .sendMessage(user.telegram_id, '✅ Arizangiz tasdiqlandi! /start bosing.')
        .catch(() => {});
    } else {
      await setStatus(userId, USER_STATUS.REJECTED);
      await ctx.editMessageText(`❌ Rad etildi: ${user.full_name}`);
      await ctx.telegram
        .sendMessage(user.telegram_id, '❌ Arizangiz rad etildi. Qayta urinish uchun /start.')
        .catch(() => {});
    }
    await ctx.answerCbQuery();
  });
}
