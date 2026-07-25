import { Injectable } from '@nestjs/common';
import {
  EwayGenerateInput,
  EwayGenerateResult,
  EwayProvider,
} from './eway.provider';

/** Demo provider — always succeeds with a stub EWB number. */
@Injectable()
export class StubEwayProvider implements EwayProvider {
  async generate(input: EwayGenerateInput): Promise<EwayGenerateResult> {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 1);
    return {
      ewbNo: `EWB${Date.now().toString().slice(-10)}`,
      validUntil,
      provider: 'stub',
      payload: {
        note: 'Demo e-way number. Set EWAY_PROVIDER=http with EWAY_API_URL for live NIC/GSP.',
        billNo: input.billNo,
        documentValue: input.documentValue,
      },
    };
  }
}
