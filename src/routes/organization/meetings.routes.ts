import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, BadRequestError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler';
export function registerMeetingsRoutes(router: Router, context: any): void {
  const { db, meetingCreateSchema, meetingUpdateSchema, attendanceSchema, getOrganizationAccess, hasOrganizationPermission, isMeetingManager, requireOrganizationStatus, writeOrganizationAudit } = context;
router.post(
  '/:id/meetings',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isMeetingManager(access) && !hasOrganizationPermission(access, 'CREATE_MEETINGS')) {
      throw new ForbiddenError('Insufficient permissions to create meetings');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot create meetings');
    }

    const payload = meetingCreateSchema.parse(req.body);
    const meeting = await db.meeting.create({
      data: {
        organizationId: id,
        createdById: req.user.id as string,
        title: payload.title,
        dateTime: new Date(payload.dateTime),
        venue: payload.venue,
        agenda: payload.agenda,
        scheduledFor: new Date(payload.dateTime),
        location: payload.venue,
        status: 'SCHEDULED' as any,
      },
      include: {
        createdBy: true,
        attendance: { include: { member: true, recordedBy: true } },
        votes: { include: { options: true, responses: true, createdBy: true, closedBy: true } },
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'CREATE',
      entityType: 'Meeting',
      entityId: meeting.id,
      newValues: meeting,
    });

    res.status(201).json({ meeting });
  })
);

router.get(
  '/:id/meetings',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id } = req.params as { id: string };
    await getOrganizationAccess(id, req.user.id as string);

    const meetings = await db.meeting.findMany({
      where: { organizationId: id },
      orderBy: { dateTime: 'desc' },
      include: {
        createdBy: true,
        attendance: { include: { member: true, recordedBy: true } },
        votes: { include: { options: true, responses: true, createdBy: true, closedBy: true } },
      },
    });

    res.json({ meetings });
  })
);

router.get(
  '/:id/meetings/:meetingId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const meeting = await db.meeting.findFirst({
      where: { id: meetingId, organizationId: id },
      include: {
        createdBy: true,
        attendance: { include: { member: true, recordedBy: true } },
        votes: { include: { options: true, responses: true, createdBy: true, closedBy: true } },
      },
    });

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    res.json({ meeting });
  })
);

router.patch(
  '/:id/meetings/:meetingId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isMeetingManager(access) && !hasOrganizationPermission(access, 'CREATE_MEETINGS')) {
      throw new ForbiddenError('Insufficient permissions to update meetings');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot be updated');
    }

    const payload = meetingUpdateSchema.parse(req.body);
    const existing = await db.meeting.findFirst({
      where: { id: meetingId, organizationId: id },
    });
    if (!existing) {
      throw new NotFoundError('Meeting not found');
    }

    const meeting = await db.meeting.update({
      where: { id: meetingId },
      data: {
        title: payload.title,
        dateTime: payload.dateTime ? new Date(payload.dateTime) : undefined,
        venue: payload.venue,
        agenda: payload.agenda,
        status: payload.status as any,
        scheduledFor: payload.dateTime ? new Date(payload.dateTime) : undefined,
        location: payload.venue,
      },
      include: {
        createdBy: true,
        attendance: { include: { member: true, recordedBy: true } },
        votes: { include: { options: true, responses: true, createdBy: true, closedBy: true } },
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'UPDATE',
      entityType: 'Meeting',
      entityId: meetingId,
      oldValues: existing,
      newValues: meeting,
    });

    res.json({ meeting });
  })
);

router.get(
  '/:id/meetings/:meetingId/attendance',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    await getOrganizationAccess(id, req.user.id as string);

    const attendance = await db.meetingAttendance.findMany({
      where: { organizationId: id, meetingId },
      include: { member: true, recordedBy: true },
      orderBy: { recordedAt: 'desc' },
    });

    res.json({ attendance });
  })
);

router.post(
  '/:id/meetings/:meetingId/attendance',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isMeetingManager(access) && !hasOrganizationPermission(access, 'MANAGE_ATTENDANCE')) {
      throw new ForbiddenError('Insufficient permissions to record attendance');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot record attendance');
    }

    const payload = attendanceSchema.parse(req.body);
    const attendance = await db.meetingAttendance.upsert({
      where: { meetingId_memberId: { meetingId, memberId: payload.memberId } },
      create: {
        organizationId: id,
        meetingId,
        memberId: payload.memberId,
        status: payload.status as any,
        notes: payload.notes,
        recordedById: req.user.id as string,
      },
      update: {
        status: payload.status as any,
        notes: payload.notes,
        recordedById: req.user.id as string,
      },
      include: { member: true, recordedBy: true },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'UPDATE',
      entityType: 'MeetingAttendance',
      entityId: attendance.id,
      newValues: attendance,
    });

    res.status(201).json({ attendance });
  })
);

router.post(
  '/:id/meetings/:meetingId/minutes',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { id, meetingId } = req.params as { id: string; meetingId: string };
    const access = await getOrganizationAccess(id, req.user.id as string);
    if (!isMeetingManager(access) && !hasOrganizationPermission(access, 'RECORD_MINUTES')) {
      throw new ForbiddenError('Insufficient permissions to record minutes');
    }

    const currentOrganization = await requireOrganizationStatus(id);
    if (currentOrganization.status === 'CLOSED' || currentOrganization.status === 'ARCHIVED') {
      throw new ForbiddenError('Closed organizations cannot record minutes');
    }

    const minutes = z.object({
      minutes: z.array(z.string()).default([]),
      resolutions: z.array(z.string()).default([]),
      actionItems: z.array(z.string()).default([]),
    }).parse(req.body);

    const existing = await db.meeting.findFirst({ where: { id: meetingId, organizationId: id } });
    if (!existing) {
      throw new NotFoundError('Meeting not found');
    }

    const meeting = await db.meeting.update({
      where: { id: meetingId },
      data: {
        minutes,
      },
      include: {
        createdBy: true,
        attendance: { include: { member: true, recordedBy: true } },
        votes: { include: { options: true, responses: true, createdBy: true, closedBy: true } },
      },
    });

    await writeOrganizationAudit({
      organizationId: id,
      userId: req.user.id as string,
      action: 'UPDATE',
      entityType: 'Meeting',
      entityId: meetingId,
      oldValues: existing,
      newValues: meeting,
      metadata: { minutesRecorded: true },
    });

    res.json({ meeting });
  })
);


}
