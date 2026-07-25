import { MediaPurpose } from '@prisma/client';

export type UploadInput = {
  tenantId: string;
  purpose: MediaPurpose;
  mimeType: string;
  buffer: Buffer;
  filename?: string;
};

export type UploadResult = {
  gcsKey: string;
  publicPath?: string;
  signedUrl?: string;
};

export interface StorageDriver {
  uploadBuffer(input: UploadInput): Promise<UploadResult>;
  getSignedUrl(gcsKey: string, expiresMinutes?: number): Promise<string | null>;
  getPublicPath(gcsKey: string): string | null;
  downloadBuffer(gcsKey: string): Promise<Buffer>;
}
