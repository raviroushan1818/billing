import { Module } from '@nestjs/common';
import { BrandingModule } from '../branding/branding.module';
import { PdfService } from './pdf.service';

@Module({
  imports: [BrandingModule],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
