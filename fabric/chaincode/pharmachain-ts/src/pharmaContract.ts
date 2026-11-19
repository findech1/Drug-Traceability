import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import * as crypto from 'crypto';

export type BatchStatus =
  | 'REGISTERED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'DISPENSED_PARTIAL'
  | 'DISPENSED_FULL'
  | 'FLAGGED'
  | 'RECALLED';

export interface CustodyEvent {
  txId: string;
  timestamp: string;
  action: 'REGISTERED' | 'TRANSFERRED' | 'RECEIVED' | 'DISPENSED' | 'FLAGGED' | 'RECALLED';
  actorMspId: string;
  actorId: string;
  toOrgMspId?: string;
  quantity?: number;
  notes?: string;
}

export interface BatchAsset {
  docType: 'pharmaceuticalBatch';
  batchNo: string;
  drugName: string;
  activeIngredient: string;
  dosageForm: string;
  storageTemp: string;
  manufacturerMspId: string;
  manufactureDate: string;
  expiryDate: string;
  initialQuantity: number;
  currentQuantity: number;
  dispensedQuantity: number;
  currentHolderMspId: string;
  pendingRecipientMspId: string | null;
  inTransitQuantity: number;
  status: BatchStatus;
  flaggedReason: string | null;
  recalledReason: string | null;
  privateDataHash?: string;
  custodyHistory: CustodyEvent[];
}

const MANUFACTURER_MSPS = ['DawaLifeMSP', 'CosmosPharmaMSP', 'UniversalCorpMSP'];
const PHARMACY_MSPS = ['GoodlifePharmMSP', 'KnhHospitalMSP'];
const REGULATOR_MSPS = ['PpbRegulatorMSP'];

@Info({
  title: 'PharmaChainContract',
  description: 'UN SDG 3 Permissioned Pharmaceutical Traceability Chaincode for Kenya (PPB Cap 244)',
})
export class PharmaChainContract extends Contract {
  private getTxTimestamp(ctx: Context): string {
    const ts = ctx.stub.getTxTimestamp();
    const millis = ts.seconds.low * 1000 + Math.floor(ts.nanos / 1_000_000);
    return new Date(millis).toISOString();
  }

  private assertNotRecalled(batch: BatchAsset): void {
    if (batch.status === 'RECALLED') {
      throw new Error(`POLICY_REJECTION: Batch ${batch.batchNo} is RECALLED and quarantined against movement or dispensing.`);
    }
  }

  @Transaction()
  public async initLedger(ctx: Context): Promise<void> {
    const txTime = this.getTxTimestamp(ctx);
    const seedBatches: BatchAsset[] = [
      {
        docType: 'pharmaceuticalBatch',
        batchNo: 'KE-ACT-2026-001',
        drugName: 'Coartem (Artemether + Lumefantrine 20/120mg)',
        activeIngredient: 'Artemether 20mg / Lumefantrine 120mg',
        dosageForm: 'Dispersible Tablets (24s)',
        storageTemp: 'Store below 30°C (Dry Place)',
        manufacturerMspId: 'UniversalCorpMSP',
        manufactureDate: '2026-01-15',
        expiryDate: '2028-01-15',
        initialQuantity: 5000,
        currentQuantity: 4650,
        dispensedQuantity: 350,
        currentHolderMspId: 'KnhHospitalMSP',
        pendingRecipientMspId: null,
        inTransitQuantity: 0,
        status: 'DISPENSED_PARTIAL',
        flaggedReason: null,
        recalledReason: null,
        custodyHistory: [
          {
            txId: ctx.stub.getTxID(),
            timestamp: txTime,
            action: 'REGISTERED',
            actorMspId: 'UniversalCorpMSP',
            actorId: 'MFG-UNIVERSAL',
            quantity: 5000,
            notes: 'Genesis seed batch certified in Kikuyu, Kiambu County.',
          },
        ],
      },
      {
        docType: 'pharmaceuticalBatch',
        batchNo: 'KE-PCM-2026-999',
        drugName: 'Cetamol Pediatric Syrup 120mg/5ml',
        activeIngredient: 'Paracetamol BP 120mg/5ml',
        dosageForm: 'Oral Suspension (100ml Amber Bottle)',
        storageTemp: 'Store below 25°C',
        manufacturerMspId: 'DawaLifeMSP',
        manufactureDate: '2026-02-01',
        expiryDate: '2027-08-01',
        initialQuantity: 3000,
        currentQuantity: 3000,
        dispensedQuantity: 0,
        currentHolderMspId: 'KemsaSupplyMSP',
        pendingRecipientMspId: null,
        inTransitQuantity: 0,
        status: 'RECALLED',
        flaggedReason: null,
        recalledReason: 'Class I PPB Statutory Recall: NQCL assay detected diethylene glycol contamination.',
        custodyHistory: [
          {
            txId: ctx.stub.getTxID(),
            timestamp: txTime,
            action: 'RECALLED',
            actorMspId: 'PpbRegulatorMSP',
            actorId: 'REG-PPB',
            notes: 'Immediate quarantine across all Kenyan supply nodes.',
          },
        ],
      },
    ];

    for (const batch of seedBatches) {
      await ctx.stub.putState(batch.batchNo, Buffer.from(JSON.stringify(batch)));
    }
  }

  @Transaction()
  public async registerBatch(
    ctx: Context,
    batchNo: string,
    drugName: string,
    activeIngredient: string,
    dosageForm: string,
    storageTemp: string,
    manufactureDate: string,
    expiryDate: string,
    quantityStr: string
  ): Promise<string> {
    const callerMsp = ctx.clientIdentity.getMSPID();
    if (!MANUFACTURER_MSPS.includes(callerMsp)) {
      throw new Error(`ACCESS_DENIED: Only Manufacturer MSPs can call registerBatch(). Caller MSP: ${callerMsp}`);
    }

    const cleanBatchNo = batchNo.trim().toUpperCase();
    const existing = await ctx.stub.getState(cleanBatchNo);
    if (existing && existing.length > 0) {
      throw new Error(`DUPLICATE_BATCH: Batch ${cleanBatchNo} already exists in CouchDB World State.`);
    }

    const quantity = parseInt(quantityStr, 10);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('INVALID_QUANTITY: Quantity must be a positive integer.');
    }

    const txTime = this.getTxTimestamp(ctx);
    const batch: BatchAsset = {
      docType: 'pharmaceuticalBatch',
      batchNo: cleanBatchNo,
      drugName,
      activeIngredient,
      dosageForm,
      storageTemp,
      manufacturerMspId: callerMsp,
      manufactureDate,
      expiryDate,
      initialQuantity: quantity,
      currentQuantity: quantity,
      dispensedQuantity: 0,
      currentHolderMspId: callerMsp,
      pendingRecipientMspId: null,
      inTransitQuantity: 0,
      status: 'REGISTERED',
      flaggedReason: null,
      recalledReason: null,
      custodyHistory: [
        {
          txId: ctx.stub.getTxID(),
          timestamp: txTime,
          action: 'REGISTERED',
          actorMspId: callerMsp,
          actorId: ctx.clientIdentity.getID(),
          quantity,
          notes: `Manufactured and registered by ${callerMsp}`,
        },
      ],
    };

    // Check transient Private Data Collection pricing payload if provided
    const transientMap = ctx.stub.getTransient();
    if (transientMap && transientMap.has('commercialTerms')) {
      const privateBytes = transientMap.get('commercialTerms');
      const collectionName = transientMap.has('collectionName')
        ? transientMap.get('collectionName').toString('utf8')
        : 'PDC_Dawa_MEDS_WholesaleAgreement';
      batch.privateDataHash = crypto.createHash('sha256').update(privateBytes).digest('hex');
      await ctx.stub.putPrivateData(collectionName, cleanBatchNo, privateBytes);
    }

    await ctx.stub.putState(cleanBatchNo, Buffer.from(JSON.stringify(batch)));
    ctx.stub.setEvent('BatchRegistered', Buffer.from(JSON.stringify({ batchNo: cleanBatchNo, mspId: callerMsp })));
    return JSON.stringify(batch);
  }

  @Transaction()
  public async transferBatch(
    ctx: Context,
    batchNo: string,
    targetMspId: string,
    quantityStr: string
  ): Promise<string> {
    const callerMsp = ctx.clientIdentity.getMSPID();
    const cleanBatchNo = batchNo.trim().toUpperCase();
    const raw = await ctx.stub.getState(cleanBatchNo);
    if (!raw || raw.length === 0) {
      throw new Error(`NOT_FOUND: Batch ${cleanBatchNo} does not exist.`);
    }

    const batch: BatchAsset = JSON.parse(raw.toString('utf8'));
    this.assertNotRecalled(batch);

    if (batch.currentHolderMspId !== callerMsp) {
      throw new Error(`CUSTODY_VIOLATION: Caller ${callerMsp} is not current holder (${batch.currentHolderMspId}).`);
    }
    if (batch.status === 'IN_TRANSIT') {
      throw new Error(`CONFLICT: Batch ${cleanBatchNo} is already IN_TRANSIT to ${batch.pendingRecipientMspId}.`);
    }

    const qty = parseInt(quantityStr, 10);
    if (!Number.isInteger(qty) || qty <= 0 || qty > batch.currentQuantity) {
      throw new Error(`INVALID_QUANTITY: Requested ${qty}, available ${batch.currentQuantity}.`);
    }

    const txTime = this.getTxTimestamp(ctx);
    batch.status = 'IN_TRANSIT';
    batch.pendingRecipientMspId = targetMspId;
    batch.inTransitQuantity = qty;
    batch.custodyHistory.push({
      txId: ctx.stub.getTxID(),
      timestamp: txTime,
      action: 'TRANSFERRED',
      actorMspId: callerMsp,
      actorId: ctx.clientIdentity.getID(),
      toOrgMspId: targetMspId,
      quantity: qty,
      notes: `Dispatched ${qty} units from ${callerMsp} to ${targetMspId}.`,
    });

    await ctx.stub.putState(cleanBatchNo, Buffer.from(JSON.stringify(batch)));
    ctx.stub.setEvent('BatchTransferred', Buffer.from(JSON.stringify({ batchNo: cleanBatchNo, from: callerMsp, to: targetMspId })));
    return JSON.stringify(batch);
  }

  @Transaction()
  public async receiveBatch(ctx: Context, batchNo: string): Promise<string> {
    const callerMsp = ctx.clientIdentity.getMSPID();
    const cleanBatchNo = batchNo.trim().toUpperCase();
    const raw = await ctx.stub.getState(cleanBatchNo);
    if (!raw || raw.length === 0) {
      throw new Error(`NOT_FOUND: Batch ${cleanBatchNo} does not exist.`);
    }

    const batch: BatchAsset = JSON.parse(raw.toString('utf8'));
    this.assertNotRecalled(batch);

    if (batch.status !== 'IN_TRANSIT' || batch.pendingRecipientMspId !== callerMsp) {
      throw new Error(`RECEIPT_DENIED: Batch ${cleanBatchNo} is not consigned to ${callerMsp}.`);
    }

    const txTime = this.getTxTimestamp(ctx);
    batch.currentHolderMspId = callerMsp;
    batch.pendingRecipientMspId = null;
    batch.inTransitQuantity = 0;
    batch.status = 'DELIVERED';
    batch.custodyHistory.push({
      txId: ctx.stub.getTxID(),
      timestamp: txTime,
      action: 'RECEIVED',
      actorMspId: callerMsp,
      actorId: ctx.clientIdentity.getID(),
      notes: `Custody accepted and verified by ${callerMsp}.`,
    });

    await ctx.stub.putState(cleanBatchNo, Buffer.from(JSON.stringify(batch)));
    return JSON.stringify(batch);
  }

  @Transaction()
  public async dispenseUnits(ctx: Context, batchNo: string, qtyStr: string): Promise<string> {
    const callerMsp = ctx.clientIdentity.getMSPID();
    if (!PHARMACY_MSPS.includes(callerMsp)) {
      throw new Error(`ACCESS_DENIED: Only Pharmacy MSPs may dispense medication. Caller: ${callerMsp}`);
    }

    const cleanBatchNo = batchNo.trim().toUpperCase();
    const raw = await ctx.stub.getState(cleanBatchNo);
    if (!raw || raw.length === 0) {
      throw new Error(`NOT_FOUND: Batch ${cleanBatchNo} not found.`);
    }

    const batch: BatchAsset = JSON.parse(raw.toString('utf8'));
    this.assertNotRecalled(batch);

    if (batch.currentHolderMspId !== callerMsp) {
      throw new Error(`CUSTODY_VIOLATION: Batch held by ${batch.currentHolderMspId}, not ${callerMsp}.`);
    }

    const txTime = this.getTxTimestamp(ctx);
    if (new Date(batch.expiryDate).getTime() < new Date(txTime).getTime()) {
      throw new Error(`SAFETY_BLOCK: Batch ${cleanBatchNo} expired on ${batch.expiryDate}. Dispensing blocked.`);
    }

    const qty = parseInt(qtyStr, 10);
    if (!Number.isInteger(qty) || qty <= 0 || qty > batch.currentQuantity) {
      throw new Error(`INSUFFICIENT_STOCK: Requested ${qty}, remaining ${batch.currentQuantity}.`);
    }

    batch.currentQuantity -= qty;
    batch.dispensedQuantity += qty;
    batch.status = batch.currentQuantity === 0 ? 'DISPENSED_FULL' : 'DISPENSED_PARTIAL';
    batch.custodyHistory.push({
      txId: ctx.stub.getTxID(),
      timestamp: txTime,
      action: 'DISPENSED',
      actorMspId: callerMsp,
      actorId: ctx.clientIdentity.getID(),
      quantity: qty,
      notes: `Dispensed ${qty} units to patient.`,
    });

    await ctx.stub.putState(cleanBatchNo, Buffer.from(JSON.stringify(batch)));
    return JSON.stringify(batch);
  }

  @Transaction()
  public async recallBatch(ctx: Context, batchNo: string, reason: string): Promise<string> {
    const callerMsp = ctx.clientIdentity.getMSPID();
    if (!REGULATOR_MSPS.includes(callerMsp)) {
      throw new Error(`ACCESS_DENIED: Only PPB Regulator MSP can issue recalls. Caller: ${callerMsp}`);
    }

    const cleanBatchNo = batchNo.trim().toUpperCase();
    const raw = await ctx.stub.getState(cleanBatchNo);
    if (!raw || raw.length === 0) {
      throw new Error(`NOT_FOUND: Batch ${cleanBatchNo} does not exist.`);
    }

    const batch: BatchAsset = JSON.parse(raw.toString('utf8'));
    const txTime = this.getTxTimestamp(ctx);
    batch.status = 'RECALLED';
    batch.recalledReason = reason;
    batch.custodyHistory.push({
      txId: ctx.stub.getTxID(),
      timestamp: txTime,
      action: 'RECALLED',
      actorMspId: callerMsp,
      actorId: ctx.clientIdentity.getID(),
      notes: `STATUTORY RECALL: ${reason}`,
    });

    await ctx.stub.putState(cleanBatchNo, Buffer.from(JSON.stringify(batch)));
    ctx.stub.setEvent(
      'BatchRecalled',
      Buffer.from(JSON.stringify({ batchNo: cleanBatchNo, reason, recalledBy: callerMsp }))
    );
    return JSON.stringify(batch);
  }

  @Transaction(false)
  @Returns('string')
  public async verifyBatch(ctx: Context, batchNo: string): Promise<string> {
    const cleanBatchNo = batchNo.trim().toUpperCase();
    const raw = await ctx.stub.getState(cleanBatchNo);
    if (!raw || raw.length === 0) {
      return JSON.stringify({ verified: false, status: 'UNKNOWN_COUNTERFEIT', batchNo: cleanBatchNo });
    }
    return raw.toString('utf8');
  }

  @Transaction(false)
  @Returns('string')
  public async queryBatchesByStatus(ctx: Context, status: string): Promise<string> {
    // Executes a real CouchDB Mango Rich Query against peer state DB
    const query = JSON.stringify({
      selector: {
        docType: 'pharmaceuticalBatch',
        status,
      },
    });
    const iterator = await ctx.stub.getQueryResult(query);
    const results: BatchAsset[] = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value && res.value.value) {
        results.push(JSON.parse(res.value.value.toString('utf8')));
      }
      res = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(results);
  }

  @Transaction(false)
  @Returns('string')
  public async getBatchHistory(ctx: Context, batchNo: string): Promise<string> {
    const iterator = await ctx.stub.getHistoryForKey(batchNo.trim().toUpperCase());
    const history: Array<{ txId: string; isDelete: boolean; value: unknown }> = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value) {
        history.push({
          txId: res.value.txId,
          isDelete: res.value.isDelete,
          value: res.value.value ? JSON.parse(res.value.value.toString('utf8')) : null,
        });
      }
      res = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(history);
  }
}
