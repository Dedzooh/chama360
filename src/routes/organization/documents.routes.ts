import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireSubscriptionFeature } from '../../middleware/subscription';
import { asyncHandler, BadRequestError, ForbiddenError } from '../../middleware/errorHandler';
import { deleteOrganizationDocument, storeOrganizationDocument } from '../../services/organizationDocumentService';

export function registerOrganizationDocumentsRoutes(router: Router, context: any) {
  const { db, getOrganizationAccess, isOwnerLike, writeOrganizationAudit } = context;
  router.post('/:id/documents', authenticate, requireSubscriptionFeature('DOCUMENTS'), asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isOwnerLike(access.role?.name) && !['TREASURER', 'SECRETARY'].includes(access.role?.name)) throw new ForbiddenError('Only authorized officials can upload organization documents');
    const input = req.body as { name?: string; contentType?: string; data?: string };
    if (!input.name || !input.contentType || !input.data) throw new BadRequestError('Document name, content type, and data are required');
    const document = await storeOrganizationDocument(id, req.user.id, { name: input.name, contentType: input.contentType, data: input.data });
    await writeOrganizationAudit({ organizationId: id, userId: req.user.id, action: 'CREATE', entityType: 'OrganizationDocument', entityId: document.id, newValues: { name: document.name, contentType: document.contentType, sizeBytes: document.sizeBytes } });
    res.status(201).json({ document });
  }));
  router.get('/:id/documents/usage', authenticate, requireSubscriptionFeature('DOCUMENTS'), asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isOwnerLike(access.role?.name) && !['TREASURER', 'SECRETARY'].includes(access.role?.name)) throw new ForbiddenError('Only authorized officials can view organization storage usage');
    const usage = await db.organizationDocument.aggregate({ where: { organizationId: id }, _sum: { sizeBytes: true }, _count: { _all: true } });
    res.json({ usedBytes: Number(usage._sum.sizeBytes ?? 0), documentCount: usage._count._all });
  }));
  router.delete('/:id/documents/:documentId', authenticate, requireSubscriptionFeature('DOCUMENTS'), asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw new BadRequestError('User not authenticated');
    const { id, documentId } = req.params as { id: string; documentId: string };
    const access = await getOrganizationAccess(id, req.user.id);
    if (!isOwnerLike(access.role?.name) && !['TREASURER', 'SECRETARY'].includes(access.role?.name)) throw new ForbiddenError('Only authorized officials can delete organization documents');
    const document = await deleteOrganizationDocument(id, documentId);
    await writeOrganizationAudit({ organizationId: id, userId: req.user.id, action: 'DELETE', entityType: 'OrganizationDocument', entityId: documentId, oldValues: { name: document.name, contentType: document.contentType, sizeBytes: document.sizeBytes } });
    res.status(204).send();
  }));
}
