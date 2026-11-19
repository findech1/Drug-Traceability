/**
 * ============================================================================
 * MODULE: ledger.ts
 * HYPERLEDGER FABRIC EQUIVALENT:
 *   - Channel Ledger (Immutable Blockchain Log stored on Peer filesystem)
 *   - Ordering Service (Raft consensus cutting ordered blocks of transactions)
 *   - VSCC (Validation System Chaincode) verifying MSP signatures & read-write sets
 *   - Merkle Root calculation per block & Merkle Proof audit
 *   - Multi-Peer Endorsement Policy validation (e.g. AND(Sender, Recipient))
 *   - Read-Write Set (RWSet) & MVCC version tracking
 * ============================================================================
 */

import {
  canonicalizeJson,
  OrgKeyPairJWK,
  sha256Hex,
  signPayloadECDSA,
  verifySignatureECDSA,
} from './crypto';
import { buildMerkleTree, MerkleProof, MerkleProofStep } from './merkle';

export type OrgRole = 'Manufacturer' | 'Distributor' | 'Pharmacy' | 'Regulator';

export interface OrganizationMSP {
  id: string;
  mspId: string;
  name: string;
  role: OrgRole;
  location: string;
  licenseNo: string;
  keys: OrgKeyPairJWK;
}

export type ChaincodeFunction =
  | 'registerBatch'
  | 'transferBatch'
  | 'receiveBatch'
  | 'dispenseUnits'
  | 'flagBatch'
  | 'recallBatch';

/**
 * Hyperledger Fabric Read-Write Set (RWSet)
 * Records key versions read during simulation and new key values written.
 */
export interface RWSet {
  reads: Array<{ key: string; version: number }>;
  writes: Array<{ key: string; value: unknown }>;
}

/**
 * Endorsement Signature from an Endorsing Peer MSP
 */
export interface PeerEndorsement {
  endorserOrgId: string;
  endorserMspId: string;
  endorserRole: OrgRole;
  timestamp: string;
  signature: string;
  publicKeyFingerprint: string;
}

export interface TransactionPayload {
  txId: string;
  channelId: string;
  chaincodeId: string;
  fn: ChaincodeFunction;
  batchNo: string;
  creatorOrgId: string;
  creatorMspId: string;
  creatorName: string;
  creatorRole: OrgRole;
  timestamp: string;
  args: Record<string, unknown>;
  summary: string;
  // Feature 3: Read-Write Set
  rwSet?: RWSet;
  // Feature 5: Private Data Collection Hash (SideDB on-chain proof)
  privateDataHash?: string;
  privateDataCollectionName?: string;
}

export interface SignedTransaction extends TransactionPayload {
  signature: string;
  signerPublicKeyFingerprint: string;
  // Feature 2: Multi-peer endorsements
  endorsements: PeerEndorsement[];
  endorsementPolicy: string;
}

export interface Block {
  index: number;
  timestamp: string;
  transactions: SignedTransaction[];
  previousHash: string;
  merkleRoot: string; // Feature 1: Merkle Root
  hash: string;
  creatingOrgId: string;
  creatingOrgName: string;
  creatingOrgMsp: string;
  tamperedNote?: string;
}

export interface TransactionValidationResult {
  txId: string;
  signatureValid: boolean;
  signerOrgId: string;
  endorsementsValid: boolean;
  endorsementResults: Array<{
    mspId: string;
    valid: boolean;
  }>;
  reason?: string;
}

export interface BlockValidationResult {
  index: number;
  computedHash: string;
  recordedHash: string;
  computedMerkleRoot: string;
  recordedMerkleRoot: string;
  hashMatches: boolean;
  merkleRootMatches: boolean;
  previousHashMatches: boolean;
  expectedPreviousHash: string;
  recordedPreviousHash: string;
  allSignaturesValid: boolean;
  allEndorsementsValid: boolean;
  txResults: TransactionValidationResult[];
  isValid: boolean;
  failureReasons: string[];
}

export interface ChainValidationReport {
  isValid: boolean;
  validatedAt: string;
  totalBlocks: number;
  totalTransactions: number;
  tamperedBlockIndices: number[];
  blockResults: Record<number, BlockValidationResult>;
}

/**
 * Deterministically computes signable transaction payload representation
 */
export function getSignableTxPayload(tx: TransactionPayload): string {
  return canonicalizeJson({
    txId: tx.txId,
    channelId: tx.channelId,
    chaincodeId: tx.chaincodeId,
    fn: tx.fn,
    batchNo: tx.batchNo,
    creatorOrgId: tx.creatorOrgId,
    creatorMspId: tx.creatorMspId,
    timestamp: tx.timestamp,
    args: tx.args,
    rwSet: tx.rwSet,
    privateDataHash: tx.privateDataHash,
  });
}

/**
 * Computes individual transaction hash for the Merkle tree leaf
 */
export async function computeTransactionHash(tx: SignedTransaction): Promise<string> {
  const content = canonicalizeJson({
    txId: tx.txId,
    fn: tx.fn,
    batchNo: tx.batchNo,
    creatorOrgId: tx.creatorOrgId,
    timestamp: tx.timestamp,
    args: tx.args,
    signature: tx.signature,
    rwSet: tx.rwSet,
    privateDataHash: tx.privateDataHash,
    endorsements: tx.endorsements.map((e) => ({
      mspId: e.endorserMspId,
      signature: e.signature,
    })),
  });
  return await sha256Hex(content);
}

/**
 * Computes the deterministic SHA-256 hash of a block's header, merkle root, and metadata.
 */
export async function computeBlockHash(
  block: Omit<Block, 'hash' | 'tamperedNote'>
): Promise<string> {
  const canonicalBlock = canonicalizeJson({
    index: block.index,
    timestamp: block.timestamp,
    previousHash: block.previousHash,
    merkleRoot: block.merkleRoot,
    creatingOrgId: block.creatingOrgId,
    creatingOrgMsp: block.creatingOrgMsp,
    txCount: block.transactions.length,
  });
  return await sha256Hex(canonicalBlock);
}

/**
 * Calculates the Merkle Root for all transactions in a block
 */
export async function computeBlockMerkleRoot(transactions: SignedTransaction[]): Promise<string> {
  if (transactions.length === 0) {
    return await sha256Hex('EMPTY_TRANSACTION_LIST');
  }
  const leafHashes: string[] = [];
  for (const tx of transactions) {
    leafHashes.push(await computeTransactionHash(tx));
  }
  const tree = await buildMerkleTree(leafHashes);
  return tree.root;
}

/**
 * Signs a transaction proposal with primary actor and endorsements from required peers,
 * computes the Merkle Root, and cuts a new ordered block.
 */
export async function createSignedTransactionAndBlock(params: {
  org: OrganizationMSP;
  fn: ChaincodeFunction;
  batchNo: string;
  args: Record<string, unknown>;
  summary: string;
  timestamp?: string;
  previousBlock: Block;
  // Multi-peer endorsing orgs (Feature 2)
  endorsingOrgs?: OrganizationMSP[];
  endorsementPolicy?: string;
  rwSet?: RWSet;
  privateDataHash?: string;
  privateDataCollectionName?: string;
}): Promise<Block> {
  const timestamp = params.timestamp || new Date().toISOString();
  const rawTxSeed = `${params.org.id}-${params.fn}-${params.batchNo}-${timestamp}-${Math.random()}`;
  const txHash = await sha256Hex(rawTxSeed);
  const txId = `tx_${txHash.slice(0, 20)}`;

  const txPayload: TransactionPayload = {
    txId,
    channelId: 'pharma-ke-channel',
    chaincodeId: 'pharmachain-cc-v1',
    fn: params.fn,
    batchNo: params.batchNo,
    creatorOrgId: params.org.id,
    creatorMspId: params.org.mspId,
    creatorName: params.org.name,
    creatorRole: params.org.role,
    timestamp,
    args: params.args,
    summary: params.summary,
    rwSet: params.rwSet,
    privateDataHash: params.privateDataHash,
    privateDataCollectionName: params.privateDataCollectionName,
  };

  const signableString = getSignableTxPayload(txPayload);
  const signature = await signPayloadECDSA(signableString, params.org.keys.privateKeyJwk);

  // Endorsement Verification for Primary Signer
  const isEndorsementValid = await verifySignatureECDSA(
    signableString,
    signature,
    params.org.keys.publicKeyJwk
  );

  if (!isEndorsementValid) {
    throw new Error(
      `MSP Endorsement Verification Failed: Invalid ECDSA signature from ${params.org.mspId}`
    );
  }

  // Multi-Peer Endorsements simulation
  const endorsingOrgs = params.endorsingOrgs || [];
  const endorsements: PeerEndorsement[] = [];

  for (const endOrg of endorsingOrgs) {
    const endSig = await signPayloadECDSA(signableString, endOrg.keys.privateKeyJwk);
    endorsements.push({
      endorserOrgId: endOrg.id,
      endorserMspId: endOrg.mspId,
      endorserRole: endOrg.role,
      timestamp,
      signature: endSig,
      publicKeyFingerprint: endOrg.keys.publicKeyFingerprint,
    });
  }

  const defaultPolicy =
    endorsements.length > 0
      ? `AND('${params.org.mspId}.peer', ${endorsements.map((e) => `'${e.endorserMspId}.peer'`).join(', ')})`
      : `OR('${params.org.mspId}.peer')`;

  const signedTx: SignedTransaction = {
    ...txPayload,
    signature,
    signerPublicKeyFingerprint: params.org.keys.publicKeyFingerprint,
    endorsements,
    endorsementPolicy: params.endorsementPolicy || defaultPolicy,
  };

  const merkleRoot = await computeBlockMerkleRoot([signedTx]);

  const draftBlock: Omit<Block, 'hash'> = {
    index: params.previousBlock.index + 1,
    timestamp,
    transactions: [signedTx],
    previousHash: params.previousBlock.hash,
    merkleRoot,
    creatingOrgId: params.org.id,
    creatingOrgName: params.org.name,
    creatingOrgMsp: params.org.mspId,
  };

  const hash = await computeBlockHash(draftBlock);

  return {
    ...draftBlock,
    hash,
  };
}

/**
 * Creates the Channel Genesis Block (Block #0) anchored by the Regulator MSP (PPB Kenya).
 */
export async function createGenesisBlock(
  regulatorOrg: OrganizationMSP,
  timestamp: string
): Promise<Block> {
  const genesisPayload: TransactionPayload = {
    txId: 'tx_genesis_pharma_ke_0000000000',
    channelId: 'pharma-ke-channel',
    chaincodeId: 'lscc-system',
    fn: 'registerBatch',
    batchNo: 'GENESIS-CHANNEL-CONFIG',
    creatorOrgId: regulatorOrg.id,
    creatorMspId: regulatorOrg.mspId,
    creatorName: regulatorOrg.name,
    creatorRole: regulatorOrg.role,
    timestamp,
    args: {
      channel: 'pharma-ke-channel',
      consortium: 'KenyaNationalPharmaConsortium',
      sdgAlignment: 'UN SDG 3: Good Health and Well-Being',
      orderingService: 'Raft-Orderer-Nairobi-1',
      endorsementPolicyDefaults: 'MAJORITY(EndorsingPeers)',
    },
    summary:
      'Channel Genesis Block initialized by Pharmacy and Poisons Board (PPB Kenya) with MSP consortium policies.',
  };

  const signable = getSignableTxPayload(genesisPayload);
  const signature = await signPayloadECDSA(signable, regulatorOrg.keys.privateKeyJwk);

  const signedGenesisTx: SignedTransaction = {
    ...genesisPayload,
    signature,
    signerPublicKeyFingerprint: regulatorOrg.keys.publicKeyFingerprint,
    endorsements: [],
    endorsementPolicy: `OR('${regulatorOrg.mspId}.admin')`,
  };

  const merkleRoot = await computeBlockMerkleRoot([signedGenesisTx]);

  const draftGenesis: Omit<Block, 'hash'> = {
    index: 0,
    timestamp,
    transactions: [signedGenesisTx],
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    merkleRoot,
    creatingOrgId: regulatorOrg.id,
    creatingOrgName: regulatorOrg.name,
    creatingOrgMsp: regulatorOrg.mspId,
  };

  const hash = await computeBlockHash(draftGenesis);
  return {
    ...draftGenesis,
    hash,
  };
}

/**
 * Full Cryptographic Chain Verification:
 * 1. Re-computes SHA-256 hash of every block and compares with recorded block.hash
 * 2. Re-computes Merkle Root of all transactions inside the block
 * 3. Verifies hash chain linkage (block[i].previousHash === block[i-1].hash)
 * 4. Verifies primary ECDSA signatures AND multi-peer endorsements
 */
export async function validateChain(
  blocks: Block[],
  orgsById: Record<string, OrganizationMSP>
): Promise<ChainValidationReport> {
  const blockResults: Record<number, BlockValidationResult> = {};
  const tamperedBlockIndices: number[] = [];
  let totalTransactions = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const failureReasons: string[] = [];

    // Check 1: Merkle Root verification
    const computedMerkleRoot = await computeBlockMerkleRoot(block.transactions);
    const merkleRootMatches = computedMerkleRoot === block.merkleRoot;
    if (!merkleRootMatches) {
      failureReasons.push(
        `Merkle Root mismatch: transaction contents inside Block #${block.index} were altered after sealing.`
      );
    }

    // Check 2: Block Header SHA-256
    const computedHash = await computeBlockHash(block);
    const hashMatches = computedHash === block.hash;
    if (!hashMatches) {
      failureReasons.push(
        `SHA-256 block hash mismatch: block header or Merkle root changed after Block #${block.index} was committed.`
      );
    }

    // Check 3: Previous Hash linkage
    const expectedPreviousHash =
      i === 0
        ? '0000000000000000000000000000000000000000000000000000000000000000'
        : blocks[i - 1].hash;
    const previousHashMatches = block.previousHash === expectedPreviousHash;
    if (!previousHashMatches) {
      failureReasons.push(
        `Broken hash chain link: previousHash does not match Block #${i - 1}'s hash.`
      );
    }

    // Upstream contamination check
    if (i > 0 && !blockResults[i - 1].isValid && hashMatches && previousHashMatches) {
      failureReasons.push(
        `Upstream tampering detected in Block #${i - 1} invalidates downstream consensus.`
      );
    }

    const txResults: TransactionValidationResult[] = [];
    let allSignaturesValid = true;
    let allEndorsementsValid = true;

    for (const tx of block.transactions) {
      totalTransactions++;
      const org = orgsById[tx.creatorOrgId];
      if (!org) {
        allSignaturesValid = false;
        const reason = `Unknown MSP Organization ID: ${tx.creatorOrgId}`;
        txResults.push({
          txId: tx.txId,
          signatureValid: false,
          signerOrgId: tx.creatorOrgId,
          endorsementsValid: false,
          endorsementResults: [],
          reason,
        });
        failureReasons.push(reason);
        continue;
      }

      const signable = getSignableTxPayload(tx);
      const sigValid = await verifySignatureECDSA(
        signable,
        tx.signature,
        org.keys.publicKeyJwk
      );

      if (!sigValid) {
        allSignaturesValid = false;
        const reason = `Invalid primary ECDSA signature on transaction ${tx.txId}: payload was altered without ${org.mspId}'s private key.`;
        failureReasons.push(reason);
      }

      // Verify endorsements
      const endorsementResults: Array<{ mspId: string; valid: boolean }> = [];
      let txEndorsementsOk = true;

      for (const end of tx.endorsements || []) {
        const endOrg = orgsById[end.endorserOrgId];
        if (!endOrg) {
          txEndorsementsOk = false;
          allEndorsementsValid = false;
          endorsementResults.push({ mspId: end.endorserMspId, valid: false });
          failureReasons.push(`Unknown endorsing peer MSP: ${end.endorserMspId}`);
          continue;
        }

        const endSigValid = await verifySignatureECDSA(
          signable,
          end.signature,
          endOrg.keys.publicKeyJwk
        );

        if (!endSigValid) {
          txEndorsementsOk = false;
          allEndorsementsValid = false;
          failureReasons.push(
            `Endorsement policy check failed: Peer ${end.endorserMspId} signature invalid on ${tx.txId}.`
          );
        }
        endorsementResults.push({ mspId: end.endorserMspId, valid: endSigValid });
      }

      txResults.push({
        txId: tx.txId,
        signatureValid: sigValid,
        signerOrgId: tx.creatorOrgId,
        endorsementsValid: txEndorsementsOk,
        endorsementResults,
        reason: sigValid && txEndorsementsOk ? undefined : 'Signature/Endorsement verification failed',
      });
    }

    const isValid =
      hashMatches &&
      merkleRootMatches &&
      previousHashMatches &&
      allSignaturesValid &&
      allEndorsementsValid &&
      failureReasons.length === 0;

    if (!isValid) {
      tamperedBlockIndices.push(block.index);
    }

    blockResults[block.index] = {
      index: block.index,
      computedHash,
      recordedHash: block.hash,
      computedMerkleRoot,
      recordedMerkleRoot: block.merkleRoot,
      hashMatches,
      merkleRootMatches,
      previousHashMatches,
      expectedPreviousHash,
      recordedPreviousHash: block.previousHash,
      allSignaturesValid,
      allEndorsementsValid,
      txResults,
      isValid,
      failureReasons,
    };
  }

  return {
    isValid: tamperedBlockIndices.length === 0,
    validatedAt: new Date().toISOString(),
    totalBlocks: blocks.length,
    totalTransactions,
    tamperedBlockIndices,
    blockResults,
  };
}

/**
 * Simulates tampering with an existing block in storage
 */
export function tamperWithBlockInPlace(
  blocks: Block[],
  targetBlockIndex?: number
): {
  mutatedBlocks: Block[];
  tamperedIndex: number;
  description: string;
} {
  if (blocks.length < 2) {
    throw new Error('Not enough blocks to run tamper demonstration.');
  }

  const indexToTamper =
    targetBlockIndex !== undefined && targetBlockIndex > 0 && targetBlockIndex < blocks.length
      ? targetBlockIndex
      : Math.min(2, blocks.length - 1);

  const cloned: Block[] = JSON.parse(JSON.stringify(blocks));
  const targetBlock = cloned[indexToTamper];
  const tx = targetBlock.transactions[0];

  const originalSummary = tx.summary;
  tx.args = {
    ...tx.args,
    quantity: 999999,
    tamperedInjection: 'UNAUTHORIZED_COUNTERFEIT_DIVERSION',
  };
  tx.summary = `[TAMPERED DATA] ${originalSummary.replace(/\[TAMPERED DATA\]\s*/g, '')} (Quantity covertly inflated to 999,999 units)`;
  targetBlock.tamperedNote = `Unauthorized mutation injected into Block #${indexToTamper} transaction ${tx.txId}`;

  return {
    mutatedBlocks: cloned,
    tamperedIndex: indexToTamper,
    description: `Modified Block #${indexToTamper} (${tx.batchNo}): altered transaction payload quantity to 999,999 units without ${tx.creatorMspId}'s private key. Breaks both the Merkle Root and ECDSA endorsement signatures.`,
  };
}
