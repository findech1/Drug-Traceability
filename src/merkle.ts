/**
 * ============================================================================
 * MODULE: merkle.ts
 * HYPERLEDGER FABRIC / CRYPTOGRAPHY EQUIVALENT:
 *   - Merkle Tree computation over transaction data inside blocks
 *   - Cryptographic Membership Proofs (Merkle Proof generation & verification)
 *   - O(log N) lightweight SPV / zero-knowledge transaction audit
 * ============================================================================
 */

import { sha256Hex } from './crypto';

export interface MerkleProofStep {
  position: 'left' | 'right';
  hash: string;
}

export interface MerkleProof {
  txId: string;
  leafHash: string;
  merkleRoot: string;
  proof: MerkleProofStep[];
  txIndex: number;
  totalLeaves: number;
}

export interface MerkleTree {
  leaves: string[];
  levels: string[][];
  root: string;
}

/**
 * Computes a deterministic Merkle Tree for a list of transaction leaf hashes.
 * If odd number of leaves at any level, duplicates the last leaf (standard Bitcoin/Fabric approach).
 */
export async function buildMerkleTree(leafHashes: string[]): Promise<MerkleTree> {
  if (leafHashes.length === 0) {
    const emptyRoot = await sha256Hex('EMPTY_MERKLE_TREE_ROOT');
    return {
      leaves: [],
      levels: [[emptyRoot]],
      root: emptyRoot,
    };
  }

  const levels: string[][] = [leafHashes.slice()];
  let currentLevel = leafHashes.slice();

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      const combined = await sha256Hex(`${left}:${right}`);
      nextLevel.push(combined);
    }
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  return {
    leaves: leafHashes,
    levels,
    root: levels[levels.length - 1][0],
  };
}

/**
 * Generates an O(log N) audit path (Merkle Proof) for a specific leaf index.
 */
export function generateMerkleProof(
  tree: MerkleTree,
  leafIndex: number,
  txId: string
): MerkleProof {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new Error(`Invalid leafIndex: ${leafIndex}`);
  }

  const proof: MerkleProofStep[] = [];
  let currentIndex = leafIndex;

  for (let levelIdx = 0; levelIdx < tree.levels.length - 1; levelIdx++) {
    const level = tree.levels[levelIdx];
    const isEven = currentIndex % 2 === 0;
    const siblingIndex = isEven ? currentIndex + 1 : currentIndex - 1;

    if (siblingIndex < level.length) {
      proof.push({
        position: isEven ? 'right' : 'left',
        hash: level[siblingIndex],
      });
    } else {
      // Duplicated odd sibling
      proof.push({
        position: 'right',
        hash: level[currentIndex],
      });
    }

    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    txId,
    leafHash: tree.leaves[leafIndex],
    merkleRoot: tree.root,
    proof,
    txIndex: leafIndex,
    totalLeaves: tree.leaves.length,
  };
}

/**
 * Mathematically verifies an audit proof against a candidate Merkle Root.
 */
export async function verifyMerkleProof(
  leafHash: string,
  proof: MerkleProofStep[],
  expectedRoot: string
): Promise<{ isValid: boolean; recomputedRoot: string; steps: string[] }> {
  let currentHash = leafHash;
  const steps: string[] = [currentHash];

  for (const step of proof) {
    if (step.position === 'left') {
      currentHash = await sha256Hex(`${step.hash}:${currentHash}`);
    } else {
      currentHash = await sha256Hex(`${currentHash}:${step.hash}`);
    }
    steps.push(currentHash);
  }

  return {
    isValid: currentHash === expectedRoot,
    recomputedRoot: currentHash,
    steps,
  };
}
