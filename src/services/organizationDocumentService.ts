import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { config } from '../config/environment';
import { prisma } from '../config/database';
import { BadRequestError, ServiceUnavailableError } from '../middleware/errorHandler';
import { subscriptionLifecycleService } from './subscriptionLifecycleService';
import { subscriptionPlans } from '../config/subscriptions';

export const storeOrganizationDocument = async (organizationId: string, userId: string, input: { name: string; contentType: string; data: string }) => {
  const storage = config.aws;
  if (!storage.accessKeyId || !storage.secretAccessKey || !storage.s3Bucket) throw new ServiceUnavailableError('Organization document storage is not configured');
  const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']);
  if (!allowedTypes.has(input.contentType)) throw new BadRequestError('Document type is not supported');
  const encoded = input.data.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new BadRequestError('Document data must be valid base64');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length) throw new BadRequestError('Document content is empty');
  if (bytes.length > config.upload.maxFileSize) throw new BadRequestError(`Document exceeds the maximum upload size of ${config.upload.maxFileSize} bytes`);
  const subscription = await subscriptionLifecycleService.reconcileOrganization(organizationId);
  const limitMb = subscriptionPlans[subscription.plan].storageLimitMb;
  const used = await prisma.organizationDocument.aggregate({ where: { organizationId }, _sum: { sizeBytes: true } });
  const usedBytes = Number(used._sum.sizeBytes ?? 0);
  const limitBytes = limitMb === null ? null : limitMb * 1024 * 1024;
  if (limitBytes !== null && usedBytes + bytes.length > limitBytes) {
    const error = new BadRequestError('Storage limit exceeded');
    (error as any).code = 'STORAGE_LIMIT_EXCEEDED';
    (error as any).details = { usedBytes, limitBytes, requiredBytes: bytes.length };
    throw error;
  }
  const client = new S3Client({ credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey }, region: storage.region, endpoint: storage.s3Endpoint, forcePathStyle: storage.s3ForcePathStyle });
  const objectKey = `organizations/${organizationId}/documents/${randomUUID()}-${input.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  await client.send(new PutObjectCommand({ Bucket: storage.s3Bucket, Key: objectKey, Body: bytes, ContentType: input.contentType, ServerSideEncryption: storage.s3KmsKeyId ? 'aws:kms' : 'AES256', ...(storage.s3KmsKeyId ? { SSEKMSKeyId: storage.s3KmsKeyId } : {}) }));
  try {
    return await prisma.organizationDocument.create({ data: { organizationId, uploadedById: userId, name: input.name, contentType: input.contentType, sizeBytes: bytes.length, objectKey } });
  } catch (error) {
    await client.send(new DeleteObjectCommand({ Bucket: storage.s3Bucket, Key: objectKey })).catch(() => undefined);
    throw error;
  }
};

export const deleteOrganizationDocument = async (organizationId: string, documentId: string) => {
  const document = await prisma.organizationDocument.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw new BadRequestError('Organization document not found');
  const storage = config.aws;
  if (storage.accessKeyId && storage.secretAccessKey && storage.s3Bucket) {
    const client = new S3Client({ credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey }, region: storage.region, endpoint: storage.s3Endpoint, forcePathStyle: storage.s3ForcePathStyle });
    await client.send(new DeleteObjectCommand({ Bucket: storage.s3Bucket, Key: document.objectKey }));
  }
  await prisma.organizationDocument.delete({ where: { id: document.id } });
  return document;
};
