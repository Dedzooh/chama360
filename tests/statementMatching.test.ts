/**
 * Unit tests for the statement matching engine (reconciliation flow).
 * Pure function tests — no database connection required.
 */
import { describe, it, expect } from '@jest/globals';
import { matchStatementToProofs, type MatchableProof } from '../src/utils/statementMatching';
import type { StatementRow } from '../src/utils/statementParser';

const proof = (overrides: Partial<MatchableProof> & { id: string }): MatchableProof => ({
  amount: 1000,
  reference: null,
  paidAt: null,
  label: 'Member',
  ...overrides,
});

const row = (overrides: Partial<StatementRow> & { amount: number }): StatementRow => ({
  ...overrides,
});

describe('matchStatementToProofs', () => {
  it('matches exactly by reference code', () => {
    const rows = [row({ amount: 1000, reference: 'RCB7QX1P2A', date: '2026-09-30' })];
    const proofs = [proof({ id: 'p1', amount: 1000, reference: 'RCB7QX1P2A' })];
    const result = matchStatementToProofs(rows, proofs);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.confidence).toBe('EXACT');
    expect(result.matches[0]?.proofId).toBe('p1');
  });

  it('does not match reference when proof reference is missing or too short', () => {
    const rows = [row({ amount: 1000, reference: 'RCB7QX1P2A' })];
    const proofs = [proof({ id: 'p1', reference: 'AB' })];
    const result = matchStatementToProofs(rows, proofs);
    expect(result.matches).toHaveLength(0);
  });

  it('matches by amount + date within window', () => {
    const rows = [row({ amount: 1500, date: '2026-09-30' })];
    const proofs = [proof({ id: 'p1', amount: 1500, paidAt: '2026-09-29T10:00:00Z' })];
    const result = matchStatementToProofs(rows, proofs);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.confidence).toBe('AMOUNT_DATE');
  });

  it('does NOT match amount + date when dates are outside the window', () => {
    const rows = [row({ amount: 1500, date: '2026-09-10' })];
    const proofs = [proof({ id: 'p1', amount: 1500, paidAt: '2026-09-29T10:00:00Z' })];
    const result = matchStatementToProofs(rows, proofs);
    expect(result.matches).toHaveLength(0);
  });

  it('does NOT match ambiguous amount+date (two candidate rows)', () => {
    const rows = [
      row({ amount: 1500, date: '2026-09-29' }),
      row({ amount: 1500, date: '2026-09-30' }),
    ];
    const proofs = [proof({ id: 'p1', amount: 1500, paidAt: '2026-09-29T12:00:00Z' })];
    const result = matchStatementToProofs(rows, proofs);
    expect(result.matches).toHaveLength(0);
  });

  it('falls back to amount-only match when unique', () => {
    const rows = [row({ amount: 2000, date: '2026-09-01' })];
    const proofs = [proof({ id: 'p1', amount: 2000, paidAt: null })];
    const result = matchStatementToProofs(rows, proofs);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.confidence).toBe('AMOUNT_ONLY');
  });

  it('does NOT match amount-only when multiple rows have the same amount', () => {
    const rows = [row({ amount: 2000 }), row({ amount: 2000 })];
    const proofs = [proof({ id: 'p1', amount: 2000 })];
    const result = matchStatementToProofs(rows, proofs);
    expect(result.matches).toHaveLength(0);
  });

  it('each statement row is used at most once', () => {
    const rows = [
      row({ amount: 1000, reference: 'RCB1AAAAAA' }),
      row({ amount: 1000, reference: 'RCB2BBBBBB' }),
    ];
    const proofs = [
      proof({ id: 'p1', amount: 1000, reference: 'RCB1AAAAAA' }),
      proof({ id: 'p2', amount: 1000, reference: 'RCB2BBBBBB' }),
    ];
    const result = matchStatementToProofs(rows, proofs);
    expect(result.matches).toHaveLength(2);
    expect(new Set(result.matches.map((m) => m.rowIndex)).size).toBe(2);
  });

  it('excludes matched rows from the unmatched set', () => {
    const rows = [
      row({ amount: 1000, reference: 'RCB1AAAAAA' }),
      row({ amount: 5000 }),
    ];
    const proofs = [proof({ id: 'p1', amount: 1000, reference: 'RCB1AAAAAA' })];
    const result = matchStatementToProofs(rows, proofs);
    expect(result.matchedRowIndexes.size).toBe(1);
  });

  it('prefers EXACT reference over AMOUNT_DATE', () => {
    const rows = [row({ amount: 1000, reference: 'RCB7QX1P2A', date: '2026-10-20' })];
    const proofs = [proof({ id: 'p1', amount: 1000, reference: 'RCB7QX1P2A', paidAt: '2026-09-28T12:00:00Z' })];
    const result = matchStatementToProofs(rows, proofs);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.confidence).toBe('EXACT');
  });

  it('returns no matches for empty inputs', () => {
    expect(matchStatementToProofs([], []).matches).toHaveLength(0);
    expect(matchStatementToProofs([row({ amount: 100 })], []).matches).toHaveLength(0);
    expect(matchStatementToProofs([], [proof({ id: 'p1' })]).matches).toHaveLength(0);
  });
});
