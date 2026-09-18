import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { requireSubscriptionFeature } from '../../middleware/subscription';

type InvestmentsRouteContext = {
  db: any;
  investmentAssetSchema: any;
  getOrganizationAccess: (organizationId: string, userId: string) => Promise<any>;
  canViewAllFinancials: (membership: any) => boolean;
  isFinanceManager: (membership: any) => boolean;
};

export function registerInvestmentsRoutes(router: Router, context: InvestmentsRouteContext): void {
  const { db, investmentAssetSchema, getOrganizationAccess, canViewAllFinancials, isFinanceManager } = context;

  router.get('/:id/investments', authenticate, requireSubscriptionFeature('INVESTMENT_AUTOMATION'), asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    const organization = await db.organization.findUnique({ where: { id }, select: { metadata: true } });
    if (!organization) throw new NotFoundError('Organization not found');
    const metadata = (organization.metadata ?? {}) as Record<string, any>;
    const assets = Array.isArray(metadata.investmentPortfolio) ? metadata.investmentPortfolio : [];
    const purchaseCost = assets.filter((asset: any) => asset.status !== 'SOLD').reduce((sum: number, asset: any) => sum + Number(asset.purchaseCost ?? 0), 0);
    const currentValue = assets.filter((asset: any) => asset.status !== 'SOLD').reduce((sum: number, asset: any) => sum + Number(asset.currentValue ?? 0), 0);
    const [paidByMember, members] = await Promise.all([
      db.contribution.groupBy({ by: ['memberId'], where: { organizationId: id, status: 'PAID' }, _sum: { amount: true } }),
      db.organizationMember.findMany({ where: { organizationId: id, status: 'ACTIVE' }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } }),
    ]);
    const contributionsByMember = new Map(paidByMember.map((row: any) => [row.memberId, Number(row._sum.amount ?? 0)]));
    const totalMemberCapital = [...contributionsByMember.values()].reduce((sum: number, amount: any) => sum + Number(amount), 0);
    const allPositions = members.map((member: any) => {
      const contributed = Number(contributionsByMember.get(member.userId) ?? 0);
      const ownershipPercent = totalMemberCapital ? (contributed / totalMemberCapital) * 100 : 0;
      const estimatedValue = currentValue * ownershipPercent / 100;
      return { memberId: member.userId, member: member.user, contributed, ownershipPercent, estimatedValue, estimatedGain: (currentValue - purchaseCost) * ownershipPercent / 100 };
    });
    const positions = canViewAllFinancials(access) ? allPositions : allPositions.filter((position: any) => position.memberId === req.user!.id);
    res.json({ assets, positions, summary: { assetCount: assets.length, activeAssets: assets.filter((asset: any) => asset.status === 'ACTIVE').length, purchaseCost, currentValue, gainLoss: currentValue - purchaseCost, returnPercent: purchaseCost ? ((currentValue - purchaseCost) / purchaseCost) * 100 : 0, totalMemberCapital } });
  }));

  router.post('/:id/investments', authenticate, requireSubscriptionFeature('INVESTMENT_AUTOMATION'), asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isFinanceManager(access)) throw new ForbiddenError('Only Treasurer or Admin can manage investments');
    const payload = investmentAssetSchema.parse(req.body);
    const asset = { id: randomUUID(), ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordedById: req.user.id };
    await db.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`investment-portfolio:${id}`}))`;
      const organization = await tx.organization.findUnique({ where: { id }, select: { metadata: true } });
      if (!organization) throw new NotFoundError('Organization not found');
      const metadata = (organization.metadata ?? {}) as Record<string, any>;
      const assets = Array.isArray(metadata.investmentPortfolio) ? metadata.investmentPortfolio : [];
      await tx.organization.update({ where: { id }, data: { metadata: { ...metadata, investmentPortfolio: [...assets, asset] } } });
      await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'CREATE', entityType: 'InvestmentAsset', entityId: asset.id, newValues: asset } });
    });
    res.status(201).json({ asset });
  }));

  router.patch('/:id/investments/:assetId', authenticate, requireSubscriptionFeature('INVESTMENT_AUTOMATION'), asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id, assetId } = req.params as { id: string; assetId: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isFinanceManager(access)) throw new ForbiddenError('Only Treasurer or Admin can manage investments');
    const payload = investmentAssetSchema.partial().parse(req.body);
    let updatedAsset: any;
    await db.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`investment-portfolio:${id}`}))`;
      const organization = await tx.organization.findUnique({ where: { id }, select: { metadata: true } });
      if (!organization) throw new NotFoundError('Organization not found');
      const metadata = (organization.metadata ?? {}) as Record<string, any>;
      const assets = Array.isArray(metadata.investmentPortfolio) ? metadata.investmentPortfolio : [];
      const index = assets.findIndex((asset: any) => asset.id === assetId);
      if (index < 0) throw new NotFoundError('Investment asset not found');
      const oldAsset = assets[index]; updatedAsset = { ...oldAsset, ...payload, updatedAt: new Date().toISOString() };
      assets[index] = updatedAsset;
      await tx.organization.update({ where: { id }, data: { metadata: { ...metadata, investmentPortfolio: assets } } });
      await tx.organizationAuditLog.create({ data: { organizationId: id, userId: req.user!.id, action: 'UPDATE', entityType: 'InvestmentAsset', entityId: assetId, oldValues: oldAsset, newValues: updatedAsset } });
    });
    res.json({ asset: updatedAsset });
  }));
}
