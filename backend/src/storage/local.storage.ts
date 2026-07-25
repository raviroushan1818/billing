import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { StorageDriver, UploadInput, UploadResult } from './storage.interface';

export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly uploadDir: string) {}

  async uploadBuffer(input: UploadInput): Promise<UploadResult> {
    const ext = input.filename?.split('.').pop() ?? mimeToExt(input.mimeType);
    const gcsKey = `${input.tenantId}/${input.purpose}/${randomUUID()}.${ext}`;
    const fullPath = join(this.uploadDir, gcsKey);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, input.buffer);
    return {
      gcsKey,
      publicPath: `/api/uploads/${gcsKey}`,
    };
  }

  async getSignedUrl(_gcsKey: string): Promise<string | null> {
    return null;
  }

  getPublicPath(gcsKey: string): string | null {
    return `/api/uploads/${gcsKey}`;
  }

  async downloadBuffer(gcsKey: string): Promise<Buffer> {
    const fullPath = join(this.uploadDir, gcsKey);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${gcsKey}`);
    }
    return readFileSync(fullPath);
  }
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'application/pdf':
      return 'pdf';
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    default:
      return 'bin';
  }
}
