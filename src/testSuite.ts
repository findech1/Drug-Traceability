/**
 * ============================================================================
 * MODULE: testSuite.ts
 * AUTOMATED SMART CONTRACT & CRYPTOGRAPHIC TEST SUITE RUNNER
 * Tests:
 *   1. Non-holder transfer rejection (Chaincode RBAC)
 *   2. Expired medication dispensing block
 *   3. Recalled medication quarantine & transfer lock
 *   4. Forged ECDSA signature rejection (Cryptographic verification)
 *   5. Merkle Root audit proof validity & tampering rejection
 *   6. MVCC read-write concurrency race conflict defense
 * ============================================================================
 */

import {
  invokeDispenseUnits,
  invokeRecallBatch,
  invokeRegisterBatch,
  invokeTransferBatch,
} from './chaincode';
import { generateOrgECDSAKeyPair, signPayloadECDSA } from './crypto';
import {
  createGenesisBlock,
  getSignableTxPayload,
  OrganizationMSP,
  validateChain,
} from './ledger';
import { buildMerkleTree, generateMerkleProof, verifyMerkleProof } from './merkle';
import { buildKenyanSeedStore } from './store';

export interface TestCaseResult {
  id: string;
  name: string;
  category: 'Access Control' | 'Safety Rules' | 'Cryptographic Proof' | 'Concurrency';
  description: string;
  expectedOutcome: string;
  actualOutcome: string;
  passed: boolean;
  durationMs: number;
  errorDetail?: string;
}

export interface TestSuiteExecutionReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executedAt: string;
  results: TestCaseResult[];
}

export async function runAllAutomatedTests(): Promise<TestSuiteExecutionReport> {
  const results: TestCaseResult[] = [];
  const testStore = await buildKenyanSeedStore();
  const mfgOrg = testStore.organizations['MFG-UNIVERSAL'];
  const distOrg = testStore.organizations['DIST-KEMSA'];
  const pharmOrg = testStore.organizations['PHARM-KNH'];
  const regOrg = testStore.organizations['REG-PPB'];

  // Test 1: Non-Holder Transfer Rejection
  {
    const start = performance.now();
    let passed = false;
    let actualOutcome = '';
    let errorDetail = '';

    try {
      // Attempting to transfer KE-ACT-2026-001 from MFG-UNIVERSAL when it is currently held by PHARM-KNH
      await invokeTransferBatch({
        actorOrg: mfgOrg,
        targetOrg: distOrg,
        worldState: testStore.worldState,
        blocks: testStore.blocks,
        batchNo: 'KE-ACT-2026-001',
        quantity: 100,
      });
      actualOutcome = 'FAILED: Transaction was erroneously accepted from non-holder!';
    } catch (err: any) {
      if (err.message.includes('Custody Violation') || err.message.includes('not the current holder')) {
        passed = true;
        actualOutcome = `SUCCESS: Rejection correctly enforced: "${err.message}"`;
      } else {
        errorDetail = err.message;
        actualOutcome = `Unexpected error: ${err.message}`;
      }
    }

    results.push({
      id: 'TC-01-RBAC-HOLDER',
      name: 'Non-Holder Custody Transfer Rejection',
      category: 'Access Control',
      description: 'Verifies that chaincode rejects transfer attempts initiated by organizations that do not hold the batch.',
      expectedOutcome: 'Rejection with Custody Violation error.',
      actualOutcome,
      passed,
      durationMs: Math.round(performance.now() - start),
      errorDetail,
    });
  }

  // Test 2: Expired Medication Dispensing Block
  {
    const start = performance.now();
    let passed = false;
    let actualOutcome = '';
    let errorDetail = '';

    try {
      // KE-CIP-2024-089 expired on 2025-08-15
      await invokeDispenseUnits({
        actorOrg: testStore.organizations['PHARM-GOODLIFE'],
        worldState: testStore.worldState,
        blocks: testStore.blocks,
        batchNo: 'KE-CIP-2024-089',
        qty: 10,
      });
      actualOutcome = 'FAILED: Expired batch was dispensed!';
    } catch (err: any) {
      if (err.message.includes('SAFETY BLOCK') || err.message.includes('expired')) {
        passed = true;
        actualOutcome = `SUCCESS: Smart contract locked expired dispensing: "${err.message}"`;
      } else {
        errorDetail = err.message;
        actualOutcome = `Unexpected error: ${err.message}`;
      }
    }

    results.push({
      id: 'TC-02-SAFETY-EXPIRED',
      name: 'Expired Pharmaceutical Dispensing Lockout',
      category: 'Safety Rules',
      description: 'Verifies that pharmacies cannot dispense pharmaceuticals whose expiry date has elapsed.',
      expectedOutcome: 'Rejection with SAFETY BLOCK: Batch expired error.',
      actualOutcome,
      passed,
      durationMs: Math.round(performance.now() - start),
      errorDetail,
    });
  }

  // Test 3: Recalled Batch Transfer & Dispense Lockout
  {
    const start = performance.now();
    let passed = false;
    let actualOutcome = '';
    let errorDetail = '';

    try {
      // KE-PCM-2026-999 is recalled by PPB
      await invokeTransferBatch({
        actorOrg: distOrg,
        targetOrg: pharmOrg,
        worldState: testStore.worldState,
        blocks: testStore.blocks,
        batchNo: 'KE-PCM-2026-999',
        quantity: 50,
      });
      actualOutcome = 'FAILED: Recalled batch was transferred!';
    } catch (err: any) {
      if (err.message.includes('RECALLED') || err.message.includes('locked against any transfer')) {
        passed = true;
        actualOutcome = `SUCCESS: Recalled batch was strictly quarantined: "${err.message}"`;
      } else {
        errorDetail = err.message;
        actualOutcome = `Unexpected error: ${err.message}`;
      }
    }

    results.push({
      id: 'TC-03-SAFETY-RECALL',
      name: 'Statutory Recalled Batch Custody Lockout',
      category: 'Safety Rules',
      description: 'Verifies that a batch with a Statutory Class I Recall is locked against any movement across all peers.',
      expectedOutcome: 'Rejection with Policy Rejection: Batch RECALLED error.',
      actualOutcome,
      passed,
      durationMs: Math.round(performance.now() - start),
      errorDetail,
    });
  }

  // Test 4: Forged ECDSA Signature Rejection
  {
    const start = performance.now();
    let passed = false;
    let actualOutcome = '';
    let errorDetail = '';

    try {
      // Generate a rogue keypair that does not belong to any authorized MSP
      const rogueKey = await generateOrgECDSAKeyPair();
      const fakeSignable = 'FORGED_TRANSACTION_PAYLOAD_UNAUTHORIZED';
      const fakeSig = await signPayloadECDSA(fakeSignable, rogueKey.privateKeyJwk);

      // Mutate a block in test store to have forged signature
      const corruptedBlocks = JSON.parse(JSON.stringify(testStore.blocks));
      corruptedBlocks[1].transactions[0].signature = fakeSig;

      const audit = await validateChain(corruptedBlocks, testStore.organizations);
      if (!audit.isValid && audit.tamperedBlockIndices.includes(1)) {
        passed = true;
        actualOutcome = 'SUCCESS: Validation engine detected invalid signature and flagged Block #1 in red.';
      } else {
        actualOutcome = 'FAILED: Forged signature bypassed validation audit!';
      }
    } catch (err: any) {
      errorDetail = err.message;
      actualOutcome = `Error during signature test: ${err.message}`;
    }

    results.push({
      id: 'TC-04-CRYPTO-FORGERY',
      name: 'Cryptographic Forgery & Key Spoofing Detection',
      category: 'Cryptographic Proof',
      description: 'Verifies that a transaction signed with an unauthorized private key fails cryptographic endorsement audit.',
      expectedOutcome: 'Ledger validation audit fails with signature verification error.',
      actualOutcome,
      passed,
      durationMs: Math.round(performance.now() - start),
      errorDetail,
    });
  }

  // Test 5: Merkle Tree Proof Audit & Tamper Proof
  {
    const start = performance.now();
    let passed = false;
    let actualOutcome = '';
    let errorDetail = '';

    try {
      const leaves = [
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444444444444444444444444444',
      ];
      const tree = await buildMerkleTree(leaves);
      const proof = generateMerkleProof(tree, 2, 'tx-test-3');
      const verification = await verifyMerkleProof(proof.leafHash, proof.proof, proof.merkleRoot);

      if (verification.isValid) {
        // Also verify that a fake root fails
        const fakeCheck = await verifyMerkleProof(proof.leafHash, proof.proof, 'FAKE_ROOT_HASH_000000');
        if (!fakeCheck.isValid) {
          passed = true;
          actualOutcome = `SUCCESS: O(log N) Merkle path verified valid root and rejected forged root.`;
        } else {
          actualOutcome = 'FAILED: Merkle verification accepted forged root!';
        }
      } else {
        actualOutcome = 'FAILED: Authentic Merkle proof failed verification!';
      }
    } catch (err: any) {
      errorDetail = err.message;
      actualOutcome = `Error in Merkle test: ${err.message}`;
    }

    results.push({
      id: 'TC-05-CRYPTO-MERKLE',
      name: 'Merkle Tree Membership Proof & Audit Path',
      category: 'Cryptographic Proof',
      description: 'Verifies that individual transaction hashes compute to the correct block Merkle Root and reject mismatched roots.',
      expectedOutcome: 'Merkle proof validates authentic root and rejects forged root.',
      actualOutcome,
      passed,
      durationMs: Math.round(performance.now() - start),
      errorDetail,
    });
  }

  // Test 6: MVCC Double-Spend Concurrency Conflict
  {
    const start = performance.now();
    let passed = false;
    let actualOutcome = '';
    let errorDetail = '';

    try {
      const batch = testStore.worldState['KE-ACT-2026-001'];
      // Intentionally provide outdated version (v - 1)
      await invokeTransferBatch({
        actorOrg: pharmOrg,
        targetOrg: distOrg,
        worldState: testStore.worldState,
        blocks: testStore.blocks,
        batchNo: 'KE-ACT-2026-001',
        quantity: 50,
        expectedVersion: Math.max(0, batch.version - 1),
      });
      actualOutcome = 'FAILED: Stale version was accepted, enabling double spend!';
    } catch (err: any) {
      if (err.message.includes('MVCC_READ_CONFLICT')) {
        passed = true;
        actualOutcome = `SUCCESS: Fabric MVCC concurrency check aborted stale transaction: "${err.message}"`;
      } else {
        errorDetail = err.message;
        actualOutcome = `Unexpected error: ${err.message}`;
      }
    }

    results.push({
      id: 'TC-06-CONCURRENCY-MVCC',
      name: 'MVCC Read-Write Set Double-Spend Defense',
      category: 'Concurrency',
      description: 'Verifies that concurrent transactions attempting to spend an outdated batch version abort with MVCC_READ_CONFLICT.',
      expectedOutcome: 'Transaction aborts with MVCC_READ_CONFLICT.',
      actualOutcome,
      passed,
      durationMs: Math.round(performance.now() - start),
      errorDetail,
    });
  }

  const passedTests = results.filter((r) => r.passed).length;
  return {
    totalTests: results.length,
    passedTests,
    failedTests: results.length - passedTests,
    executedAt: new Date().toISOString(),
    results,
  };
}
