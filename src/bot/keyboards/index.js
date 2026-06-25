import { Markup } from 'telegraf';
import { ROLE, REQUEST_TYPES, PRIORITIES, USER_STATUS } from '../../constants/index.js';

// --- Ro'yxatdan o'tish ---

// Rol tanlash (Driver / Ishchi)
export const roleKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('🚛 Driver', `role:${ROLE.DRIVER}`)],
    [Markup.button.callback('🔧 Dispetcher', `role:${ROLE.WORKER}`)],
  ]);

// --- Asosiy menyular ---

export const driverMenu = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('➕ Yangi sorov', 'req:new')],
    [Markup.button.callback('📋 Mening sorovlarim', 'req:my')],
  ]);

// Mening sorovlarim uchun orqaga qaytish
export const myRequestsKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Orqaga', 'menu:main')],
  ]);

export const workerMenu = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📋 Ochiq sorovlar', 'work:open')],
    [Markup.button.callback('📋 Mening sorovlarim', 'work:myrequests')],
  ]);

export const adminMenu = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('👥 Barcha foydalanuvchilar', 'admin:allusers')],
    [Markup.button.callback('👥 Adminlar', 'admin:admins')],
    [Markup.button.callback('📊 Statistika', 'admin:stats')],
    [Markup.button.callback('⚙️ Sozlamalar', 'admin:settings')],
    [Markup.button.callback('📄 Excel eksport', 'admin:export')],
    [Markup.button.callback('📢 Barchaga habar yuborish', 'admin:broadcast')],
  ]);

export const adminAdminsKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('➕ Admin qoshish', 'admin:addadmin')],
    [Markup.button.callback('➖ Admin olish', 'admin:removeadmin')],
    [Markup.button.callback('🔙 Orqaga', 'admin:back')],
  ]);

export const adminStatsKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📋 Barcha sorovlar', 'admin:allrequests')],
    [Markup.button.callback('🔙 Orqaga', 'admin:back')],
  ]);

// Barcha foydalanuvchilar uchun kategoriya tanlash
export const adminUsersCategoryKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('⏳ Tasdiq kutayotganlar', 'admin:users:pending')],
    [Markup.button.callback('🚛 Driverlar', 'admin:users:drivers')],
    [Markup.button.callback('🔧 Dispetcherlar', 'admin:users:workers')],
    [Markup.button.callback('🚫 Bloklanganlar', 'admin:users:blocked')],
    [Markup.button.callback('🔙 Orqaga', 'admin:back')],
  ]);

// Foydalanuvchi uchun barcha tugmalar (detail view)
export const userDetailKeyboard = (user) => {
  const buttons = [];
  
  // Rolni o'zgartirish
  if (user.role === ROLE.DRIVER) {
    buttons.push([Markup.button.callback('🔄 Driver → Worker', `user:changerole:${user.id}:${ROLE.WORKER}`)]);
  } else if (user.role === ROLE.WORKER) {
    buttons.push([Markup.button.callback('🔄 Worker → Driver', `user:changerole:${user.id}:${ROLE.DRIVER}`)]);
  }
  
  // Bloklash/Blokdan ochish
  if (user.status === USER_STATUS.BLOCKED) {
    buttons.push([Markup.button.callback('✅ Blokdan ochish', `user:unblock:${user.id}`)]);
  } else if (user.status === USER_STATUS.APPROVED) {
    buttons.push([Markup.button.callback('🚫 Bloklash', `user:block:${user.id}`)]);
  }
  
  // Adminlikdan olib tashlash
  if (user.role === ROLE.ADMIN) {
    buttons.push([Markup.button.callback('❌ Adminlikdan olib tashlash', `user:removeadmin:${user.id}`)]);
  }
  
  buttons.push([Markup.button.callback('🔙 Orqaga', 'admin:allusers')]);
  
  return Markup.inlineKeyboard(buttons);
};

// Admin olish uchun (adminlar ro'yxati)
export const removeAdminKeyboard = (admins, currentAdminId) => {
  const buttons = admins.filter(a => a.id !== currentAdminId).map(a => 
    [Markup.button.callback(`❌ ${a.full_name} (ID:${a.id})`, `user:removeadmin:${a.id}`)]
  );
  buttons.push([Markup.button.callback('🔙 Orqaga', 'admin:back')]);
  return Markup.inlineKeyboard(buttons);
};

// --- Zayavka wizard ---

export const priorityKeyboard = () =>
  Markup.inlineKeyboard([
    PRIORITIES.map((p, i) => Markup.button.callback(p, `prio:${i}`)),
    [Markup.button.callback('❌ Bekor qilish', 'req:cancel')],
  ]);

// Wizard ichida har bir qadamda bekor qilish
export const cancelKeyboard = () =>
  Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'req:cancel')]]);

// Ixtiyoriy qadamlarni o'tkazib yuborish + bekor qilish
export const skipKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("⏭ O'tkazib yuborish", 'req:skip')],
    [Markup.button.callback('❌ Bekor qilish', 'req:cancel')],
  ]);

// Yakuniy tasdiqlash (jo'natish)
export const confirmRequestKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("✅ Sorovni yuborish", 'req:submit')],
    [Markup.button.callback('❌ Bekor qilish', 'req:cancel')],
  ]);

// --- Kanal posti (ishchilar uchun qabul tugmasi) ---
export const acceptKeyboard = (requestId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✅ Qabul qildim', `accept:${requestId}`)],
  ]);

// Reassign (qayta tayinlash)
export const reassignKeyboard = (requestId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Qayta olaman', `reassign:${requestId}`)],
    [Markup.button.callback('❌ Bekor qilish', `worker:cancel:${requestId}`)],
  ]);

// Ishchi qabul qilgan zayavka uchun tugmalar
export const acceptedRequestKeyboard = (requestId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('❌ Sorovni bekor qilish', `worker:cancel:${requestId}`)],
  ]);

// Driver uchun sorovni bekor qilish tugmasi
export const driverCancelRequestKeyboard = (requestId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('❌ Sorovni bekor qilish', `driver:cancel:${requestId}`)],
  ]);

// --- Driverga hal qilingani haqida (Approve) ---
export const approveKeyboard = (requestId) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✅ Tasdiqlash', `approve:${requestId}`)],
    [Markup.button.callback('🔄 Qayta hal qilish kerak', `reopen:${requestId}`)],
  ]);

// --- Admin: foydalanuvchini tasdiqlash/rad etish ---
export const userDecisionKeyboard = (userId) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Tasdiqlash', `user:approve:${userId}`),
      Markup.button.callback('❌ Rad etish', `user:reject:${userId}`),
    ],
  ]);

// --- Admin sozlamalar ---
export const settingsKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('⏱ SLA (daqiqa)', 'set:sla_minutes')],
    [Markup.button.callback('📢 Kanal ID', 'set:channel_id')],
    [Markup.button.callback('👥 Guruh ID', 'set:group_id')],
    [Markup.button.callback('🔙 Orqaga', 'admin:back')],
  ]);

// Orqaga (asosiy admin menyusiga)
export const backToAdminKeyboard = () =>
  Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'admin:back')]]);
