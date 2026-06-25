// Sana-vaqtni o'qiladigan ko'rinishga keltiradi
export function formatDateTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// Ikki vaqt orasidagi farqni daqiqada qaytaradi
export function diffMinutes(start, end) {
  if (!start || !end) return null;
  return Math.round((new Date(end) - new Date(start)) / 60000);
}
