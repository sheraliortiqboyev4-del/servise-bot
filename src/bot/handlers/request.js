import { REQUEST_SCENE } from '../scenes/request.scene.js';
import { ROLE, STATUS_LABEL, REQUEST_STATUS } from '../../constants/index.js';
import {
  getDriverRequests, findById, closeRequest, cancelRequest,
} from '../../services/request.service.js';
import { findById as findUserById } from '../../services/user.service.js';
import { getSetting } from '../../services/settings.service.js';
import { updateChannelPost, buildPostText } from './channel.js';
import { formatDateTime } from '../../utils/format.js';
import { requireApproved } from '../middlewares/auth.js';
import { query } from '../../db/index.js';
import { myRequestsKeyboard } from '../keyboards/index.js';

// Xabarni tahrirlash yoki yangi xabar yuborish uchun yordamchi
async function editOrReply(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, { ...extra, parse_mode: extra.parse_mode || undefined });
  } catch (err) {
    return ctx.reply(text, extra);
  }
}

// Reopen uchun helper: statusni ACCEPTED ga qaytarish
async function reopenRequest(requestId) {
  const { rows } = await query(
    `UPDATE requests SET status = $2, resolved_photo_ids = '[]'::jsonb WHERE id = $1 RETURNING *`,
    [requestId, REQUEST_STATUS.ACCEPTED]
  );
  return rows[0] ?? null;
}

export function registerRequestHandlers(bot) {
  // Yangi zayavka (driver)
  bot.action('req:new', requireApproved(), async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.state.user.role !== ROLE.DRIVER) {
      return ctx.reply('⛔ Faqat driverlar sorov yubora oladi.');
    }
    return ctx.scene.enter(REQUEST_SCENE);
  });

  // Mening zayavkalarim
  bot.action('req:my', requireApproved(), async (ctx) => {
    await ctx.answerCbQuery();
    const requests = await getDriverRequests(ctx.state.user.id);
    if (requests.length === 0) {
      return editOrReply(ctx, '🐭 Sizda hali sorovlar yo\'q.', myRequestsKeyboard());
    }
    const listText = requests.map(r => `• \`${r.code}\` — ${STATUS_LABEL[r.status]}`).join('\n');
    const fullText = `📋 Sorovlaringiz:\n\n${listText}\n\n🔍 To'liq ma'lumot uchun sorov ID'sini yuboring!`;
    return editOrReply(ctx, fullText, { parse_mode: 'Markdown', ...myRequestsKeyboard() });
  });

  // Driver hal qilinishini tasdiqlaydi (Approve) -> yopiladi
  bot.action(/^approve:(\d+)$/, async (ctx) => {
    const requestId = Number(ctx.match[1]);
    const req = await findById(requestId);
    if (!req || req.driver_id !== ctx.state.user?.id) {
      return ctx.answerCbQuery('⛔ Bu sizning sorovingiz emas.', { show_alert: true });
    }
    const closed = await closeRequest(requestId);
    if (!closed) {
      return ctx.answerCbQuery('⚠\ufe0f Sorov topilmadi yoki allaqachon yopilgan.', { show_alert: true });
    }
    await ctx.answerCbQuery('✅ Tasdiqlandi va yopildi!');
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await updateChannelPost(ctx.telegram, closed);
    
    // Dispetcherga xabar yuborish (qabul qilgan odam)
    if (req.accepted_by) {
      const worker = await findUserById(req.accepted_by);
      if (worker) {
        await ctx.telegram.sendMessage(
          worker.telegram_id,
          `✅ ${req.code} sorovi driver tomonidan tasdiqlandi!`,
        ).catch(() => {});
      }
    }
  });

  // Driver qayta hal qilish kerakligini bildiradi (reopen)
  bot.action(/^reopen:(\d+)$/, async (ctx) => {
    const requestId = Number(ctx.match[1]);
    const req = await findById(requestId);
    if (!req || req.driver_id !== ctx.state.user?.id) {
      return ctx.answerCbQuery('⛔ Bu sizning sorovingiz emas.', { show_alert: true });
    }
    const reopened = await reopenRequest(requestId);
    if (!reopened) {
      return ctx.answerCbQuery('⚠\ufe0f Sorov topilmadi.', { show_alert: true });
    }
    await ctx.answerCbQuery('🔄 Ishchiga qaytarildi!');
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    
    // Kanal postini yangilash
    await updateChannelPost(ctx.telegram, reopened);
    
    // Qabul qilgan ishchiga xabar yuborish
    if (reopened.accepted_by) {
      const worker = await findUserById(reopened.accepted_by);
      if (worker) {
        await ctx.telegram.sendMessage(
          worker.telegram_id,
          `🔄 ${reopened.code} sorov uchun qayta hal qilish talab qilindi.\n` +
          `Guruhdagi postiga reply qilib yangi rasm yuboring.`,
        ).catch(() => {});
      }
      // Guruhga ham eslatma
      const groupId = await getSetting('group_id');
      if (groupId) {
        await ctx.telegram.sendMessage(
          groupId,
          `🔄 ${reopened.code} sorov uchun qayta hal qilish talab qilindi.`,
        ).catch(() => {});
      }
    }
  });
}
