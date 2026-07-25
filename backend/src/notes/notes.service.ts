import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateNoteDto, UpdateNoteDto } from './dto/notes.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, partyId?: string) {
    const where: Prisma.WorkspaceNoteWhereInput = { tenantId };
    if (partyId) where.partyId = partyId;
    return this.prisma.workspaceNote.findMany({
      where,
      include: {
        party: { select: { id: true, name: true } },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
  }

  async get(tenantId: string, id: string) {
    const note = await this.prisma.workspaceNote.findFirst({
      where: { id, tenantId },
      include: {
        party: { select: { id: true, name: true } },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }

  create(actor: AuthUser, dto: CreateNoteDto) {
    return this.prisma.workspaceNote.create({
      data: {
        tenantId: actor.tenantId,
        title: dto.title,
        body: dto.body ?? '',
        partyId: dto.partyId,
        invoiceId: dto.invoiceId,
        pinned: dto.pinned ?? false,
        remindAt: dto.remindAt ? new Date(dto.remindAt) : null,
        createdById: actor.userId,
      },
      include: {
        party: { select: { id: true, name: true } },
      },
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateNoteDto) {
    await this.get(actor.tenantId, id);
    return this.prisma.workspaceNote.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        partyId: dto.partyId === undefined ? undefined : dto.partyId,
        invoiceId: dto.invoiceId === undefined ? undefined : dto.invoiceId,
        pinned: dto.pinned,
        remindAt:
          dto.remindAt === undefined
            ? undefined
            : dto.remindAt === null
              ? null
              : new Date(dto.remindAt),
      },
      include: {
        party: { select: { id: true, name: true } },
      },
    });
  }

  async remove(actor: AuthUser, id: string) {
    await this.get(actor.tenantId, id);
    await this.prisma.workspaceNote.delete({ where: { id } });
    return { ok: true };
  }
}
