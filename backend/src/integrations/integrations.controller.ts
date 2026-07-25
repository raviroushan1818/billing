import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { IntegrationsService } from './integrations.service';
import { TestEmailDto, UpsertIntegrationsDto } from './dto/integrations.dto';

@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  @Roles(UserRole.CLIENT_ADMIN)
  get(@CurrentUser() user: AuthUser) {
    return this.integrations.get(user.tenantId);
  }

  @Put()
  @Roles(UserRole.CLIENT_ADMIN)
  upsert(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertIntegrationsDto,
  ) {
    return this.integrations.upsert(user, dto);
  }

  @Post('test-email')
  @Roles(UserRole.CLIENT_ADMIN)
  testEmail(@CurrentUser() user: AuthUser, @Body() dto: TestEmailDto) {
    return this.integrations.testEmail(user, dto);
  }
}
