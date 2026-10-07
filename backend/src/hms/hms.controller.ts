import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { HmsService } from './hms.service';
import { HmsApiKeyGuard } from './hms-api-key.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { CreateInvoiceDto } from '../invoices/dto/invoice.dto';

@Controller('hms')
export class HmsController {
  constructor(private readonly hms: HmsService) {}

  @Post('auth/token')
  exchangeApiKey(
    @Body() body: { clientId: string; apiKey: string },
  ) {
    return this.hms.exchangeApiKeyForJwt(body.clientId, body.apiKey);
  }

  @Post('auth/sso')
  exchangeSso(@Body() body: { token: string }) {
    return this.hms.exchangeSsoToken(body.token);
  }

  @Post('api-key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT_ADMIN')
  issueKey(
    @CurrentUser() user: AuthUser,
    @Body() body: { hmsBaseUrl?: string },
  ) {
    return this.hms.issueApiKey(user, body.hmsBaseUrl);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT_ADMIN', 'BILLING_OPERATOR')
  status(@CurrentUser() user: AuthUser) {
    return this.hms.getHmsStatus(user.tenantId);
  }

  @Put('parties')
  @UseGuards(HmsApiKeyGuard)
  upsertParty(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      externalId: string;
      name: string;
      phone?: string;
      email?: string;
      address?: string;
      customFields?: Record<string, unknown>;
    },
  ) {
    return this.hms.upsertParty(user, body);
  }

  @Put('items')
  @UseGuards(HmsApiKeyGuard)
  upsertItem(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      barcode: string;
      name: string;
      rate: number;
      gstRate?: number;
      unit?: string;
      hsnSac?: string;
      description?: string;
    },
  ) {
    return this.hms.upsertItem(user, body);
  }

  @Put('invoices/encounter')
  @UseGuards(HmsApiKeyGuard)
  upsertEncounterInvoice(
    @CurrentUser() user: AuthUser,
    @Body()
    body: CreateInvoiceDto & {
      externalRef: string;
      raisedBy?: {
        name?: string;
        email?: string;
        role?: string;
        userId?: string;
      };
    },
  ) {
    return this.hms.upsertEncounterInvoice(user, body);
  }

  @Get('invoices/by-ref/:externalRef')
  @UseGuards(HmsApiKeyGuard)
  getByRef(
    @CurrentUser() user: AuthUser,
    @Param('externalRef') externalRef: string,
  ) {
    return this.hms.getByExternalRef(user, externalRef);
  }
}
