import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PartiesService } from './parties.service';
import { CreatePartyDto, UpdatePartyDto } from './dto/party.dto';

@Controller('parties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartiesController {
  constructor(private readonly parties: PartiesService) {}

  @Post()
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePartyDto) {
    return this.parties.create(user.tenantId, dto);
  }

  @Get()
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  list(@CurrentUser() user: AuthUser, @Query('all') all?: string) {
    return this.parties.list(user.tenantId, all !== 'true');
  }

  @Get('search')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  search(
    @CurrentUser() user: AuthUser,
    @Query('q') q: string,
    @Query('take') take?: string,
  ) {
    return this.parties.search(user.tenantId, q ?? '', take ? Number(take) : 20);
  }

  @Get('import/template')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="parties-template.csv"')
  template(@Res() res: Response) {
    res.send(this.parties.templateCsv());
  }

  @Post('import')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importCsv(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const text = file?.buffer?.toString('utf8') ?? '';
    return this.parties.importCsv(user.tenantId, text);
  }

  @Get(':id')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.parties.get(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePartyDto,
  ) {
    return this.parties.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.parties.remove(user.tenantId, id);
  }
}
