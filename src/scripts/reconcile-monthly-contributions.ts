import 'dotenv/config';
import { prisma } from '../config/database';
import { monthlyContributionService } from '../services/monthlyContributionService';

monthlyContributionService.reconcile()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .finally(() => prisma.$disconnect());
