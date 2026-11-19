/**
 * ============================================================================
 * MODULE: server.ts
 * PharmaChain Kenya — Full-Stack Node.js + Express API Gateway
 * Serves:
 *   - `/api/*` REST Gateway backed by `@hyperledger/fabric-gateway` & Apache CouchDB
 *   - Vite SSR/Middleware in development (`npm run dev`)
 *   - Compiled static SPA (`dist/`) in production (`npm start`)
 * ============================================================================
 */

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { CouchDBClient } from './server/couchdbClient.ts';
import { FabricGatewayService } from './server/fabricGateway.ts';
import { NodeLedgerEngine } from './server/nodeLedgerEngine.ts';

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const couch = new CouchDBClient();
  const fabricGateway = new FabricGatewayService();
  const nodeEngine = new NodeLedgerEngine(couch);

  // --------------------------------------------------------------------------
  // API ROUTE 1: Health & Infrastructure Mode Inspection
  // --------------------------------------------------------------------------
  app.get('/api/health', async (_req, res) => {
    const [couchStatus, fabricStatus] = await Promise.all([
      couch.ping(),
      fabricGateway.checkConnection(),
    ]);
    const snapshot = await nodeEngine.loadSnapshot();

    res.json({
      service: 'PharmaChain Kenya API Gateway',
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      fabricGateway: fabricStatus,
      couchdb: couchStatus,
      ledgerSnapshot: snapshot
        ? {
            syncedAt: snapshot.syncedAt,
            blockCount: snapshot.blockCount,
            batchCount: snapshot.batchCount,
            serverIntegrityHash: snapshot.serverIntegrityHash,
          }
        : null,
    });
  });

  // --------------------------------------------------------------------------
  // API ROUTE 2: Sync / Mirror World State & Blocks to Node.js + CouchDB
  // --------------------------------------------------------------------------
  app.post('/api/ledger/sync', async (req, res) => {
    try {
      const { channelId, worldState, blocks } = req.body || {};
      if (!worldState || !Array.isArray(blocks)) {
        res.status(400).json({ error: 'Invalid payload: worldState and blocks[] are required.' });
        return;
      }
      const { snapshot, couchSynced } = await nodeEngine.syncLedger({
        channelId,
        worldState,
        blocks,
      });
      res.json({
        ok: true,
        couchSynced,
        syncedAt: snapshot.syncedAt,
        blockCount: snapshot.blockCount,
        batchCount: snapshot.batchCount,
        serverIntegrityHash: snapshot.serverIntegrityHash,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Sync failed' });
    }
  });

  // --------------------------------------------------------------------------
  // API ROUTE 3: Read Synchronized World State & Blocks from CouchDB / Disk
  // --------------------------------------------------------------------------
  app.get('/api/ledger/state', async (_req, res) => {
    const couchStatus = await couch.ping();
    if (couchStatus.connected) {
      const docs = await couch.getAllWorldState();
      res.json({ source: 'couchdb', count: docs.length, batches: docs });
      return;
    }
    const snap = await nodeEngine.loadSnapshot();
    res.json({
      source: 'node-store',
      count: snap ? Object.keys(snap.worldState).length : 0,
      batches: snap ? Object.values(snap.worldState) : [],
      blocks: snap?.blocks || [],
    });
  });

  // --------------------------------------------------------------------------
  // API ROUTE 4: Consumer Batch Verification (Fabric Gateway -> CouchDB -> Node)
  // --------------------------------------------------------------------------
  app.get('/api/verify/:batchNo', async (req, res) => {
    const batchNo = req.params.batchNo;
    if (fabricGateway.isEnabled()) {
      try {
        const raw = await fabricGateway.evaluateTransaction('verifyBatch', batchNo);
        res.json({ source: 'hyperledger-fabric-gateway', result: JSON.parse(raw) });
        return;
      } catch {
        // fallback cleanly to CouchDB / Node store if peer is offline
      }
    }
    const result = await nodeEngine.verifyBatchFromBackend(batchNo);
    res.json(result);
  });

  // --------------------------------------------------------------------------
  // API ROUTE 5: Submit Chaincode Transaction to Fabric Gateway (when live)
  // --------------------------------------------------------------------------
  app.post('/api/fabric/invoke', async (req, res) => {
    const { fn, args, transientData } = req.body || {};
    if (!fn || !Array.isArray(args)) {
      res.status(400).json({ error: 'Missing required fields: fn and args[]' });
      return;
    }
    if (!fabricGateway.isEnabled()) {
      res.status(503).json({
        error: 'FABRIC_ENABLED is not set to true. Start Docker Fabric network and configure .env to route gRPC proposals.',
        gatewayStatus: fabricGateway.getStatus(),
      });
      return;
    }
    try {
      const parsedTransient = transientData
        ? Object.fromEntries(
            Object.entries(transientData as Record<string, string>).map(([k, v]) => [
              k,
              Buffer.from(v, 'utf8'),
            ])
          )
        : undefined;
      const result = await fabricGateway.submitTransaction(
        String(fn),
        args.map(String),
        parsedTransient
      );
      res.json({ ok: true, source: 'hyperledger-fabric-gateway', result: JSON.parse(result) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Fabric invocation error' });
    }
  });

  // --------------------------------------------------------------------------
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC ASSETS
  // --------------------------------------------------------------------------
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve('dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('{*splat}', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, HOST, () => {
    console.log(`[PharmaChain API Gateway] Listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
