/**
 * ============================================================================
 * MODULE: store.ts
 * HYPERLEDGER FABRIC / COUCHDB EQUIVALENT:
 *   - CouchDB World State Database (stores latest state per `batchNo`)
 *   - Multi-Peer Endorsement Pipeline (Sender + Recipient)
 *   - Read-Write Set (RWSet) & MVCC version tracking
 *   - Private Data Collections (SideDB confidential contracts)
 * ============================================================================
 */

import {
  BatchWorldState,
  invokeDispenseUnits,
  invokeFlagBatch,
  invokeRecallBatch,
  invokeReceiveBatch,
  invokeRegisterBatch,
  invokeTransferBatch,
} from './chaincode';
import { generateOrgECDSAKeyPair } from './crypto';
import {
  Block,
  ChainValidationReport,
  createGenesisBlock,
  OrganizationMSP,
  tamperWithBlockInPlace,
  validateChain,
} from './ledger';
import {
  computePrivateDataHash,
  ConfidentialCommercialDeal,
  loadPrivateDataStore,
  savePrivateDataDeal,
  SEED_PRIVATE_DEALS,
} from './privatedata';

const STORAGE_KEY = 'pharmachain_sdg3_ledger_state_v2';

export interface RecallAlertEvent {
  id: string;
  batchNo: string;
  drugName: string;
  reason: string;
  recalledBy: string;
  recalledAt: string;
  affectedOrgIds: string[];
  currentHolderOrgId: string;
  currentHolderName: string;
}

export interface PersistedLedgerStore {
  initializedAt: string;
  organizations: Record<string, OrganizationMSP>;
  blocks: Block[];
  worldState: Record<string, BatchWorldState>;
  recallAlerts: RecallAlertEvent[];
}

type RecallListener = (alert: RecallAlertEvent) => void;
type StoreChangeListener = () => void;

class PharmaChainEventBus {
  private recallListeners: Set<RecallListener> = new Set();
  private changeListeners: Set<StoreChangeListener> = new Set();

  public onRecall(listener: RecallListener): () => void {
    this.recallListeners.add(listener);
    return () => this.recallListeners.delete(listener);
  }

  public emitRecall(alert: RecallAlertEvent): void {
    this.recallListeners.forEach((fn) => fn(alert));
  }

  public onStoreChange(listener: StoreChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  public emitStoreChange(): void {
    this.changeListeners.forEach((fn) => fn());
  }
}

export const ledgerEventBus = new PharmaChainEventBus();

/**
 * Builds pristine Kenyan seed store with Merkle roots, multi-peer endorsements,
 * MVCC versions, and Private Data Collection hashes.
 */
export async function buildKenyanSeedStore(): Promise<PersistedLedgerStore> {
  const orgSpecs: Array<Omit<OrganizationMSP, 'keys'>> = [
    {
      id: 'MFG-DAWA',
      mspId: 'DawaLifeMSP',
      name: 'Dawa Life Sciences Ltd',
      role: 'Manufacturer',
      location: 'Ruaraka Industrial Area, Nairobi',
      licenseNo: 'PPB/MFG/KE-0014',
    },
    {
      id: 'MFG-COSMOS',
      mspId: 'CosmosPharmaMSP',
      name: 'Cosmos Limited',
      role: 'Manufacturer',
      location: 'Rangwe Rd, Industrial Area, Nairobi',
      licenseNo: 'PPB/MFG/KE-0021',
    },
    {
      id: 'MFG-UNIVERSAL',
      mspId: 'UniversalCorpMSP',
      name: 'Universal Corporation Ltd',
      role: 'Manufacturer',
      location: 'Club Rd, Kikuyu, Kiambu County',
      licenseNo: 'PPB/MFG/KE-0038',
    },
    {
      id: 'DIST-KEMSA',
      mspId: 'KemsaSupplyMSP',
      name: 'KEMSA (Kenya Medical Supplies Authority)',
      role: 'Distributor',
      location: 'Embakasi National Logistics Depot, Nairobi',
      licenseNo: 'PPB/DIST/KE-0101',
    },
    {
      id: 'DIST-MEDS',
      mspId: 'MedsLogisticsMSP',
      name: 'MEDS (Mission for Essential Drugs & Supplies)',
      role: 'Distributor',
      location: 'Mombasa Road Supply Hub, Nairobi',
      licenseNo: 'PPB/DIST/KE-0108',
    },
    {
      id: 'PHARM-GOODLIFE',
      mspId: 'GoodlifePharmMSP',
      name: 'Goodlife Pharmacy — Westlands',
      role: 'Pharmacy',
      location: 'Westlands Square, Waiyaki Way, Nairobi',
      licenseNo: 'PPB/PHARM/KE-2045',
    },
    {
      id: 'PHARM-KNH',
      mspId: 'KnhHospitalMSP',
      name: 'Kenyatta National Hospital (KNH) Pharmacy',
      role: 'Pharmacy',
      location: 'Hospital Rd, Upper Hill, Nairobi',
      licenseNo: 'PPB/PHARM/KE-1002',
    },
    {
      id: 'REG-PPB',
      mspId: 'PpbRegulatorMSP',
      name: 'Pharmacy and Poisons Board (PPB Kenya)',
      role: 'Regulator',
      location: 'Lenana Road Regulatory HQ, Nairobi',
      licenseNo: 'STATUTORY-CAP-244-KE',
    },
  ];

  const organizations: Record<string, OrganizationMSP> = {};
  for (const spec of orgSpecs) {
    const keys = await generateOrgECDSAKeyPair();
    organizations[spec.id] = {
      ...spec,
      keys,
    };
  }

  const blocks: Block[] = [];
  const worldState: Record<string, BatchWorldState> = {};
  const recallAlerts: RecallAlertEvent[] = [];

  // Genesis Block #0
  const genesisBlock = await createGenesisBlock(
    organizations['REG-PPB'],
    '2026-01-10T08:00:00.000Z'
  );
  blocks.push(genesisBlock);

  // Private Data Hash for Batch 1
  const deal1 = SEED_PRIVATE_DEALS['KE-ACT-2026-001'];
  const pHash1 = await computePrivateDataHash(deal1);

  // BATCH 1: KE-ACT-2026-001
  {
    const r1 = await invokeRegisterBatch({
      actorOrg: organizations['MFG-UNIVERSAL'],
      worldState,
      blocks,
      batchNo: 'KE-ACT-2026-001',
      drugName: 'Coartem (Artemether 20mg / Lumefantrine 120mg)',
      activeIngredient: 'Artemether 20mg + Lumefantrine 120mg',
      dosageForm: 'Dispersible Tablets (24s Blister Pack)',
      storageTemp: 'Store below 30°C in original blister',
      manufactureDate: '2026-01-15',
      expiryDate: '2028-01-15',
      quantity: 5000,
      timestamp: '2026-01-15T09:30:00.000Z',
      privateDataHash: pHash1,
      privateDataCollectionName: deal1.collectionName,
    });
    blocks.push(r1.newBlock);
    worldState[r1.updatedBatch.batchNo] = r1.updatedBatch;

    const t1 = await invokeTransferBatch({
      actorOrg: organizations['MFG-UNIVERSAL'],
      targetOrg: organizations['DIST-KEMSA'],
      worldState,
      blocks,
      batchNo: 'KE-ACT-2026-001',
      quantity: 5000,
      transportNotes: 'Dispatched from Kikuyu WHO-PQ plant to KEMSA Embakasi Depot via Truck KDK-412P.',
      timestamp: '2026-01-18T11:15:00.000Z',
      expectedVersion: r1.updatedBatch.version,
    });
    blocks.push(t1.newBlock);
    worldState[t1.updatedBatch.batchNo] = t1.updatedBatch;

    const rc1 = await invokeReceiveBatch({
      actorOrg: organizations['DIST-KEMSA'],
      worldState,
      blocks,
      batchNo: 'KE-ACT-2026-001',
      conditionNotes: 'Received at KEMSA Embakasi Cold/Ambient Bay #4; tamper seals verified.',
      timestamp: '2026-01-19T14:20:00.000Z',
    });
    blocks.push(rc1.newBlock);
    worldState[rc1.updatedBatch.batchNo] = rc1.updatedBatch;

    const t2 = await invokeTransferBatch({
      actorOrg: organizations['DIST-KEMSA'],
      targetOrg: organizations['PHARM-KNH'],
      worldState,
      blocks,
      batchNo: 'KE-ACT-2026-001',
      quantity: 5000,
      transportNotes: 'Allocated to Kenyatta National Hospital Outpatient Pharmacy requisition #KNH-882.',
      timestamp: '2026-02-02T08:45:00.000Z',
      expectedVersion: rc1.updatedBatch.version,
    });
    blocks.push(t2.newBlock);
    worldState[t2.updatedBatch.batchNo] = t2.updatedBatch;

    const rc2 = await invokeReceiveBatch({
      actorOrg: organizations['PHARM-KNH'],
      worldState,
      blocks,
      batchNo: 'KE-ACT-2026-001',
      conditionNotes: 'Verified by Chief Pharmacist at KNH Upper Hill; QR & batch seal matched.',
      timestamp: '2026-02-02T15:10:00.000Z',
    });
    blocks.push(rc2.newBlock);
    worldState[rc2.updatedBatch.batchNo] = rc2.updatedBatch;

    const d1 = await invokeDispenseUnits({
      actorOrg: organizations['PHARM-KNH'],
      worldState,
      blocks,
      batchNo: 'KE-ACT-2026-001',
      qty: 350,
      patientRef: 'Outpatient Acute Malaria Clinic — 350 packs dispensed under NHIF/SHIF coverage.',
      timestamp: '2026-02-14T16:30:00.000Z',
    });
    blocks.push(d1.newBlock);
    worldState[d1.updatedBatch.batchNo] = d1.updatedBatch;
  }

  // BATCH 2: KE-AMX-2026-002
  const deal2 = SEED_PRIVATE_DEALS['KE-AMX-2026-002'];
  const pHash2 = await computePrivateDataHash(deal2);

  {
    const r2 = await invokeRegisterBatch({
      actorOrg: organizations['MFG-DAWA'],
      worldState,
      blocks,
      batchNo: 'KE-AMX-2026-002',
      drugName: 'Amoxil (Amoxicillin Trihydrate 500mg)',
      activeIngredient: 'Amoxicillin Trihydrate BP equivalent to 500mg',
      dosageForm: 'Hard Gelatin Capsules (10x10 Blisters)',
      storageTemp: 'Store below 25°C, protect from moisture',
      manufactureDate: '2026-02-01',
      expiryDate: '2028-08-01',
      quantity: 2000,
      timestamp: '2026-02-01T10:00:00.000Z',
      privateDataHash: pHash2,
      privateDataCollectionName: deal2.collectionName,
    });
    blocks.push(r2.newBlock);
    worldState[r2.updatedBatch.batchNo] = r2.updatedBatch;

    const t1 = await invokeTransferBatch({
      actorOrg: organizations['MFG-DAWA'],
      targetOrg: organizations['DIST-MEDS'],
      worldState,
      blocks,
      batchNo: 'KE-AMX-2026-002',
      quantity: 2000,
      transportNotes: 'Delivered from Ruaraka plant to MEDS Mombasa Rd distribution center.',
      timestamp: '2026-02-05T09:20:00.000Z',
      expectedVersion: r2.updatedBatch.version,
    });
    blocks.push(t1.newBlock);
    worldState[t1.updatedBatch.batchNo] = t1.updatedBatch;

    const rc1 = await invokeReceiveBatch({
      actorOrg: organizations['DIST-MEDS'],
      worldState,
      blocks,
      batchNo: 'KE-AMX-2026-002',
      conditionNotes: 'Accepted into MEDS QA warehouse after batch certificate inspection.',
      timestamp: '2026-02-05T14:00:00.000Z',
    });
    blocks.push(rc1.newBlock);
    worldState[rc1.updatedBatch.batchNo] = rc1.updatedBatch;

    const t2 = await invokeTransferBatch({
      actorOrg: organizations['DIST-MEDS'],
      targetOrg: organizations['PHARM-GOODLIFE'],
      worldState,
      blocks,
      batchNo: 'KE-AMX-2026-002',
      quantity: 2000,
      transportNotes: 'Scheduled retail pharmacy replenishment to Goodlife Westlands Square.',
      timestamp: '2026-02-12T11:00:00.000Z',
      expectedVersion: rc1.updatedBatch.version,
    });
    blocks.push(t2.newBlock);
    worldState[t2.updatedBatch.batchNo] = t2.updatedBatch;

    const rc2 = await invokeReceiveBatch({
      actorOrg: organizations['PHARM-GOODLIFE'],
      worldState,
      blocks,
      batchNo: 'KE-AMX-2026-002',
      conditionNotes: 'Logged into Goodlife Westlands inventory via barcode scanner.',
      timestamp: '2026-02-12T16:45:00.000Z',
    });
    blocks.push(rc2.newBlock);
    worldState[rc2.updatedBatch.batchNo] = rc2.updatedBatch;

    const d2 = await invokeDispenseUnits({
      actorOrg: organizations['PHARM-GOODLIFE'],
      worldState,
      blocks,
      batchNo: 'KE-AMX-2026-002',
      qty: 120,
      patientRef: 'Verified prescription dispensing at Westlands retail counter (120 packs).',
      timestamp: '2026-02-20T13:15:00.000Z',
    });
    blocks.push(d2.newBlock);
    worldState[d2.updatedBatch.batchNo] = d2.updatedBatch;
  }

  // BATCH 3: KE-MET-2026-003 (In transit to Goodlife)
  {
    const r3 = await invokeRegisterBatch({
      actorOrg: organizations['MFG-COSMOS'],
      worldState,
      blocks,
      batchNo: 'KE-MET-2026-003',
      drugName: 'Glucophage (Metformin HCl 850mg)',
      activeIngredient: 'Metformin Hydrochloride BP 850mg',
      dosageForm: 'Film-Coated Tablets (30s Pack)',
      storageTemp: 'Store below 25°C',
      manufactureDate: '2026-02-10',
      expiryDate: '2029-02-10',
      quantity: 3200,
      timestamp: '2026-02-10T08:30:00.000Z',
    });
    blocks.push(r3.newBlock);
    worldState[r3.updatedBatch.batchNo] = r3.updatedBatch;

    const t1 = await invokeTransferBatch({
      actorOrg: organizations['MFG-COSMOS'],
      targetOrg: organizations['DIST-KEMSA'],
      worldState,
      blocks,
      batchNo: 'KE-MET-2026-003',
      quantity: 3200,
      transportNotes: 'Transferred from Cosmos Rangwe Rd plant to KEMSA Embakasi.',
      timestamp: '2026-02-15T10:00:00.000Z',
      expectedVersion: r3.updatedBatch.version,
    });
    blocks.push(t1.newBlock);
    worldState[t1.updatedBatch.batchNo] = t1.updatedBatch;

    const rc1 = await invokeReceiveBatch({
      actorOrg: organizations['DIST-KEMSA'],
      worldState,
      blocks,
      batchNo: 'KE-MET-2026-003',
      conditionNotes: 'Received at KEMSA chronic care warehouse section.',
      timestamp: '2026-02-15T15:30:00.000Z',
    });
    blocks.push(rc1.newBlock);
    worldState[rc1.updatedBatch.batchNo] = rc1.updatedBatch;

    const t2 = await invokeTransferBatch({
      actorOrg: organizations['DIST-KEMSA'],
      targetOrg: organizations['PHARM-GOODLIFE'],
      worldState,
      blocks,
      batchNo: 'KE-MET-2026-003',
      quantity: 3200,
      transportNotes: 'In-transit dispatch from KEMSA Embakasi to Goodlife Pharmacy Westlands.',
      timestamp: '2026-03-01T09:00:00.000Z',
      expectedVersion: rc1.updatedBatch.version,
    });
    blocks.push(t2.newBlock);
    worldState[t2.updatedBatch.batchNo] = t2.updatedBatch;
  }

  // BATCH 4: KE-AZM-2026-004
  {
    const r4 = await invokeRegisterBatch({
      actorOrg: organizations['MFG-DAWA'],
      worldState,
      blocks,
      batchNo: 'KE-AZM-2026-004',
      drugName: 'Zithromax (Azithromycin Dihydrate 500mg)',
      activeIngredient: 'Azithromycin Dihydrate USP 500mg',
      dosageForm: 'Scored Tablets (3-Tablet Blister)',
      storageTemp: 'Store below 30°C',
      manufactureDate: '2026-03-05',
      expiryDate: '2029-03-05',
      quantity: 4500,
      timestamp: '2026-03-05T11:20:00.000Z',
    });
    blocks.push(r4.newBlock);
    worldState[r4.updatedBatch.batchNo] = r4.updatedBatch;
  }

  // BATCH 5: KE-INS-2026-005 (Cold-chain flagged)
  {
    const r5 = await invokeRegisterBatch({
      actorOrg: organizations['MFG-COSMOS'],
      worldState,
      blocks,
      batchNo: 'KE-INS-2026-005',
      drugName: 'Insulatard (Human Insulin Isophane 100IU/ml)',
      activeIngredient: 'Recombinant Human Insulin 100IU/ml Suspension',
      dosageForm: '10ml Sterile Glass Vial',
      storageTemp: 'Cold Chain 2°C – 8°C (Do Not Freeze)',
      manufactureDate: '2026-02-18',
      expiryDate: '2027-08-18',
      quantity: 1200,
      timestamp: '2026-02-18T08:15:00.000Z',
    });
    blocks.push(r5.newBlock);
    worldState[r5.updatedBatch.batchNo] = r5.updatedBatch;

    const t1 = await invokeTransferBatch({
      actorOrg: organizations['MFG-COSMOS'],
      targetOrg: organizations['DIST-MEDS'],
      worldState,
      blocks,
      batchNo: 'KE-INS-2026-005',
      quantity: 1200,
      transportNotes: 'Refrigerated van transfer to MEDS Cold Storage.',
      timestamp: '2026-02-19T10:00:00.000Z',
      expectedVersion: r5.updatedBatch.version,
    });
    blocks.push(t1.newBlock);
    worldState[t1.updatedBatch.batchNo] = t1.updatedBatch;

    const rc1 = await invokeReceiveBatch({
      actorOrg: organizations['DIST-MEDS'],
      worldState,
      blocks,
      batchNo: 'KE-INS-2026-005',
      conditionNotes: 'Placed in MEDS Cold Room B; IoT data logger flagged brief 9.4°C spike.',
      timestamp: '2026-02-19T14:40:00.000Z',
    });
    blocks.push(rc1.newBlock);
    worldState[rc1.updatedBatch.batchNo] = rc1.updatedBatch;

    const fl1 = await invokeFlagBatch({
      actorOrg: organizations['REG-PPB'],
      worldState,
      blocks,
      batchNo: 'KE-INS-2026-005',
      reason:
        'Cold-chain IoT excursion (+9.4°C for 45 mins on Mombasa Rd transit) — potency assay required before pharmacy release.',
      timestamp: '2026-02-21T09:10:00.000Z',
    });
    blocks.push(fl1.newBlock);
    worldState[fl1.updatedBatch.batchNo] = fl1.updatedBatch;
  }

  // BATCH 6: KE-CIP-2024-089 (Expired)
  {
    const r6 = await invokeRegisterBatch({
      actorOrg: organizations['MFG-COSMOS'],
      worldState,
      blocks,
      batchNo: 'KE-CIP-2024-089',
      drugName: 'Ciproxin (Ciprofloxacin HCl 500mg)',
      activeIngredient: 'Ciprofloxacin Hydrochloride USP 500mg',
      dosageForm: 'Film-Coated Tablets (10s Blister)',
      storageTemp: 'Store below 25°C',
      manufactureDate: '2023-08-15',
      expiryDate: '2025-08-15',
      quantity: 800,
      timestamp: '2023-08-16T10:00:00.000Z',
    });
    blocks.push(r6.newBlock);
    worldState[r6.updatedBatch.batchNo] = r6.updatedBatch;

    const t1 = await invokeTransferBatch({
      actorOrg: organizations['MFG-COSMOS'],
      targetOrg: organizations['DIST-MEDS'],
      worldState,
      blocks,
      batchNo: 'KE-CIP-2024-089',
      quantity: 800,
      transportNotes: 'Standard wholesale delivery to MEDS.',
      timestamp: '2023-09-01T09:00:00.000Z',
      expectedVersion: r6.updatedBatch.version,
    });
    blocks.push(t1.newBlock);
    worldState[t1.updatedBatch.batchNo] = t1.updatedBatch;

    const rc1 = await invokeReceiveBatch({
      actorOrg: organizations['DIST-MEDS'],
      worldState,
      blocks,
      batchNo: 'KE-CIP-2024-089',
      conditionNotes: 'Received in good condition at MEDS.',
      timestamp: '2023-09-02T11:30:00.000Z',
    });
    blocks.push(rc1.newBlock);
    worldState[rc1.updatedBatch.batchNo] = rc1.updatedBatch;

    const t2 = await invokeTransferBatch({
      actorOrg: organizations['DIST-MEDS'],
      targetOrg: organizations['PHARM-GOODLIFE'],
      worldState,
      blocks,
      batchNo: 'KE-CIP-2024-089',
      quantity: 800,
      transportNotes: 'Transferred to Goodlife Pharmacy Westlands.',
      timestamp: '2023-10-10T10:00:00.000Z',
      expectedVersion: rc1.updatedBatch.version,
    });
    blocks.push(t2.newBlock);
    worldState[t2.updatedBatch.batchNo] = t2.updatedBatch;

    const rc2 = await invokeReceiveBatch({
      actorOrg: organizations['PHARM-GOODLIFE'],
      worldState,
      blocks,
      batchNo: 'KE-CIP-2024-089',
      conditionNotes: 'Received at Goodlife Westlands; remaining stock now past 2025-08-15 expiry date.',
      timestamp: '2023-10-11T15:00:00.000Z',
    });
    blocks.push(rc2.newBlock);
    worldState[rc2.updatedBatch.batchNo] = rc2.updatedBatch;
  }

  // BATCH 7: KE-PCM-2026-999 (Recalled)
  {
    const r7 = await invokeRegisterBatch({
      actorOrg: organizations['MFG-UNIVERSAL'],
      worldState,
      blocks,
      batchNo: 'KE-PCM-2026-999',
      drugName: 'Cetamol Pediatric Syrup 120mg/5ml',
      activeIngredient: 'Paracetamol BP 120mg per 5ml Oral Suspension',
      dosageForm: '60ml Amber Glass Bottle',
      storageTemp: 'Store below 25°C, protect from light',
      manufactureDate: '2026-01-20',
      expiryDate: '2028-01-20',
      quantity: 6000,
      timestamp: '2026-01-20T09:00:00.000Z',
    });
    blocks.push(r7.newBlock);
    worldState[r7.updatedBatch.batchNo] = r7.updatedBatch;

    const t1 = await invokeTransferBatch({
      actorOrg: organizations['MFG-UNIVERSAL'],
      targetOrg: organizations['DIST-KEMSA'],
      worldState,
      blocks,
      batchNo: 'KE-PCM-2026-999',
      quantity: 6000,
      transportNotes: 'Bulk pediatric consignment to KEMSA Embakasi Depot.',
      timestamp: '2026-01-25T10:30:00.000Z',
      expectedVersion: r7.updatedBatch.version,
    });
    blocks.push(t1.newBlock);
    worldState[t1.updatedBatch.batchNo] = t1.updatedBatch;

    const rc1 = await invokeReceiveBatch({
      actorOrg: organizations['DIST-KEMSA'],
      worldState,
      blocks,
      batchNo: 'KE-PCM-2026-999',
      conditionNotes: 'Received at KEMSA Embakasi; post-market surveillance sample sent to NQCL.',
      timestamp: '2026-01-26T13:00:00.000Z',
    });
    blocks.push(rc1.newBlock);
    worldState[rc1.updatedBatch.batchNo] = rc1.updatedBatch;

    const recallReason =
      'Class I Statutory Recall (PPB Rapid Alert #KE-RA-2026-14): National Quality Control Laboratory (NQCL) detected failed dissolution profile & diethylene glycol trace impurity.';
    const rec = await invokeRecallBatch({
      actorOrg: organizations['REG-PPB'],
      worldState,
      blocks,
      batchNo: 'KE-PCM-2026-999',
      reason: recallReason,
      timestamp: '2026-02-28T11:00:00.000Z',
    });
    blocks.push(rec.newBlock);
    worldState[rec.updatedBatch.batchNo] = rec.updatedBatch;

    recallAlerts.push({
      id: 'alert_seed_ke_pcm_2026_999',
      batchNo: 'KE-PCM-2026-999',
      drugName: 'Cetamol Pediatric Syrup 120mg/5ml',
      reason: recallReason,
      recalledBy: organizations['REG-PPB'].name,
      recalledAt: '2026-02-28T11:00:00.000Z',
      affectedOrgIds: ['MFG-UNIVERSAL', 'DIST-KEMSA'],
      currentHolderOrgId: 'DIST-KEMSA',
      currentHolderName: organizations['DIST-KEMSA'].name,
    });
  }

  return {
    initializedAt: new Date().toISOString(),
    organizations,
    blocks,
    worldState,
    recallAlerts,
  };
}

let memoryStore: PersistedLedgerStore | null = null;

function syncStoreToBackend(store: PersistedLedgerStore): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  try {
    void fetch('/api/ledger/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: 'pharma-ke-channel',
        worldState: store.worldState,
        blocks: store.blocks,
      }),
    }).catch(() => {
      // ignore transient network errors when offline
    });
  } catch {
    // ignore
  }
}

export function saveStoreToLocalStorage(store: PersistedLedgerStore): void {
  memoryStore = store;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('localStorage quota warning:', e);
  }
  syncStoreToBackend(store);
  ledgerEventBus.emitStoreChange();
}

export async function initializeOrLoadStore(): Promise<PersistedLedgerStore> {
  if (memoryStore) return memoryStore;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedLedgerStore;
      if (
        parsed &&
        parsed.blocks &&
        parsed.blocks.length > 0 &&
        parsed.organizations &&
        parsed.worldState &&
        parsed.blocks[0].merkleRoot // verify upgraded schema
      ) {
        memoryStore = parsed;
        syncStoreToBackend(parsed);
        return parsed;
      }
    }
  } catch {
    // Fall through to seed generation
  }

  const seeded = await buildKenyanSeedStore();
  saveStoreToLocalStorage(seeded);
  return seeded;
}

export async function resetDemoStore(): Promise<PersistedLedgerStore> {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  memoryStore = null;
  const fresh = await buildKenyanSeedStore();
  saveStoreToLocalStorage(fresh);
  return fresh;
}

export async function runChainValidation(): Promise<ChainValidationReport> {
  const store = await initializeOrLoadStore();
  return await validateChain(store.blocks, store.organizations);
}

export async function runTamperSimulation(targetBlockIndex?: number): Promise<{
  tamperedIndex: number;
  description: string;
  validationReport: ChainValidationReport;
}> {
  const store = await initializeOrLoadStore();
  const { mutatedBlocks, tamperedIndex, description } = tamperWithBlockInPlace(
    store.blocks,
    targetBlockIndex
  );
  const updatedStore: PersistedLedgerStore = {
    ...store,
    blocks: mutatedBlocks,
  };
  saveStoreToLocalStorage(updatedStore);
  const validationReport = await validateChain(updatedStore.blocks, updatedStore.organizations);
  return {
    tamperedIndex,
    description,
    validationReport,
  };
}

export async function executeRegisterBatch(params: {
  actorOrgId: string;
  batchNo: string;
  drugName: string;
  activeIngredient?: string;
  dosageForm?: string;
  storageTemp?: string;
  manufactureDate: string;
  expiryDate: string;
  quantity: number;
  confidentialDeal?: {
    unitWholesalePriceKES: number;
    paymentTerms: string;
    procurementContractRef: string;
    rebatePercent: number;
  };
}): Promise<BatchWorldState> {
  const store = await initializeOrLoadStore();
  const actorOrg = store.organizations[params.actorOrgId];
  if (!actorOrg) throw new Error('Invalid acting organization.');

  let privateDataHash: string | undefined;
  let privateDataCollectionName: string | undefined;

  if (params.confidentialDeal) {
    privateDataCollectionName = `PDC_${actorOrg.mspId}_CommercialSideDB`;
    const deal: ConfidentialCommercialDeal = {
      batchNo: params.batchNo.trim().toUpperCase(),
      collectionName: privateDataCollectionName,
      authorizedOrgIds: [actorOrg.id, 'REG-PPB'],
      unitWholesalePriceKES: params.confidentialDeal.unitWholesalePriceKES,
      currency: 'KES',
      paymentTerms: params.confidentialDeal.paymentTerms,
      procurementContractRef: params.confidentialDeal.procurementContractRef,
      rebatePercent: params.confidentialDeal.rebatePercent,
      privateSalt: `0x${Math.random().toString(16).slice(2, 14)}`,
      timestamp: new Date().toISOString(),
    };
    privateDataHash = await computePrivateDataHash(deal);
    savePrivateDataDeal(deal);
  }

  const { newBlock, updatedBatch } = await invokeRegisterBatch({
    actorOrg,
    worldState: store.worldState,
    blocks: store.blocks,
    batchNo: params.batchNo,
    drugName: params.drugName,
    activeIngredient: params.activeIngredient,
    dosageForm: params.dosageForm,
    storageTemp: params.storageTemp,
    manufactureDate: params.manufactureDate,
    expiryDate: params.expiryDate,
    quantity: params.quantity,
    privateDataHash,
    privateDataCollectionName,
  });

  const nextStore: PersistedLedgerStore = {
    ...store,
    blocks: [...store.blocks, newBlock],
    worldState: {
      ...store.worldState,
      [updatedBatch.batchNo]: updatedBatch,
    },
  };
  saveStoreToLocalStorage(nextStore);
  return updatedBatch;
}

export async function executeTransferBatch(params: {
  actorOrgId: string;
  targetOrgId: string;
  batchNo: string;
  quantity: number;
  transportNotes?: string;
  expectedVersion?: number;
}): Promise<BatchWorldState> {
  const store = await initializeOrLoadStore();
  const actorOrg = store.organizations[params.actorOrgId];
  const targetOrg = store.organizations[params.targetOrgId];
  if (!actorOrg) throw new Error('Invalid acting organization.');
  if (!targetOrg) throw new Error('Please select a valid recipient organization.');

  const { newBlock, updatedBatch } = await invokeTransferBatch({
    actorOrg,
    targetOrg,
    worldState: store.worldState,
    blocks: store.blocks,
    batchNo: params.batchNo,
    quantity: params.quantity,
    transportNotes: params.transportNotes,
    expectedVersion: params.expectedVersion,
  });

  const nextStore: PersistedLedgerStore = {
    ...store,
    blocks: [...store.blocks, newBlock],
    worldState: {
      ...store.worldState,
      [updatedBatch.batchNo]: updatedBatch,
    },
  };
  saveStoreToLocalStorage(nextStore);
  return updatedBatch;
}

export async function executeReceiveBatch(params: {
  actorOrgId: string;
  batchNo: string;
  conditionNotes?: string;
}): Promise<BatchWorldState> {
  const store = await initializeOrLoadStore();
  const actorOrg = store.organizations[params.actorOrgId];
  if (!actorOrg) throw new Error('Invalid acting organization.');

  const { newBlock, updatedBatch } = await invokeReceiveBatch({
    actorOrg,
    worldState: store.worldState,
    blocks: store.blocks,
    batchNo: params.batchNo,
    conditionNotes: params.conditionNotes,
  });

  const nextStore: PersistedLedgerStore = {
    ...store,
    blocks: [...store.blocks, newBlock],
    worldState: {
      ...store.worldState,
      [updatedBatch.batchNo]: updatedBatch,
    },
  };
  saveStoreToLocalStorage(nextStore);
  return updatedBatch;
}

export async function executeDispenseUnits(params: {
  actorOrgId: string;
  batchNo: string;
  qty: number;
  patientRef?: string;
}): Promise<BatchWorldState> {
  const store = await initializeOrLoadStore();
  const actorOrg = store.organizations[params.actorOrgId];
  if (!actorOrg) throw new Error('Invalid acting organization.');

  const { newBlock, updatedBatch } = await invokeDispenseUnits({
    actorOrg,
    worldState: store.worldState,
    blocks: store.blocks,
    batchNo: params.batchNo,
    qty: params.qty,
    patientRef: params.patientRef,
  });

  const nextStore: PersistedLedgerStore = {
    ...store,
    blocks: [...store.blocks, newBlock],
    worldState: {
      ...store.worldState,
      [updatedBatch.batchNo]: updatedBatch,
    },
  };
  saveStoreToLocalStorage(nextStore);
  return updatedBatch;
}

export async function executeFlagBatch(params: {
  actorOrgId: string;
  batchNo: string;
  reason: string;
}): Promise<BatchWorldState> {
  const store = await initializeOrLoadStore();
  const actorOrg = store.organizations[params.actorOrgId];
  if (!actorOrg) throw new Error('Invalid acting organization.');

  const { newBlock, updatedBatch } = await invokeFlagBatch({
    actorOrg,
    worldState: store.worldState,
    blocks: store.blocks,
    batchNo: params.batchNo,
    reason: params.reason,
  });

  const nextStore: PersistedLedgerStore = {
    ...store,
    blocks: [...store.blocks, newBlock],
    worldState: {
      ...store.worldState,
      [updatedBatch.batchNo]: updatedBatch,
    },
  };
  saveStoreToLocalStorage(nextStore);
  return updatedBatch;
}

export async function executeRecallBatch(params: {
  actorOrgId: string;
  batchNo: string;
  reason: string;
}): Promise<{ updatedBatch: BatchWorldState; alert: RecallAlertEvent }> {
  const store = await initializeOrLoadStore();
  const actorOrg = store.organizations[params.actorOrgId];
  if (!actorOrg) throw new Error('Invalid acting organization.');

  const { newBlock, updatedBatch } = await invokeRecallBatch({
    actorOrg,
    worldState: store.worldState,
    blocks: store.blocks,
    batchNo: params.batchNo,
    reason: params.reason,
  });

  const affectedSet = new Set<string>();
  affectedSet.add(updatedBatch.currentHolderOrgId);
  affectedSet.add(updatedBatch.manufacturerOrgId);
  if (updatedBatch.pendingRecipientOrgId) {
    affectedSet.add(updatedBatch.pendingRecipientOrgId);
  }
  updatedBatch.custodyHistory.forEach((ev) => {
    affectedSet.add(ev.actorOrgId);
    if (ev.toOrgId) affectedSet.add(ev.toOrgId);
  });

  const alert: RecallAlertEvent = {
    id: `alert_${Date.now()}_${updatedBatch.batchNo}`,
    batchNo: updatedBatch.batchNo,
    drugName: updatedBatch.drugName,
    reason: updatedBatch.recalledReason || params.reason,
    recalledBy: actorOrg.name,
    recalledAt: updatedBatch.recalledAt || new Date().toISOString(),
    affectedOrgIds: Array.from(affectedSet),
    currentHolderOrgId: updatedBatch.currentHolderOrgId,
    currentHolderName: updatedBatch.currentHolderName,
  };

  const nextStore: PersistedLedgerStore = {
    ...store,
    blocks: [...store.blocks, newBlock],
    worldState: {
      ...store.worldState,
      [updatedBatch.batchNo]: updatedBatch,
    },
    recallAlerts: [alert, ...store.recallAlerts],
  };

  saveStoreToLocalStorage(nextStore);
  ledgerEventBus.emitRecall(alert);

  return { updatedBatch, alert };
}
