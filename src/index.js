import { Telegraf, Scenes, session } from 'telegraf';
import { config } from './config/index.js';
import { pool } from './db/index.js';

import { registerScene } from './bot/scenes/register.scene.js';
import { requestScene } from './bot/scenes/request.scene.js';

import { attachUser } from './bot/middlewares/auth.js';
import { registerStartHandlers } from './bot/handlers/start.js';
import { registerRegisterHandlers } from './bot/handlers/register.js';
import { registerRequestHandlers } from './bot/handlers/request.js';
import { registerWorkerHandlers } from './bot/handlers/worker.js';
import { registerGroupHandlers, registerChannelForwardTracker } from './bot/handlers/group.js';
import { registerAdminHandlers } from './bot/handlers/admin.js';
import { registerStatsHandlers } from './bot/handlers/stats.js';
import { findByCode, acceptRequest, cancelByWorker, getAllRequests } from './services/request.service.js';
import { Markup } from 'telegraf';
import { adminStatsKeyboard } from './bot/keyboards/index.js';
import { findById as findUserById, makeAdmin, getAllUsers } from './services/user.service.js';
import { getSetting, setSetting as saveSetting } from './services/settings.service.js';
import { buildPostText, updateChannelPost, publishRequest } from './bot/handlers/channel.js';
import { acceptKeyboard, reassignKeyboard, acceptedRequestKeyboard, backToAdminKeyboard } from './bot/keyboards/index.js';
import { ROLE, REQUEST_STATUS, USER_STATUS } from './constants/index.js';

import { startSlaWatcher } from './services/sla.service.js';

const bot = new Telegraf(config.botToken, {
  handlerTimeout: 90000,
  telegram: {
    webhookReply: false,
    apiRoot: 'https://api.telegram.org',
    agent: false,
    retryAfter: 1
  }
});

bot.use(session());
bot.use(attachUser());

const stage = new Scenes.Stage([registerScene, requestScene]);
bot.use(stage.middleware());

registerChannelForwardTracker(bot);
registerStartHandlers(bot);
registerRegisterHandlers(bot);
registerRequestHandlers(bot);
registerWorkerHandlers(bot);
registerAdminHandlers(bot);
registerStatsHandlers(bot);
registerGroupHandlers(bot);

// Barcha zayavkalar handler
bot.action('admin:allrequests', async (ctx) => {
  await ctx.answerCbQuery();
  const allRequests = await getAllRequests();
  const requestList = allRequests.map(r => `• ${r.code} | ${r.status}`).join('\n');
  const text = "📋 Barcha so\'rov:\n\n" + requestList + "\n\n🔍 To'liq ma'lumot uchun so\'rov ID sini (REQ-1234) yuboring!";
  // Xabarni tahrirlash yoki yangisi
  try {
    await ctx.editMessageText(text, { ...adminStatsKeyboard() });
  } catch (e) {
    await ctx.reply(text, adminStatsKeyboard());
  }
});

// Photo handler for broadcast (supports single photos and media groups)
bot.on('photo', async (ctx, next) => {
  if (ctx.session.adminAction === 'broadcast') {
    // Initialize session storage for broadcast
    if (!ctx.session.broadcastPhotos) ctx.session.broadcastPhotos = [];
    if (!ctx.session.broadcastUpdateTimer) ctx.session.broadcastUpdateTimer = null;
    if (!ctx.session.broadcastCaption) ctx.session.broadcastCaption = null;

    // Store photo and caption
    ctx.session.broadcastPhotos.push(ctx.message.photo.at(-1).file_id);
    if (ctx.message.caption) {
      ctx.session.broadcastCaption = ctx.message.caption;
    }

    // Clear existing timer
    if (ctx.session.broadcastUpdateTimer) {
      clearTimeout(ctx.session.broadcastUpdateTimer);
    }

    // Set new timer to send after 1 second of last photo
    ctx.session.broadcastUpdateTimer = setTimeout(async () => {
      const allUsers = await getAllUsers();
      const photoFileIds = ctx.session.broadcastPhotos;
      const caption = ctx.session.broadcastCaption;
      let sent = 0;
      let failed = 0;

      for (const user of allUsers) {
        try {
          if (photoFileIds.length === 1) {
            await ctx.telegram.sendPhoto(user.telegram_id, photoFileIds[0], { caption });
          } else {
            // Create media group
            const media = photoFileIds.map((fileId, index) => ({
              type: 'photo',
              media: fileId,
              caption: index === 0 ? caption : undefined
            }));
            await ctx.telegram.sendMediaGroup(user.telegram_id, media);
          }
          sent++;
        } catch (err) {
          failed++;
        }
      }

      // Clear session
      delete ctx.session.adminAction;
      delete ctx.session.broadcastPhotos;
      delete ctx.session.broadcastUpdateTimer;
      delete ctx.session.broadcastCaption;

      await ctx.reply(`✅ Xabar yuborildi!\n\nYuborilgan: ${sent}\nXato: ${failed}`, backToAdminKeyboard());
    }, 1000);

    return; // Don't call next
  }
  return next();
});

// Global handler: Zayavka ID yoki Foydalanuvchi ID
bot.on('text', async (ctx, next) => {
  // Birinchi admin session actionlari bilan ishlaymiz
  if (ctx.session.adminAction) {
    const action = ctx.session.adminAction;

    try {
      switch(action) {
        case 'addAdmin':
          delete ctx.session.adminAction;
          const tgId = ctx.message.text.trim();
          await makeAdmin(tgId);
          return ctx.reply('✅ Yangi admin qo\'shildi!', backToAdminKeyboard());
        case 'setSlaMinutes':
          delete ctx.session.adminAction;
          const mins = parseInt(ctx.message.text.trim());
          await saveSetting('sla_minutes', mins.toString());
          return ctx.reply('✅ SLA yangilandi!', backToAdminKeyboard());
        case 'setChannelId':
          delete ctx.session.adminAction;
          const channelId = ctx.message.text.trim();
          await saveSetting('channel_id', channelId);
          return ctx.reply('✅ Kanal ID yangilandi!', backToAdminKeyboard());
        case 'setGroupId':
          delete ctx.session.adminAction;
          const groupId = ctx.message.text.trim();
          await saveSetting('group_id', groupId);
          return ctx.reply('✅ Guruh ID yangilandi!', backToAdminKeyboard());
        case 'broadcast':
          delete ctx.session.adminAction;
          const allUsers = await getAllUsers();
          let sent = 0;
          let failed = 0;
          for (const user of allUsers) {
            try {
              await ctx.telegram.sendMessage(user.telegram_id, ctx.message.text);
              sent++;
            } catch (err) {
              failed++;
            }
          }
          return ctx.reply(`✅ Xabar yuborildi!\n\nYuborilgan: ${sent}\nXato: ${failed}`, backToAdminKeyboard());
      }
    } catch(e) {
      delete ctx.session.adminAction;
      return ctx.reply('❌ Xatolik yuz berdi!', backToAdminKeyboard());
    }
  }

  // Keyin zayavka ID
  const text = ctx.message.text.trim();
  const reqCodeMatch = text.match(/^REQ-\d+$/i);
  if (reqCodeMatch) {
    const reqCode = text.toUpperCase();
    const req = await findByCode(reqCode);
    if (!req) {
      return ctx.reply('❌ Bunday so\'rov topilmadi!');
    }
    const postText = buildPostText(req);
    let keyboard = undefined;
    const user = ctx.state.user;

    if (user && user.role === ROLE.WORKER) {
      if (req.status === REQUEST_STATUS.OPEN) {
        keyboard = acceptKeyboard(req.id);
      } else if (req.status === REQUEST_STATUS.ACCEPTED && req.accepted_by === user.id) {
        keyboard = acceptedRequestKeyboard(req.id);
      } else if (req.status === REQUEST_STATUS.ACCEPTED && req.accepted_by !== user.id) {
        keyboard = reassignKeyboard(req.id);
      }
    }

    const firstPhotoId = req.photo_file_ids?.[0];
    if (firstPhotoId) {
      return ctx.replyWithPhoto(firstPhotoId, { caption: postText, parse_mode: 'Markdown', ...keyboard });
    } else {
      return ctx.reply(postText, { parse_mode: 'Markdown', ...keyboard });
    }
  }

  // Keyin foydalanuvchi ID (agar admin bo'lsa)
  const userIdMatch = text.match(/^\d+$/);
  if (userIdMatch && ctx.state.user && ctx.state.user.role === ROLE.ADMIN) {
    const userId = Number(text.trim());
    const user = await (await import('./services/user.service.js')).findById(userId);
    if (!user) {
      return ctx.reply('❌ Bunday foydalanuvchi topilmadi!');
    }
    const userDetailKeyboard = (await import('./bot/keyboards/index.js')).userDetailKeyboard;
    const info = "👤 Foydalanuvchi ma'lumotlari:\n\nID: `" + user.id + "`\nIsm: " + user.full_name + "\nTelegram ID: `" + user.telegram_id + "`\nRol: " + user.role + "\nHolat: " + user.status + "\nTelefon: " + (user.phone || "Noma'lum") + "\nJoylashuv: " + (user.location || "Noma'lum") + "\nQo'shilgan vaqt: " + user.created_at;
    return ctx.reply(info, userDetailKeyboard(user));
  }

  // Worker cancel uchun session
  if (ctx.state.user && ctx.state.user.role === ROLE.WORKER && ctx.session.cancelRequestId) {
    const reason = ctx.message.text.trim();
    const reqId = ctx.session.cancelRequestId;
    delete ctx.session.cancelRequestId;
    const cancelled = await cancelByWorker(reqId, ctx.state.user.id, reason);
    if (!cancelled) {
      return ctx.reply('⚠️ So\'rov topilmadi yoki siz qabul qilmagansiz!');
    }
    await ctx.reply('✅ So\'rov bekor qilindi, boshqa ishchilar uchun yana ochiq!');
    await updateChannelPost(ctx.telegram, cancelled);
    const driver = await findUserById(cancelled.driver_id);
    if (driver) {
      await ctx.telegram.sendMessage(
        driver.telegram_id,
        '⚠️ ' + cancelled.code + ' so\'rov bekor qilindi!\n\n📝 Sabab: ' + reason,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    await publishRequest(ctx.telegram, cancelled);
    return;
  }

  return next();
});

// Accept request
bot.action(/^accept:(\d+)$/, async (ctx) => {
  const requestId = Number(ctx.match[1]);
  const user = ctx.state.user;
  if (!user || user.role !== ROLE.WORKER) {
    return ctx.answerCbQuery('⛔ Faqat Dispatcherlar qabul qila oladi!', { show_alert: true });
  }
  const accepted = await acceptRequest(requestId, user.id);
  if (!accepted) {
    return ctx.answerCbQuery('⚠️ Bu so\'rov allaqachon olingan!', { show_alert: true });
  }
  await ctx.answerCbQuery('✅ Qabul qilindi!');
  await updateChannelPost(ctx.telegram, accepted);
  const driver = await findUserById(accepted.driver_id);
  if (driver) {
    await ctx.telegram.sendMessage(
      driver.telegram_id,
      '✅ ' + accepted.code + ' so\'rov qabul qilindi!\n\n👤 Ishchi: ' + user.full_name,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
  const groupId = await getSetting('group_id');
  await ctx.telegram.sendMessage(
    user.telegram_id,
    '✅ ' + accepted.code + ' so\'rov qabul qildingiz!\n\nHal qilgach, guruhdagi shu so\'rov postiga reply qilib, natija rasmini yuboring!',
    { parse_mode: 'Markdown' }
  ).catch(() => {});
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});
});

// Worker cancel
bot.action(/^worker:cancel:(\d+)$/, async (ctx) => {
  const requestId = Number(ctx.match[1]);
  const user = ctx.state.user;
  if (!user || user.role !== ROLE.WORKER) {
    return ctx.answerCbQuery('⛔ Ruxsat yo\'q!', { show_alert: true });
  }
  ctx.session.cancelRequestId = requestId;
  await ctx.answerCbQuery();
  return ctx.reply('❌ So\'rov bekor qilish uchun sababni yozing:');
});

// Global error catcher
bot.catch((err, ctx) => {
  if (err.response?.error_code === 400 && err.response?.description?.includes('query is too old')) {
    console.warn('⚠️ Eski callback query - ignore qilindi');
    return;
  }
  console.error('Bot xatosi:', err);
});

// Bootstrap
async function bootstrap() {
  await pool.query('SELECT 1');
  console.log('✅ Bazaga ulandi!');
  startSlaWatcher(bot.telegram);
  await bot.launch();
  console.log('🚀 Bot ishga tushdi!');
}
bootstrap().catch(err => { console.error('❌ Ishga tushirishda xato:', err); process.exit(1); });
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
