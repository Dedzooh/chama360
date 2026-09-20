import { Prisma } from '@prisma/client';

export function toDecimal(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === 'number' || typeof value === 'string') return new Prisma.Decimal(value);
  return new Prisma.Decimal(0);
}

export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  return toDecimal(value).toNumber();
}

export function sumDecimal(values: Array<Prisma.Decimal | number | string | null | undefined>): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((total, value) => total.plus(toDecimal(value)), new Prisma.Decimal(0));
}
