CREATE TABLE "organization_documents" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "objectKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_documents_objectKey_key" ON "organization_documents"("objectKey");
CREATE INDEX "organization_documents_organizationId_createdAt_idx" ON "organization_documents"("organizationId", "createdAt");
ALTER TABLE "organization_documents" ADD CONSTRAINT "organization_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_documents" ADD CONSTRAINT "organization_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;