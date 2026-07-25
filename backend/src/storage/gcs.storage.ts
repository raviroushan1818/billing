import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { StorageDriver, UploadInput, UploadResult } from './storage.interface';

export class GcsStorageDriver implements StorageDriver {
  private readonly storage: Storage;
  private readonly bucket: string;

  constructor(opts: {
    bucket: string;
    projectId?: string;
    keyFilename?: string;
    clientEmail?: string;
    privateKey?: string;
  }) {
    this.bucket = opts.bucket;
    if (opts.keyFilename) {
      this.storage = new Storage({
        projectId: opts.projectId,
        keyFilename: opts.keyFilename,
      });
    } else if (opts.clientEmail && opts.privateKey) {
      this.storage = new Storage({
        projectId: opts.projectId,
        credentials: {
          client_email: opts.clientEmail,
          private_key: opts.privateKey.replace(/\\n/g, '\n'),
        },
      });
    } else {
      this.storage = new Storage(
        opts.projectId ? { projectId: opts.projectId } : undefined,
      );
    }
  }

  async uploadBuffer(input: UploadInput): Promise<UploadResult> {
    const ext = input.filename?.split('.').pop() ?? 'bin';
    const gcsKey = `tenants/${input.tenantId}/${input.purpose.toLowerCase()}/${randomUUID()}.${ext}`;
    const file = this.storage.bucket(this.bucket).file(gcsKey);

    await file.save(input.buffer, {
      contentType: input.mimeType,
      resumable: false,
    });

    const signedUrl = await this.getSignedUrl(gcsKey, 60);
    return { gcsKey, signedUrl: signedUrl ?? undefined };
  }

  async getSignedUrl(gcsKey: string, expiresMinutes = 15): Promise<string | null> {
    const file = this.storage.bucket(this.bucket).file(gcsKey);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresMinutes * 60_000,
    });
    return url;
  }

  getPublicPath(_gcsKey: string): string | null {
    return null;
  }

  async downloadBuffer(gcsKey: string): Promise<Buffer> {
    const file = this.storage.bucket(this.bucket).file(gcsKey);
    const [contents] = await file.download();
    return contents;
  }
}
