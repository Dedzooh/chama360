import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHmac, randomUUID } from 'crypto';
import { config } from '../config/environment';
import { prisma } from '../config/database';
import { BadRequestError, ServiceUnavailableError } from '../middleware/errorHandler';

type DocumentInput = {
  userId: string;
  type: string;
  frontImage: string;
  backImage?: string;
  documentNumber: string;
  issueDate?: Date;
  expiryDate?: Date;
  issuingAuthority?: string;
};

type ParsedImage = { bytes: Buffer; contentType: string; extension: string };

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class DocumentService {
  private static storage() {
    const { accessKeyId, secretAccessKey, region, s3Bucket, s3Endpoint, s3ForcePathStyle, s3KmsKeyId, documentHashSecret } = config.aws;
    if (!accessKeyId || !secretAccessKey || !s3Bucket || !documentHashSecret) {
      throw new ServiceUnavailableError('KYC document storage is not configured');
    }
    return {
      bucket: s3Bucket,
      kmsKeyId: s3KmsKeyId,
      hashSecret: documentHashSecret,
      client: new S3Client({
        credentials: { accessKeyId, secretAccessKey },
        region,
        endpoint: s3Endpoint,
        forcePathStyle: s3ForcePathStyle,
      }),
    };
  }

  private static parseImage(value: string): ParsedImage {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
    const encoded = (match?.[2] ?? value).replace(/\s/g, '');
    if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new BadRequestError('Document image must be a base64-encoded JPEG, PNG, or WebP file');
    }
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length || bytes.length > config.upload.maxFileSize) {
      throw new BadRequestError(`Document image must be between 1 byte and ${config.upload.maxFileSize} bytes`);
    }
    const detectedType = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? 'image/jpeg'
      : bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        ? 'image/png'
        : bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
          ? 'image/webp'
          : undefined;
    if (!detectedType || (match?.[1] && match[1] !== detectedType)) {
      throw new BadRequestError('Document image content does not match an allowed JPEG, PNG, or WebP format');
    }
    const contentType = detectedType;
    return { bytes, contentType, extension: ALLOWED_IMAGE_TYPES[contentType]! };
  }

  private static async uploadObject(userId: string, side: 'front' | 'back', image: ParsedImage) {
    const storage = this.storage();
    const key = `kyc/${userId}/${randomUUID()}-${side}.${image.extension}`;
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: image.bytes,
      ContentType: image.contentType,
      CacheControl: 'no-store',
      ServerSideEncryption: storage.kmsKeyId ? 'aws:kms' : 'AES256',
      ...(storage.kmsKeyId ? { SSEKMSKeyId: storage.kmsKeyId } : {}),
    }));
    return { key, contentType: image.contentType };
  }

  static async storeDocument(input: DocumentInput) {
    const storage = this.storage();
    const front = this.parseImage(input.frontImage);
    const back = input.backImage ? this.parseImage(input.backImage) : undefined;
    const uploadedKeys: string[] = [];
    try {
      const frontUpload = await this.uploadObject(input.userId, 'front', front);
      uploadedKeys.push(frontUpload.key);
      const backUpload = back ? await this.uploadObject(input.userId, 'back', back) : undefined;
      if (backUpload) uploadedKeys.push(backUpload.key);
      return await prisma.kycDocument.create({
        data: {
          userId: input.userId,
          type: input.type,
          frontObjectKey: frontUpload.key,
          frontContentType: frontUpload.contentType,
          backObjectKey: backUpload?.key,
          backContentType: backUpload?.contentType,
          documentNumberHash: createHmac('sha256', storage.hashSecret).update(input.documentNumber.trim().toUpperCase()).digest('hex'),
          documentNumberLast4: input.documentNumber.slice(-4),
          issueDate: input.issueDate,
          expiryDate: input.expiryDate,
          issuingAuthority: input.issuingAuthority,
        },
      });
    } catch (error) {
      if (uploadedKeys.length) {
        await storage.client.send(new DeleteObjectsCommand({ Bucket: storage.bucket, Delete: { Objects: uploadedKeys.map(Key => ({ Key })), Quiet: true } })).catch(() => undefined);
      }
      throw error;
    }
  }

  static async listDocuments(userId: string) {
    return prisma.kycDocument.findMany({
      where: { userId },
      select: { id: true, type: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async deleteUserDocuments(userId: string) {
    const documents = await prisma.kycDocument.findMany({ where: { userId }, select: { frontObjectKey: true, backObjectKey: true } });
    if (!documents.length) return;
    const storage = this.storage();
    const keys = documents.flatMap(document => [document.frontObjectKey, document.backObjectKey]).filter((key): key is string => Boolean(key));
    if (keys.length) {
      await storage.client.send(new DeleteObjectsCommand({ Bucket: storage.bucket, Delete: { Objects: keys.map(Key => ({ Key })), Quiet: true } }));
    }
    await prisma.kycDocument.deleteMany({ where: { userId } });
  }
}
