import 'dotenv/config';
import { prisma } from '../config/database';
import { contributionReminderService } from '../services/contributionReminderService';

contributionReminderService.reconcile()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .finally(() => prisma.$disconnect());
