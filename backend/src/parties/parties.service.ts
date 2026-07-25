import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartyDto, UpdatePartyDto } from './dto/party.dto';
import { ImportResult, parseCsv, toCsv } from '../common/csv.util';

const PARTY_HEADERS = [
  'externalId',
  'name',
  'phone',
  'email',
  'address',
  'city',
  'state',
  'stateCode',
  'pincode',
  'gstin',
  'referredBy',
];

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreatePartyDto) {
    return this.prisma.party.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email?.toLowerCase(),
        address: dto.address,
        city: dto.city,
        state: dto.state,
        stateCode: dto.stateCode,
        pincode: dto.pincode,
        gstin: dto.gstin?.toUpperCase(),
        externalId: dto.externalId,
        referredBy: dto.referredBy,
        customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  list(tenantId: string, activeOnly = true) {
    return this.prisma.party.findMany({
      where: {
        tenantId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async get(tenantId: string, id: string) {
    const party = await this.prisma.party.findFirst({
      where: { id, tenantId },
    });
    if (!party) throw new NotFoundException('Party not found');
    return party;
  }

  async update(tenantId: string, id: string, dto: UpdatePartyDto) {
    await this.get(tenantId, id);
    return this.prisma.party.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email?.toLowerCase(),
        address: dto.address,
        city: dto.city,
        state: dto.state,
        stateCode: dto.stateCode,
        pincode: dto.pincode,
        gstin: dto.gstin?.toUpperCase(),
        externalId: dto.externalId,
        referredBy: dto.referredBy,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.prisma.party.update({
      where: { id },
      data: { isActive: false },
    });
  }

  search(tenantId: string, q: string, take = 20) {
    const term = q.trim();
    if (!term) return [];

    return this.prisma.party.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term } },
          { externalId: { contains: term, mode: 'insensitive' } },
          { gstin: { contains: term, mode: 'insensitive' } },
        ],
      },
      take,
      orderBy: { name: 'asc' },
    });
  }

  templateCsv(): string {
    return toCsv(PARTY_HEADERS, [
      [
        '001',
        'Sample Customer',
        '9876543210',
        'customer@example.com',
        '12 Main Street',
        'Patna',
        'Bihar',
        '10',
        '800001',
        '',
        '',
      ],
    ]);
  }

  async importCsv(tenantId: string, csvText: string): Promise<ImportResult> {
    const { rows } = parseCsv(csvText);
    const result: ImportResult = { created: 0, updated: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNo = i + 2;
      const name = (row.name ?? '').trim();
      if (!name) {
        result.errors.push({ row: rowNo, message: 'name is required' });
        continue;
      }
      try {
        const externalId = (row.externalId ?? '').trim() || null;
        const data = {
          name,
          phone: (row.phone ?? '').trim() || null,
          email: (row.email ?? '').trim().toLowerCase() || null,
          address: (row.address ?? '').trim() || null,
          city: (row.city ?? '').trim() || null,
          state: (row.state ?? '').trim() || null,
          stateCode: (row.stateCode ?? '').trim() || null,
          pincode: (row.pincode ?? '').trim() || null,
          gstin: (row.gstin ?? '').trim().toUpperCase() || null,
          externalId,
          referredBy: (row.referredBy ?? '').trim() || null,
          isActive: true,
        };

        if (externalId) {
          const existing = await this.prisma.party.findFirst({
            where: { tenantId, externalId },
          });
          if (existing) {
            await this.prisma.party.update({
              where: { id: existing.id },
              data,
            });
            result.updated++;
            continue;
          }
        }

        await this.prisma.party.create({
          data: { tenantId, ...data },
        });
        result.created++;
      } catch (e) {
        result.errors.push({
          row: rowNo,
          message: e instanceof Error ? e.message : 'Import failed',
        });
      }
    }

    return result;
  }
}
