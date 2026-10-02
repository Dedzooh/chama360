/**
 * Statement matching
 *
 * Matches parsed statement rows against pending member payment proofs so the
 * treasurer doesn't have to eyeball every claim.
 *
 * Strategy (highest confidence first):
 *  1. Reference match   — proof's receipt code appears in the row (exact, case-insensitive).
 *  2. Amount + date     — same amount and row date within ±3 days of the claimed payment date.
 *  3. Amount only       — single unmatched row with that amount (only when unambiguous).
 *
 * A statement row can satisfy at most one proof; leftover rows are returned as
 * "unmatched deposits" for the treasurer to investigate manually.
 */

import type { StatementRow } from './statementParser';

export interface MatchableProof {
  id: string;
  amount: number;
  reference?: string | null;
  paidAt?: string | null;
  label: string;
}

export interface ProofMatch {
  proofId: string;
  row: StatementRow;
  rowIndex: number;
  confidence: 'EXACT' | 'AMOUNT_DATE' | 'AMOUNT_ONLY';
}

export interface StatementMatchResult {
  matches: ProofMatch[];
  matchedRowIndexes: Set<number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_WINDOW_DAYS = 3;

export function matchStatementToProofs(rows: StatementRow[], proofs: MatchableProof[]): StatementMatchResult {
  const rowUsed = new Array<boolean>(rows.length).fill(false);
  const proofUsed = new Set<string>();
  const matches: ProofMatch[] = [];

  const takeRow = (rowIndex: number, proof: MatchableProof, confidence: ProofMatch['confidence']) => {
    rowUsed[rowIndex] = true;
    proofUsed.add(proof.id);
    matches.push({ proofId: proof.id, row: rows[rowIndex] as StatementRow, rowIndex, confidence });
  };

  // 1. Exact reference match
  for (const proof of proofs) {
    if (!proof.reference) continue;
    const ref = proof.reference.trim().toUpperCase();
    if (ref.length < 6) continue;
    const rowIndex = rows.findIndex((row, index) => !rowUsed[index] && row.reference?.toUpperCase().includes(ref));
    if (rowIndex >= 0 && rows[rowIndex] && !proofUsed.has(proof.id)) takeRow(rowIndex, proof, 'EXACT');
  }

  // 2. Amount + date window
  for (const proof of proofs) {
    if (proofUsed.has(proof.id)) continue;
    const proofDate = proof.paidAt ? new Date(proof.paidAt) : null;
    const proofTime = proofDate && !Number.isNaN(proofDate.getTime()) ? proofDate.getTime() : null;
    const candidateIndexes = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => {
        if (rowUsed[index]) return false;
        if (Math.abs(row.amount - proof.amount) > 0.01) return false;
        if (!proofTime || !row.date) return false;
        const rowTime = new Date(row.date).getTime();
        if (Number.isNaN(rowTime)) return false;
        return Math.abs(rowTime - proofTime) <= DATE_WINDOW_DAYS * DAY_MS;
      })
      .map(({ index }) => index);
    // Ambiguous (several rows could match) — leave for the treasurer.
    const chosen = candidateIndexes[0];
    if (chosen !== undefined && candidateIndexes.length === 1) takeRow(chosen, proof, 'AMOUNT_DATE');
  }

  // 3. Amount only, unambiguous. If the proof claims a payment date, do not
  //    rescue it by matching a row dated far outside that window. A proof with
  //    an invalid (too-short) reference is not trusted for amount-only matching.
  for (const proof of proofs) {
    if (proofUsed.has(proof.id)) continue;
    if (proof.reference && proof.reference.trim().length < 6) continue;
    const proofDate = proof.paidAt ? new Date(proof.paidAt) : null;
    const proofTime = proofDate && !Number.isNaN(proofDate.getTime()) ? proofDate.getTime() : null;
    const candidateIndexes = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => {
        if (rowUsed[index]) return false;
        if (Math.abs(row.amount - proof.amount) > 0.01) return false;
        if (proofTime && row.date) {
          const rowTime = new Date(row.date).getTime();
          if (!Number.isNaN(rowTime) && Math.abs(rowTime - proofTime) > DATE_WINDOW_DAYS * DAY_MS) return false;
        }
        return true;
      })
      .map(({ index }) => index);
    if (candidateIndexes.length === 1) {
      const chosen = candidateIndexes[0];
      if (chosen !== undefined) takeRow(chosen, proof, 'AMOUNT_ONLY');
    }
  }

  return { matches, matchedRowIndexes: new Set(matches.map((m) => m.rowIndex)) };
}
