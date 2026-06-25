import { ROLE, USER_STATUS } from '../../constants/index.js';
import { REGISTER_SCENE } from '../scenes/register.scene.js';
import { driverMenu, workerMenu, adminMenu } from '../keyboards/index.js';

// Xabarni tahrirlash yoki yangi xabar yuborish uchun yordamchi
async function editOrReply(ctx, text, extra = {}) {
  try {
    // Oldin tahrirlashga harakat qilamiz
    return await ctx.editMessageText(text, { ...extra, parse_mode: extra.parse_mode || undefined });
  } catch (err) {
    // Tahrirlab bo'lmasa (yangi xabar kerak bo'lsa), yangi yuboramiz
    return ctx.reply(text, extra);
  }
}

// /start: ro'yxatdan o'tmagan bo'lsa register scene, aks holda rolga mos menyu
export function registerStartHandlers(bot) {
  bot.start(async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.scene.enter(REGISTER_SCENE);
    }
    if (user.status === USER_STATUS.PENDING) {
      return ctx.reply('⏳ Arizangiz admin tasdig\'ini kutmoqda.');
    }
    if (user.status === USER_STATUS.REJECTED) {
      return ctx.reply('❌ Arizangiz rad etilgan. Qayta urinish uchun /start bosing.');
    }
    return showMenu(ctx, user);
  });

  // Asosiy menyuga qaytish
  bot.action('menu:main', async (ctx) => {
    await ctx.answerCbQuery();
    return showMenu(ctx, ctx.state.user);
  });
}

export async function showMenu(ctx, user) {
  if (user.role === ROLE.ADMIN) {
    return editOrReply(ctx, '🛠 Admin panel:', adminMenu());
  }
  if (user.role === ROLE.WORKER) {
    return editOrReply(ctx, `👋 ${user.full_name}, Dispetcher menyusi:`, workerMenu());
  }
  return editOrReply(ctx, `👋 ${user.full_name}, Driver menyusi:`, driverMenu());
}
