# PharmaChain Kenya — Hyperledger Fabric 2.5 + Apache CouchDB Deployment Guide

This directory contains the **real Hyperledger Fabric 2.5 network topology**, **Apache CouchDB 3.3.3 state databases**, and **TypeScript Chaincode (`fabric-contract-api`)** used by the Node.js API Gateway (`server.ts`).

## Prerequisites (Local VS Code / Linux / macOS / WSL2)
- **Docker Desktop / Docker Engine** (v24+) & **Docker Compose**
- **Hyperledger Fabric v2.5 binaries** (`cryptogen`, `configtxgen`, `osnadmin`, `peer`) installed on your `PATH`
- **Node.js v20+**

## Step 1: Launch Fabric Orderer, 4 Kenyan Peers & 4 CouchDB Containers

### Option A — One-Command Bootstrap (Recommended)
Automatically downloads Hyperledger Fabric v2.5.9 binaries/Docker images (if missing), starts the 4-peer + Raft orderer + 4-CouchDB network, creates `pharma-ke-channel`, deploys `pharmachain-cc`, and writes `.env` in the project root:
```bash
cd fabric/network
./bootstrap-fabric.sh
```

### Option B — Manual Step-by-Step Control
```bash
cd fabric/network
chmod +x network.sh
./network.sh up
./network.sh createChannel
./network.sh deployCC
```

### Option C — Lightweight Standalone CouchDB Only (Without Full Fabric Peers)
To test the Node.js Express Gateway (`server.ts`) and React Native app (`mobile/`) directly against Apache CouchDB 3.3.3 without booting all Fabric peer containers:
```bash
docker compose -f fabric/network/docker-compose-couchdb-only.yaml up -d
# Fauxton UI available at http://localhost:5984/_utils (admin / adminpw)
```

Once running (Options A/B):
- **Orderer (Raft):** `localhost:7050`
- **Dawa Life Sciences Peer + CouchDB Fauxton UI:** `localhost:7051` / `http://localhost:5984/_utils`
- **KEMSA Peer + CouchDB:** `localhost:9051` / `http://localhost:6984/_utils`
- **Goodlife Pharmacy Peer + CouchDB:** `localhost:11051` / `http://localhost:7984/_utils`
- **PPB Regulator Peer + CouchDB:** `localhost:13051` / `http://localhost:8984/_utils`

## Step 2: Connect the Node.js Backend (`server.ts`) to Live Fabric & CouchDB
Create a `.env` file in the project root (based on `.env.example`):
```env
FABRIC_ENABLED=true
FABRIC_CHANNEL=pharma-ke-channel
FABRIC_CHAINCODE=pharmachain-cc
FABRIC_MSP_ID=DawaLifeMSP
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_PEER_HOST_ALIAS=peer0.dawa.pharmachain.ke
FABRIC_CRYPTO_PATH=./fabric/network/organizations/peerOrganizations/dawa.pharmachain.ke
COUCHDB_URL=http://admin:adminpw@localhost:5984
```

Then run the full-stack server on port 3000:
```bash
npm install
npm run dev
```

When `FABRIC_ENABLED=true`, `server.ts` authenticates via `@hyperledger/fabric-gateway` + `@grpc/grpc-js` mTLS against the live peer and evaluates/submits transactions to `pharmachain-cc` backed by CouchDB. When running standalone without Docker (e.g. in cloud preview), `server.ts` seamlessly falls back to its Node.js `node:crypto` + CouchDB HTTP / local disk ledger engine.
