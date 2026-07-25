import { Injectable, Logger } from '@nestjs/common';
import {
  EwayGenerateInput,
  EwayGenerateResult,
  EwayProvider,
} from './eway.provider';

/**
 * HTTP GSP/NIC bridge. Set EWAY_PROVIDER=http and:
 *   EWAY_API_URL, EWAY_API_KEY (optional Bearer)
 * Expects JSON response with ewbNo (and optional validUntil).
 */
@Injectable()
export class HttpEwayProvider implements EwayProvider {
  private readonly logger = new Logger(HttpEwayProvider.name);

  async generate(input: EwayGenerateInput): Promise<EwayGenerateResult> {
    const url = process.env.EWAY_API_URL?.trim();
    if (!url) {
      throw new Error('EWAY_API_URL is not configured');
    }
    const key = process.env.EWAY_API_KEY?.trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (key) headers.Authorization = `Bearer ${key}`;

    this.logger.log(`Generating e-way for ${input.billNo} via HTTP provider`);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        invoiceId: input.invoiceId,
        billNo: input.billNo,
        invoiceDate: input.invoiceDate.toISOString(),
        partyName: input.partyName,
        partyGstin: input.partyGstin,
        sellerGstin: input.sellerGstin,
        documentValue: input.documentValue,
        fromPlace: input.fromPlace,
        toPlace: input.toPlace,
        transporterName: input.transporterName,
        transporterId: input.transporterId,
        vehicleNo: input.vehicleNo,
        distanceKm: input.distanceKm,
      }),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      throw new Error(
        `E-way provider error ${res.status}: ${text.slice(0, 300)}`,
      );
    }
    const ewbNo =
      typeof json.ewbNo === 'string'
        ? json.ewbNo
        : typeof json.ewayBillNo === 'string'
          ? json.ewayBillNo
          : undefined;
    if (!ewbNo) {
      throw new Error('E-way provider response missing ewbNo');
    }
    return {
      ewbNo,
      validUntil: json.validUntil
        ? new Date(String(json.validUntil))
        : undefined,
      provider: 'http',
      payload: json,
    };
  }
}
