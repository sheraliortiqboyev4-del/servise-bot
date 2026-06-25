import { Scenes, Markup } from 'telegraf';
import { ROLE } from '../../constants/index.js';
import { isNonEmpty, isPhone } from '../../utils/validators.js';
import { roleKeyboard, userDecisionKeyboard } from '../keyboards/index.js';
import { createUser, getAdmins } from '../../services/user.service.js';

export const REGISTER_SCENE = 'register';

// Bosqichlar (aniq state.step)
const STEP = {
  ROLE: 'role',
  PHONE: 'phone',
  LOCATION: 'location',
};

export const registerScene = new Scenes.BaseScene(REGISTER_SCENE);

// Xabarni tahrirlash yoki yangi xabar yuborish uchun yordamchi
async function editOrReply(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, extra);
  } catch (err) {
    return ctx.reply(text, extra);
  }
}

registerScene.enter(async (ctx) => {
  ctx.scene.state.data = {};
  ctx.scene.state.step = STEP.ROLE;
  // Ism familiyani avtomatik olish
  const firstName = ctx.from.first_name || '';
  const lastName = ctx.from.last_name || '';
  ctx.scene.state.data.fullName = `${firstName} ${lastName}`.trim();
  await ctx.reply('👋 Xush kelibsiz! Sohangizni tanlang:', roleKeyboard());
});

// Rol tanlash (callback)
registerScene.action(/^role:(driver|worker)$/, async (ctx) => {
  if (ctx.scene.state.step !== STEP.ROLE) return ctx.answerCbQuery();
  await ctx.answerCbQuery();
  ctx.scene.state.data.role = ctx.match[1];
  ctx.scene.state.step = STEP.PHONE;
  await editOrReply(ctx, `Soha tanlandi: ${ctx.match[1] === ROLE.DRIVER ? 'Driver' : 'Dispetcher'}`);
  await ctx.reply(
    '📞 Telefon raqamingizni kiriting yoki tugma orqali ulashing:',
    Markup.keyboard([Markup.button.contactRequest('📞 Raqamni ulashish')]).oneTime().resize()
  );
});

// Telefonni kontakt orqali ulashish
registerScene.on('contact', async (ctx) => {
  if (ctx.scene.state.step !== STEP.PHONE) return;
  ctx.scene.state.data.phone = ctx.message.contact.phone_number;
  ctx.scene.state.step = STEP.LOCATION;
  await ctx.reply(
    '📍 Joylashuvingizni (location) yuboring yoki kiriting:',
    Markup.keyboard([Markup.button.locationRequest('📍 Joylashuvni yuborish')]).oneTime().resize()
  );
});

// Joylashuvni location orqali qabul qilish
registerScene.on('location', async (ctx) => {
  if (ctx.scene.state.step !== STEP.LOCATION) return;
  ctx.scene.state.data.location = `Lat: ${ctx.message.location.latitude}, Lon: ${ctx.message.location.longitude}`;
  return finishRegistration(ctx);
});

// Matnli javoblar (qadamga qarab)
registerScene.on('text', async (ctx) => {
  const { step, data } = ctx.scene.state;
  const value = ctx.message.text.trim();

  switch (step) {
    case STEP.PHONE:
      if (!isPhone(value)) return ctx.reply('⚠\ufe0f Telefon noto\'g\'ri. Masalan: +998901234567');
      data.phone = value;
      ctx.scene.state.step = STEP.LOCATION;
      await ctx.reply(
        '📍 Joylashuvingizni (location) yuboring yoki kiriting:',
        Markup.keyboard([Markup.button.locationRequest('📍 Joylashuvni yuborish')]).oneTime().resize()
      );
      break;

    case STEP.LOCATION:
      if (!isNonEmpty(value)) return ctx.reply('⚠\ufe0f Joylashuv bo\'sh bo\'lmasligi kerak.');
      data.location = value;
      return finishRegistration(ctx);

    default:
      return ctx.reply('ℹ\ufe0f Iltimos tugmalardan foydalaning.');
  }
});

async function finishRegistration(ctx) {
  const data = ctx.scene.state.data;
  const user = await createUser({
    telegramId: ctx.from.id,
    fullName: data.fullName,
    role: data.role,
    phone: data.phone,
    location: data.location,
  });

  await ctx.reply('✅ Arizangiz qabul qilindi! Admin tasdig\'ini kuting.', Markup.removeKeyboard());

  const roleLabel = data.role === ROLE.DRIVER ? 'Driver' : 'Ishchi';
  const admins = await getAdmins();
  const text =
    `🔔 Yangi ro'yxatdan o'tish\n\n` +
    `👤 ${data.fullName}\n` +
    `🏷 Soha: ${roleLabel}\n` +
    `📞 ${data.phone}\n` +
    `📍 ${data.location}`;
  for (const admin of admins) {
    await ctx.telegram
      .sendMessage(admin.telegram_id, text, userDecisionKeyboard(user.id))
      .catch(() => {});
  }

  return ctx.scene.leave();
}
