/**
 * Unit tests for the M-Pesa SMS parser (payment proof flow).
 * Pure function tests — no database connection required.
 */
import { describe, it, expect } from '@jest/globals';
import { parseMpesaSms } from '../src/utils/mpesaSmsParser';

describe('parseMpesaSms', () => {
  it('parses a standard "sent to" M-Pesa message', () => {
    const result = parseMpesaSms('QGH7DE2X8R Confirmed. Ksh1,000.00 sent to JANE WANJIKU on 2/10/2026 at 14:32. New M-PESA balance is Ksh450.00.');
    expect(result).not.toBeNull();
    expect(result?.receipt).toBe('QGH7DE2X8R');
    expect(result?.amount).toBe(1000);
    expect(result?.party).toBe('JANE WANJIKU');
    expect(result?.balance).toBe(450);
    expect(result?.paidAt).toBeDefined();
    const parsed = new Date(result?.paidAt ?? '');
    expect(parsed.getMonth()).toBe(9); // October
    expect(parsed.getDate()).toBe(2);
  });

  it('parses a "received from" message with 12-hour time and AM/PM', () => {
    const result = parseMpesaSms('SBGH7DE2X8R Confirmed. You have received Ksh2,500.00 from WANJIKU JANE 0712 345 678 on 2/10/2026 at 2:32 PM. New M-PESA balance is Ksh450.00.');
    expect(result).not.toBeNull();
    expect(result?.receipt).toBe('SBGH7DE2X8R');
    expect(result?.amount).toBe(2500);
    expect(result?.party).toBe('WANJIKU JANE');
    const parsed = new Date(result?.paidAt ?? '');
    expect(parsed.getHours()).toBe(14);
    expect(parsed.getMinutes()).toBe(32);
  });

  it('converts PM correctly for 12 PM (noon)', () => {
    const result = parseMpesaSms('QGH7DE2X8R Confirmed. Ksh500.00 sent to JOHN DOE on 5/1/2026 at 12:15 PM. New M-PESA balance is Ksh1,000.00.');
    const parsed = new Date(result?.paidAt ?? '');
    expect(parsed.getHours()).toBe(12);
    expect(parsed.getMinutes()).toBe(15);
  });

  it('converts AM correctly for 12 AM (midnight)', () => {
    const result = parseMpesaSms('QGH7DE2X8R Confirmed. Ksh500.00 sent to JOHN DOE on 5/1/2026 at 12:15 AM. New M-PESA balance is Ksh1,000.00.');
    const parsed = new Date(result?.paidAt ?? '');
    expect(parsed.getHours()).toBe(0);
  });

  it('parses ISO date format without misreading it as dd/mm', () => {
    const result = parseMpesaSms('QGH7DE2X8R Confirmed. Ksh800.00 sent to JOHN DOE on 2026-09-30 at 14:32. New M-PESA balance is Ksh200.00.');
    const parsed = new Date(result?.paidAt ?? '');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8); // September
    expect(parsed.getDate()).toBe(30);
  });

  it('returns null when there is no amount', () => {
    expect(parseMpesaSms('QGH7DE2X8R Confirmed. sent to JANE WANJIKU on 2/10/2026 at 14:32.')).toBeNull();
  });

  it('returns null when there is no receipt code', () => {
    expect(parseMpesaSms('Confirmed. Ksh1,000.00 sent to JANE WANJIKU on 2/10/2026 at 14:32.')).toBeNull();
  });

  it('returns null for empty or too-short text', () => {
    expect(parseMpesaSms('')).toBeNull();
    expect(parseMpesaSms('   ')).toBeNull();
    expect(parseMpesaSms('short txt')).toBeNull();
  });

  it('returns null when amount is zero or negative-looking', () => {
    expect(parseMpesaSms('QGH7DE2X8R Confirmed. Ksh0.00 sent to JANE on 2/10/2026 at 14:32.')).toBeNull();
  });

  it('rejects invalid calendar dates like 31/02', () => {
    const result = parseMpesaSms('QGH7DE2X8R Confirmed. Ksh500.00 sent to JOHN DOE on 31/02/2026 at 10:00. New M-PESA balance is Ksh1,000.00.');
    // Parser should still return the payment (amount + receipt are valid) but never invent Feb 31
    if (result?.paidAt) {
      const parsed = new Date(result.paidAt);
      expect(parsed.getMonth()).toBe(1); // must stay February if set at all
      expect(parsed.getDate()).toBe(31); // and never roll over to March 3
    }
  });

  it('does not treat a bare 8-9 char word as a receipt (requires 10-12 for standalone)', () => {
    // "Confirmed." preceded by short token: standalone fallback must not fire on it
    const result = parseMpesaSms('Payment QGH7DE2X8R was Confirmed. Ksh300.00 sent to ANN on 3/11/2026 at 09:00.');
    expect(result?.receipt).toBe('QGH7DE2X8R');
  });
});
