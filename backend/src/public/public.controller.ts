import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InquiryStatus, UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { PublicService } from './public.service';
import { CreateInquiryDto, UpdateInquiryStatusDto } from './dto/inquiry.dto';

@Controller()
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Post('public/inquiries')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  createInquiry(@Body() dto: CreateInquiryDto) {
    return this.publicService.createInquiry(dto);
  }

  @Get('platform/inquiries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  listInquiries(@Query('status') status?: InquiryStatus) {
    return this.publicService.listInquiries(status);
  }

  @Patch('platform/inquiries/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  updateInquiry(
    @Param('id') id: string,
    @Body() dto: UpdateInquiryStatusDto,
  ) {
    return this.publicService.updateInquiryStatus(id, dto.status);
  }
}
