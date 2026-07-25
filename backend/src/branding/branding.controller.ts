import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { BrandingService } from './branding.service';
import { UpdateBrandTemplateDto } from './dto/branding.dto';

const imageUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

@Controller('branding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  getRoot(@CurrentUser() user: AuthUser) {
    return this.branding.get(user.tenantId);
  }

  @Put()
  @Roles(UserRole.CLIENT_ADMIN)
  putRoot(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBrandTemplateDto,
  ) {
    return this.branding.update(user.tenantId, dto);
  }

  @Get('template')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  get(@CurrentUser() user: AuthUser) {
    return this.branding.get(user.tenantId);
  }

  @Patch('template')
  @Roles(UserRole.CLIENT_ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBrandTemplateDto,
  ) {
    return this.branding.update(user.tenantId, dto);
  }

  @Post('logo')
  @Roles(UserRole.CLIENT_ADMIN)
  @UseInterceptors(imageUpload)
  uploadLogo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.branding.uploadLogo(user.tenantId, file);
  }

  @Delete('logo')
  @Roles(UserRole.CLIENT_ADMIN)
  removeLogo(@CurrentUser() user: AuthUser) {
    return this.branding.removeLogo(user.tenantId);
  }

  @Post('banner')
  @Roles(UserRole.CLIENT_ADMIN)
  @UseInterceptors(imageUpload)
  uploadBanner(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.branding.uploadBanner(user.tenantId, file);
  }

  @Delete('banner')
  @Roles(UserRole.CLIENT_ADMIN)
  removeBanner(@CurrentUser() user: AuthUser) {
    return this.branding.removeBanner(user.tenantId);
  }
}
