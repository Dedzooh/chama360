import 'dotenv/config';
import { prisma } from '../config/database';
import { contributionPenaltyService } from '../services/contributionPenaltyService';

contributionPenaltyService.reconcile()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .finally(() => prisma.$disconnect());
