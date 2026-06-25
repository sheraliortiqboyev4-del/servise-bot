import { findByTelegramId } from '../../services/user.service.js';
import { ROLE, USER_STATUS } from '../../constants/index.js';

// Foydalanuvchi ma'lumotlarini cache da saqlaymiz (5 daqiqa davomida)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 daqiqa

// Cache ni tozalash uchun yordamchi
function clearExpiredCache() {
  const now = Date.now();
  for (const [tgId, { expiresAt }] of userCache.entries()) {
    if (now > expiresAt) {
      userCache.delete(tgId);
    }
  }
}

// Cache ni har 1 daqiqada tozalaymiz
setInterval(clearExpiredCache, 60 * 1000);

// Cache ga user qo'shish
export function cacheUser(tgId, user) {
  userCache.set(tgId, { user, expiresAt: Date.now() + CACHE_TTL });
}

// Cache dan user o'chirish (update bo'lganda)
export function invalidateUserCache(tgId) {
  userCache.delete(tgId);
}

// Har bir update'da foydalanuvchini cache'dan oladi, yo'q bo'lsa bazadan oladi
export function attachUser() {
  return async (ctx, next) => {
    const tgId = ctx.from?.id;
    if (tgId) {
      // Cache dan tekshiramiz
      const cached = userCache.get(tgId);
      if (cached && cached.expiresAt > Date.now()) {
        ctx.state.user = cached.user;
      } else {
        // Cache'da yo'q, bazadan olamiz va cache'ga saqlaymiz
        const user = await findByTelegramId(tgId);
        if (user) {
          cacheUser(tgId, user);
        }
        ctx.state.user = user;
      }
    }
    return next();
  };
}

// Foydalanuvchi tasdiqlangan bo'lishini talab qiladi
export function requireApproved() {
  return async (ctx, next) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.reply('⛔ Siz hali ro\'yxatdan o\'tmadingiz. Iltimos /start bosing.');
    }
    if (user.status === USER_STATUS.BLOCKED) {
      return ctx.reply('🚫 Siz bloklangansiz. Botdan foydalana olmaysiz!');
    }
    if (user.status !== USER_STATUS.APPROVED) {
      return ctx.reply('⛔ Siz hali tasdiqlanmagansiz. Iltimos admin tasdig\'ini kuting yoki /start bosing.');
    }
    return next();
  };
}

// Faqat adminlar uchun
export function requireAdmin() {
  return async (ctx, next) => {
    const user = ctx.state.user;
    if (!user || user.role !== ROLE.ADMIN) {
      return ctx.answerCbQuery?.('⛔ Faqat adminlar uchun.').catch(() => {});
    }
    return next();
  };
}
