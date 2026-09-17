import { Router, Request, Response } from 'express';
import { LoanStatus, MemberStatus, MemberRole } from '@prisma/client';
import { prisma } from '../config/database';
import { asyncHandler, BadRequestError, ForbiddenError } from '../middleware/errorHandler';
import { authenticate, rateLimitSensitive, requireMfaIfEnabled } from '../middleware/auth';
import { applyLoanSchema, loanListSchema } from '../schemas/loan';
import { isOperationalChama } from '../utils/chamaLifecycle';
import { auditLog, logger } from '../config/logger';

const router = Router();

/**
 * POST /loan/apply
 * Apply for a loan
 */
router.post('/apply',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const data = applyLoanSchema.parse(req.body);

    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId: data.chamaId,
          userId: req.user.id,
        },
      },
    });

    if (!membership || membership.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenError('Active membership required to apply for a loan');
    }

    const chama = await prisma.chama.findUnique({
      where: { id: data.chamaId },
      select: { status: true },
    });

    if (!isOperationalChama(chama?.status)) {
      throw new ForbiddenError('Loans can only be applied for when the chama is active');
    }

    const interestRate = data.interestRate ?? 10;
    const durationMonths = data.durationMonths ?? 6;
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + durationMonths);

    const loan = await prisma.loan.create({
      data: {
        chamaId: data.chamaId,
        borrowerId: req.user.id,
        memberId: req.user.id,
        amountRequested: data.amount,
        amountApproved: null,
        amount: data.amount,
        purpose: data.purpose,
        interestRate,
        repaymentPeriodMonths: durationMonths,
        guarantorsData: [],
        status: LoanStatus.PENDING,
        dueDate,
        balance: data.amount,
        riskScore: 0,
      },
    });

    auditLog('CREATE', loan.id, req.user.id, {
      action: 'LOAN_APPLIED',
      chamaId: data.chamaId,
      amount: data.amount,
      interestRate,
      durationMonths,
    });

    logger.info('Loan application submitted', {
      loanId: loan.id,
      userId: req.user.id,
      chamaId: data.chamaId,
      amount: data.amount,
    });

    res.status(201).json({
      message: 'Loan application submitted',
      loan,
    });
  })
);

/**
 * GET /loan
 * List loans for current user (optional filtering)
 */
router.get('/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const filters = loanListSchema.parse({
      chamaId: req.query.chamaId as string,
      status: req.query.status as any,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });

    const skip = (filters.page - 1) * filters.limit;

    const where: any = {
      borrowerId: req.user.id,
    };

    if (filters.chamaId) {
      where.chamaId = filters.chamaId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.loan.count({ where }),
    ]);

    res.json({
      loans,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    });
  })
);

/**
 * POST /loan/:loanId/approve
 * Approve loan (Chair/Founder/Treasurer only)
 */
router.post('/:loanId/approve',
  authenticate,
  requireMfaIfEnabled,
  rateLimitSensitive,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError('User not authenticated');
    }

    const { loanId } = req.params;
    if (!loanId) {
      throw new BadRequestError('Loan ID is required');
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new BadRequestError('Loan not found');
    }

    const chama = await prisma.chama.findUnique({
      where: { id: loan.chamaId },
      select: { status: true },
    });

    if (!isOperationalChama(chama?.status)) {
      throw new ForbiddenError('Loans cannot be approved unless the chama is active');
    }

    const membership = await prisma.chamaMembership.findUnique({
      where: {
        chamaId_userId: {
          chamaId: loan.chamaId,
          userId: req.user.id,
        },
      },
    });

    const allowedRoles: MemberRole[] = [MemberRole.FOUNDER, MemberRole.CHAIR, MemberRole.TREASURER];
    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenError('Insufficient permissions to approve loan');
    }

    const updated = await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.ACTIVE,
        disbursedAt: new Date(),
      },
    });

    res.json({
      message: 'Loan approved',
      loan: updated,
    });
  })
);

export { router as loanRouter };
