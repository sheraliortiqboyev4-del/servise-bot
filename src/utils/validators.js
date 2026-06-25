// Faqat raqamlardan iboratligini tekshiradi (Unit/Trailer raqami uchun)
export function isNumeric(value) {
  return /^\d+$/.test(String(value).trim());
}

// Telefon raqami formati: (555) 123-4567, +99890..., 998901234567 va h.k.
export function isPhone(value) {
  return /^[+()\d][\d\s()-]{6,19}$/.test(String(value).trim());
}

// Bo'sh emasligini tekshiradi
export function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
