import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGodownDto,
  TransferStockDto,
  UpdateGodownDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  listGodowns(tenantId: string) {
    return this.prisma.godown.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async ensureDefaultGodown(tenantId: string) {
    const existing = await this.prisma.godown.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
    });
    if (existing) return existing;
    return this.prisma.godown.create({
      data: {
        tenantId,
        name: 'Main Store',
        code: 'MAIN',
        isDefault: true,
      },
    });
  }

  async createGodown(tenantId: string, dto: CreateGodownDto) {
    if (dto.isDefault) {
      await this.prisma.godown.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.godown.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        code: dto.code,
        address: dto.address,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updateGodown(tenantId: string, id: string, dto: UpdateGodownDto) {
    const g = await this.prisma.godown.findFirst({ where: { id, tenantId } });
    if (!g) throw new NotFoundException('Godown not found');
    if (dto.isDefault) {
      await this.prisma.godown.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.godown.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code === undefined ? undefined : dto.code,
        address: dto.address === undefined ? undefined : dto.address,
        isDefault: dto.isDefault,
        isActive: dto.isActive,
      },
    });
  }

  async stockByGodown(tenantId: string, godownId?: string) {
    await this.ensureDefaultGodown(tenantId);
    return this.prisma.itemStock.findMany({
      where: {
        tenantId,
        ...(godownId ? { godownId } : {}),
      },
      include: {
        item: { select: { id: true, name: true, unit: true, barcode: true } },
        godown: { select: { id: true, name: true, code: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
  }

  async adjustAtGodown(
    tenantId: string,
    itemId: string,
    godownId: string,
    qtyDelta: number,
    note?: string,
    userId?: string,
  ) {
    if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
      throw new BadRequestException('qtyDelta must be non-zero');
    }
    const item = await this.prisma.itemMaster.findFirst({
      where: { id: itemId, tenantId },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (!item.trackStock) {
      throw new BadRequestException('Stock tracking not enabled');
    }
    const godown = await this.prisma.godown.findFirst({
      where: { id: godownId, tenantId, isActive: true },
    });
    if (!godown) throw new NotFoundException('Godown not found');

    let row = await this.prisma.itemStock.findUnique({
      where: { itemId_godownId: { itemId, godownId } },
    });
    const current = row ? Number(row.qty) : 0;
    const after = current + qtyDelta;
    if (after < 0) throw new BadRequestException('Stock cannot go negative');

    if (row) {
      row = await this.prisma.itemStock.update({
        where: { id: row.id },
        data: { qty: after },
      });
    } else {
      row = await this.prisma.itemStock.create({
        data: { tenantId, itemId, godownId, qty: after },
      });
    }

    const total = await this.recalcItemTotal(tenantId, itemId);
    await this.prisma.stockMovement.create({
      data: {
        tenantId,
        itemId,
        godownId,
        type: StockMovementType.ADJUST,
        qtyDelta,
        qtyAfter: after,
        note,
        createdById: userId,
      },
    });
    return { godownStock: row, itemStockQty: total };
  }

  async transfer(tenantId: string, dto: TransferStockDto, userId?: string) {
    if (dto.fromGodownId === dto.toGodownId) {
      throw new BadRequestException('Source and destination must differ');
    }
    if (!(dto.qty > 0)) throw new BadRequestException('qty must be positive');
    await this.adjustAtGodown(
      tenantId,
      dto.itemId,
      dto.fromGodownId,
      -dto.qty,
      dto.note ?? 'Transfer out',
      userId,
    );
    await this.adjustAtGodown(
      tenantId,
      dto.itemId,
      dto.toGodownId,
      dto.qty,
      dto.note ?? 'Transfer in',
      userId,
    );
    await this.prisma.stockMovement.create({
      data: {
        tenantId,
        itemId: dto.itemId,
        godownId: dto.toGodownId,
        type: StockMovementType.TRANSFER,
        qtyDelta: dto.qty,
        qtyAfter: 0,
        note: `Transfer ${dto.qty} from ${dto.fromGodownId.slice(0, 8)}`,
        createdById: userId,
      },
    });
    return { ok: true };
  }

  async addPurchaseStock(
    tenantId: string,
    godownId: string | null | undefined,
    lines: { itemId?: string | null; qty: number }[],
    purchaseId: string,
    userId?: string,
  ) {
    const godown =
      (godownId
        ? await this.prisma.godown.findFirst({
            where: { id: godownId, tenantId },
          })
        : null) ?? (await this.ensureDefaultGodown(tenantId));

    for (const line of lines) {
      if (!line.itemId || !(line.qty > 0)) continue;
      const item = await this.prisma.itemMaster.findFirst({
        where: { id: line.itemId, tenantId },
      });
      if (!item?.trackStock) continue;
      await this.adjustAtGodown(
        tenantId,
        line.itemId,
        godown.id,
        line.qty,
        `Purchase ${purchaseId.slice(0, 8)}`,
        userId,
      );
      await this.prisma.stockMovement.create({
        data: {
          tenantId,
          itemId: line.itemId,
          godownId: godown.id,
          type: StockMovementType.PURCHASE,
          qtyDelta: line.qty,
          qtyAfter: 0,
          purchaseId,
          createdById: userId,
        },
      });
    }
  }

  /**
   * Deduct stock for a finalized sale. Uses line godown when set, else default godown.
   */
  async deductSale(
    tenantId: string,
    lines: { itemId?: string | null; qty: number; godownId?: string | null }[],
    invoiceId: string,
    userId?: string,
  ) {
    await this.assertSaleStock(tenantId, lines);
    const defaultGodown = await this.ensureDefaultGodown(tenantId);
    for (const line of lines) {
      if (!line.itemId || !(line.qty > 0)) continue;
      const item = await this.prisma.itemMaster.findFirst({
        where: { id: line.itemId, tenantId },
      });
      if (!item?.trackStock) continue;

      const godownId = line.godownId || defaultGodown.id;
      let stock = await this.prisma.itemStock.findUnique({
        where: { itemId_godownId: { itemId: line.itemId, godownId } },
      });
      const stocks = await this.prisma.itemStock.findMany({
        where: { tenantId, itemId: line.itemId },
      });
      if (!stocks.length && !stock) {
        stock = await this.prisma.itemStock.create({
          data: {
            tenantId,
            itemId: line.itemId,
            godownId,
            qty: Number(item.stockQty),
          },
        });
      }

      const available = stock ? Number(stock.qty) : 0;
      const after = available - line.qty;
      if (stock) {
        await this.prisma.itemStock.update({
          where: { id: stock.id },
          data: { qty: after },
        });
      } else {
        await this.prisma.itemStock.create({
          data: { tenantId, itemId: line.itemId, godownId, qty: after },
        });
      }

      await this.recalcItemTotal(tenantId, line.itemId);
      await this.prisma.stockMovement.create({
        data: {
          tenantId,
          itemId: line.itemId,
          godownId,
          type: StockMovementType.SALE,
          qtyDelta: -line.qty,
          qtyAfter: after,
          invoiceId,
          createdById: userId,
        },
      });
    }
  }

  async assertSaleStock(
    tenantId: string,
    lines: { itemId?: string | null; qty: number; godownId?: string | null }[],
  ) {
    const defaultGodown = await this.ensureDefaultGodown(tenantId);
    for (const line of lines) {
      if (!line.itemId || !(line.qty > 0)) continue;
      const item = await this.prisma.itemMaster.findFirst({
        where: { id: line.itemId, tenantId },
      });
      if (!item?.trackStock) continue;
      const godownId = line.godownId || defaultGodown.id;
      const godown = await this.prisma.godown.findFirst({
        where: { id: godownId, tenantId, isActive: true },
      });
      if (!godown) throw new BadRequestException('Sale godown not found');

      const stock = await this.prisma.itemStock.findUnique({
        where: { itemId_godownId: { itemId: line.itemId, godownId } },
      });
      const stocks = await this.prisma.itemStock.findMany({
        where: { tenantId, itemId: line.itemId },
      });
      const available = stock
        ? Number(stock.qty)
        : stocks.length
          ? 0
          : Number(item.stockQty);
      if (available < line.qty) {
        throw new BadRequestException(
          `Insufficient stock for "${item.name}" at ${godown.name} (have ${available}, need ${line.qty})`,
        );
      }
    }
  }

  private async recalcItemTotal(tenantId: string, itemId: string) {
    const stocks = await this.prisma.itemStock.findMany({
      where: { tenantId, itemId },
    });
    const total = stocks.reduce((s, r) => s + Number(r.qty), 0);
    await this.prisma.itemMaster.update({
      where: { id: itemId },
      data: { stockQty: total },
    });
    return total;
  }
}
