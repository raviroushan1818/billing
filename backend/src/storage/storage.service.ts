import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { MediaPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageDriver } from './local.storage';
import { GcsStorageDriver } from './gcs.storage';
import { StorageDriver, UploadInput, UploadResult } from './storage.interface';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const driverMode = (config.get<string>('STORAGE_DRIVER') ?? 'local').toLowerCase();
    const gcsBucket = config.get<string>('GCS_BUCKET')?.trim();
    const gcsProject = config.get<string>('GCS_PROJECT_ID')?.trim();
    const keyFilename =
      config.get<string>('GOOGLE_APPLICATION_CREDENTIALS')?.trim() ||
      config.get<string>('GCS_KEY_FILE')?.trim();
    const clientEmail = config.get<string>('GCS_CLIENT_EMAIL')?.trim();
    const privateKey = config.get<string>('GCS_PRIVATE_KEY')?.trim();

    const useGcs =
      driverMode === 'gcs' ||
      Boolean(gcsBucket && (keyFilename || (clientEmail && privateKey)));

    if (useGcs && gcsBucket) {
      this.driver = new GcsStorageDriver({
        bucket: gcsBucket,
        projectId: gcsProject,
        keyFilename,
        clientEmail,
        privateKey,
      });
      this.logger.log(`Storage driver: GCS bucket=${gcsBucket}`);
    } else {
      const uploadDir =
        config.get<string>('UPLOAD_DIR') ?? join(process.cwd(), 'uploads');
      this.driver = new LocalStorageDriver(uploadDir);
      this.logger.log(`Storage driver: local dir=${uploadDir}`);
    }
  }

  async uploadBuffer(input: UploadInput): Promise<UploadResult> {
    const result = await this.driver.uploadBuffer(input);

    await this.prisma.mediaObject.create({
      data: {
        tenantId: input.tenantId,
        gcsKey: result.gcsKey,
        mimeType: input.mimeType,
        purpose: input.purpose,
        sizeBytes: input.buffer.length,
      },
    });

    return result;
  }

  getSignedUrl(gcsKey: string, expiresMinutes?: number) {
    return this.driver.getSignedUrl(gcsKey, expiresMinutes);
  }

  getPublicPath(gcsKey: string): string | null {
    return this.driver.getPublicPath(gcsKey);
  }

  downloadBuffer(gcsKey: string): Promise<Buffer> {
    return this.driver.downloadBuffer(gcsKey);
  }

  async uploadForPurpose(
    tenantId: string,
    purpose: MediaPurpose,
    buffer: Buffer,
    mimeType: string,
    filename?: string,
  ): Promise<UploadResult> {
    return this.uploadBuffer({
      tenantId,
      purpose,
      buffer,
      mimeType,
      filename,
    });
  }
}
