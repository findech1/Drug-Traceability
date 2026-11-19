import React, { useState } from 'react';
import {
  Network,
  Database,
  ShieldCheck,
  Smartphone,
  Server,
  Cpu,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface ArchNodeSpec {
  id: string;
  title: string;
  productionTech: string;
  simulationFile: string;
  description: string;
  responsibilities: string[];
}

const ARCH_NODES: Record<string, ArchNodeSpec> = {
  mobile: {
    id: 'mobile',
    title: '1. Mobile App & Stakeholder Portal',
    productionTech: 'React Native (iOS / Android) + BarcodeDetector Camera Scanner',
    simulationFile: 'src/components/ConsumerVerifyPage.tsx & RoleDashboard.tsx',
    description:
      'Provides two interfaces: a zero-login Public Consumer QR Scanner for patients to verify packs at the point of dispensing, and an authenticated Stakeholder Console for Manufacturers, Distributors, Pharmacies, and PPB Regulators.',
    responsibilities: [
      'Scans 2D QR codes on pharmaceutical blister packs and cartons',
      'Submits signed transaction proposals via REST/gRPC to the API Gateway',
      'Subscribes to real-time Recall Alerts emitted by the Fabric channel',
    ],
  },
  gateway: {
    id: 'gateway',
    title: '2. API Gateway & Identity Enrollment Service',
    productionTech: 'Node.js / Express + @hyperledger/fabric-gateway SDK + Fabric CA',
    simulationFile: 'src/crypto.ts (Web Crypto ECDSA P-256)',
    description:
      'Manages X.509 certificate enrollment with each organization’s Certificate Authority (CA), signs transaction proposals with ECDSA P-256 private keys, and routes invocations to endorsing peers.',
    responsibilities: [
      'Generates & stores per-organization ECDSA P-256 key pairs via Web Crypto API',
      'Computes deterministic canonical JSON payloads and ECDSA signatures',
      'Enforces client MSP identity headers before invoking smart contracts',
    ],
  },
  channel: {
    id: 'channel',
    title: '3. Hyperledger Fabric Permissioned Channel (pharma-ke-channel)',
    productionTech: 'Hyperledger Fabric 2.5 Peers (Mfg, Dist, Pharm, Regulator) + Chaincode',
    simulationFile: 'src/chaincode.ts & src/ledger.ts',
    description:
      'The shared consortium channel connecting Kenyan manufacturers (Dawa, Cosmos, Universal), distributors (KEMSA, MEDS), pharmacies (KNH, Goodlife), and the Pharmacy & Poisons Board (PPB).',
    responsibilities: [
      'Executes pharmachain-cc chaincode functions with strict role-based access control',
      'Verifies ECDSA endorsement signatures from the acting organization',
      'Rejects invalid state transitions (e.g. transferring recalled or unheld stock)',
    ],
  },
  orderer: {
    id: 'orderer',
    title: '4. Raft Ordering Service',
    productionTech: 'Hyperledger Fabric Raft Crash-Fault-Tolerant Ordering Cluster',
    simulationFile: 'src/ledger.ts (createSignedTransactionAndBlock)',
    description:
      'Packages endorsed transactions into deterministic, chronologically ordered blocks linked by SHA-256 cryptographic hashes and broadcasts blocks to all peers.',
    responsibilities: [
      'Assigns sequential block index and canonical timestamp',
      'Links each block to previousHash and computes SHA-256 block digest',
      'Guarantees identical block history across every stakeholder organization',
    ],
  },
  couchdb: {
    id: 'couchdb',
    title: '5. CouchDB World State & Event Hub',
    productionTech: 'Apache CouchDB State Database + Peer Channel Event Service',
    simulationFile: 'src/store.ts (World State + RecallEventEmitter)',
    description:
      'Maintains the latest key-value state for every batchNo (current holder, remaining quantity, recall status) so consumer verifications run in milliseconds without scanning every historical block.',
    responsibilities: [
      'Stores current BatchWorldState JSON documents indexed by batchNo',
      'Persists ledger blocks and world state in localStorage',
      'Broadcasts real-time BatchRecalled events to all stakeholder dashboards',
    ],
  },
};

export const ArchitecturePage: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('channel');
  const activeSpec = ARCH_NODES[selectedNodeId] || ARCH_NODES.channel;

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
        <div className="text-xs font-semibold tracking-wider text-[#001F54] uppercase">
          System Architecture & Distributed Systems Justification
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Hyperledger Fabric Reference Architecture & Database Comparison
        </h1>
        <p className="text-xs text-slate-500 max-w-3xl">
          Click any tier in the interactive SVG architecture diagram below to inspect how the
          production stack (React Native → Node.js API Gateway → Hyperledger Fabric Channel &
          Ordering Service → CouchDB World State) maps directly to the modules in this application.
        </p>
      </section>

      {/* INTERACTIVE SVG DIAGRAM + NODE INSPECTOR */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Interactive SVG Diagram */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Network className="w-4 h-4 text-[#001F54]" />
              End-to-End Permissioned Traceability Topology (Interactive SVG)
            </h2>
            <span className="text-xs text-slate-500">Click any box to inspect</span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox="0 0 880 500"
              className="w-full h-auto min-w-[680px] select-none"
              role="img"
              aria-label="PharmaChain System Architecture Diagram"
            >
              <defs>
                <marker
                  id="arrowGold"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#C9A227" />
                </marker>
                <marker
                  id="arrowNavy"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#001F54" />
                </marker>
              </defs>

              {/* Background Grid */}
              <rect x="0" y="0" width="880" height="500" rx="12" fill="#F8FAFC" />

              {/* 1. MOBILE APP NODE (LEFT) */}
              <g
                onClick={() => setSelectedNodeId('mobile')}
                className="cursor-pointer transition-opacity hover:opacity-90"
              >
                <rect
                  x="20"
                  y="90"
                  width="165"
                  height="320"
                  rx="10"
                  fill={selectedNodeId === 'mobile' ? '#001F54' : '#FFFFFF'}
                  stroke="#001F54"
                  strokeWidth={selectedNodeId === 'mobile' ? '3' : '1.5'}
                />
                <text
                  x="102"
                  y="125"
                  textAnchor="middle"
                  fill={selectedNodeId === 'mobile' ? '#C9A227' : '#001F54'}
                  fontSize="11"
                  fontWeight="700"
                >
                  CLIENT TIER
                </text>
                <text
                  x="102"
                  y="148"
                  textAnchor="middle"
                  fill={selectedNodeId === 'mobile' ? '#FFFFFF' : '#0F172A'}
                  fontSize="13"
                  fontWeight="700"
                >
                  Mobile & Web App
                </text>
                <text
                  x="102"
                  y="166"
                  textAnchor="middle"
                  fill={selectedNodeId === 'mobile' ? '#CBD5E1' : '#64748B'}
                  fontSize="10"
                >
                  (React Native / Web)
                </text>

                {/* Sub-boxes inside Mobile */}
                <rect
                  x="34"
                  y="190"
                  width="137"
                  height="85"
                  rx="6"
                  fill={selectedNodeId === 'mobile' ? '#002B75' : '#F1F5F9'}
                  stroke="#C9A227"
                  strokeWidth="1"
                />
                <text
                  x="102"
                  y="215"
                  textAnchor="middle"
                  fill={selectedNodeId === 'mobile' ? '#FFFFFF' : '#0F172A'}
                  fontSize="11"
                  fontWeight="600"
                >
                  Consumer QR Scanner
                </text>
                <text
                  x="102"
                  y="233"
                  textAnchor="middle"
                  fill={selectedNodeId === 'mobile' ? '#CBD5E1' : '#475569'}
                  fontSize="9.5"
                >
                  Public verifyBatch()
                </text>
                <text
                  x="102"
                  y="250"
                  textAnchor="middle"
                  fill={selectedNodeId === 'mobile' ? '#C9A227' : '#001F54'}
                  fontSize="9.5"
                  fontWeight="600"
                >
                  BarcodeDetector API
                </text>

                <rect
                  x="34"
                  y="295"
                  width="137"
                  height="95"
                  rx="6"
                  fill={selectedNodeId === 'mobile' ? '#002B75' : '#F1F5F9'}
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
                <text
                  x="102"
                  y="320"
                  textAnchor="middle"
                  fill={selectedNodeId === 'mobile' ? '#FFFFFF' : '#0F172A'}
                  fontSize="11"
                  fontWeight="600"
                >
                  Org Role Consoles
                </text>
                <text
                  x="102"
                  y="338"
                  textAnchor="middle"
                  fill={selectedNodeId === 'mobile' ? '#CBD5E1' : '#475569'}
                  fontSize="9.5"
                >
                  Mfg · Dist · Pharm · PPB
                </text>
                <text
                  x="102"
                  y="356"
                  textAnchor="middle"
                  fill={selectedNodeId === 'mobile' ? '#C9A227' : '#DC2626'}
                  fontSize="9.5"
                  fontWeight="600"
                >
                  Real-Time Recall Banner
                </text>
              </g>

              {/* Arrow: Mobile -> API Gateway */}
              <line
                x1="185"
                y1="250"
                x2="225"
                y2="250"
                stroke="#001F54"
                strokeWidth="2"
                markerEnd="url(#arrowNavy)"
              />
              <text x="205" y="240" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="600">
                HTTPS
              </text>

              {/* 2. API GATEWAY NODE */}
              <g
                onClick={() => setSelectedNodeId('gateway')}
                className="cursor-pointer transition-opacity hover:opacity-90"
              >
                <rect
                  x="230"
                  y="90"
                  width="155"
                  height="320"
                  rx="10"
                  fill={selectedNodeId === 'gateway' ? '#001F54' : '#FFFFFF'}
                  stroke="#001F54"
                  strokeWidth={selectedNodeId === 'gateway' ? '3' : '1.5'}
                />
                <text
                  x="307"
                  y="125"
                  textAnchor="middle"
                  fill={selectedNodeId === 'gateway' ? '#C9A227' : '#001F54'}
                  fontSize="11"
                  fontWeight="700"
                >
                  MIDDLEWARE
                </text>
                <text
                  x="307"
                  y="148"
                  textAnchor="middle"
                  fill={selectedNodeId === 'gateway' ? '#FFFFFF' : '#0F172A'}
                  fontSize="13"
                  fontWeight="700"
                >
                  API Gateway
                </text>
                <text
                  x="307"
                  y="166"
                  textAnchor="middle"
                  fill={selectedNodeId === 'gateway' ? '#CBD5E1' : '#64748B'}
                  fontSize="10"
                >
                  (Node.js + Fabric SDK)
                </text>

                <rect
                  x="244"
                  y="190"
                  width="127"
                  height="90"
                  rx="6"
                  fill={selectedNodeId === 'gateway' ? '#002B75' : '#F1F5F9'}
                  stroke="#C9A227"
                />
                <text
                  x="307"
                  y="215"
                  textAnchor="middle"
                  fill={selectedNodeId === 'gateway' ? '#FFFFFF' : '#0F172A'}
                  fontSize="10.5"
                  fontWeight="600"
                >
                  Fabric CA & MSP Wallet
                </text>
                <text
                  x="307"
                  y="234"
                  textAnchor="middle"
                  fill={selectedNodeId === 'gateway' ? '#CBD5E1' : '#475569'}
                  fontSize="9.5"
                >
                  Web Crypto API
                </text>
                <text
                  x="307"
                  y="252"
                  textAnchor="middle"
                  fill={selectedNodeId === 'gateway' ? '#C9A227' : '#001F54'}
                  fontSize="9.5"
                  fontWeight="600"
                >
                  ECDSA P-256 Signer
                </text>

                <rect
                  x="244"
                  y="295"
                  width="127"
                  height="95"
                  rx="6"
                  fill={selectedNodeId === 'gateway' ? '#002B75' : '#F1F5F9'}
                  stroke="#CBD5E1"
                />
                <text
                  x="307"
                  y="322"
                  textAnchor="middle"
                  fill={selectedNodeId === 'gateway' ? '#FFFFFF' : '#0F172A'}
                  fontSize="10.5"
                  fontWeight="600"
                >
                  Event Hub Listener
                </text>
                <text
                  x="307"
                  y="342"
                  textAnchor="middle"
                  fill={selectedNodeId === 'gateway' ? '#CBD5E1' : '#475569'}
                  fontSize="9.5"
                >
                  Pushes Recall Alerts
                </text>
                <text
                  x="307"
                  y="360"
                  textAnchor="middle"
                  fill={selectedNodeId === 'gateway' ? '#C9A227' : '#001F54'}
                  fontSize="9.5"
                  fontWeight="600"
                >
                  src/crypto.ts
                </text>
              </g>

              {/* Arrow: Gateway -> Fabric Channel */}
              <line
                x1="385"
                y1="250"
                x2="425"
                y2="250"
                stroke="#001F54"
                strokeWidth="2"
                markerEnd="url(#arrowNavy)"
              />
              <text x="405" y="240" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="600">
                gRPC
              </text>

              {/* 3. HYPERLEDGER FABRIC CHANNEL & PEERS */}
              <g
                onClick={() => setSelectedNodeId('channel')}
                className="cursor-pointer transition-opacity hover:opacity-95"
              >
                <rect
                  x="430"
                  y="35"
                  width="255"
                  height="315"
                  rx="12"
                  fill={selectedNodeId === 'channel' ? '#001F54' : '#FFFFFF'}
                  stroke="#001F54"
                  strokeWidth={selectedNodeId === 'channel' ? '3' : '2'}
                />
                <text
                  x="557"
                  y="62"
                  textAnchor="middle"
                  fill={selectedNodeId === 'channel' ? '#C9A227' : '#001F54'}
                  fontSize="11"
                  fontWeight="700"
                >
                  PERMISSIONED BLOCKCHAIN NETWORK
                </text>
                <text
                  x="557"
                  y="82"
                  textAnchor="middle"
                  fill={selectedNodeId === 'channel' ? '#FFFFFF' : '#0F172A'}
                  fontSize="13"
                  fontWeight="700"
                >
                  Fabric Channel: pharma-ke-channel
                </text>

                {/* 4 Organization Peer Nodes (2x2 Grid) */}
                <rect
                  x="445"
                  y="100"
                  width="108"
                  height="68"
                  rx="6"
                  fill={selectedNodeId === 'channel' ? '#002B75' : '#F8FAFC'}
                  stroke="#C9A227"
                />
                <text
                  x="499"
                  y="124"
                  textAnchor="middle"
                  fill={selectedNodeId === 'channel' ? '#FFFFFF' : '#0F172A'}
                  fontSize="10.5"
                  fontWeight="700"
                >
                  Manufacturer Peer
                </text>
                <text
                  x="499"
                  y="140"
                  textAnchor="middle"
                  fill={selectedNodeId === 'channel' ? '#CBD5E1' : '#475569'}
                  fontSize="9"
                >
                  Dawa · Cosmos · Univ
                </text>
                <text
                  x="499"
                  y="155"
                  textAnchor="middle"
                  fill="#C9A227"
                  fontSize="9"
                  fontWeight="600"
                >
                  registerBatch()
                </text>

                <rect
                  x="562"
                  y="100"
                  width="108"
                  height="68"
                  rx="6"
                  fill={selectedNodeId === 'channel' ? '#002B75' : '#F8FAFC'}
                  stroke="#C9A227"
                />
                <text
                  x="616"
                  y="124"
                  textAnchor="middle"
                  fill={selectedNodeId === 'channel' ? '#FFFFFF' : '#0F172A'}
                  fontSize="10.5"
                  fontWeight="700"
                >
                  Distributor Peer
                </text>
                <text
                  x="616"
                  y="140"
                  textAnchor="middle"
                  fill={selectedNodeId === 'channel' ? '#CBD5E1' : '#475569'}
                  fontSize="9"
                >
                  KEMSA · MEDS
                </text>
                <text
                  x="616"
                  y="155"
                  textAnchor="middle"
                  fill="#C9A227"
                  fontSize="9"
                  fontWeight="600"
                >
                  receive / transfer
                </text>

                <rect
                  x="445"
                  y="178"
                  width="108"
                  height="68"
                  rx="6"
                  fill={selectedNodeId === 'channel' ? '#002B75' : '#F8FAFC'}
                  stroke="#C9A227"
                />
                <text
                  x="499"
                  y="202"
                  textAnchor="middle"
                  fill={selectedNodeId === 'channel' ? '#FFFFFF' : '#0F172A'}
                  fontSize="10.5"
                  fontWeight="700"
                >
                  Pharmacy Peer
                </text>
                <text
                  x="499"
                  y="218"
                  textAnchor="middle"
                  fill={selectedNodeId === 'channel' ? '#CBD5E1' : '#475569'}
                  fontSize="9"
                >
                  KNH · Goodlife
                </text>
                <text
                  x="499"
                  y="233"
                  textAnchor="middle"
                  fill="#C9A227"
                  fontSize="9"
                  fontWeight="600"
                >
                  dispenseUnits()
                </text>

                <rect
                  x="562"
                  y="178"
                  width="108"
                  height="68"
                  rx="6"
                  fill={selectedNodeId === 'channel' ? '#002B75' : '#F8FAFC'}
                  stroke="#DC2626"
                />
                <text
                  x="616"
                  y="202"
                  textAnchor="middle"
                  fill={selectedNodeId === 'channel' ? '#FFFFFF' : '#0F172A'}
                  fontSize="10.5"
                  fontWeight="700"
                >
                  Regulator Peer
                </text>
                <text
                  x="616"
                  y="218"
                  textAnchor="middle"
                  fill={selectedNodeId === 'channel' ? '#CBD5E1' : '#475569'}
                  fontSize="9"
                >
                  PPB Kenya
                </text>
                <text
                  x="616"
                  y="233"
                  textAnchor="middle"
                  fill="#F87171"
                  fontSize="9"
                  fontWeight="600"
                >
                  flag / recallBatch()
                </text>

                {/* Smart Contract Bar inside Channel */}
                <rect
                  x="445"
                  y="260"
                  width="225"
                  height="72"
                  rx="6"
                  fill="#C9A227"
                />
                <text
                  x="557"
                  y="284"
                  textAnchor="middle"
                  fill="#001F54"
                  fontSize="11"
                  fontWeight="700"
                >
                  Smart Contract (src/chaincode.ts)
                </text>
                <text
                  x="557"
                  y="302"
                  textAnchor="middle"
                  fill="#001F54"
                  fontSize="9.5"
                  fontWeight="600"
                >
                  RBAC Policy + Custody State Machine
                </text>
                <text
                  x="557"
                  y="318"
                  textAnchor="middle"
                  fill="#001F54"
                  fontSize="9"
                >
                  Verifies ECDSA Signatures Before Block Commit
                </text>
              </g>

              {/* 4. ORDERING SERVICE NODE (BOTTOM CENTER) */}
              <g
                onClick={() => setSelectedNodeId('orderer')}
                className="cursor-pointer transition-opacity hover:opacity-90"
              >
                <rect
                  x="430"
                  y="375"
                  width="255"
                  height="95"
                  rx="10"
                  fill={selectedNodeId === 'orderer' ? '#001F54' : '#FFFFFF'}
                  stroke="#001F54"
                  strokeWidth={selectedNodeId === 'orderer' ? '3' : '1.5'}
                />
                <text
                  x="557"
                  y="402"
                  textAnchor="middle"
                  fill={selectedNodeId === 'orderer' ? '#C9A227' : '#001F54'}
                  fontSize="11"
                  fontWeight="700"
                >
                  CONSENSUS & BLOCK CUTTING
                </text>
                <text
                  x="557"
                  y="424"
                  textAnchor="middle"
                  fill={selectedNodeId === 'orderer' ? '#FFFFFF' : '#0F172A'}
                  fontSize="13"
                  fontWeight="700"
                >
                  Raft Ordering Service
                </text>
                <text
                  x="557"
                  y="445"
                  textAnchor="middle"
                  fill={selectedNodeId === 'orderer' ? '#CBD5E1' : '#475569'}
                  fontSize="10"
                >
                  SHA-256 Block Hash Chain (src/ledger.ts)
                </text>
              </g>

              {/* Vertical Arrow between Channel & Orderer */}
              <line
                x1="557"
                y1="350"
                x2="557"
                y2="375"
                stroke="#C9A227"
                strokeWidth="2.5"
                markerEnd="url(#arrowGold)"
              />

              {/* Arrow: Channel -> CouchDB World State */}
              <line
                x1="685"
                y1="250"
                x2="720"
                y2="250"
                stroke="#001F54"
                strokeWidth="2"
                markerEnd="url(#arrowNavy)"
              />

              {/* 5. COUCHDB WORLD STATE (RIGHT) */}
              <g
                onClick={() => setSelectedNodeId('couchdb')}
                className="cursor-pointer transition-opacity hover:opacity-90"
              >
                <rect
                  x="725"
                  y="90"
                  width="135"
                  height="320"
                  rx="10"
                  fill={selectedNodeId === 'couchdb' ? '#001F54' : '#FFFFFF'}
                  stroke="#001F54"
                  strokeWidth={selectedNodeId === 'couchdb' ? '3' : '1.5'}
                />
                <text
                  x="792"
                  y="125"
                  textAnchor="middle"
                  fill={selectedNodeId === 'couchdb' ? '#C9A227' : '#001F54'}
                  fontSize="11"
                  fontWeight="700"
                >
                  STATE DB
                </text>
                <text
                  x="792"
                  y="148"
                  textAnchor="middle"
                  fill={selectedNodeId === 'couchdb' ? '#FFFFFF' : '#0F172A'}
                  fontSize="13"
                  fontWeight="700"
                >
                  CouchDB
                </text>
                <text
                  x="792"
                  y="166"
                  textAnchor="middle"
                  fill={selectedNodeId === 'couchdb' ? '#CBD5E1' : '#64748B'}
                  fontSize="10"
                >
                  World State
                </text>

                <rect
                  x="737"
                  y="190"
                  width="110"
                  height="100"
                  rx="6"
                  fill={selectedNodeId === 'couchdb' ? '#002B75' : '#F1F5F9'}
                  stroke="#C9A227"
                />
                <text
                  x="792"
                  y="215"
                  textAnchor="middle"
                  fill={selectedNodeId === 'couchdb' ? '#FFFFFF' : '#0F172A'}
                  fontSize="10"
                  fontWeight="600"
                >
                  Latest Batch State
                </text>
                <text
                  x="792"
                  y="235"
                  textAnchor="middle"
                  fill={selectedNodeId === 'couchdb' ? '#CBD5E1' : '#475569'}
                  fontSize="9"
                >
                  Key: batchNo
                </text>
                <text
                  x="792"
                  y="252"
                  textAnchor="middle"
                  fill={selectedNodeId === 'couchdb' ? '#CBD5E1' : '#475569'}
                  fontSize="9"
                >
                  Holder, Qty, Status
                </text>
                <text
                  x="792"
                  y="272"
                  textAnchor="middle"
                  fill={selectedNodeId === 'couchdb' ? '#C9A227' : '#001F54'}
                  fontSize="9"
                  fontWeight="600"
                >
                  O(1) Fast Verify
                </text>

                <rect
                  x="737"
                  y="305"
                  width="110"
                  height="85"
                  rx="6"
                  fill={selectedNodeId === 'couchdb' ? '#002B75' : '#F1F5F9'}
                  stroke="#CBD5E1"
                />
                <text
                  x="792"
                  y="330"
                  textAnchor="middle"
                  fill={selectedNodeId === 'couchdb' ? '#FFFFFF' : '#0F172A'}
                  fontSize="10"
                  fontWeight="600"
                >
                  Persistent Store
                </text>
                <text
                  x="792"
                  y="348"
                  textAnchor="middle"
                  fill={selectedNodeId === 'couchdb' ? '#CBD5E1' : '#475569'}
                  fontSize="9"
                >
                  localStorage Sync
                </text>
                <text
                  x="792"
                  y="366"
                  textAnchor="middle"
                  fill={selectedNodeId === 'couchdb' ? '#C9A227' : '#001F54'}
                  fontSize="9"
                  fontWeight="600"
                >
                  src/store.ts
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* Right 4 Cols: Selected Architecture Node Details */}
        <div className="lg:col-span-4 bg-[#001F54] text-white rounded-xl p-6 space-y-5">
          <div className="border-b border-white/15 pb-3">
            <div className="text-xs font-mono text-[#C9A227] uppercase">
              Selected Architecture Component
            </div>
            <h3 className="text-lg font-bold mt-1">{activeSpec.title}</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-slate-300">Production Technology</div>
              <div className="font-semibold text-white mt-0.5">{activeSpec.productionTech}</div>
            </div>

            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-slate-300">Browser Simulation Module</div>
              <div className="font-mono font-semibold text-[#C9A227] mt-0.5">
                {activeSpec.simulationFile}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed">{activeSpec.description}</p>

          <div className="space-y-2 pt-2 border-t border-white/15">
            <div className="text-xs font-semibold text-[#C9A227]">Core Responsibilities:</div>
            <ul className="space-y-2 text-xs text-slate-200">
              {activeSpec.responsibilities.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#C9A227] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 flex flex-wrap gap-1.5">
            {Object.values(ARCH_NODES).map((n, idx) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelectedNodeId(n.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  selectedNodeId === n.id
                    ? 'bg-[#C9A227] text-[#001F54] font-bold'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                Tier #{idx + 1}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* WHY BLOCKCHAIN AND NOT A NORMAL CENTRALIZED DATABASE? COMPARISON TABLE */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="text-xs font-semibold tracking-wider text-[#001F54] uppercase">
            Architectural Justification
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">
            Why a Permissioned Blockchain (Hyperledger Fabric) Instead of a Normal SQL/NoSQL
            Database?
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            In a national pharmaceutical supply chain spanning competing private manufacturers,
            autonomous distributors, independent pharmacies, and statutory regulators, a traditional
            single-admin database fails on trust, non-repudiation, and tamper resistance.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="py-3.5 px-5 w-1/5">Security & Trust Dimension</th>
                <th className="py-3.5 px-5 w-2/5 text-red-800">
                  Traditional Centralized Database (SQL / Cloud CRUD)
                </th>
                <th className="py-3.5 px-5 w-2/5 text-[#001F54]">
                  Permissioned Blockchain (PharmaChain / Hyperledger Fabric)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              <tr>
                <td className="py-4 px-5 font-bold text-slate-900">1. Immutability</td>
                <td className="py-4 px-5 text-slate-600">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>
                      Supports <code className="font-mono">UPDATE</code> and{' '}
                      <code className="font-mono">DELETE</code> statements. A compromised DB admin
                      or insider can silently alter historical batch quantities or expiry dates.
                    </span>
                  </div>
                </td>
                <td className="py-4 px-5 text-slate-800 bg-slate-50/60">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Append-only ledger where every block commits the SHA-256 hash of the previous
                      block. Historical custody records cannot be overwritten without breaking the
                      entire cryptographic chain.
                    </span>
                  </div>
                </td>
              </tr>

              <tr>
                <td className="py-4 px-5 font-bold text-slate-900">
                  2. Multi-Party Trust Without a Central Admin
                </td>
                <td className="py-4 px-5 text-slate-600">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>
                      Requires all competing manufacturers, distributors, and pharmacies to trust a
                      single super-administrator who controls the master server and credentials.
                    </span>
                  </div>
                </td>
                <td className="py-4 px-5 text-slate-800 bg-slate-50/60">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Decentralized consortium governance. Each organization operates its own peer
                      and holds its own private ECDSA key; no single party can forge another
                      organization’s custody signature.
                    </span>
                  </div>
                </td>
              </tr>

              <tr>
                <td className="py-4 px-5 font-bold text-slate-900">
                  3. Auditability & Non-Repudiation
                </td>
                <td className="py-4 px-5 text-slate-600">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>
                      Audit logs are stored in the same mutable database or log server and can be
                      truncated or spoofed during a counterfeit investigation.
                    </span>
                  </div>
                </td>
                <td className="py-4 px-5 text-slate-800 bg-slate-50/60">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Every transaction is digitally signed via ECDSA P-256 by the acting
                      organization’s private key. Provides mathematical non-repudiation for
                      regulatory forensics.
                    </span>
                  </div>
                </td>
              </tr>

              <tr>
                <td className="py-4 px-5 font-bold text-slate-900">4. Tamper Evidence</td>
                <td className="py-4 px-5 text-slate-600">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>
                      Row-level edits leave no cryptographic mismatch; downstream consumers querying
                      the API have no way to verify whether a record was altered.
                    </span>
                  </div>
                </td>
                <td className="py-4 px-5 text-slate-800 bg-slate-50/60">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Any 1-byte mutation to a historical transaction invalidates both the signer’s
                      ECDSA signature and the block’s SHA-256 hash (demonstrated live in the Ledger
                      Explorer Tamper Demo).
                    </span>
                  </div>
                </td>
              </tr>

              <tr>
                <td className="py-4 px-5 font-bold text-slate-900">
                  5. Shared State & Real-Time Recall Enforcement
                </td>
                <td className="py-4 px-5 text-slate-600">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>
                      Fragmented ERP silos require manual CSV reconciliations, email circulars, and
                      delayed phone calls when a batch is recalled.
                    </span>
                  </div>
                </td>
                <td className="py-4 px-5 text-slate-800 bg-slate-50/60">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Synchronized CouchDB World State across all peers. When PPB invokes{' '}
                      <code className="font-mono">recallBatch()</code>, chaincode atomically blocks
                      transfers/dispensing and triggers instant alerts across all holders.
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
