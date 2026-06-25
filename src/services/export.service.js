import ExcelJS from 'exceljs';
import { getAllRequests } from './request.service.js';
import { formatDateTime } from '../utils/format.js';

// Barcha zayavkalarni Excel buffer ko'rinishida qaytaradi
export async function buildRequestsExcel() {
  const requests = await getAllRequests();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Requests');

  ws.columns = [
    { header: 'Code', key: 'code', width: 12 },
    { header: 'Type', key: 'request_type', width: 16 },
    { header: 'Unit', key: 'unit_number', width: 10 },
    { header: 'Trailer', key: 'trailer_number', width: 10 },
    { header: 'Driver', key: 'driver_name', width: 18 },
    { header: 'Phone', key: 'driver_phone', width: 16 },
    { header: 'Location', key: 'location', width: 18 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Created', key: 'created_at', width: 20 },
    { header: 'Closed', key: 'closed_at', width: 20 },
  ];

  for (const r of requests) {
    ws.addRow({
      ...r,
      created_at: formatDateTime(r.created_at),
      closed_at: formatDateTime(r.closed_at),
    });
  }

  ws.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
}
