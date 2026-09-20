import { Prisma } from '@prisma/client';
import { sumDecimal, toDecimal, toNumber } from '../utils/decimal';

describe('financial Decimal helpers', () => {
  it('preserves Decimal values without converting through JavaScript numbers', () => {
    const value = new Prisma.Decimal('123456789012345.67');
    expect(toDecimal(value).toString()).toBe('123456789012345.67');
  });

  it('normalizes nullish and numeric inputs', () => {
    expect(toDecimal(null).toString()).toBe('0');
    expect(toDecimal('5000.25').toString()).toBe('5000.25');
    expect(toNumber('5000.25')).toBe(5000.25);
  });

  it('sums money values using Decimal arithmetic', () => {
    expect(sumDecimal(['0.1', '0.2', null]).toString()).toBe('0.3');
  });
});
