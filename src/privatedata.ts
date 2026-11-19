/**
 * ============================================================================
 * MODULE: privatedata.ts
 * HYPERLEDGER FABRIC EQUIVALENT:
 *   - Private Data Collections (PDC / SideDBs)
 *   - Transient Data & Hash-on-Chain verification
 *   - Keeps commercial pricing & contracts confidential between parties
 *     (e.g., Dawa Life Sciences & KEMSA) while the channel ledger stores the SHA-256 hash
 * ============================================================================
 */

import { canonicalizeJson, sha256Hex } from './crypto';

export interface ConfidentialCommercialDeal {
  batchNo: string;
  collectionName: string; // e.g. "Collection_Dawa_KEMSA_B2B"
  authorizedOrgIds: string[];
  unitWholesalePriceKES: number;
  currency: string;
  paymentTerms: string;
  procurementContractRef: string;
  rebatePercent: number;
  privateSalt: string;
  timestamp: string;
}

export interface PrivateDataRecord {
  deal: ConfidentialCommercialDeal;
  onChainHash: string;
}

const PDC_STORAGE_KEY = 'pharmachain_private_data_collections_v1';

/**
 * Preloaded commercial private deals between Kenyan supply chain partners
 */
export const SEED_PRIVATE_DEALS: Record<string, ConfidentialCommercialDeal> = {
  'KE-ACT-2026-001': {
    batchNo: 'KE-ACT-2026-001',
    collectionName: 'PDC_Universal_KEMSA_NationalProcurement',
    authorizedOrgIds: ['MFG-UNIVERSAL', 'DIST-KEMSA', 'REG-PPB'],
    unitWholesalePriceKES: 145.5,
    currency: 'KES',
    paymentTerms: 'MoH Framework Contract Net 60 Days',
    procurementContractRef: 'GOK/MOH/KEMSA/2026/MAL-891',
    rebatePercent: 4.5,
    privateSalt: '0x8849bfd3910c81e284920aef',
    timestamp: '2026-01-18T11:15:00.000Z',
  },
  'KE-AMX-2026-002': {
    batchNo: 'KE-AMX-2026-002',
    collectionName: 'PDC_Dawa_MEDS_WholesaleAgreement',
    authorizedOrgIds: ['MFG-DAWA', 'DIST-MEDS', 'REG-PPB'],
    unitWholesalePriceKES: 320.0,
    currency: 'KES',
    paymentTerms: 'Mission Essential Supply Net 30 Days',
    procurementContractRef: 'MEDS/SUPPLY/DAWA/2026/041',
    rebatePercent: 6.0,
    privateSalt: '0x33eef8192a0149c839d481b0',
    timestamp: '2026-02-05T09:20:00.000Z',
  },
};

export async function computePrivateDataHash(
  deal: ConfidentialCommercialDeal
): Promise<string> {
  const canonical = canonicalizeJson({
    batchNo: deal.batchNo,
    collectionName: deal.collectionName,
    authorizedOrgIds: deal.authorizedOrgIds.sort(),
    unitWholesalePriceKES: deal.unitWholesalePriceKES,
    currency: deal.currency,
    paymentTerms: deal.paymentTerms,
    procurementContractRef: deal.procurementContractRef,
    rebatePercent: deal.rebatePercent,
    privateSalt: deal.privateSalt,
  });
  return await sha256Hex(canonical);
}

export function loadPrivateDataStore(): Record<string, ConfidentialCommercialDeal> {
  try {
    const raw = window.localStorage.getItem(PDC_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return { ...SEED_PRIVATE_DEALS };
}

export function savePrivateDataDeal(deal: ConfidentialCommercialDeal): void {
  const current = loadPrivateDataStore();
  current[deal.batchNo] = deal;
  try {
    window.localStorage.setItem(PDC_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}
