import type { AppState, InvoiceBatch } from './types';
import { billedAmount } from './rules';

function esc(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

// QuickBooks Online invoice import layout (sample mapping - confirmed in the
// mapping workshop for the client's edition). One row per invoice line.
export const QB_COLUMNS = [
  'InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate', 'Terms', 'Item(Product/Service)',
  'ItemDescription', 'ItemQuantity', 'ItemRate', 'ItemAmount', 'Memo', 'ServiceDate',
];

export function quickBooksCsv(state: AppState, batch: InvoiceBatch): string {
  const agency = state.agencies.find((a) => a.id === batch.agencyId)!;
  const lines = batch.lineIds.map((id) => state.submissions.find((s) => s.id === id)!);
  const invoiceDate = batch.createdAt.slice(0, 10);
  const due = new Date(invoiceDate + 'T12:00:00');
  const termDays = parseInt(agency.terms.replace(/\D/g, ''), 10) || 30;
  due.setDate(due.getDate() + termDays);
  const rows: (string | number)[][] = [QB_COLUMNS];
  for (const s of lines) {
    const vt = state.visitTypes.find((v) => v.code === s.visitTypeCode)!;
    const patient = state.patients.find((p) => p.id === s.patientId)!;
    const clinician = state.users.find((u) => u.id === s.clinicianId)!;
    const amount = billedAmount(s);
    rows.push([
      batch.invoiceNo,
      agency.name,
      invoiceDate,
      due.toISOString().slice(0, 10),
      agency.terms,
      `${vt.short} - ${s.visitTypeCode === 'FUV' ? 'Follow-up visit' : vt.label}`,
      `${vt.label} - ${patient.lastName}, ${patient.firstName} (${patient.emrRef})`,
      1,
      amount.toFixed(2),
      amount.toFixed(2),
      `${clinician.name} - HHC ref ${s.id}${s.agencyAmountOverride ? ' - adjusted: ' + s.agencyAmountOverride.reason : ''}`,
      s.visitDate,
    ]);
  }
  return toCsv(rows);
}

export function downloadText(fileName: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
