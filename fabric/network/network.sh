#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PharmaChain Kenya — Hyperledger Fabric 2.5 + CouchDB Network Orchestrator
# Usage:
#   ./network.sh up             # Generate MSP crypto, start Orderer + 4 Peers + 4 CouchDBs
#   ./network.sh createChannel  # Generate genesis block & join all 4 org peers to pharma-ke-channel
#   ./network.sh deployCC       # Package, install, approve & commit TypeScript chaincode + SideDBs
#   ./network.sh down           # Tear down containers and remove generated crypto/channel artifacts
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -d "$SCRIPT_DIR/bin" ]; then
  export PATH="$SCRIPT_DIR/bin:$PATH"
fi

export FABRIC_CFG_PATH="$SCRIPT_DIR"
CHANNEL_NAME="pharma-ke-channel"
CC_NAME="pharmachain-cc"
CC_SRC_PATH="../chaincode/pharmachain-ts"
CC_COLLECTIONS="../chaincode/pharmachain-ts/collections_config.json"
CC_VERSION="1.0"
CC_SEQUENCE="1"

ORDERER_CA="$SCRIPT_DIR/organizations/ordererOrganizations/pharmachain.ke/orderers/orderer.pharmachain.ke/tls/ca.crt"
ORDERER_ADMIN_TLS_CERT="$SCRIPT_DIR/organizations/ordererOrganizations/pharmachain.ke/orderers/orderer.pharmachain.ke/tls/server.crt"
ORDERER_ADMIN_TLS_KEY="$SCRIPT_DIR/organizations/ordererOrganizations/pharmachain.ke/orderers/orderer.pharmachain.ke/tls/server.key"

function networkUp() {
  echo ">>> [1/3] Generating X.509 MSP Certificates via cryptogen..."
  rm -rf organizations channel-artifacts
  mkdir -p channel-artifacts
  cryptogen generate --config=./crypto-config.yaml --output=organizations

  echo ">>> [2/3] Starting Hyperledger Fabric 2.5 Peers, Raft Orderer, and CouchDB containers..."
  docker compose -f docker-compose-pharmachain.yaml up -d
  sleep 4
  docker compose -f docker-compose-pharmachain.yaml ps
}

function setPeerEnv() {
  local ORG="$1"
  if [ "$ORG" = "dawa" ]; then
    export CORE_PEER_LOCALMSPID="DawaLifeMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$SCRIPT_DIR/organizations/peerOrganizations/dawa.pharmachain.ke/peers/peer0.dawa.pharmachain.ke/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$SCRIPT_DIR/organizations/peerOrganizations/dawa.pharmachain.ke/users/Admin@dawa.pharmachain.ke/msp"
    export CORE_PEER_ADDRESS="localhost:7051"
  elif [ "$ORG" = "kemsa" ]; then
    export CORE_PEER_LOCALMSPID="KemsaSupplyMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$SCRIPT_DIR/organizations/peerOrganizations/kemsa.pharmachain.ke/peers/peer0.kemsa.pharmachain.ke/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$SCRIPT_DIR/organizations/peerOrganizations/kemsa.pharmachain.ke/users/Admin@kemsa.pharmachain.ke/msp"
    export CORE_PEER_ADDRESS="localhost:9051"
  elif [ "$ORG" = "goodlife" ]; then
    export CORE_PEER_LOCALMSPID="GoodlifePharmMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$SCRIPT_DIR/organizations/peerOrganizations/goodlife.pharmachain.ke/peers/peer0.goodlife.pharmachain.ke/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$SCRIPT_DIR/organizations/peerOrganizations/goodlife.pharmachain.ke/users/Admin@goodlife.pharmachain.ke/msp"
    export CORE_PEER_ADDRESS="localhost:11051"
  elif [ "$ORG" = "ppb" ]; then
    export CORE_PEER_LOCALMSPID="PpbRegulatorMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$SCRIPT_DIR/organizations/peerOrganizations/ppb.pharmachain.ke/peers/peer0.ppb.pharmachain.ke/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$SCRIPT_DIR/organizations/peerOrganizations/ppb.pharmachain.ke/users/Admin@ppb.pharmachain.ke/msp"
    export CORE_PEER_ADDRESS="localhost:13051"
  fi
  export CORE_PEER_TLS_ENABLED=true
}

function createChannel() {
  echo ">>> Generating channel genesis block for '$CHANNEL_NAME'..."
  configtxgen -profile PharmaKeChannel -outputBlock "./channel-artifacts/${CHANNEL_NAME}.block" -channelID "$CHANNEL_NAME"

  echo ">>> Joining Orderer via osnadmin..."
  osnadmin channel join --channelID "$CHANNEL_NAME" \
    --config-block "./channel-artifacts/${CHANNEL_NAME}.block" \
    -o localhost:7053 --ca-file "$ORDERER_CA" \
    --client-cert "$ORDERER_ADMIN_TLS_CERT" --client-key "$ORDERER_ADMIN_TLS_KEY"

  for ORG in dawa kemsa goodlife ppb; do
    echo ">>> Joining peer0.${ORG}.pharmachain.ke to '$CHANNEL_NAME'..."
    setPeerEnv "$ORG"
    peer channel join -b "./channel-artifacts/${CHANNEL_NAME}.block"
  done
}

function deployCC() {
  echo ">>> Compiling TypeScript Chaincode in $CC_SRC_PATH..."
  (cd "$CC_SRC_PATH" && npm install && npm run build)

  echo ">>> Packaging Chaincode '$CC_NAME'..."
  setPeerEnv "dawa"
  peer lifecycle chaincode package "${CC_NAME}.tar.gz" \
    --path "$CC_SRC_PATH" --lang node --label "${CC_NAME}_${CC_VERSION}"

  for ORG in dawa kemsa goodlife ppb; do
    echo ">>> Installing chaincode on peer0.${ORG}..."
    setPeerEnv "$ORG"
    peer lifecycle chaincode install "${CC_NAME}.tar.gz"
  done

  PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep "${CC_NAME}_${CC_VERSION}" | sed -n 's/Package ID: //; s/, Label:.*//p' | head -n 1)
  echo ">>> Detected Package ID: $PACKAGE_ID"

  for ORG in dawa kemsa goodlife ppb; do
    echo ">>> Approving chaincode definition for $ORG..."
    setPeerEnv "$ORG"
    peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.pharmachain.ke \
      --tls --cafile "$ORDERER_CA" --channelID "$CHANNEL_NAME" \
      --name "$CC_NAME" --version "$CC_VERSION" --package-id "$PACKAGE_ID" --sequence "$CC_SEQUENCE" \
      --collections-config "$CC_COLLECTIONS"
  done

  echo ">>> Committing chaincode definition to '$CHANNEL_NAME'..."
  setPeerEnv "dawa"
  peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.pharmachain.ke \
    --tls --cafile "$ORDERER_CA" --channelID "$CHANNEL_NAME" \
    --name "$CC_NAME" --version "$CC_VERSION" --sequence "$CC_SEQUENCE" \
    --collections-config "$CC_COLLECTIONS" \
    --peerAddresses localhost:7051 --tlsRootCertFiles "$SCRIPT_DIR/organizations/peerOrganizations/dawa.pharmachain.ke/peers/peer0.dawa.pharmachain.ke/tls/ca.crt" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "$SCRIPT_DIR/organizations/peerOrganizations/kemsa.pharmachain.ke/peers/peer0.kemsa.pharmachain.ke/tls/ca.crt"

  echo ">>> Initializing Genesis Ledger via initLedger()..."
  peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.pharmachain.ke \
    --tls --cafile "$ORDERER_CA" -C "$CHANNEL_NAME" -n "$CC_NAME" \
    --peerAddresses localhost:7051 --tlsRootCertFiles "$SCRIPT_DIR/organizations/peerOrganizations/dawa.pharmachain.ke/peers/peer0.dawa.pharmachain.ke/tls/ca.crt" \
    -c '{"function":"initLedger","Args":[]}'
}

function networkDown() {
  docker compose -f docker-compose-pharmachain.yaml down --volumes --remove-orphans
  rm -rf organizations channel-artifacts "${CC_NAME}.tar.gz"
  echo ">>> Network torn down and cleaned."
}

case "${1:-}" in
  up) networkUp ;;
  createChannel) createChannel ;;
  deployCC) deployCC ;;
  down) networkDown ;;
  *)
    echo "Usage: $0 {up|createChannel|deployCC|down}"
    exit 1
    ;;
esac
