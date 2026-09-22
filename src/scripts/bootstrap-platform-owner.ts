import { prisma } from '../config/database';

const bootstrap = async () => {
  const emailArgument = process.argv.find((argument) => argument.startsWith('--email='))?.slice('--email='.length);
  const email = (emailArgument || process.env.PLATFORM_OWNER_EMAIL || '').trim().toLowerCase();

  if (!email) {
    console.error('Provide --email=<account email> or PLATFORM_OWNER_EMAIL.');
    process.exitCode = 1;
  } else {
    try {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) {
        throw new Error(`No existing user found for ${email}. The bootstrap command never creates accounts.`);
      }
      await prisma.user.update({ where: { id: user.id }, data: { platformRole: 'PLATFORM_OWNER' } });
      console.log(`${email} is now a CHAMAZ360 PLATFORM_OWNER.`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Platform owner bootstrap failed.');
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  }
};

void bootstrap();