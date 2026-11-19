/**
 * ============================================================================
 * MODULE: channels.ts
 * HYPERLEDGER FABRIC MULTI-CHANNEL LEDGER ISOLATION
 * Channels define isolated communication and ledger networks between subsets of peers:
 *   1. pharma-ke-channel: Consortium baseline (All 8 peers)
 *   2. commercial-retail-channel: Private sector distribution (4 commercial peers + PPB)
 *   3. public-health-subsidized-channel: Donor & MoH subsidized programs (4 public health peers + PPB)
 * ============================================================================
 */

export interface FabricChannelConfig {
  id: string;
  name: string;
  description: string;
  purpose: string;
  consensusType: 'Raft (Orderer Node Cluster)' | 'BFT Consensus';
  memberOrgIds: string[];
  associatedBatchPrefixes: string[];
  colorHex: string;
}

export const FABRIC_CHANNELS: Record<string, FabricChannelConfig> = {
  'pharma-ke-channel': {
    id: 'pharma-ke-channel',
    name: 'Consortium Master Channel',
    description: 'National drug traceability baseline channel connecting all registered Kenyan manufacturers, distributors, healthcare facilities, and PPB.',
    purpose: 'Universal traceability, public health alerts, cross-sector regulatory compliance',
    consensusType: 'Raft (Orderer Node Cluster)',
    memberOrgIds: [
      'MFG-DAWA',
      'MFG-COSMOS',
      'MFG-UNIVERSAL',
      'DIST-KEMSA',
      'DIST-MEDS',
      'PHARM-GOODLIFE',
      'PHARM-KNH',
      'REG-PPB',
    ],
    associatedBatchPrefixes: ['*'],
    colorHex: '#001F54',
  },
  'commercial-retail-channel': {
    id: 'commercial-retail-channel',
    name: 'Commercial Retail Channel',
    description: 'Isolated commercial channel for private sector pharmaceutical manufacturers, wholesale distributors, and retail community pharmacies.',
    purpose: 'Confidential commercial margins, retail pharmacy supply contracts, non-subsidized pharmaceuticals',
    consensusType: 'Raft (Orderer Node Cluster)',
    memberOrgIds: ['MFG-DAWA', 'MFG-COSMOS', 'DIST-MEDS', 'PHARM-GOODLIFE', 'REG-PPB'],
    associatedBatchPrefixes: ['KE-CIP-2024-089', 'KE-AMX-2026-042', 'KE-PCM-2026-999'],
    colorHex: '#0284C7',
  },
  'public-health-subsidized-channel': {
    id: 'public-health-subsidized-channel',
    name: 'Public Health Subsidized Channel',
    description: 'Restricted channel for Government of Kenya (MoH), Global Fund, and KEMSA subsidized essential drugs (Malaria ACTs, Insulin).',
    purpose: 'Subsidized essential medicine distribution, public dispensary allocations, zero-cost patient dispensing',
    consensusType: 'Raft (Orderer Node Cluster)',
    memberOrgIds: ['MFG-UNIVERSAL', 'DIST-KEMSA', 'PHARM-KNH', 'REG-PPB'],
    associatedBatchPrefixes: ['KE-ACT-2026-001', 'KE-INS-2026-005'],
    colorHex: '#059669',
  },
};

export function isBatchOnChannel(batchNo: string, channelId: string): boolean {
  if (channelId === 'pharma-ke-channel') return true;
  const cfg = FABRIC_CHANNELS[channelId];
  if (!cfg) return true;
  return cfg.associatedBatchPrefixes.some((p) => p === '*' || batchNo.startsWith(p) || p === batchNo);
}

export function isOrgAuthorizedForChannel(orgId: string, channelId: string): boolean {
  const cfg = FABRIC_CHANNELS[channelId];
  if (!cfg) return true;
  return cfg.memberOrgIds.includes(orgId);
}
