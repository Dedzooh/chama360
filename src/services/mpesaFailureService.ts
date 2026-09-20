export type MpesaFailureClassification = 'RETRYABLE' | 'USER_CANCELLED' | 'INSUFFICIENT_FUNDS' | 'TIMEOUT' | 'INVALID_REQUEST' | 'PERMANENT_FAILURE';

export const classifyMpesaResultCode = (resultCode: number, resultDescription = ''): MpesaFailureClassification => {
  const description = resultDescription.toLowerCase();
  if (resultCode === 1032 || description.includes('cancel')) return 'USER_CANCELLED';
  if (resultCode === 1 || description.includes('insufficient')) return 'INSUFFICIENT_FUNDS';
  if (resultCode === 1037 || description.includes('timeout') || description.includes('timed out')) return 'TIMEOUT';
  if ((resultCode >= 400 && resultCode < 500) || description.includes('invalid')) return 'INVALID_REQUEST';
  if ([1001, 1006, 1019, 1025, 9999].includes(resultCode)) return 'RETRYABLE';
  return 'PERMANENT_FAILURE';
};
