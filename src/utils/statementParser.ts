/**
 * Statement parser
 *
 * Parses pasted M-Pesa statement text or bank statement CSV into a list of
 * incoming payment rows. Used by the treasurer's reconciliation flow: paste or
 * upload a statement, the system extracts rows, then matches them against
 * pending member payment proofs.
 *
 * M-Pesa statement rows look like:
 *   "2026-09-30 14:32  Deposit  RCB7QX1P2A  KES 1,000.00  Paid to: JANE WANJIKA"
 * or free-form M-Pesa SMS text (delegated to parseMpesaSms).
 *
 * Bank CSV: heuristically detects the header row, then maps columns for
 * date / amount / reference / details.
 */

import { parseMpesaSms } from './mpesaSmsParser';

export interface StatementRow {
  date?: string;
  amount: number;
  reference?: string;
  details?: string;
}

const AMOUNT_IN_ROW = /(?:KES|Ksh|ksh)?\s*([\d,]+\.\d{2})/g;
const DATE_IN_ROW = /(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})/;
const REF_IN_ROW = /\b([A-Z0-9]{8,12})\b/;

function toAmount(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

function normalizeDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const day = m[1] ?? '1';
    const month = m[2] ?? '1';
    const yearRaw = m[3] ?? '';
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    if (!year) return undefined;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return undefined;
}

/** Parse pasted M-Pesa statement text: one payment per line. */
export function parseMpesaStatementText(text: string): StatementRow[] {
  const rows: StatementRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Try full SMS format first (covers copy-pasted M-Pesa messages).
    const sms = parseMpesaSms(trimmed);
    if (sms) {
      rows.push({ date: sms.paidAt?.slice(0, 10), amount: sms.amount, reference: sms.receipt, details: sms.party });
      continue;
    }

    // Structured statement line: date ... ref ... amount
    const dateMatch = trimmed.match(DATE_IN_ROW);
    const refMatch = trimmed.match(REF_IN_ROW);
    const amounts = [...trimmed.matchAll(AMOUNT_IN_ROW)].map((m) => toAmount(m[1] ?? ''));
    const amount = amounts.length ? amounts[amounts.length - 1] ?? NaN : NaN; // M-Pesa lines end with the amount
    if (!Number.isFinite(amount) || amount <= 0) continue;

    rows.push({
      date: normalizeDate(dateMatch?.[0]),
      amount,
      reference: refMatch?.[1],
      details: trimmed.slice(0, 120),
    });
  }
  return rows;
}

/** Parse a bank/CSV export: detects header row, maps columns. */
export function parseStatementCsv(csv: string): StatementRow[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 1) return [];

  const splitCsv = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else current += char;
    }
    cells.push(current.trim());
    return cells;
  };

  const firstLine = lines[0] ?? '';
  const header = splitCsv(firstLine).map((cell) => cell.toLowerCase());
  const findCol = (names: string[]) => header.findIndex((cell) => names.some((name) => cell.includes(name)));
  let dateCol = findCol(['date']);
  let amountCol = findCol(['amount', 'credit', 'value']);
  let refCol = findCol(['ref', 'receipt', 'code', 'trans id', 'transaction']);
  let detailCol = findCol(['detail', 'description', 'narration', 'particulars', 'paid to', 'name']);
  const hasHeader = dateCol >= 0 && amountCol >= 0 && Number.isNaN(Number(header[amountCol]?.replace(/[\d.,]/g, '')));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (!hasHeader) {
    // No header: assume date, amount, ref, details ordering.
    dateCol = 0;
    amountCol = 1;
    refCol = 2;
    detailCol = 3;
  }

  const rows: StatementRow[] = [];
  for (const line of dataLines) {
    const cells = splitCsv(line);
    const amountCell = amountCol >= 0 ? cells[amountCol] : undefined;
    const cleanedAmount = (amountCell ?? '').replace(/[^\d.,-]/g, '');
    if (cleanedAmount.includes('-')) continue; // debit/withdrawal row — deposits only
    const amount = toAmount(cleanedAmount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const dateCell = dateCol >= 0 ? cells[dateCol] : undefined;
    const refCell = refCol >= 0 ? cells[refCol] : undefined;
    const detailCell = detailCol >= 0 ? cells[detailCol] : undefined;
    rows.push({
      date: normalizeDate(dateCell),
      amount,
      reference: refCell ? refCell.toUpperCase() : undefined,
      details: detailCell ? detailCell.slice(0, 120) : undefined,
    });
  }
  return rows;
}
