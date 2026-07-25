import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/notes.dto';

@Controller('notes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.CLIENT_ADMIN,
  UserRole.BILLING_OPERATOR,
  UserRole.ACCOUNTANT,
  UserRole.VIEWER,
)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('partyId') partyId?: string) {
    return this.notes.list(user.tenantId, partyId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notes.get(user.tenantId, id);
  }

  @Post()
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
  )
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) {
    return this.notes.create(user, dto);
  }

  @Patch(':id')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
  )
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notes.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notes.remove(user, id);
  }
}
