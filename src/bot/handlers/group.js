import {
  findByGroupMessage, markResolved, setGroupMessage, findById
} from '../../services/request.service.js';
import { findById as findUserById, findByTelegramId } from '../../services/user.service.js';
import { query } from '../../db/index.js';
import { approveKeyboard } from '../keyboards/index.js';
import { REQUEST_STATUS } from '../../constants/index.js';

// Guruhda: ishchi zayavka postiga reply qilib rasm yuboradi.
// Bot uni topib, driverga Approve tugmasi bilan yuboradi.
export function registerGroupHandlers(bot) {
  // Session'da joriy hal qilinayotgan zayavka uchun rasmlarni, info xabar ID sini va timerni saqlash
  bot.on('photo', async (ctx, next) => {
    const reply = ctx.message?.reply_to_message;
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    if (!reply || !isGroup) return next();

    // Reply qilingan post bo'yicha zayavkani topamiz
    const req = await findByGroupMessage(reply.message_id);
    if (!req) return next();

    // Faqat qabul qilingan zayavka uchun (allaqachon yopilgan bo'lsa, qaytmaymiz)
    if (req.status !== REQUEST_STATUS.ACCEPTED) {
      return ctx.reply(`ℹ️ ${req.code}: bu so'rov hozir hal qilish bosqichida emas.`,
        { reply_to_message_id: ctx.message.message_id });
    }

    // Faqat zayavkani qabul qilgan ishchi hal qilishi mumkin!
    const sender = await findByTelegramId(ctx.from.id);
    if (!sender || sender.id !== req.accepted_by) {
      return ctx.reply(`⛔ ${req.code}: so'rovni faqat uni qabul qilgan ishchi hal qilishi mumkin!`,
        { reply_to_message_id: ctx.message.message_id });
    }

    // Session'da rasmlarni saqlash uchun joy yaratish
    if (!ctx.session.resolvePhotos) {
      ctx.session.resolvePhotos = {};
    }
    if (!ctx.session.resolvePhotos[req.id]) {
      ctx.session.resolvePhotos[req.id] = [];
    }
    if (!ctx.session.resolvePhotoInfoMessageId) {
      ctx.session.resolvePhotoInfoMessageId = {};
    }
    if (!ctx.session.resolvePhotoUpdateTimer) {
      ctx.session.resolvePhotoUpdateTimer = {};
    }

    // Yangi rasmni qo'shish
    const photoFileId = ctx.message.photo.at(-1).file_id;
    ctx.session.resolvePhotos[req.id].push(photoFileId);

    // Oldingi timerni to'xtatamiz
    if (ctx.session.resolvePhotoUpdateTimer[req.id]) {
      clearTimeout(ctx.session.resolvePhotoUpdateTimer[req.id]);
    }

    // Yangi timer yaratamiz (1 sekund kutamiz, keyin xabarni yangilaymiz)
    ctx.session.resolvePhotoUpdateTimer[req.id] = setTimeout(async () => {
      const text = `✅ Rasm qo'shildi! Jami: ${ctx.session.resolvePhotos[req.id].length} ta. Yana rasm yuboring yoki "✅ Yakunlash" tugmasini bosing.`;
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Yakunlash', callback_data: `resolve:${req.id}` }]
          ]
        },
        reply_to_message_id: ctx.message.message_id
      };

      if (ctx.session.resolvePhotoInfoMessageId[req.id]) {
        // Oldingi xabar mavjud, uni tahrirlaymiz
        try {
          await ctx.telegram.editMessageText(ctx.chat.id, ctx.session.resolvePhotoInfoMessageId[req.id], undefined, text, {
            reply_markup: keyboard.reply_markup
          });
        } catch (err) {
          // Tahrirlab bo'lmasa, yangi xabar yuboramiz
          const msg = await ctx.reply(text, keyboard);
          ctx.session.resolvePhotoInfoMessageId[req.id] = msg.message_id;
        }
      } else {
        // Oldingi xabar yo'q, yangisini yuboramiz
        const msg = await ctx.reply(text, keyboard);
        ctx.session.resolvePhotoInfoMessageId[req.id] = msg.message_id;
      }
    }, 1000);
  });

  // Rasmlarni yakunlash va driverga yuborish
  bot.action(/^resolve:(\d+)$/, async (ctx) => {
    const reqId = Number(ctx.match[1]);
    const sender = await findByTelegramId(ctx.from.id);

    // Zayavkanni topish
    const req = await findById(reqId);
    if (!req) return ctx.answerCbQuery('⚠️ So\'rov topilmadi.', { show_alert: true });

    // Faqat qabul qilgan ishchi yakunlashi mumkin
    if (!sender || sender.id !== req.accepted_by) {
      return ctx.answerCbQuery('⛔ Ruxsat yo\'q.', { show_alert: true });
    }

    // Session'da rasmlar borligini tekshirish
    const photoFileIds = ctx.session.resolvePhotos?.[reqId] || [];
    if (photoFileIds.length === 0) {
      return ctx.answerCbQuery('⚠️ Hech qanday rasm yo\'q!', { show_alert: true });
    }

    await ctx.answerCbQuery();

    // Zayavkani hal qilingan deb belgilash
    const resolved = await markResolved(reqId, photoFileIds);

    // Media group yaratish
    const media = photoFileIds.map(fileId => ({ type: 'photo', media: fileId }));

    // Info xabarini yangilash (tugmani olib tashlash)
    if (ctx.session.resolvePhotoInfoMessageId?.[reqId]) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.resolvePhotoInfoMessageId[reqId],
          undefined,
          `✅ ${resolved.code}: rasmlar yuklandi, driverga yuborildi, tasdiq kutilmoqda.`
        );
      } catch (err) {
        console.error('Info xabarini tahrirlashda xatolik:', err);
      }
    }

    // Zayavka egasini (driver) topamiz
    const driver = await findUserById(resolved.driver_id);
    if (driver) {
      // Barcha rasmlarni media group sifatida yuborish
      await ctx.telegram.sendMediaGroup(driver.telegram_id, media).catch(() => {});
      // Keyin tasdiqlash tugmasi bilan matn yuborish
      await ctx.telegram.sendMessage(driver.telegram_id, `✅ *${resolved.code}* so\'rovingiz hal qilindi.\n\nIltimos tekshiring va tasdiqlang.`, {
        parse_mode: 'Markdown',
        ...approveKeyboard(resolved.id),
      }).catch(() => {});
    }

    // Session'dagi rasmlarni va info xabar ID sini tozalash
    delete ctx.session.resolvePhotos[reqId];
    delete ctx.session.resolvePhotoInfoMessageId[reqId];
    delete ctx.session.resolvePhotoUpdateTimer[reqId];

    await ctx.reply(`✅ ${resolved.code}: natija driverga yuborildi, tasdiq kutilmoqda.`);
  });
}

// Kanal posti guruhga avtomatik forward bo'lganda group_msg_id ni saqlash.
// (Kanal diskussiya guruhiga ulanganda Telegram postni guruhga forward qiladi.)
export function registerChannelForwardTracker(bot) {
  bot.on('message', async (ctx, next) => {
    const isAutoForward = ctx.message?.is_automatic_forward;
    const origin = ctx.message?.forward_from_chat;
    if (isAutoForward && origin?.type === 'channel') {
      const channelMsgId = ctx.message.forward_from_message_id;
      const req = await findRequestByChannelMsg(channelMsgId);
      if (req) await setGroupMessage(req.id, ctx.message.message_id);
    }
    return next();
  });
}

// Yordamchi: kanal message_id bo'yicha zayavka topish
async function findRequestByChannelMsg(channelMsgId) {
  const { rows } = await query('SELECT * FROM requests WHERE channel_msg_id = $1', [channelMsgId]);
  return rows[0] ?? null;
}
