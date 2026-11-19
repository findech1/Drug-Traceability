#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PharmaChain Kenya — One-Command Local Bootstrap & Environment Setup
# Downloads Hyperledger Fabric 2.5 binaries/images if missing, starts the
# network + CouchDB, deploys chaincode, and writes `.env` for Node.js `server.ts`.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SCRIPT_DIR"

FABRIC_VERSION="${FABRIC_VERSION:-2.5.9}"
CA_VERSION="${CA_VERSION:-1.5.12}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is not installed. Please install Docker Desktop / Docker Engine first."
  exit 1
fi

if [ -d "$SCRIPT_DIR/bin" ]; then
  export PATH="$SCRIPT_DIR/bin:$PATH"
fi

if ! command -v cryptogen >/dev/null 2>&1 || ! command -v configtxgen >/dev/null 2>&1; then
  echo ">>> Hyperledger Fabric binaries not found on PATH. Downloading Fabric v${FABRIC_VERSION}..."
  curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
  chmod +x install-fabric.sh
  ./install-fabric.sh --fabric-version "$FABRIC_VERSION" --ca-version "$CA_VERSION" binary docker
  if [ -d "$SCRIPT_DIR/bin" ]; then
    export PATH="$SCRIPT_DIR/bin:$PATH"
  fi
fi

chmod +x "$SCRIPT_DIR/network.sh"
"$SCRIPT_DIR/network.sh" up
"$SCRIPT_DIR/network.sh" createChannel
"$SCRIPT_DIR/network.sh" deployCC

cat > "$ROOT_DIR/.env" <<EOF
PORT=3000
FABRIC_ENABLED=true
FABRIC_CHANNEL=pharma-ke-channel
FABRIC_CHAINCODE=pharmachain-cc
FABRIC_MSP_ID=DawaLifeMSP
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_PEER_HOST_ALIAS=peer0.dawa.pharmachain.ke
FABRIC_CRYPTO_PATH=./fabric/network/organizations/peerOrganizations/dawa.pharmachain.ke
COUCHDB_URL=http://admin:adminpw@127.0.0.1:5984
COUCHDB_WORLDSTATE_DB=pharma_ke_worldstate
COUCHDB_BLOCKS_DB=pharma_ke_blocks
EOF

echo ">>> Bootstrap complete! Live Hyperledger Fabric 2.5 + CouchDB configured in .env."
echo ">>> Run 'npm run dev' in project root and 'cd mobile && npx expo start' for React Native."
