export type EwayGenerateInput = {
  invoiceId: string;
  billNo: string;
  invoiceDate: Date;
  partyName: string;
  partyGstin?: string | null;
  sellerGstin?: string | null;
  documentValue: number;
  fromPlace?: string;
  toPlace?: string;
  transporterName?: string;
  transporterId?: string;
  vehicleNo?: string;
  distanceKm?: number;
};

export type EwayGenerateResult = {
  ewbNo: string;
  validUntil?: Date;
  provider: string;
  payload?: Record<string, unknown>;
};

export interface EwayProvider {
  generate(input: EwayGenerateInput): Promise<EwayGenerateResult>;
}
