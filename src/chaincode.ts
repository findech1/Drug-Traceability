/**
 * ============================================================================
 * MODULE: chaincode.ts
 * HYPERLEDGER FABRIC EQUIVALENT:
 *   - Smart Contract / Chaincode (`fabric-contract-api` Contract class)
 *   - Client Identity (`ctx.clientIdentity.getMSPID()` / attribute-based access control)
 *   - CouchDB World State (`ctx.stub.putState`, `ctx.stub.getState`, `ctx.stub.setEvent`)
 *   - MVCC version enforcement on Batch records
 *   - Multi-peer endorsement (e.g. AND(Sender, Recipient))
 * ============================================================================
 */

import {
  Block,
  createSignedTransactionAndBlock,
  OrganizationMSP,
  PeerEndorsement,
  RWSet,
  SignedTransaction,
} from './ledger';

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
  blockIndex: number;
  timestamp: string;
  action:
    | 'REGISTERED'
    | 'TRANSFERRED'
    | 'RECEIVED'
    | 'DISPENSED'
    | 'FLAGGED'
    | 'RECALLED';
  actorOrgId: string;
  actorName: string;
  actorRole: string;
  actorMspId: string;
  fromOrgId?: string;
  fromOrgName?: string;
  toOrgId?: string;
  toOrgName?: string;
  quantity?: number;
  notes?: string;
  signatureHex: string;
  // Multi-peer endorsement signatures for this hop
  endorsements?: PeerEndorsement[];
  endorsementPolicy?: string;
}

/**
 * Represents a single pharmaceutical batch record in the CouchDB World State.
 * Includes `version` for Multi-Version Concurrency Control (MVCC).
 */
export interface BatchWorldState {
  batchNo: string;
  version: number; // Feature 3: MVCC record version
  drugName: string;
  activeIngredient: string;
  dosageForm: string;
  storageTemp: string;
  manufacturerOrgId: string;
  manufacturerName: string;
  manufactureDate: string;
  expiryDate: string;
  initialQuantity: number;
  currentQuantity: number;
  dispensedQuantity: number;
  currentHolderOrgId: string;
  currentHolderName: string;
  currentHolderRole: string;
  pendingRecipientOrgId: string | null;
  pendingRecipientName: string | null;
  inTransitQuantity: number;
  status: BatchStatus;
  flaggedReason: string | null;
  flaggedByOrgName: string | null;
  flaggedAt: string | null;
  recalledReason: string | null;
  recalledByOrgName: string | null;
  recalledAt: string | null;
  lastUpdated: string;
  // Feature 5: Private Data Collection on-chain hash reference
  privateDataHash?: string;
  privateDataCollectionName?: string;
  custodyHistory: CustodyEvent[];
}

export type VerificationStatusCode =
  | 'AUTHENTIC'
  | 'RECALLED'
  | 'EXPIRED'
  | 'FLAGGED'
  | 'UNKNOWN_COUNTERFEIT';

export interface ConsumerVerificationResult {
  batchNo: string;
  status: VerificationStatusCode;
  headline: string;
  subheadline: string;
  isSafeToUse: boolean;
  isExpired: boolean;
  batch: BatchWorldState | null;
  custodyTimeline: CustodyEvent[];
  ledgerBlocksVerified: number;
  verifiedAt: string;
}

/**
 * Helper to check if a batch's expiryDate is in the past relative to current date.
 */
export function isBatchExpired(expiryDateStr: string, referenceDate?: Date): boolean {
  const ref = referenceDate || new Date();
  const exp = new Date(expiryDateStr);
  if (isNaN(exp.getTime())) return false;
  return exp.getTime() < ref.getTime();
}

/**
 * CHAINCODE FUNCTION 1: registerBatch [Manufacturer ONLY]
 */
export async function invokeRegisterBatch(params: {
  actorOrg: OrganizationMSP;
  worldState: Record<string, BatchWorldState>;
  blocks: Block[];
  batchNo: string;
  drugName: string;
  activeIngredient?: string;
  dosageForm?: string;
  storageTemp?: string;
  manufactureDate: string;
  expiryDate: string;
  quantity: number;
  timestamp?: string;
  privateDataHash?: string;
  privateDataCollectionName?: string;
}): Promise<{ newBlock: Block; updatedBatch: BatchWorldState }> {
  const { actorOrg, worldState, blocks } = params;
  const cleanBatchNo = params.batchNo.trim().toUpperCase();
  const cleanDrugName = params.drugName.trim();

  // 1. Access Control Check (MSP Role)
  if (actorOrg.role !== 'Manufacturer') {
    throw new Error(
      `Access Denied (MSP Role Violation): Only a 'Manufacturer' peer can invoke registerBatch(). Current role: '${actorOrg.role}'.`
    );
  }

  // 2. Input Validation
  if (!cleanBatchNo || cleanBatchNo.length < 4) {
    throw new Error('Batch number must be at least 4 characters (e.g., KE-AMX-2026-010).');
  }
  if (!cleanDrugName) {
    throw new Error('Drug name is required.');
  }
  if (!params.manufactureDate || !params.expiryDate) {
    throw new Error('Both manufacture date and expiry date are required.');
  }
  if (new Date(params.expiryDate) <= new Date(params.manufactureDate)) {
    throw new Error('Expiry date must be later than the manufacture date.');
  }
  if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
    throw new Error('Batch quantity must be a positive whole number.');
  }

  // 3. Prevent Duplicate Batch Registration in World State
  if (worldState[cleanBatchNo]) {
    throw new Error(
      `Batch '${cleanBatchNo}' already exists on the ledger. Duplicate batch registration is prohibited.`
    );
  }

  const timestamp = params.timestamp || new Date().toISOString();
  const activeIngredient =
    params.activeIngredient?.trim() || 'Standard Active Pharmaceutical Ingredient';
  const dosageForm = params.dosageForm?.trim() || 'Film-Coated Tablets';
  const storageTemp = params.storageTemp?.trim() || 'Store below 25°C (Dry Place)';

  const rwSet: RWSet = {
    reads: [],
    writes: [{ key: `batch_${cleanBatchNo}`, value: { status: 'REGISTERED', quantity: params.quantity, version: 1 } }],
  };

  const summary = `Registered ${params.quantity.toLocaleString()} units of ${cleanDrugName} (${cleanBatchNo}) by ${actorOrg.name}.`;

  const newBlock = await createSignedTransactionAndBlock({
    org: actorOrg,
    fn: 'registerBatch',
    batchNo: cleanBatchNo,
    args: {
      drugName: cleanDrugName,
      activeIngredient,
      dosageForm,
      storageTemp,
      manufactureDate: params.manufactureDate,
      expiryDate: params.expiryDate,
      quantity: params.quantity,
    },
    summary,
    timestamp,
    previousBlock: blocks[blocks.length - 1],
    rwSet,
    privateDataHash: params.privateDataHash,
    privateDataCollectionName: params.privateDataCollectionName,
    endorsementPolicy: `AND('${actorOrg.mspId}.peer')`,
  });

  const signedTx: SignedTransaction = newBlock.transactions[0];

  const initialEvent: CustodyEvent = {
    txId: signedTx.txId,
    blockIndex: newBlock.index,
    timestamp,
    action: 'REGISTERED',
    actorOrgId: actorOrg.id,
    actorName: actorOrg.name,
    actorRole: actorOrg.role,
    actorMspId: actorOrg.mspId,
    quantity: params.quantity,
    notes: `Manufactured and sealed at ${actorOrg.location}. Exp: ${params.expiryDate}.`,
    signatureHex: signedTx.signature,
    endorsements: signedTx.endorsements,
    endorsementPolicy: signedTx.endorsementPolicy,
  };

  const updatedBatch: BatchWorldState = {
    batchNo: cleanBatchNo,
    version: 1,
    drugName: cleanDrugName,
    activeIngredient,
    dosageForm,
    storageTemp,
    manufacturerOrgId: actorOrg.id,
    manufacturerName: actorOrg.name,
    manufactureDate: params.manufactureDate,
    expiryDate: params.expiryDate,
    initialQuantity: params.quantity,
    currentQuantity: params.quantity,
    dispensedQuantity: 0,
    currentHolderOrgId: actorOrg.id,
    currentHolderName: actorOrg.name,
    currentHolderRole: actorOrg.role,
    pendingRecipientOrgId: null,
    pendingRecipientName: null,
    inTransitQuantity: 0,
    status: 'REGISTERED',
    flaggedReason: null,
    flaggedByOrgName: null,
    flaggedAt: null,
    recalledReason: null,
    recalledByOrgName: null,
    recalledAt: null,
    lastUpdated: timestamp,
    privateDataHash: params.privateDataHash,
    privateDataCollectionName: params.privateDataCollectionName,
    custodyHistory: [initialEvent],
  };

  return { newBlock, updatedBatch };
}

/**
 * CHAINCODE FUNCTION 2: transferBatch [Current Holder ONLY]
 * Feature 2: Multi-Peer Endorsement Policy: AND(SenderMSP, RecipientMSP)
 * Feature 3: MVCC Read-Write Set version verification
 */
export async function invokeTransferBatch(params: {
  actorOrg: OrganizationMSP;
  targetOrg: OrganizationMSP;
  worldState: Record<string, BatchWorldState>;
  blocks: Block[];
  batchNo: string;
  quantity: number;
  transportNotes?: string;
  timestamp?: string;
  expectedVersion?: number; // MVCC check
  privateDataHash?: string;
  privateDataCollectionName?: string;
}): Promise<{ newBlock: Block; updatedBatch: BatchWorldState }> {
  const { actorOrg, targetOrg, worldState, blocks } = params;
  const cleanBatchNo = params.batchNo.trim().toUpperCase();
  const batch = worldState[cleanBatchNo];

  if (!batch) {
    throw new Error(`Batch '${cleanBatchNo}' does not exist in CouchDB World State.`);
  }

  // Feature 3: MVCC Conflict Detection
  if (params.expectedVersion !== undefined && params.expectedVersion !== batch.version) {
    throw new Error(
      `MVCC_READ_CONFLICT: Transaction aborted! The batch record has already been modified (Expected Version: v${params.expectedVersion}, Current Ledger Version: v${batch.version}). Concurrency double-spend prevented.`
    );
  }

  if (batch.status === 'RECALLED') {
    throw new Error(
      `Chaincode Policy Rejection: Batch '${cleanBatchNo}' has been RECALLED by the Regulator and is locked against any transfer.`
    );
  }

  if (batch.currentHolderOrgId !== actorOrg.id) {
    throw new Error(
      `Custody Violation: ${actorOrg.name} is not the current holder of batch '${cleanBatchNo}'. Current holder is ${batch.currentHolderName}.`
    );
  }

  if (batch.status === 'IN_TRANSIT' || batch.pendingRecipientOrgId) {
    throw new Error(
      `Batch '${cleanBatchNo}' is already IN_TRANSIT to ${batch.pendingRecipientName}. It must be received before another transfer.`
    );
  }

  if (targetOrg.id === actorOrg.id) {
    throw new Error('Cannot transfer a batch to the same organization.');
  }

  if (targetOrg.role === 'Regulator') {
    throw new Error('Cannot transfer commercial supply chain stock to the Regulator.');
  }

  if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
    throw new Error('Transfer quantity must be a positive whole number.');
  }

  if (params.quantity > batch.currentQuantity) {
    throw new Error(
      `Insufficient Quantity: Cannot transfer ${params.quantity.toLocaleString()} units when only ${batch.currentQuantity.toLocaleString()} units are held.`
    );
  }

  const timestamp = params.timestamp || new Date().toISOString();
  const notes =
    params.transportNotes?.trim() ||
    `Dispatched via GDP temperature-monitored logistics to ${targetOrg.name} (${targetOrg.location}).`;

  const newVersion = batch.version + 1;
  const rwSet: RWSet = {
    reads: [{ key: `batch_${cleanBatchNo}`, version: batch.version }],
    writes: [
      {
        key: `batch_${cleanBatchNo}`,
        value: {
          status: 'IN_TRANSIT',
          pendingRecipientOrgId: targetOrg.id,
          inTransitQuantity: params.quantity,
          version: newVersion,
        },
      },
    ],
  };

  const summary = `Transferred ${params.quantity.toLocaleString()} units of ${batch.drugName} (${cleanBatchNo}) from ${actorOrg.name} to ${targetOrg.name}.`;

  // Multi-Peer Endorsement: Both Sender AND Recipient peers must endorse the transfer
  const newBlock = await createSignedTransactionAndBlock({
    org: actorOrg,
    fn: 'transferBatch',
    batchNo: cleanBatchNo,
    args: {
      fromOrgId: actorOrg.id,
      toOrgId: targetOrg.id,
      toOrgName: targetOrg.name,
      quantity: params.quantity,
      transportNotes: notes,
    },
    summary,
    timestamp,
    previousBlock: blocks[blocks.length - 1],
    endorsingOrgs: [targetOrg],
    endorsementPolicy: `AND('${actorOrg.mspId}.peer', '${targetOrg.mspId}.peer')`,
    rwSet,
    privateDataHash: params.privateDataHash || batch.privateDataHash,
    privateDataCollectionName: params.privateDataCollectionName || batch.privateDataCollectionName,
  });

  const signedTx = newBlock.transactions[0];

  const event: CustodyEvent = {
    txId: signedTx.txId,
    blockIndex: newBlock.index,
    timestamp,
    action: 'TRANSFERRED',
    actorOrgId: actorOrg.id,
    actorName: actorOrg.name,
    actorRole: actorOrg.role,
    actorMspId: actorOrg.mspId,
    fromOrgId: actorOrg.id,
    fromOrgName: actorOrg.name,
    toOrgId: targetOrg.id,
    toOrgName: targetOrg.name,
    quantity: params.quantity,
    notes,
    signatureHex: signedTx.signature,
    endorsements: signedTx.endorsements,
    endorsementPolicy: signedTx.endorsementPolicy,
  };

  const updatedBatch: BatchWorldState = {
    ...batch,
    version: newVersion,
    pendingRecipientOrgId: targetOrg.id,
    pendingRecipientName: targetOrg.name,
    inTransitQuantity: params.quantity,
    status: batch.status === 'FLAGGED' ? 'FLAGGED' : 'IN_TRANSIT',
    lastUpdated: timestamp,
    custodyHistory: [...batch.custodyHistory, event],
  };

  return { newBlock, updatedBatch };
}

/**
 * CHAINCODE FUNCTION 3: receiveBatch [Designated Recipient ONLY]
 */
export async function invokeReceiveBatch(params: {
  actorOrg: OrganizationMSP;
  worldState: Record<string, BatchWorldState>;
  blocks: Block[];
  batchNo: string;
  conditionNotes?: string;
  timestamp?: string;
}): Promise<{ newBlock: Block; updatedBatch: BatchWorldState }> {
  const { actorOrg, worldState, blocks } = params;
  const cleanBatchNo = params.batchNo.trim().toUpperCase();
  const batch = worldState[cleanBatchNo];

  if (!batch) {
    throw new Error(`Batch '${cleanBatchNo}' does not exist in World State.`);
  }

  if (batch.status === 'RECALLED') {
    throw new Error(
      `Chaincode Policy Rejection: Batch '${cleanBatchNo}' is RECALLED and must be quarantined immediately—cannot accept into commercial stock.`
    );
  }

  if (batch.pendingRecipientOrgId !== actorOrg.id) {
    throw new Error(
      `Recipient Mismatch: Batch '${cleanBatchNo}' is not consigned to ${actorOrg.name}. Designated recipient: ${
        batch.pendingRecipientName || 'None (Not in transit)'
      }.`
    );
  }

  const timestamp = params.timestamp || new Date().toISOString();
  const notes =
    params.conditionNotes?.trim() ||
    `Seal intact & cold-chain verified upon arrival at ${actorOrg.name} (${actorOrg.location}).`;

  const previousHolderId = batch.currentHolderOrgId;
  const previousHolderName = batch.currentHolderName;
  const receivedQty = batch.inTransitQuantity || batch.currentQuantity;
  const newVersion = batch.version + 1;

  const rwSet: RWSet = {
    reads: [{ key: `batch_${cleanBatchNo}`, version: batch.version }],
    writes: [
      {
        key: `batch_${cleanBatchNo}`,
        value: {
          currentHolderOrgId: actorOrg.id,
          pendingRecipientOrgId: null,
          inTransitQuantity: 0,
          version: newVersion,
        },
      },
    ],
  };

  const summary = `${actorOrg.name} confirmed receipt of ${receivedQty.toLocaleString()} units of ${batch.drugName} (${cleanBatchNo}) from ${previousHolderName}.`;

  const newBlock = await createSignedTransactionAndBlock({
    org: actorOrg,
    fn: 'receiveBatch',
    batchNo: cleanBatchNo,
    args: {
      fromOrgId: previousHolderId,
      receivedByOrgId: actorOrg.id,
      receivedQuantity: receivedQty,
      conditionNotes: notes,
    },
    summary,
    timestamp,
    previousBlock: blocks[blocks.length - 1],
    rwSet,
    endorsementPolicy: `AND('${actorOrg.mspId}.peer')`,
  });

  const signedTx = newBlock.transactions[0];

  const event: CustodyEvent = {
    txId: signedTx.txId,
    blockIndex: newBlock.index,
    timestamp,
    action: 'RECEIVED',
    actorOrgId: actorOrg.id,
    actorName: actorOrg.name,
    actorRole: actorOrg.role,
    actorMspId: actorOrg.mspId,
    fromOrgId: previousHolderId,
    fromOrgName: previousHolderName,
    toOrgId: actorOrg.id,
    toOrgName: actorOrg.name,
    quantity: receivedQty,
    notes,
    signatureHex: signedTx.signature,
    endorsements: signedTx.endorsements,
    endorsementPolicy: signedTx.endorsementPolicy,
  };

  const updatedBatch: BatchWorldState = {
    ...batch,
    version: newVersion,
    currentQuantity: receivedQty,
    currentHolderOrgId: actorOrg.id,
    currentHolderName: actorOrg.name,
    currentHolderRole: actorOrg.role,
    pendingRecipientOrgId: null,
    pendingRecipientName: null,
    inTransitQuantity: 0,
    status: batch.flaggedReason ? 'FLAGGED' : 'DELIVERED',
    lastUpdated: timestamp,
    custodyHistory: [...batch.custodyHistory, event],
  };

  return { newBlock, updatedBatch };
}

/**
 * CHAINCODE FUNCTION 4: dispenseUnits [Pharmacy ONLY]
 */
export async function invokeDispenseUnits(params: {
  actorOrg: OrganizationMSP;
  worldState: Record<string, BatchWorldState>;
  blocks: Block[];
  batchNo: string;
  qty: number;
  patientRef?: string;
  timestamp?: string;
}): Promise<{ newBlock: Block; updatedBatch: BatchWorldState }> {
  const { actorOrg, worldState, blocks } = params;
  const cleanBatchNo = params.batchNo.trim().toUpperCase();
  const batch = worldState[cleanBatchNo];

  if (actorOrg.role !== 'Pharmacy') {
    throw new Error(
      `Access Denied (MSP Role Violation): Only a licensed 'Pharmacy' peer can invoke dispenseUnits().`
    );
  }

  if (!batch) {
    throw new Error(`Batch '${cleanBatchNo}' does not exist in World State.`);
  }

  if (batch.status === 'RECALLED') {
    throw new Error(
      `CRITICAL SAFETY BLOCK: Batch '${cleanBatchNo}' is RECALLED by the Regulator! Dispensing to patients is strictly prohibited.`
    );
  }

  if (isBatchExpired(batch.expiryDate)) {
    throw new Error(
      `SAFETY BLOCK: Batch '${cleanBatchNo}' expired on ${batch.expiryDate} and cannot be dispensed.`
    );
  }

  if (batch.currentHolderOrgId !== actorOrg.id) {
    throw new Error(
      `Custody Violation: ${actorOrg.name} does not hold batch '${cleanBatchNo}'. Current holder: ${batch.currentHolderName}.`
    );
  }

  if (batch.pendingRecipientOrgId) {
    throw new Error(
      `Batch '${cleanBatchNo}' is currently marked IN_TRANSIT and must be received before dispensing.`
    );
  }

  if (!Number.isInteger(params.qty) || params.qty <= 0) {
    throw new Error('Dispense quantity must be a positive whole number.');
  }

  if (params.qty > batch.currentQuantity) {
    throw new Error(
      `Over-Quantity Rejection: Cannot dispense ${params.qty.toLocaleString()} units when only ${batch.currentQuantity.toLocaleString()} units remain in stock.`
    );
  }

  const timestamp = params.timestamp || new Date().toISOString();
  const remaining = batch.currentQuantity - params.qty;
  const newDispensedTotal = batch.dispensedQuantity + params.qty;
  const newVersion = batch.version + 1;
  const notes =
    params.patientRef?.trim() ||
    `Dispensed ${params.qty} units at ${actorOrg.name}. Remaining stock: ${remaining.toLocaleString()} units.`;

  const rwSet: RWSet = {
    reads: [{ key: `batch_${cleanBatchNo}`, version: batch.version }],
    writes: [
      {
        key: `batch_${cleanBatchNo}`,
        value: {
          currentQuantity: remaining,
          dispensedQuantity: newDispensedTotal,
          version: newVersion,
        },
      },
    ],
  };

  const summary = `Dispensed ${params.qty.toLocaleString()} units of ${batch.drugName} (${cleanBatchNo}) at ${actorOrg.name} (${remaining.toLocaleString()} units remaining).`;

  const newBlock = await createSignedTransactionAndBlock({
    org: actorOrg,
    fn: 'dispenseUnits',
    batchNo: cleanBatchNo,
    args: {
      dispensedQty: params.qty,
      remainingQuantity: remaining,
      patientRef: notes,
    },
    summary,
    timestamp,
    previousBlock: blocks[blocks.length - 1],
    rwSet,
    endorsementPolicy: `AND('${actorOrg.mspId}.peer')`,
  });

  const signedTx = newBlock.transactions[0];

  const event: CustodyEvent = {
    txId: signedTx.txId,
    blockIndex: newBlock.index,
    timestamp,
    action: 'DISPENSED',
    actorOrgId: actorOrg.id,
    actorName: actorOrg.name,
    actorRole: actorOrg.role,
    actorMspId: actorOrg.mspId,
    quantity: params.qty,
    notes,
    signatureHex: signedTx.signature,
    endorsements: signedTx.endorsements,
    endorsementPolicy: signedTx.endorsementPolicy,
  };

  let nextStatus: BatchStatus = remaining === 0 ? 'DISPENSED_FULL' : 'DISPENSED_PARTIAL';
  if (batch.flaggedReason) {
    nextStatus = 'FLAGGED';
  }

  const updatedBatch: BatchWorldState = {
    ...batch,
    version: newVersion,
    currentQuantity: remaining,
    dispensedQuantity: newDispensedTotal,
    status: nextStatus,
    lastUpdated: timestamp,
    custodyHistory: [...batch.custodyHistory, event],
  };

  return { newBlock, updatedBatch };
}

/**
 * CHAINCODE FUNCTION 5: flagBatch [Regulator ONLY]
 */
export async function invokeFlagBatch(params: {
  actorOrg: OrganizationMSP;
  worldState: Record<string, BatchWorldState>;
  blocks: Block[];
  batchNo: string;
  reason: string;
  timestamp?: string;
}): Promise<{ newBlock: Block; updatedBatch: BatchWorldState }> {
  const { actorOrg, worldState, blocks } = params;
  const cleanBatchNo = params.batchNo.trim().toUpperCase();
  const batch = worldState[cleanBatchNo];

  if (actorOrg.role !== 'Regulator') {
    throw new Error(
      `Access Denied (MSP Role Violation): Only the 'Regulator' (PPB) can invoke flagBatch().`
    );
  }

  if (!batch) {
    throw new Error(`Batch '${cleanBatchNo}' does not exist in World State.`);
  }

  if (batch.status === 'RECALLED') {
    throw new Error(`Batch '${cleanBatchNo}' is already RECALLED.`);
  }

  const cleanReason = params.reason.trim();
  if (!cleanReason || cleanReason.length < 5) {
    throw new Error(
      'Please provide a specific regulatory inspection reason (at least 5 characters).'
    );
  }

  const timestamp = params.timestamp || new Date().toISOString();
  const newVersion = batch.version + 1;
  const summary = `REGULATORY FLAG on ${batch.drugName} (${cleanBatchNo}) by ${actorOrg.name}: "${cleanReason}"`;

  const rwSet: RWSet = {
    reads: [{ key: `batch_${cleanBatchNo}`, version: batch.version }],
    writes: [
      {
        key: `batch_${cleanBatchNo}`,
        value: { status: 'FLAGGED', flaggedReason: cleanReason, version: newVersion },
      },
    ],
  };

  const newBlock = await createSignedTransactionAndBlock({
    org: actorOrg,
    fn: 'flagBatch',
    batchNo: cleanBatchNo,
    args: {
      reason: cleanReason,
      currentHolderOrgId: batch.currentHolderOrgId,
    },
    summary,
    timestamp,
    previousBlock: blocks[blocks.length - 1],
    rwSet,
    endorsementPolicy: `AND('${actorOrg.mspId}.regulator')`,
  });

  const signedTx = newBlock.transactions[0];

  const event: CustodyEvent = {
    txId: signedTx.txId,
    blockIndex: newBlock.index,
    timestamp,
    action: 'FLAGGED',
    actorOrgId: actorOrg.id,
    actorName: actorOrg.name,
    actorRole: actorOrg.role,
    actorMspId: actorOrg.mspId,
    notes: cleanReason,
    signatureHex: signedTx.signature,
    endorsements: signedTx.endorsements,
    endorsementPolicy: signedTx.endorsementPolicy,
  };

  const updatedBatch: BatchWorldState = {
    ...batch,
    version: newVersion,
    status: 'FLAGGED',
    flaggedReason: cleanReason,
    flaggedByOrgName: actorOrg.name,
    flaggedAt: timestamp,
    lastUpdated: timestamp,
    custodyHistory: [...batch.custodyHistory, event],
  };

  return { newBlock, updatedBatch };
}

/**
 * CHAINCODE FUNCTION 6: recallBatch [Regulator ONLY]
 */
export async function invokeRecallBatch(params: {
  actorOrg: OrganizationMSP;
  worldState: Record<string, BatchWorldState>;
  blocks: Block[];
  batchNo: string;
  reason: string;
  timestamp?: string;
}): Promise<{ newBlock: Block; updatedBatch: BatchWorldState }> {
  const { actorOrg, worldState, blocks } = params;
  const cleanBatchNo = params.batchNo.trim().toUpperCase();
  const batch = worldState[cleanBatchNo];

  if (actorOrg.role !== 'Regulator') {
    throw new Error(
      `Access Denied (MSP Role Violation): Only the 'Regulator' (PPB) can invoke recallBatch().`
    );
  }

  if (!batch) {
    throw new Error(`Batch '${cleanBatchNo}' does not exist in World State.`);
  }

  if (batch.status === 'RECALLED') {
    throw new Error(`Batch '${cleanBatchNo}' has already been recalled.`);
  }

  const cleanReason =
    params.reason.trim() ||
    'Mandatory Class I Statutory Recall ordered by Pharmacy and Poisons Board (PPB Kenya).';

  const timestamp = params.timestamp || new Date().toISOString();
  const newVersion = batch.version + 1;
  const summary = `EMERGENCY RECALL ORDERED on ${batch.drugName} (${cleanBatchNo}) by ${actorOrg.name}: "${cleanReason}"`;

  const rwSet: RWSet = {
    reads: [{ key: `batch_${cleanBatchNo}`, version: batch.version }],
    writes: [
      {
        key: `batch_${cleanBatchNo}`,
        value: { status: 'RECALLED', recalledReason: cleanReason, version: newVersion },
      },
    ],
  };

  const newBlock = await createSignedTransactionAndBlock({
    org: actorOrg,
    fn: 'recallBatch',
    batchNo: cleanBatchNo,
    args: {
      reason: cleanReason,
      affectedHolderOrgId: batch.currentHolderOrgId,
      affectedHolderName: batch.currentHolderName,
      pendingRecipientOrgId: batch.pendingRecipientOrgId,
    },
    summary,
    timestamp,
    previousBlock: blocks[blocks.length - 1],
    rwSet,
    endorsementPolicy: `AND('${actorOrg.mspId}.regulator')`,
  });

  const signedTx = newBlock.transactions[0];

  const event: CustodyEvent = {
    txId: signedTx.txId,
    blockIndex: newBlock.index,
    timestamp,
    action: 'RECALLED',
    actorOrgId: actorOrg.id,
    actorName: actorOrg.name,
    actorRole: actorOrg.role,
    actorMspId: actorOrg.mspId,
    notes: cleanReason,
    signatureHex: signedTx.signature,
    endorsements: signedTx.endorsements,
    endorsementPolicy: signedTx.endorsementPolicy,
  };

  const updatedBatch: BatchWorldState = {
    ...batch,
    version: newVersion,
    status: 'RECALLED',
    recalledReason: cleanReason,
    recalledByOrgName: actorOrg.name,
    recalledAt: timestamp,
    lastUpdated: timestamp,
    custodyHistory: [...batch.custodyHistory, event],
  };

  return { newBlock, updatedBatch };
}

/**
 * CHAINCODE FUNCTION 7: verifyBatch [Public / Consumer Read-Only Query]
 */
export function evaluateVerifyBatch(
  batchNo: string,
  worldState: Record<string, BatchWorldState>,
  totalBlocks: number
): ConsumerVerificationResult {
  const cleanBatchNo = batchNo.trim().toUpperCase();
  const nowIso = new Date().toISOString();
  const batch = worldState[cleanBatchNo] || null;

  if (!batch) {
    return {
      batchNo: cleanBatchNo,
      status: 'UNKNOWN_COUNTERFEIT',
      headline: 'UNKNOWN BATCH — POSSIBLE COUNTERFEIT',
      subheadline: `Batch "${cleanBatchNo}" is not registered on the Kenya National PharmaChain Ledger. Do not consume this medication and report to PPB Kenya.`,
      isSafeToUse: false,
      isExpired: false,
      batch: null,
      custodyTimeline: [],
      ledgerBlocksVerified: totalBlocks,
      verifiedAt: nowIso,
    };
  }

  const expired = isBatchExpired(batch.expiryDate);

  if (batch.status === 'RECALLED') {
    return {
      batchNo: cleanBatchNo,
      status: 'RECALLED',
      headline: 'RECALLED, DO NOT USE',
      subheadline: `Statutory Recall issued by ${batch.recalledByOrgName || 'PPB Kenya'}: ${
        batch.recalledReason || 'Safety & quality alert.'
      }`,
      isSafeToUse: false,
      isExpired: expired,
      batch,
      custodyTimeline: batch.custodyHistory,
      ledgerBlocksVerified: totalBlocks,
      verifiedAt: nowIso,
    };
  }

  if (expired) {
    return {
      batchNo: cleanBatchNo,
      status: 'EXPIRED',
      headline: 'EXPIRED BATCH — DO NOT DISPENSE OR CONSUME',
      subheadline: `Genuine batch manufactured by ${batch.manufacturerName}, but its shelf life expired on ${batch.expiryDate}.`,
      isSafeToUse: false,
      isExpired: true,
      batch,
      custodyTimeline: batch.custodyHistory,
      ledgerBlocksVerified: totalBlocks,
      verifiedAt: nowIso,
    };
  }

  if (batch.status === 'FLAGGED') {
    return {
      batchNo: cleanBatchNo,
      status: 'FLAGGED',
      headline: 'UNDER REGULATORY INSPECTION (FLAGGED)',
      subheadline: `Registered batch flagged by ${batch.flaggedByOrgName || 'PPB Kenya'}: ${
        batch.flaggedReason || 'Pending quality verification.'
      }`,
      isSafeToUse: false,
      isExpired: false,
      batch,
      custodyTimeline: batch.custodyHistory,
      ledgerBlocksVerified: totalBlocks,
      verifiedAt: nowIso,
    };
  }

  return {
    batchNo: cleanBatchNo,
    status: 'AUTHENTIC',
    headline: 'AUTHENTIC & VERIFIED PHARMACEUTICAL BATCH',
    subheadline: `Cryptographically verified origin from ${batch.manufacturerName} with unbroken custody to ${batch.currentHolderName}.`,
    isSafeToUse: true,
    isExpired: false,
    batch,
    custodyTimeline: batch.custodyHistory,
    ledgerBlocksVerified: totalBlocks,
    verifiedAt: nowIso,
  };
}
