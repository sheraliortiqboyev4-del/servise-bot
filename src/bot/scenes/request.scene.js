import { Scenes } from 'telegraf';
import { REQUEST_TYPES, PRIORITIES } from '../../constants/index.js';
import { isNumeric, isNonEmpty } from '../../utils/validators.js';
import {
  priorityKeyboard, cancelKeyboard,
  skipKeyboard, confirmRequestKeyboard,
} from '../keyboards/index.js';
import { createRequest } from '../../services/request.service.js';
import { publishRequest } from '../handlers/channel.js';

export const REQUEST_SCENE = 'request';

// Bosqichlar ketma-ketligi (aniq, mo'rt cursor o'rniga state.step)
const STEP = {
  UNIT: 'unit',
  TRAILER: 'trailer',
  LOCATION: 'location',
  PRIORITY: 'priority',
  DESCRIPTION: 'description',
  NOTES: 'notes',
  PHOTO: 'photo',
  CONFIRM: 'confirm',
};

export const requestScene = new Scenes.BaseScene(REQUEST_SCENE);

// Xabarni tahrirlash yoki yangi xabar yuborish uchun yordamchi
async function editOrReply(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, extra);
  } catch (err) {
    return ctx.reply(text, extra);
  }
}

// Scene boshlanishi
requestScene.enter(async (ctx) => {
  ctx.scene.state.data = {};
  // Request type ni avtomatik birinchi qiymatga qo'yamiz (type qismi o'chirildi)
  ctx.scene.state.data.requestType = REQUEST_TYPES[0];
  // Driver name va phone ni avtomatik olish (ro'yxatdan o'tgan ma'lumotlardan)
  ctx.scene.state.data.driverName = ctx.state.user.full_name;
  ctx.scene.state.data.driverPhone = ctx.state.user.phone;
  ctx.scene.state.data.photoFileIds = []; // Initialize empty array for multiple photos
  ctx.scene.state.photoInfoMessageId = null; // Saqlanadigan info xabarining ID si
  ctx.scene.state.photoUpdateTimer = null; // Rasm qo'shilgandan keyin kutish uchun timer
  ctx.scene.state.step = STEP.UNIT;
  await ctx.reply('🔢 Unit raqamini kiriting:', cancelKeyboard());
});

// --- Matnli javoblarni qadamga qarab qabul qilish ---
requestScene.on('text', async (ctx) => {
  const { step, data } = ctx.scene.state;
  const value = ctx.message.text.trim();

  switch (step) {
    case STEP.UNIT:
      if (!isNumeric(value)) return ctx.reply('⚠\ufe0f Malumot faqat raqamdan iborat bo\'lishi kerak.');
      data.unitNumber = value;
      ctx.scene.state.step = STEP.TRAILER;
      return editOrReply(ctx, '🚛 Trailer raqamini kiriting:', cancelKeyboard());

    case STEP.TRAILER:
      if (!isNumeric(value)) return ctx.reply('⚠\ufe0f Malumot faqat raqamdan iborat bo\'lishi kerak.');
      data.trailerNumber = value;
      ctx.scene.state.step = STEP.LOCATION;
      return editOrReply(ctx, '📍 Joylashuvni kiriting:', cancelKeyboard());

    case STEP.LOCATION:
      if (!isNonEmpty(value)) return ctx.reply('⚠\ufe0f Joylashuv bo\'sh bo\'lmasligi kerak.');
      data.location = value;
      ctx.scene.state.step = STEP.PRIORITY;
      return editOrReply(ctx, '❗ Ustuvorlikni tanlang:', priorityKeyboard());

    case STEP.DESCRIPTION:
      if (!isNonEmpty(value)) return ctx.reply('⚠\ufe0f Tavsif bo\'sh bo\'lmasligi kerak.');
      data.description = value;
      ctx.scene.state.step = STEP.NOTES;
      return editOrReply(ctx, '📝 Qo\'shimcha izoh (ixtiyoriy):', skipKeyboard());

    case STEP.NOTES:
      data.notes = value;
      ctx.scene.state.step = STEP.PHOTO;
      return editOrReply(ctx, '📷 Rasm yuboring (majburiy):', cancelKeyboard());

    default:
      return ctx.reply('ℹ\ufe0f Iltimos tugmalardan foydalaning.');
  }
});

// --- Rasm qabul qilish (faqat PHOTO qadamida, majburiy, bir nechta) ---
requestScene.on('photo', async (ctx) => {
  if (ctx.scene.state.step !== STEP.PHOTO) return;
  // Add photo to array
  const photoFileId = ctx.message.photo.at(-1).file_id;
  ctx.scene.state.data.photoFileIds.push(photoFileId);
  
  // Oldingi timerni to'xtatamiz
  if (ctx.scene.state.photoUpdateTimer) {
    clearTimeout(ctx.scene.state.photoUpdateTimer);
  }
  
  // Yangi timer yaratamiz (1 sekund kutamiz, keyin xabarni yangilaymiz)
  ctx.scene.state.photoUpdateTimer = setTimeout(async () => {
    const text = `✅ Rasm qo'shildi! Jami: ${ctx.scene.state.data.photoFileIds.length} ta. Yana rasm yuboring yoki "✅ Yakunlash" tugmasini bosing.`;
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Yakunlash', callback_data: 'req:photos-done' }]
        ]
      }
    };

    if (ctx.scene.state.photoInfoMessageId) {
      // Oldingi xabar mavjud, uni tahrirlaymiz
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, ctx.scene.state.photoInfoMessageId, undefined, text, keyboard);
      } catch (err) {
        // Tahrirlab bo'lmasa, yangi xabar yuboramiz
        const msg = await ctx.reply(text, keyboard);
        ctx.scene.state.photoInfoMessageId = msg.message_id;
      }
    } else {
      // Oldingi xabar yo'q, yangisini yuboramiz
      const msg = await ctx.reply(text, keyboard);
      ctx.scene.state.photoInfoMessageId = msg.message_id;
    }
  }, 1000);
});

// Photos done handler
requestScene.action('req:photos-done', async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.scene.state.data.photoFileIds.length === 0) {
    return ctx.reply('⚠️ Hech qanday rasm yo\'q! Iltimos kamida bitta rasm yuboring!');
  }
  return showSummary(ctx);
});

// --- Callbacklar ---

requestScene.action(/^prio:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.state.data.priority = PRIORITIES[Number(ctx.match[1])];
  ctx.scene.state.step = STEP.DESCRIPTION;
  await editOrReply(ctx, '📄 Muammo tavsifini yozing:', cancelKeyboard());
});

// O'tkazib yuborish (faqat notes qismi uchun)
requestScene.action('req:skip', async (ctx) => {
  await ctx.answerCbQuery();
  const { step, data } = ctx.scene.state;
  if (step === STEP.NOTES) {
    data.notes = null;
    ctx.scene.state.step = STEP.PHOTO;
    return editOrReply(ctx, '📷 Rasm yuboring (majburiy):', cancelKeyboard());
  }
});

requestScene.action('req:cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await editOrReply(ctx, '❌ So\'rov bekor qilindi.');
  return ctx.scene.leave();
});

requestScene.action('req:submit', async (ctx) => {
  await ctx.answerCbQuery();
  const d = ctx.scene.state.data;
  const request = await createRequest({
    driverId: ctx.state.user.id,
    requestType: d.requestType,
    unitNumber: d.unitNumber,
    trailerNumber: d.trailerNumber,
    driverName: d.driverName,
    driverPhone: d.driverPhone,
    location: d.location,
    priority: d.priority,
    description: d.description,
    notes: d.notes,
    photoFileIds: d.photoFileIds,
  });

  await editOrReply(ctx, `✅ So\'rov yuborildi! Kod: ${request.code}`);
  await publishRequest(ctx.telegram, request);
  return ctx.scene.leave();
});

// --- Yakuniy ko'rinish ---
async function showSummary(ctx) {
  ctx.scene.state.step = STEP.CONFIRM;
  const d = ctx.scene.state.data;
  const text =
    `🚛 *So\'rov tekshiring:*\n\n` +
    `Driver: ${d.driverName}\n` +
    `Phone: ${d.driverPhone}\n` +
    `Location: ${d.location}\n` +
    `Type: ${d.requestType}\n` +
    `Unit: ${d.unitNumber}\n` +
    `Trailer: ${d.trailerNumber}\n` +
    `Priority: ${d.priority}\n` +
    `Description: ${d.description}\n` +
    `Notes: ${d.notes || '-'}\n` +
    `Photos: ${d.photoFileIds.length} ta`;
  await editOrReply(ctx, text, { parse_mode: 'Markdown', ...confirmRequestKeyboard() });
}
