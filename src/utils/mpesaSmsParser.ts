/**
 * M-Pesa SMS parser
 *
 * Parses a pasted M-Pesa confirmation SMS (personal-number payments to the
 * treasurer) into structured payment proof data, so members do not need to
 * manually type receipt numbers, amounts, or dates.
 *
 * Handles the common Safaricom M-Pesa message formats, e.g.:
 * "QGH7DE2X8R Confirmed. Ksh1,000.00 sent to JANE WANJIKU on 2/10/2026 at 14:32.
 *  New M-PESA balance is Ksh450.00."
 * "SBGH7DE2X8R Confirmed. You have received Ksh1,000.00 from WANJIKU JANE
 *  0712 345 678 on 2/10/2026 at 2:32 PM. New M-PESA balance is Ksh450.00."
 */

export interface ParsedMpesaSms {
  receipt: string;
  amount: number;
  paidAt?: string;
  party?: string;
  balance?: number;
}

const RECEIPT = /\b([A-Z0-9]{8,12})\b\s*Confirmed/i;
const RECEIPT_STANDALONE = /\b([A-Z0-9]{10,12})\b/;
const AMOUNT = /(?:Ksh|KES|kes)\s*([\d,]+(?:\.\d{1,2})?)/i;
const DATE_ISO = /(\d{4})-(\d{2})-(\d{2})/;
const DATE_DMY = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/;
const TIME = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i;
const SENT_FROM = /(?:sent to|paid to)\s+([A-Z][A-Z '.]{2,58}?)(?=\s+on\b|\s*\.|$)|received .*? from\s+([A-Z][A-Z '.]{2,58}?)(?=\s+\d|\s+on\b|\s*\.|$)/i;

function buildIsoDate(date: { year: number; month: number; day: number }, hour: number, minute: number): string | undefined {
  const built = new Date(date.year, date.month - 1, date.day, hour, minute);
  const valid =
    built.getFullYear() === date.year &&
    built.getMonth() === date.month - 1 &&
    built.getDate() === date.day;
  return valid && !Number.isNaN(built.getTime()) ? built.toISOString() : undefined;
}

export function parseMpesaSms(text: string): ParsedMpesaSms | null {
  if (!text || text.trim().length < 10) return null;

  const receiptMatch = text.match(RECEIPT) ?? text.match(RECEIPT_STANDALONE);
  const amountMatch = text.match(AMOUNT);
  if (!receiptMatch || !amountMatch) return null;

  const amount = Number(amountMatch?.[1]?.replace(/,/g, '') ?? '0');
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let hour = 12;
  let minute = 0;
  const timeMatch = text.match(TIME);
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
    const suffix = timeMatch[4]?.toUpperCase();
    if (suffix === 'PM' && hour < 12) hour += 12;
    if (suffix === 'AM' && hour === 12) hour = 0;
  }

  let paidAt: string | undefined;
  const isoMatch = text.match(DATE_ISO);
  const dmyMatch = isoMatch ? undefined : text.match(DATE_DMY);
  if (isoMatch) {
    paidAt = buildIsoDate(
      { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) },
      hour,
      minute,
    );
  } else if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const yearRaw = dmyMatch[3] ?? '';
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    if (day >= 1 && month >= 1 && month <= 12 && year >= 2000) {
      paidAt = buildIsoDate({ year, month, day }, hour, minute);
    }
  }

  const partyMatch = text.match(SENT_FROM);
  const balanceMatch = text.match(/balance is (?:Ksh|KES)\s*([\d,]+(?:\.\d{1,2})?)/i);

  return {
    receipt: receiptMatch?.[1]?.toUpperCase() ?? '',
    amount,
    paidAt,
    party: (partyMatch?.[1] ?? partyMatch?.[2])?.trim(),
    balance: balanceMatch?.[1] ? Number(balanceMatch[1].replace(/,/g, '')) : undefined,
  };
}
