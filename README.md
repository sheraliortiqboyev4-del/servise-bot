# 🚛 Truck Service Bot

Logistika xizmat-so'rovi (service request) uchun Telegram bot. Driver zayavka tashlaydi, ishchilar qabul qilib hal qiladi, admin boshqaradi.

## Texnologiya

- **Node.js 18+** (ESM)
- **Telegraf** — Telegram bot framework
- **PostgreSQL** + `pg` — ma'lumotlar bazasi (DB-level lock bilan)
- **node-cron** — SLA eslatmalari
- **ExcelJS** — CSV/Excel eksport

## Imkoniyatlar

- 2 tur foydalanuvchi: **Driver** (zayavka beradi) / **Ishchi** (hal qiladi)
- Ro'yxatdan o'tish → **admin tasdig'i**
- Zayavka wizard: validatsiya + rasm + ❌ Bekor qilish
- Kanalga post (🟢 Ochiq / 🔴 Yopildi + vaqtlar)
- Barcha ishchilarga xabar
- ✅ Qabul qildim (DB-level lock — dublikat oldini olish)
- Guruhda reply + rasm → driverga **Approve** → kanal statusini yangilash
- Reassign, SLA eslatma (default 20 daqiqa), "Mening zayavkalarim"
- Admin panel: tasdiqlash, sozlamalar (SLA, kanal, guruh, adminlar), `/stats`, eksport
- Barcha tugmalar **inline**

## O'rnatish

```bash
npm install
cp .env.example .env      # .env ni to'ldiring
npm run migrate           # jadvallar + root admin
npm start
```

## Sozlash

1. `.env` da `BOT_TOKEN`, `DATABASE_URL`, `ROOT_ADMIN_ID` ni kiriting
2. Botni **kanal** va **guruhga** admin qilib qo'shing
3. Bot ichida `/admin` → Sozlamalar → kanal ID, guruh ID, SLA ni kiriting

## Struktura

```
src/
  config/        muhit o'zgaruvchilari
  constants/     rollar, statuslar, turlar
  db/            schema, migratsiya, connection
  bot/
    keyboards/   inline tugmalar
    scenes/      ro'yxat + zayavka wizard
    handlers/    start, register, request, worker, channel, group, admin, stats
    middlewares/ auth
  services/      user, request, settings, sla, export
  utils/         validatsiya, format
  index.js
```
