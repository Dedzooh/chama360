/**
 * Unit tests for the statement parser (M-Pesa text + bank CSV).
 * Pure function tests — no database connection required.
 */
import { describe, it, expect } from '@jest/globals';
import { parseMpesaStatementText, parseStatementCsv } from '../src/utils/statementParser';

describe('parseMpesaStatementText', () => {
  it('parses structured M-Pesa statement lines', () => {
    const rows = parseMpesaStatementText(
      '2026-09-30 14:32  Deposit  RCB7QX1P2A  KES 1,000.00  Paid to: JANE WANJIKU\n2026-09-28 09:10  Deposit  RCB8AA22BB  KES 2,500.00  Paid to: JOHN DOE',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ amount: 1000, reference: 'RCB7QX1P2A', date: '2026-09-30' });
    expect(rows[1]).toMatchObject({ amount: 2500, reference: 'RCB8AA22BB', date: '2026-09-28' });
  });

  it('parses copy-pasted full M-Pesa SMS lines', () => {
    const rows = parseMpesaStatementText('QGH7DE2X8R Confirmed. Ksh1,000.00 sent to JANE WANJIKU on 2/10/2026 at 14:32. New M-PESA balance is Ksh450.00.');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 1000, reference: 'QGH7DE2X8R' });
  });

  it('skips blank lines and lines without amounts', () => {
    const rows = parseMpesaStatementText('\nM-PESA Statement\n\n2026-09-30 Deposit RCB7QX1P2A KES 1,000.00\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(1000);
  });

  it('returns empty array for empty input', () => {
    expect(parseMpesaStatementText('')).toEqual([]);
    expect(parseMpesaStatementText('   \n  \n')).toEqual([]);
  });
});

describe('parseStatementCsv', () => {
  it('detects headers and maps columns', () => {
    const csv = [
      'Date,Amount,Reference,Details',
      '30/09/2026,1000.00,RCB7QX1P2A,JANE WANJIKU',
      '28/09/2026,2500.00,RCB8AA22BB,JOHN DOE',
    ].join('\n');
    const rows = parseStatementCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ amount: 1000, reference: 'RCB7QX1P2A', date: '2026-09-30' });
    expect(rows[1]).toMatchObject({ amount: 2500, reference: 'RCB8AA22BB' });
  });

  it('handles quoted CSV cells containing commas', () => {
    const csv = [
      'Date,Amount,Reference,Details',
      '"30/09/2026","1,000.00","RCB7QX1P2A","WANJIKU, JANE"',
    ].join('\n');
    const rows = parseStatementCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(1000);
    expect(rows[0]?.details).toBe('WANJIKU, JANE');
  });

  it('falls back to positional columns when there is no header', () => {
    const csv = '30/09/2026,1000.00,RCB7QX1P2A,JANE WANJIKU';
    const rows = parseStatementCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 1000, reference: 'RCB7QX1P2A' });
  });

  it('skips debit/negative rows and zero amounts', () => {
    const csv = [
      'Date,Amount,Reference,Details',
      '30/09/2026,1000.00,RCB7QX1P2A,Deposit',
      '30/09/2026,-500.00,WTH1XXXXXX,Withdrawal',
      '30/09/2026,0.00,ZZZ,Nothing',
    ].join('\n');
    const rows = parseStatementCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(1000);
  });

  it('returns empty array for empty or single-line CSV', () => {
    expect(parseStatementCsv('')).toEqual([]);
    expect(parseStatementCsv('Date,Amount')).toEqual([]);
  });

  it('accepts ISO date format in CSV', () => {
    const csv = ['Date,Amount,Reference', '2026-09-30,1000.00,RCB7QX1P2A'].join('\n');
    const rows = parseStatementCsv(csv);
    expect(rows[0]?.date).toBe('2026-09-30');
  });
});
