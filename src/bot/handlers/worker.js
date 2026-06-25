import { reassignRequest, getAllRequests, getWorkerRequests } from '../../services/request.service.js';
import { ROLE, REQUEST_STATUS, STATUS_LABEL } from '../../constants/index.js';
import { requireApproved } from '../middlewares/auth.js';

// Xabarni tahrirlash yoki yangi xabar yuborish uchun yordamchi
async function editOrReply(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, { ...extra, parse_mode: extra.parse_mode || undefined });
  } catch (err) {
    return ctx.reply(text, extra);
  }
}

export function registerWorkerHandlers(bot) {
  // Ochiq zayavkalarni ko'rsatish
  bot.action('work:open', requireApproved(), async (ctx) => {
    const user = ctx.state.user;
    if (user.role !== ROLE.WORKER && user.role !== ROLE.ADMIN) {
      return ctx.answerCbQuery('⛔ Faqat dispetcher va adminlar ko\'ra oladi.', { show_alert: true });
    }
    await ctx.answerCbQuery();
    const allRequests = await getAllRequests();
    const openRequests = allRequests.filter(r => r.status === REQUEST_STATUS.OPEN);
    if (openRequests.length === 0) {
      return editOrReply(ctx, '✅ Hozirda ochiq sorov yo\'q.');
    }
    const listText = openRequests.map(r => `• \`${r.code}\` — ${STATUS_LABEL[r.status]}`).join('\n');
    const fullText = `📋 Ochiq sorov:\n\n${listText}\n\n🔍 To'liq ma'lumot uchun sorov ID'sini yuboring!`;
    return editOrReply(ctx, fullText, { parse_mode: 'Markdown' });
  });

  // Qayta tayinlash (reassign)
  bot.action(/^reassign:(\d+)$/, async (ctx) => {
    const requestId = Number(ctx.match[1]);
    const user = ctx.state.user;
    if (!user || (user.role !== ROLE.WORKER && user.role !== ROLE.ADMIN)) {
      return ctx.answerCbQuery('⛔ Ruxsat yo\'q.', { show_alert: true });
    }
    const { reassignRequest: reassign } = await import('../../services/request.service.js');
    const req = await reassign(requestId, user.id);
    if (!req) return ctx.answerCbQuery('⚠️ Zayavka topilmadi.', { show_alert: true });
    await ctx.answerCbQuery('🔄 Siz qayta oldingiz.');
    const { updateChannelPost } = await import('./channel.js');
    await updateChannelPost(ctx.telegram, req);
  });

  // Mening zayavkalarim (ishchi uchun)
  bot.action('work:myrequests', requireApproved(), async (ctx) => {
    const user = ctx.state.user;
    if (user.role !== ROLE.WORKER && user.role !== ROLE.ADMIN) {
      return ctx.answerCbQuery('⛔ Faqat dispetcher va adminlar ko\'ra oladi.', { show_alert: true });
    }
    await ctx.answerCbQuery();
    const myRequests = await getWorkerRequests(user.id);
    if (myRequests.length === 0) {
      return editOrReply(ctx, '✅ Sizda hech qanday qabul qilingan sorov yo\'q.');
    }
    const listText = myRequests.map(r => `• \`${r.code}\` — ${STATUS_LABEL[r.status]}`).join('\n');
    const fullText = `📋 Mening sorovlarim:\n\n${listText}\n\n🔍 To'liq ma'lumot uchun sorov ID'sini yuboring!`;
    return editOrReply(ctx, fullText, { parse_mode: 'Markdown' });
  });
}
