import { requireAdmin } from '../middlewares/auth.js';
import { getStats } from '../../services/stats.service.js';
import { buildRequestsExcel } from '../../services/export.service.js';
import { Input } from 'telegraf';
import { adminStatsKeyboard } from '../keyboards/index.js';

// Xabarni tahrirlash yoki yangi xabar yuborish uchun yordamchi
async function editOrReply(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, { ...extra, parse_mode: extra.parse_mode || undefined });
  } catch (err) {
    return ctx.reply(text, extra);
  }
}

// Xavfsiz answerCbQuery (eskirgan querylar uchun xatosini ignore qiladi
async function safeAnswerCbQuery(ctx, text = undefined) {
  try {
    await ctx.answerCbQuery(text);
  } catch (err) {
    // 400: query old - ignore qilamiz
    if (err.response?.error_code !== 400) {
      throw err;
    }
  }
}

function formatMinutes(m) {
  return m == null ? '-' : `${m} daqiqa`;
}

export function registerStatsHandlers(bot) {
  const showStats = async (ctx) => {
    const s = await getStats();
    const text =
      `📊 *Statistika:*\n\n` +
      `📅 Bugun: ${s.daily}\n` +
      `🗓 Hafta: ${s.weekly}\n` +
      `📈 Jami: ${s.total}\n\n` +
      `⚡ Eng tez: ${formatMinutes(s.fastest)}\n` +
      `⏱ O'rtacha: ${formatMinutes(s.average)}\n` +
      `🐌 Eng sekin: ${formatMinutes(s.slowest)}\n\n` +
      `🏆 Eng faol dispetcher: ${s.topWorker ? `${s.topWorker.full_name} (${s.topWorker.c})` : '-'}`;
    return editOrReply(ctx, text, { parse_mode: 'Markdown', ...adminStatsKeyboard() });
  };

  bot.command('stats', requireAdmin(), showStats);
  bot.action('admin:stats', requireAdmin(), async (ctx) => {
    await safeAnswerCbQuery(ctx);
    return showStats(ctx);
  });

  // Excel eksport
  bot.action('admin:export', requireAdmin(), async (ctx) => {
    await safeAnswerCbQuery(ctx, '⏳ Tayyorlanmoqda...');
    const buffer = await buildRequestsExcel();
    await ctx.replyWithDocument(
      Input.fromBuffer(buffer, `requests-${Date.now()}.xlsx`)
    );
  });
}
