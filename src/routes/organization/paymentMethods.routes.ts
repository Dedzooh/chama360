import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';

type ChamaPaymentChannelType = 'MPESA_TILL' | 'MPESA_PAYBILL' | 'TREASURER_MPESA' | 'BANK' | 'OTHER';
type ChamaPaymentMethodStatus = 'ACTIVE' | 'PENDING_VERIFICATION' | 'DISABLED';

// Chama payment methods are the Chama's OWN collection channels. They are
// deliberately separate from the Chama360 platform subscription collection
// number (0713222431 / config.mpesa.shortcode). Only authorized finance roles
// may configure them, and every change writes a full audit trail with the
// previous and new values so member payments cannot be fraudulently redirected.

const paymentMethodCreateSchema = z.object({
  channelType: z.enum(['MPESA_TILL', 'MPESA_PAYBILL', 'TREASURER_MPESA', 'BANK', 'OTHER']),
  label: z.string().trim().min(1).max(60),
  tillNumber: z.string().trim().max(20).optional(),
  paybillNumber: z.string().trim().max(20).optional(),
  accountNumber: z.string().trim().max(30).optional(),
  bankName: z.string().trim().max(80).optional(),
  bankAccountName: z.string().trim().max(80).optional(),
  bankAccountNumber: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(20).optional(),
  recipientName: z.string().trim().max(80).optional(),
  instructions: z.string().trim().max(1000).optional(),
  status: z.enum(['ACTIVE', 'PENDING_VERIFICATION', 'DISABLED']).optional(),
  isDefault: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.channelType === 'MPESA_TILL' && !data.tillNumber) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tillNumber'], message: 'A Till number is required for an M-Pesa Till method' });
  }
  if (data.channelType === 'MPESA_PAYBILL' && !data.paybillNumber) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paybillNumber'], message: 'A PayBill number is required for an M-Pesa PayBill method' });
  }
  if (data.channelType === 'TREASURER_MPESA' && !data.phone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: 'The Treasurer phone number is required for this method' });
  }
  if (data.channelType === 'BANK' && (!data.bankName || !data.bankAccountNumber)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bankAccountNumber'], message: 'Bank name and account number are required for a bank method' });
  }
});

const paymentMethodUpdateSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  tillNumber: z.string().trim().max(20).optional(),
  paybillNumber: z.string().trim().max(20).optional(),
  accountNumber: z.string().trim().max(30).optional(),
  bankName: z.string().trim().max(80).optional(),
  bankAccountName: z.string().trim().max(80).optional(),
  bankAccountNumber: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(20).optional(),
  recipientName: z.string().trim().max(80).optional(),
  instructions: z.string().trim().max(1000).optional(),
  status: z.enum(['ACTIVE', 'PENDING_VERIFICATION', 'DISABLED']).optional(),
  isDefault: z.boolean().optional(),
});

type RouteContext = {
  // Prisma delegates are deeply typed per-model; the shared router context used
  // across these route modules is intentionally loose (same pattern as the
  // existing organization route modules), so keep it as `any` with an eslint
  // opt-out at the single declaration site.
  db: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  getOrganizationAccess: (organizationId: string, userId: string) => Promise<any>;
  isFinanceManager: (access: any) => boolean;
  writeOrganizationAudit: (params: { organizationId: string; userId: string; action: 'CREATE' | 'UPDATE' | 'DELETE'; entityType: string; entityId: string; oldValues?: unknown; newValues?: unknown; metadata?: Record<string, unknown> }) => Promise<unknown>;
};

const methodDetails = (method: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (method.channelType as ChamaPaymentChannelType) {
    case 'MPESA_TILL':
      return { kind: 'Till Number', value: method.tillNumber };
    case 'MPESA_PAYBILL':
      return { kind: 'PayBill', value: method.paybillNumber, account: method.accountNumber };
    case 'TREASURER_MPESA':
      return { kind: 'Treasurer M-Pesa', value: method.phone, account: method.recipientName };
    case 'BANK':
      return { kind: 'Bank', value: method.bankAccountNumber, account: [method.bankName, method.bankAccountName].filter(Boolean).join(' — ') };
    default:
      return { kind: 'Other', value: method.instructions ?? null };
  }
};

export function registerPaymentMethodRoutes(router: Router, context: RouteContext): void {
  const { db, getOrganizationAccess, isFinanceManager, writeOrganizationAudit } = context;

  // Public within the chama: members need to see the enabled methods so they
  // know where to pay contributions. Disabled / pending methods are hidden
  // from members but visible to finance officials with a status flag.
  router.get('/:id/payment-methods', authenticate, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    const canManage = isFinanceManager(access);
    const methods = await db.organizationPaymentMethod.findMany({
      where: { organizationId: id, ...(canManage ? {} : { status: 'ACTIVE' as ChamaPaymentMethodStatus }) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({
      methods: methods.map((method: any) => ({
        id: method.id,
        channelType: method.channelType,
        label: method.label,
        ...methodDetails(method),
        instructions: method.instructions,
        status: method.status,
        isDefault: method.isDefault,
        updatedAt: method.updatedAt,
      })),
      canManage,
    });
  }));

  router.post('/:id/payment-methods', authenticate, requireMfaIfEnabled, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isFinanceManager(access)) {
      throw new ForbiddenError('Only the Treasurer, Founder, Chair or Admin can configure payment methods');
    }
    const payload = paymentMethodCreateSchema.parse(req.body);
    const existingCount = await db.organizationPaymentMethod.count({ where: { organizationId: id } });
    const method = await db.organizationPaymentMethod.create({
      data: {
      channelType: payload.channelType,
      label: payload.label,
      tillNumber: payload.tillNumber,
      paybillNumber: payload.paybillNumber,
      accountNumber: payload.accountNumber,
      bankName: payload.bankName,
      bankAccountName: payload.bankAccountName,
      bankAccountNumber: payload.bankAccountNumber,
      phone: payload.phone,
      recipientName: payload.recipientName,
      instructions: payload.instructions,
      status: (payload.status ?? 'ACTIVE') as string,
      isDefault: payload.isDefault ?? existingCount === 0,
        createdById: req.user.id,
      },
    });
    if (method.isDefault) {
      await db.organizationPaymentMethod.updateMany({ where: { organizationId: id, id: { not: method.id } }, data: { isDefault: false } });
    }
    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id,
      action: 'CREATE',
      entityType: 'OrganizationPaymentMethod',
      entityId: method.id,
      newValues: method,
      metadata: { operation: 'PAYMENT_METHOD_ADDED', channelType: method.channelType },
    });
    res.status(201).json({ method });
  }));

  router.patch('/:id/payment-methods/:methodId', authenticate, requireMfaIfEnabled, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id, methodId } = req.params as { id: string; methodId: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isFinanceManager(access)) {
      throw new ForbiddenError('Only the Treasurer, Founder, Chair or Admin can change payment methods');
    }
    const existing = await db.organizationPaymentMethod.findUnique({ where: { id: methodId } });
    if (!existing || existing.organizationId !== id) throw new NotFoundError('Payment method not found');
    const payload = paymentMethodUpdateSchema.parse(req.body);

    const changedFields = Object.keys(payload).filter((key) => JSON.stringify((payload as any)[key]) !== JSON.stringify((existing as any)[key]));
    // Changing the collection details (numbers / account) is the fraud-sensitive
    // operation — flag it explicitly in the audit trail.
    const sensitiveFields = ['tillNumber', 'paybillNumber', 'accountNumber', 'bankAccountNumber', 'phone'].filter((field) => changedFields.includes(field) && payload[field as keyof typeof payload] !== undefined);

    const method = await db.organizationPaymentMethod.update({
      where: { id: methodId },
      data: {
        ...payload,
        status: (payload.status as ChamaPaymentMethodStatus | undefined) ?? undefined,
        updatedById: req.user.id,
      },
    });
    if (payload.isDefault === true) {
      await db.organizationPaymentMethod.updateMany({ where: { organizationId: id, id: { not: methodId } }, data: { isDefault: false } });
    }
    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'OrganizationPaymentMethod',
      entityId: methodId,
      oldValues: existing,
      newValues: method,
      metadata: {
        operation: 'PAYMENT_METHOD_CHANGED',
        changedFields,
        sensitiveFieldsChanged: sensitiveFields,
        ...(sensitiveFields.length ? {
          changeSummary: sensitiveFields.map((field) => ({ field, previous: (existing as any)[field], new: (method as any)[field] })),
        } : {}),
      },
    });
    res.json({ method });
  }));

  router.delete('/:id/payment-methods/:methodId', authenticate, requireMfaIfEnabled, rateLimitSensitive, asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id, methodId } = req.params as { id: string; methodId: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isFinanceManager(access)) {
      throw new ForbiddenError('Only the Treasurer, Founder, Chair or Admin can remove payment methods');
    }
    const existing = await db.organizationPaymentMethod.findUnique({ where: { id: methodId } });
    if (!existing || existing.organizationId !== id) throw new NotFoundError('Payment method not found');
    await db.organizationPaymentMethod.update({
      where: { id: methodId },
      data: { status: 'DISABLED' as ChamaPaymentMethodStatus, isDefault: false, updatedById: req.user.id },
    });
    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id,
      action: 'UPDATE',
      entityType: 'OrganizationPaymentMethod',
      entityId: methodId,
      oldValues: existing,
      newValues: { ...existing, status: 'DISABLED' },
      metadata: { operation: 'PAYMENT_METHOD_DISABLED' },
    });
    res.json({ message: 'Payment method disabled. Historical payments keep their reference to it.' });
  }));
}
