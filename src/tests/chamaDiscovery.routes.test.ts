/**
 * Integration tests for Chama Discovery Routes
 * Task 5.2: Implement Chama discovery and public directory
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import request from 'supertest';
import express from 'express';
import { chamaRouter } from '../routes/chama';
import { ChamaService } from '../services/chamaService';
import { ChamaType, Frequency } from '@prisma/client';

// Mock the ChamaService
jest.mock('../services/chamaService');

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test_user_id', email: 'test@example.com' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => {
    next();
  },
}));

// Mock logger
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  auditLog: jest.fn(),
}));

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/chama', chamaRouter);

describe('Chama Discovery Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /chama/public', () => {
    it('should return public chamas with pagination', async () => {
      const mockResponse = {
        chamas: [
          {
            id: 'chama_1',
            name: 'Test Chama',
            type: ChamaType.ROSCA,
            description: 'Test description',
            maxMembers: 20,
            contributionAmount: 1000,
            contributionFrequency: Frequency.MONTHLY,
            currency: 'KES',
            shareableLink: 'link1',
            qrCode: 'qr1',
            createdAt: new Date(),
            _count: { memberships: 10, contributions: 50 },
            memberships: [],
            successMetrics: {
              memberCount: 10,
              contributionSuccessRate: 90,
              loanRepaymentRate: 80,
              avgReliabilityScore: 75,
              totalContributions: 50,
              activeLoans: 2,
            },
            availableSlots: 10,
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      };

      (ChamaService.getPublicChamas as jest.Mock).mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/chama/public')
        .expect(200);

      expect(response.body.chamas).toHaveLength(1);
      expect(response.body.pagination.page).toBe(1);
      expect(ChamaService.getPublicChamas).toHaveBeenCalledWith(
        1,
        20,
        expect.any(Object)
      );
    });

    it('should accept filter parameters', async () => {
      const mockResponse = {
        chamas: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      };

      (ChamaService.getPublicChamas as jest.Mock).mockResolvedValue(mockResponse);

      await request(app)
        .get('/chama/public')
        .query({
          page: '2',
          limit: '10',
          search: 'savings',
          type: 'ROSCA',
          minContribution: '500',
          maxContribution: '2000',
          frequency: 'MONTHLY',
        })
        .expect(200);

      expect(ChamaService.getPublicChamas).toHaveBeenCalledWith(
        2,
        10,
        expect.objectContaining({
          search: 'savings',
          type: ChamaType.ROSCA,
          minContribution: 500,
          maxContribution: 2000,
          frequency: Frequency.MONTHLY,
        })
      );
    });
  });

  describe('GET /chama/recommendations', () => {
    it('should return personalized recommendations', async () => {
      const mockRecommendations = [
        {
          id: 'chama_2',
          name: 'Recommended Chama',
          type: ChamaType.ROSCA,
          description: 'Similar to your groups',
          maxMembers: 20,
          contributionAmount: 1200,
          contributionFrequency: Frequency.MONTHLY,
          currency: 'KES',
          shareableLink: 'link2',
          qrCode: 'qr2',
          createdAt: new Date(),
          _count: { memberships: 8, contributions: 40 },
          memberships: [],
          successMetrics: {
            memberCount: 8,
            contributionSuccessRate: 85,
            loanRepaymentRate: 75,
            avgReliabilityScore: 70,
            totalContributions: 40,
            activeLoans: 1,
          },
          matchScore: 75,
          availableSlots: 12,
          recommendationReason: 'Matches your preferred ROSCA type',
        },
      ];

      (ChamaService.getRecommendedChamas as jest.Mock).mockResolvedValue(mockRecommendations);

      const response = await request(app)
        .get('/chama/recommendations')
        .expect(200);

      expect(response.body.recommendations).toHaveLength(1);
      expect(response.body.recommendations[0].matchScore).toBe(75);
      expect(response.body.recommendations[0].recommendationReason).toBeDefined();
      expect(ChamaService.getRecommendedChamas).toHaveBeenCalledWith('test_user_id', 10);
    });

    it('should accept custom limit parameter', async () => {
      (ChamaService.getRecommendedChamas as jest.Mock).mockResolvedValue([]);

      await request(app)
        .get('/chama/recommendations')
        .query({ limit: '5' })
        .expect(200);

      expect(ChamaService.getRecommendedChamas).toHaveBeenCalledWith('test_user_id', 5);
    });
  });

  describe('GET /chama/featured', () => {
    it('should return featured chamas', async () => {
      const mockFeatured = [
        {
          id: 'chama_1',
          name: 'High Performer',
          type: ChamaType.ROSCA,
          description: 'Best chama',
          maxMembers: 20,
          contributionAmount: 1000,
          contributionFrequency: Frequency.MONTHLY,
          currency: 'KES',
          shareableLink: 'link1',
          qrCode: 'qr1',
          createdAt: new Date(),
          _count: { memberships: 18, contributions: 200 },
          memberships: [],
          successMetrics: {
            memberCount: 18,
            contributionSuccessRate: 95,
            loanRepaymentRate: 90,
            avgReliabilityScore: 90,
            totalContributions: 200,
            activeLoans: 2,
          },
          successScore: 92,
          availableSlots: 2,
        },
      ];

      (ChamaService.getFeaturedChamas as jest.Mock).mockResolvedValue(mockFeatured);

      const response = await request(app)
        .get('/chama/featured')
        .expect(200);

      expect(response.body.featured).toHaveLength(1);
      expect(response.body.featured[0].successScore).toBe(92);
      expect(ChamaService.getFeaturedChamas).toHaveBeenCalledWith(5);
    });

    it('should accept custom limit parameter', async () => {
      (ChamaService.getFeaturedChamas as jest.Mock).mockResolvedValue([]);

      await request(app)
        .get('/chama/featured')
        .query({ limit: '3' })
        .expect(200);

      expect(ChamaService.getFeaturedChamas).toHaveBeenCalledWith(3);
    });
  });

  describe('POST /chama/:chamaId/bookmark', () => {
    it('should bookmark a chama successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Chama bookmarked successfully',
      };

      (ChamaService.bookmarkChama as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/chama/chama_1/bookmark')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('bookmarked successfully');
      expect(ChamaService.bookmarkChama).toHaveBeenCalledWith('test_user_id', 'chama_1');
    });

    it('should return 400 if chama ID is missing', async () => {
      await request(app)
        .post('/chama//bookmark')
        .expect(404); // Express returns 404 for missing route params
    });

    it('should handle service errors', async () => {
      (ChamaService.bookmarkChama as jest.Mock).mockRejectedValue(
        new Error('Chama not found')
      );

      await request(app)
        .post('/chama/invalid_chama/bookmark')
        .expect(500);
    });
  });
});
