ALTER TABLE "organizations" ADD COLUMN "inviteToken" TEXT;
CREATE UNIQUE INDEX "organizations_inviteToken_key" ON "organizations"("inviteToken");
