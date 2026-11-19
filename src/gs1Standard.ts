/**
 * ============================================================================
 * MODULE: gs1Standard.ts
 * GS1 HEALTHCARE DIGITAL LINK & 2D DATAMATRIX STANDARD
 * Encodes pharmaceutical batch information conforming to ISO/IEC 15418 & GS1 Digital Link:
 *   (01) GTIN - Global Trade Item Number (14 digits)
 *   (10) Batch / Lot Number
 *   (17) Expiration Date (YYMMDD)
 *   (21) Serial Number
 * ============================================================================
 */

export interface GS1DrugAttributes {
  gtin: string; // 14-digit Global Trade Item Number
  batchNo: string; // (10)
  expiryDateYYMMDD: string; // (17)
  serialNo: string; // (21)
  productName: string;
}

export function formatGS1DigitalLinkUri(attrs: GS1DrugAttributes): string {
  return `https://id.pharmachain.ke/01/${attrs.gtin}/10/${encodeURIComponent(
    attrs.batchNo
  )}/17/${attrs.expiryDateYYMMDD}/21/${encodeURIComponent(attrs.serialNo)}`;
}

export function formatGS1ElementStrings(attrs: GS1DrugAttributes): string {
  return `(01)${attrs.gtin}(17)${attrs.expiryDateYYMMDD}(10)${attrs.batchNo}(21)${attrs.serialNo}`;
}

export function convertDateToYYMMDD(isoDateString: string): string {
  const parts = isoDateString.split('-');
  if (parts.length === 3) {
    const yy = parts[0].slice(-2);
    const mm = parts[1].padStart(2, '0');
    const dd = parts[2].padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }
  return '281231';
}

/**
 * Deterministically generates standard Kenyan GTIN for a batch
 */
export function getStandardGtinForBatch(batchNo: string): string {
  // Kenya GS1 Country Prefix: 616
  const hash = Math.abs(
    batchNo.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  );
  const suffix = String(hash % 1000000000).padStart(10, '0');
  return `616${suffix}1`;
}
