import { Markup } from 'telegraf';
import { requireAdmin } from '../middlewares/auth.js';
import {
  getPendingUsers, makeAdmin, getAllUsers, changeRole,
  removeAdmin, findById, getUsersByStatus, getUsersByRole,
  getAdmins, blockUser, unblockUser
} from '../../services/user.service.js';
import { getAllSettings, setSetting } from '../../services/settings.service.js';
import {
  adminMenu, settingsKeyboard, userDecisionKeyboard,
  backToAdminKeyboard, adminUsersCategoryKeyboard,
  userDetailKeyboard, removeAdminKeyboard,
  adminAdminsKeyboard, adminStatsKeyboard
} from '../keyboards/index.js';
import { ROLE, USER_STATUS } from '../../constants/index.js';

// Xabarni tahrirlash yoki yangi xabar yuborish uchun yordamchi
async function editOrReply(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, { ...extra, parse_mode: extra.parse_mode || undefined });
  } catch (err) {
    return ctx.reply(text, extra);
  }
}

// Foydalanuvchi ro'yxatini formatlash
function formatUserList(users, label) {
  if (users.length === 0) return `${label}: Hozircha hech kim yo'q`;
  const list = users.map(u => `• ID: \`${u.id}\` | ${u.full_name} | ${u.role}`).join('\n');
  return `${label}:\n\n${list}\n\n🔍 To'liq ma'lumot uchun foydalanuvchi ID sini yuboring!`;
}

export function registerAdminHandlers(bot) {
  bot.command('admin', requireAdmin(), (ctx) => ctx.reply('🛠 Admin panel:', adminMenu()));

  bot.action('admin:back', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    await editOrReply(ctx, '🛠 Admin panel:', adminMenu());
  });

  // --- Foydalanuvchilar kategoriya tanlash
  bot.action('admin:allusers', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    await editOrReply(ctx, '👥 Foydalanuvchilar turini tanlang:', adminUsersCategoryKeyboard());
  });

  // Kategoriya bo'yicha ro'yxatlar
  bot.action('admin:users:pending', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    const users = await getPendingUsers();
    await editOrReply(ctx, formatUserList(users, '⏳ Tasdiq kutayotganlar'), adminUsersCategoryKeyboard());
  });

  bot.action('admin:users:drivers', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    const users = await getUsersByRole(ROLE.DRIVER);
    await editOrReply(ctx, formatUserList(users, '🚛 Driverlar'), adminUsersCategoryKeyboard());
  });

  bot.action('admin:users:workers', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    const users = await getUsersByRole(ROLE.WORKER);
    await editOrReply(ctx, formatUserList(users, '🔧 Dispetcherlar'), adminUsersCategoryKeyboard());
  });

  bot.action('admin:users:blocked', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    const users = await getUsersByStatus(USER_STATUS.BLOCKED);
    await editOrReply(ctx, formatUserList(users, '🚫 Bloklanganlar'), adminUsersCategoryKeyboard());
  });

  // Foydalanuvchi haqida to'liq ma'lumot (ID bilan)
  bot.action(/^user:detail:(\d+)$/, requireAdmin(), async (ctx) => {
    const userId = Number(ctx.match[1]);
    const user = await findById(userId);
    if (!user) {
      return ctx.answerCbQuery('❌ Bunday foydalanuvchi topilmadi!', { show_alert: true });
    }
    await ctx.answerCbQuery();
    const text = "👤 Foydalanuvchi ma'lumotlari:\n\nID: `" + user.id + "`\nIsm: " + user.full_name + "\nTelegram ID: `" + user.telegram_id + "`\nRol: " + user.role + "\nHolat: " + user.status + "\nTelefon: " + (user.phone || "Noma'lum") + "\nJoylashuv: " + (user.location || "Noma'lum") + "\nQo'shilgan vaqt: " + user.created_at;
    await editOrReply(ctx, text, userDetailKeyboard(user));
  });

  // --- Tasdiqlash/rad etish
  bot.action('admin:pending', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    const pendingUsers = await getPendingUsers();
    if (pendingUsers.length === 0) {
      return ctx.reply('✅ Tasdiq kutayotgan hech kim yo\'q.', backToAdminKeyboard());
    }
    for (const user of pendingUsers) {
      const text = "👤 Yangi foydalanuvchi:\n\nID: " + user.id + "\nIsm: " + user.full_name + "\nRol: " + user.role + "\nTelefon: " + (user.phone || "Noma'lum") + "\nJoylashuv: " + (user.location || "Noma'lum");
      await ctx.reply(text, userDecisionKeyboard(user.id));
    }
  });

  bot.action(/^user:approve:(\d+)$/, requireAdmin(), async (ctx) => {
    const userId = Number(ctx.match[1]);
    await (await import('../../services/user.service.js')).setStatus(userId, USER_STATUS.APPROVED);
    await ctx.answerCbQuery('✅ Tasdiqlandi!');
    await ctx.editMessageReplyMarkup(undefined);
  });

  bot.action(/^user:reject:(\d+)$/, requireAdmin(), async (ctx) => {
    const userId = Number(ctx.match[1]);
    await (await import('../../services/user.service.js')).setStatus(userId, USER_STATUS.REJECTED);
    await ctx.answerCbQuery('❌ Rad etildi!');
    await ctx.editMessageReplyMarkup(undefined);
  });

  // Rolni o'zgartirish
  bot.action(/^user:changerole:(\d+):(driver|worker)$/, requireAdmin(), async (ctx) => {
    const userId = Number(ctx.match[1]);
    const newRole = ctx.match[2];
    await changeRole(userId, newRole);
    await ctx.answerCbQuery("✅ Rol o'zgartirildi!");
    const user = await findById(userId);
    const text = "👤 Foydalanuvchi ma'lumotlari:\n\nID: `" + user.id + "`\nIsm: " + user.full_name + "\nTelegram ID: `" + user.telegram_id + "`\nRol: " + user.role + "\nHolat: " + user.status + "\nTelefon: " + (user.phone || "Noma'lum") + "\nJoylashuv: " + (user.location || "Noma'lum") + "\nQo'shilgan vaqt: " + user.created_at;
    await editOrReply(ctx, text, userDetailKeyboard(user));
  });

  // Bloklash/unblock
  bot.action(/^user:block:(\d+)$/, requireAdmin(), async (ctx) => {
    const userId = Number(ctx.match[1]);
    await blockUser(userId);
    await ctx.answerCbQuery('🚫 Foydalanuvchi bloklandi!');
    const user = await findById(userId);
    const text = "👤 Foydalanuvchi ma'lumotlari:\n\nID: `" + user.id + "`\nIsm: " + user.full_name + "\nTelegram ID: `" + user.telegram_id + "`\nRol: " + user.role + "\nHolat: " + user.status + "\nTelefon: " + (user.phone || "Noma'lum") + "\nJoylashuv: " + (user.location || "Noma'lum") + "\nQo'shilgan vaqt: " + user.created_at;
    await editOrReply(ctx, text, userDetailKeyboard(user));
  });

  bot.action(/^user:unblock:(\d+)$/, requireAdmin(), async (ctx) => {
    const userId = Number(ctx.match[1]);
    await unblockUser(userId);
    await ctx.answerCbQuery('✅ Blokdan ochildi!');
    const user = await findById(userId);
    const text = "👤 Foydalanuvchi ma'lumotlari:\n\nID: `" + user.id + "`\nIsm: " + user.full_name + "\nTelegram ID: `" + user.telegram_id + "`\nRol: " + user.role + "\nHolat: " + user.status + "\nTelefon: " + (user.phone || "Noma'lum") + "\nJoylashuv: " + (user.location || "Noma'lum") + "\nQo'shilgan vaqt: " + user.created_at;
    await editOrReply(ctx, text, userDetailKeyboard(user));
  });

  // Adminlikdan olib tashlash
  bot.action(/^user:removeadmin:(\d+)$/, requireAdmin(), async (ctx) => {
    const userId = Number(ctx.match[1]);
    await removeAdmin(userId);
    await ctx.answerCbQuery('✅ Adminlikdan olib tashlandi!');
    const user = await findById(userId);
    const text = "👤 Foydalanuvchi ma'lumotlari:\n\nID: `" + user.id + "`\nIsm: " + user.full_name + "\nTelegram ID: `" + user.telegram_id + "`\nRol: " + user.role + "\nHolat: " + user.status + "\nTelefon: " + (user.phone || "Noma'lum") + "\nJoylashuv: " + (user.location || "Noma'lum") + "\nQo'shilgan vaqt: " + user.created_at;
    await editOrReply(ctx, text, userDetailKeyboard(user));
  });

  // Adminlar bo'limi
  bot.action('admin:admins', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    const admins = await getAdmins();
    const adminList = admins.map(admin => `• ${admin.full_name} (ID: ${admin.id})`).join('\n');
    await editOrReply(ctx, "👥 Adminlar:\n\n" + adminList, adminAdminsKeyboard());
  });

  // Admin qoshish
  bot.action('admin:addadmin', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.adminAction = 'addAdmin';
    return ctx.reply('➕ Yangi admin qoshish uchun Telegram ID sini yuboring:');
  });

  // Admin olish
  bot.action('admin:removeadmin', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    const admins = await getAdmins();
    const currentAdminId = ctx.state.user.id;
    await ctx.reply('➖ Adminlikdan olib tashlash uchun foydalanuvchini tanlang:', removeAdminKeyboard(admins, currentAdminId));
  });



  // Sozlamalar
  bot.action('admin:settings', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    const settings = await getAllSettings();
    const text = "⚙️ Sozlamalar:\n\nSLA (daqiqa): " + (settings.sla_minutes || 20) + "\nKanal ID: " + (settings.channel_id || "Kiritilmagan") + "\nGuruh ID: " + (settings.group_id || "Kiritilmagan");
    await editOrReply(ctx, text, settingsKeyboard());
  });

  // Barchaga habar yuborish
  bot.action('admin:broadcast', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.adminAction = 'broadcast';
    return ctx.reply('📢 Yuboriladigan habarni (matn yoki rasm) yuboring:', backToAdminKeyboard());
  });

  // Sozlamalarni yangilash uchun handlerlar
  bot.action('set:sla_minutes', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.adminAction = 'setSlaMinutes';
    return ctx.reply('⏱ Yangi SLA vaqtini (daqiqa) kiriting:');
  });

  bot.action('set:channel_id', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.adminAction = 'setChannelId';
    return ctx.reply('📢 Yangi kanal ID sini kiriting (Eslatma botni Kanalga admin qilishni unutmang):');
  });

  bot.action('set:group_id', requireAdmin(), async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.adminAction = 'setGroupId';
    return ctx.reply('👥 Yangi guruh ID sini kiriting (Eslatma botni Guruhga admin qilishni unutmang):');
  });
}
