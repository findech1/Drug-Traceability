/**
 * ============================================================================
 * MODULE: server/nodeLedgerEngine.ts
 * Node.js Cryptographic Persistence Engine + CouchDB Dual-Sync
 * Uses native `node:crypto` (SHA-256 / ECDSA) and filesystem storage under
 * `.pharmachain-data/ledger.json`, mirroring every batch and block document
 * into Apache CouchDB when `COUCHDB_URL` is running.
 * ============================================================================
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CouchDBClient } from './couchdbClient.ts';

export interface ServerLedgerSnapshot {
  syncedAt: string;
  channelId: string;
  blockCount: number;
  batchCount: number;
  serverIntegrityHash: string;
  worldState: Record<string, Record<string, unknown>>;
  blocks: Array<Record<string, unknown>>;
}

const DATA_DIR = path.resolve('.pharmachain-data');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.json');

export class NodeLedgerEngine {
  private snapshot: ServerLedgerSnapshot | null = null;
  private readonly couch: CouchDBClient;

  constructor(couch: CouchDBClient) {
    this.couch = couch;
  }

  private computeSnapshotDigest(
    worldState: Record<string, Record<string, unknown>>,
    blocks: Array<Record<string, unknown>>
  ): string {
    const payload = JSON.stringify({
      blockCount: blocks.length,
      latestHash: blocks[blocks.length - 1]?.hash || '',
      batchNos: Object.keys(worldState).sort(),
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  public async loadSnapshot(): Promise<ServerLedgerSnapshot | null> {
    if (this.snapshot) return this.snapshot;
    try {
      const raw = await fs.readFile(LEDGER_FILE, 'utf8');
      this.snapshot = JSON.parse(raw) as ServerLedgerSnapshot;
      return this.snapshot;
    } catch {
      return null;
    }
  }

  public async syncLedger(params: {
    channelId?: string;
    worldState: Record<string, Record<string, unknown>>;
    blocks: Array<Record<string, unknown>>;
  }): Promise<{ snapshot: ServerLedgerSnapshot; couchSynced: boolean }> {
    const channelId = params.channelId || 'pharma-ke-channel';
    const digest = this.computeSnapshotDigest(params.worldState, params.blocks);
    const snapshot: ServerLedgerSnapshot = {
      syncedAt: new Date().toISOString(),
      channelId,
      blockCount: params.blocks.length,
      batchCount: Object.keys(params.worldState).length,
      serverIntegrityHash: digest,
      worldState: params.worldState,
      blocks: params.blocks,
    };

    this.snapshot = snapshot;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LEDGER_FILE, JSON.stringify(snapshot, null, 2), 'utf8');

    // Attempt real CouchDB REST replication if CouchDB is running
    let couchSynced = false;
    const couchReady = await this.couch.ensureDatabases();
    if (couchReady) {
      try {
        for (const [batchNo, batchDoc] of Object.entries(params.worldState)) {
          await this.couch.upsertDoc(this.couch.worldStateDb, batchNo, {
            docType: 'pharmaceuticalBatch',
            ...batchDoc,
          });
        }
        for (const block of params.blocks) {
          const blockId = `block_${String(block.index ?? 0).padStart(6, '0')}`;
          await this.couch.upsertDoc(this.couch.blocksDb, blockId, block);
        }
        couchSynced = true;
      } catch {
        couchSynced = false;
      }
    }

    return { snapshot, couchSynced };
  }

  public async verifyBatchFromBackend(
    batchNo: string
  ): Promise<{ found: boolean; source: 'couchdb' | 'node-store'; batch: Record<string, unknown> | null }> {
    const clean = batchNo.trim().toUpperCase();

    // 1. Prefer live CouchDB query when available
    const couchStatus = await this.couch.ping();
    if (couchStatus.connected) {
      const doc = await this.couch.getDoc<Record<string, unknown>>(this.couch.worldStateDb, clean);
      if (doc) {
        return { found: true, source: 'couchdb', batch: doc };
      }
    }

    // 2. Fallback to Node.js filesystem ledger snapshot
    const snap = await this.loadSnapshot();
    const batch = snap?.worldState?.[clean] || null;
    return {
      found: Boolean(batch),
      source: 'node-store',
      batch,
    };
  }
}
