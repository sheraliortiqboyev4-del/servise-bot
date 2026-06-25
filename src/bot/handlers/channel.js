import { STATUS_LABEL, REQUEST_STATUS } from '../../constants/index.js';
import { getSetting } from '../../services/settings.service.js';
import { getApprovedWorkers } from '../../services/user.service.js';
import { setChannelMessage } from '../../services/request.service.js';
import { acceptKeyboard } from '../keyboards/index.js';
import { formatDateTime } from '../../utils/format.js';

// Kanal posti matnini quradi
export function buildPostText(req) {
  const lines = [
    '🚛 *NEW SERVICE REQUEST*',
    '',
    `*Request ID:* ${req.code}`,
    '',
    `*Driver:* ${req.driver_name}`,
    `*Phone:* ${req.driver_phone}`,
    `*Location:* ${req.location}`,
    '',
    `*Trailer:* ${req.trailer_number}`,
    `*Unit:* ${req.unit_number}`,
    `*Type:* ${req.request_type}`,
    '',
    `*Priority:* ${req.priority}`,
    `*Problem:* ${req.description}`,
    `*Notes:* ${req.notes || '-'}`,
  ];
  if (req.cancel_reason) lines.push(`\n*Bekor qilish sababi:* ${req.cancel_reason}`);
  lines.push('', `*Status:* ${STATUS_LABEL[req.status]}`, `*Open:* ${formatDateTime(req.created_at)}`);
  if (req.closed_at) lines.push(`*Closed:* ${formatDateTime(req.closed_at)}`);
  return lines.join('\n');
}

// Zayavkani kanalga e'lon qilish + guruhga + barcha ishchilarga xabar
export async function publishRequest(telegram, req) {
  const channelId = await getSetting('channel_id');
  const groupId = await getSetting('group_id');
  const text = buildPostText(req);

  // Birinchi rasmni olamiz
  const firstPhotoId = req.photo_file_ids?.[0];

  // Kanalga post: agar bir nechta rasm bo'lsa media group, aks holda bir rasm yoki matn
  let msg;
  if (channelId) {
    if (req.photo_file_ids.length > 0) {
      if (req.photo_file_ids.length === 1) {
        msg = await telegram.sendPhoto(channelId, firstPhotoId, {
          caption: text,
          parse_mode: 'Markdown',
        });
      } else {
        // Media group yaratamiz (birinchi rasmga caption qo'shamiz)
        const media = req.photo_file_ids.map((fileId, index) => ({
          type: 'photo',
          media: fileId,
          caption: index === 0 ? text : undefined,
          parse_mode: index === 0 ? 'Markdown' : undefined
        }));
        const messages = await telegram.sendMediaGroup(channelId, media);
        msg = messages[0]; // Birinchi xabarni saqlaymiz (statusni yangilash uchun)
      }
    } else {
      msg = await telegram.sendMessage(channelId, text, {
        parse_mode: 'Markdown',
      });
    }
    await setChannelMessage(req.id, msg.message_id);
  }

  // Guruh va dispetcher likiga: birinchi rasm + text + button
  if (groupId) {
    if (firstPhotoId) {
      await telegram.sendPhoto(groupId, firstPhotoId, {
        caption: text, parse_mode: 'Markdown', ...acceptKeyboard(req.id),
      }).catch(() => {});
    } else {
      await telegram.sendMessage(groupId, text, {
        parse_mode: 'Markdown', ...acceptKeyboard(req.id),
      }).catch(() => {});
    }
  }

  // Barcha tasdiqlangan ishchilarga lichkaga xabar
  const workers = await getApprovedWorkers();
  for (const w of workers) {
    try {
      if (firstPhotoId) {
        await telegram.sendPhoto(w.telegram_id, firstPhotoId, {
          caption: text, parse_mode: 'Markdown', ...acceptKeyboard(req.id)
        });
      } else {
        await telegram.sendMessage(w.telegram_id, text, {
          parse_mode: 'Markdown', ...acceptKeyboard(req.id)
        });
      }
    } catch (err) {
      // Xatolikni ignore qilamiz
    }
  }
}

// Kanal postini yangilangan status bilan tahrirlash
export async function updateChannelPost(telegram, req) {
  const channelId = await getSetting('channel_id');
  if (!channelId || !req.channel_msg_id) return;
  const text = buildPostText(req);
  const firstPhotoId = req.photo_file_ids?.[0];
  if (firstPhotoId) {
    await telegram
      .editMessageCaption(channelId, req.channel_msg_id, undefined, text, { parse_mode: 'Markdown' })
      .catch(() => {});
  } else {
    await telegram
      .editMessageText(channelId, req.channel_msg_id, undefined, text, { parse_mode: 'Markdown' })
      .catch(() => {});
  }
}
