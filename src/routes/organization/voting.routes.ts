import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
import { requireSubscriptionFeature } from '../../middleware/subscription';
export function registerVotingRoutes(router: Router, context: any): void {
  const { db, voteCreateSchema, voteResponseSchema, getOrganizationAccess, hasOrganizationPermission, isVoteManager, requireOrganizationStatus, writeOrganizationAudit } = context;
router.post(
  '/:id/meetings/:meetingId/votes',
  authenticate,
  requireSubscriptionFeature('VOTING'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isVoteManager(access) && !hasOrganizationPermission(access, 'MANAGE_VOTING')) {
      throw new ForbiddenError('Insufficient permissions to create votes');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot create votes');
    }

    const payload = voteCreateSchema.parse(req.body);
    const meeting = await db.meeting.findFirst({ where: { id: meetingId, organizationId: id } });
    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    const linkedChamaId = (currentOrganization as any).chama?.id;
    if (!linkedChamaId) {
      throw new BadRequestError('Organization is not linked to a Chama');
    }

    const vote = await db.vote.create({
      data: {
        chamaId: linkedChamaId,
        organizationId: id,
        meetingId,
        createdById: req.user.id as string,
        title: payload.title,
        description: payload.description,
        type: 'SIMPLE' as any,
        quorumRequired: payload.quorumRequired,
        startDate: new Date(),
        endDate: payload.closesAt ? new Date(payload.closesAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        closesAt: payload.closesAt ? new Date(payload.closesAt) : null,
        status: 'ACTIVE' as any,
        isAnonymous: payload.isAnonymous,
        options: {
          create: payload.options.map((option: string) => ({ text: option })),
        },
      },
      include: {
        options: true,
        responses: true,
        createdBy: true,
        closedBy: true,
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'CREATE',
      entityType: 'Vote',
      entityId: vote.id,
      newValues: vote,
    });

    res.status(201).json({ vote });
  })
);

router.get(
  '/:id/meetings/:meetingId/votes',
  authenticate,
  requireSubscriptionFeature('VOTING'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const votes = await db.vote.findMany({
      where: { organizationId: id, meetingId },
      include: {
        options: true,
        responses: { include: { member: true } },
        createdBy: true,
        closedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ votes });
  })
);

router.patch(
  '/:id/votes/:voteId/close',
  authenticate,
  requireSubscriptionFeature('VOTING'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, voteId } = req.params as { id: string; voteId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isVoteManager(access) && !hasOrganizationPermission(access, 'MANAGE_VOTING')) {
      throw new ForbiddenError('Insufficient permissions to close votes');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot close votes');
    }

    const existing = await db.vote.findFirst({ where: { id: voteId, organizationId: id } });
    if (!existing) {
      throw new NotFoundError('Vote not found');
    }

    const vote = await db.vote.update({
      where: { id: voteId },
      data: {
        status: 'CLOSED' as any,
        closedById: req.user.id as string,
        closesAt: new Date(),
      },
      include: {
        options: true,
        responses: { include: { member: true } },
        createdBy: true,
        closedBy: true,
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'UPDATE',
      entityType: 'Vote',
      entityId: voteId,
      oldValues: existing,
      newValues: vote,
      metadata: { closed: true },
    });

    res.json({ vote });
  })
);

router.post(
  '/:id/votes/:voteId/response',
  authenticate,
  requireSubscriptionFeature('VOTING'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, voteId } = req.params as { id: string; voteId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot accept votes');
    }

    const payload = voteResponseSchema.parse(req.body);
    const vote = await db.vote.findFirst({
      where: { id: voteId, organizationId: id },
      include: { options: true },
    });
    if (!vote) {
      throw new NotFoundError('Vote not found');
    }

    if (vote.status !== 'ACTIVE') {
      throw new BadRequestError('Vote is not open');
    }

    const optionExists = vote.options.some((option: { text: string }) => option.text === payload.selectedOption);
    if (!optionExists) {
      throw new BadRequestError('Invalid vote option');
    }

    const response = await db.voteCast.upsert({
      where: { voteId_memberId: { voteId, memberId: req.user.id as string } },
      create: {
        organizationId: id,
        voteId,
        memberId: req.user.id as string,
        selectedOption: payload.selectedOption,
        votedAt: new Date(),
      },
      update: {
        selectedOption: payload.selectedOption,
        votedAt: new Date(),
      },
      include: { member: true, vote: { include: { options: true } } },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'CREATE',
      entityType: 'VoteCast',
      entityId: response.id,
      newValues: response,
    });

    res.status(201).json({ response });
  })
);

router.get(
  '/:id/votes/:voteId/results',
  authenticate,
  requireSubscriptionFeature('VOTING'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, voteId } = req.params as { id: string; voteId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const vote = await db.vote.findFirst({
      where: { id: voteId, organizationId: id },
      include: {
        options: true,
        responses: true,
        createdBy: true,
        closedBy: true,
      },
    });
    if (!vote) {
      throw new NotFoundError('Vote not found');
    }

    const counts = vote.options.map((option: { text: string }) => ({
      option: option.text,
      votes: vote.responses.filter((response: { selectedOption: string }) => response.selectedOption === option.text).length,
    }));

    res.json({
      vote,
      results: counts,
      totalResponses: vote.responses.length,
    });
  })
);


}
