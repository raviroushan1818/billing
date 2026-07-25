import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdjustStockDto,
  CreateItemDto,
  UpdateItemDto,
} from './dto/item.dto';
import { ImportResult, parseCsv, toCsv } from '../common/csv.util';

const ITEM_HEADERS = [
  'name',
  'description',
  'hsnSac',
  'unit',
  'rate',
  'gstRate',
  'barcode',
  'trackStock',
  'stockQty',
];

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateItemDto) {
    const trackStock = dto.trackStock ?? false;
    const stockQty = trackStock ? (dto.stockQty ?? 0) : 0;
    return this.prisma.itemMaster.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        hsnSac: dto.hsnSac,
        unit: dto.unit ?? 'NOS',
        rate: dto.rate,
        gstRate: dto.gstRate ?? 18,
        barcode: dto.barcode,
        trackStock,
        stockQty,
      },
    });
  }

  list(tenantId: string, activeOnly = true) {
    return this.prisma.itemMaster.findMany({
      where: {
        tenantId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  search(tenantId: string, q: string, take = 30) {
    const term = q.trim();
    if (!term) {
      return this.list(tenantId, true).then((items) => items.slice(0, take));
    }
    return this.prisma.itemMaster.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { hsnSac: { contains: term, mode: 'insensitive' } },
          { barcode: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      },
      take,
      orderBy: { name: 'asc' },
    });
  }

  async get(tenantId: string, id: string) {
    const item = await this.prisma.itemMaster.findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async update(tenantId: string, id: string, dto: UpdateItemDto) {
    await this.get(tenantId, id);
    return this.prisma.itemMaster.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        hsnSac: dto.hsnSac,
        unit: dto.unit,
        rate: dto.rate,
        gstRate: dto.gstRate,
        barcode: dto.barcode,
        isActive: dto.isActive,
        trackStock: dto.trackStock,
      },
    });
  }

  async adjustStock(
    tenantId: string,
    itemId: string,
    dto: AdjustStockDto,
    userId?: string,
  ) {
    const item = await this.get(tenantId, itemId);
    if (!item.trackStock) {
      throw new BadRequestException(
        'Stock tracking is not enabled for this item',
      );
    }
    const delta = Number(dto.qtyDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      throw new BadRequestException('qtyDelta must be a non-zero number');
    }
    const after = Number(item.stockQty) + delta;
    if (after < 0) {
      throw new BadRequestException('Stock cannot go negative');
    }
    const updated = await this.prisma.itemMaster.update({
      where: { id: itemId },
      data: { stockQty: after },
    });
    await this.prisma.stockMovement.create({
      data: {
        tenantId,
        itemId,
        type: StockMovementType.ADJUST,
        qtyDelta: delta,
        qtyAfter: after,
        note: dto.note,
        createdById: userId,
      },
    });
    return updated;
  }

  listMovements(tenantId: string, itemId: string) {
    return this.prisma.stockMovement.findMany({
      where: { tenantId, itemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async applySaleDeduction(
    tenantId: string,
    lines: { itemId?: string | null; qty: number; godownId?: string | null }[],
    invoiceId: string,
    userId?: string,
  ) {
    // Prefer godown-aware inventory path when InventoryService is available via module.
    // Kept for backward-compatible call sites; invoices module now uses InventoryService directly.
    for (const line of lines) {
      if (!line.itemId) continue;
      const item = await this.prisma.itemMaster.findFirst({
        where: { id: line.itemId, tenantId },
      });
      if (!item?.trackStock) continue;
      const after = Number(item.stockQty) - line.qty;
      if (after < -0.0001) {
        throw new BadRequestException(
          `Insufficient stock for "${item.name}" (have ${Number(item.stockQty)}, need ${line.qty})`,
        );
      }
      await this.prisma.itemMaster.update({
        where: { id: item.id },
        data: { stockQty: Math.max(0, after) },
      });
      await this.prisma.stockMovement.create({
        data: {
          tenantId,
          itemId: item.id,
          godownId: line.godownId ?? undefined,
          type: StockMovementType.SALE,
          qtyDelta: -line.qty,
          qtyAfter: Math.max(0, after),
          invoiceId,
          createdById: userId,
        },
      });
    }
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.prisma.itemMaster.update({
      where: { id },
      data: { isActive: false },
    });
  }

  templateCsv(): string {
    return toCsv(ITEM_HEADERS, [
      [
        'Web Development',
        'Custom website development',
        '998314',
        'NOS',
        '5000',
        '18',
        'WEB-001',
        'false',
        '0',
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
        const rate = Number(row.rate ?? 0);
        const gstRate = Number(row.gstRate ?? 18);
        if (!Number.isFinite(rate) || rate < 0) {
          result.errors.push({ row: rowNo, message: 'invalid rate' });
          continue;
        }
        if (!Number.isFinite(gstRate) || gstRate < 0) {
          result.errors.push({ row: rowNo, message: 'invalid gstRate' });
          continue;
        }

        const barcode = (row.barcode ?? '').trim() || null;
        const hsnSac = (row.hsnSac ?? '').trim() || null;
        const trackStock =
          String(row.trackStock ?? '')
            .trim()
            .toLowerCase() === 'true';
        const stockQty = trackStock ? Number(row.stockQty ?? 0) || 0 : 0;
        const data = {
          name,
          description: (row.description ?? '').trim() || null,
          hsnSac,
          unit: (row.unit ?? '').trim() || 'NOS',
          rate,
          gstRate,
          barcode,
          trackStock,
          stockQty,
          isActive: true,
        };

        let existing = null as Awaited<
          ReturnType<typeof this.prisma.itemMaster.findFirst>
        >;
        if (barcode) {
          existing = await this.prisma.itemMaster.findFirst({
            where: { tenantId, barcode },
          });
        }
        if (!existing && hsnSac) {
          existing = await this.prisma.itemMaster.findFirst({
            where: {
              tenantId,
              name: { equals: name, mode: 'insensitive' },
              hsnSac,
            },
          });
        }

        if (existing) {
          await this.prisma.itemMaster.update({
            where: { id: existing.id },
            data,
          });
          result.updated++;
        } else {
          await this.prisma.itemMaster.create({
            data: { tenantId, ...data },
          });
          result.created++;
        }
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
