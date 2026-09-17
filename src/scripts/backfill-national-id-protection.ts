import { prisma } from '../config/database';
import { IdentityProtectionService } from '../services/identityProtectionService';

const apply = process.argv.includes('--apply');

async function main(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { nationalId: { not: null } },
    select: { id: true, nationalId: true },
  });

  if (!apply) {
    console.log(`National-ID protection backfill: ${users.length} row(s) require conversion.`);
    console.log('Run npm run identity:backfill -- --apply after backing up the database.');
    return;
  }

  for (const user of users) {
    if (!user.nationalId) continue;
    const protectedIdentity = IdentityProtectionService.protect(user.nationalId);
    await prisma.user.update({ where: { id: user.id }, data: protectedIdentity });
  }

  const remaining = await prisma.user.count({ where: { nationalId: { not: null } } });
  if (remaining !== 0) throw new Error(`${remaining} plaintext national ID row(s) remain`);
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "users" VALIDATE CONSTRAINT "users_nationalId_plaintext_disabled"',
  );
  console.log(`Protected ${users.length} national ID row(s); no plaintext values remain.`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
