import React, { useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  Blocks,
  Network,
  ArrowRight,
  Lock,
  Share2,
  BellRing,
  BookOpen,
  Building2,
  CheckCircle2,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Thermometer,
  ShieldAlert,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PersistedLedgerStore } from '../store';

interface LandingPageProps {
  store: PersistedLedgerStore;
  onNavigate: (
    tab: 'landing' | 'dashboard' | 'verify' | 'explorer' | 'architecture' | 'analytics' | 'tests',
    verifyBatchNo?: string
  ) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ store, onNavigate }) => {
  const batches = Object.values(store.worldState);
  const totalBatches = batches.length;
  const totalBlocks = store.blocks.length;
  const recalledCount = batches.filter((b) => b.status === 'RECALLED').length;
  const totalOrgs = Object.keys(store.organizations).length;

  const [selectedHeroBatchNo, setSelectedHeroBatchNo] = useState<string>('KE-ACT-2026-001');
  const [researchTab, setResearchTab] = useState<'standards' | 'literature' | 'crypto'>('standards');
  const [showReferences, setShowReferences] = useState(true);

  const heroBatch = store.worldState[selectedHeroBatchNo] || store.worldState['KE-ACT-2026-001'];

  const quickHeroBatches = [
    { id: 'KE-ACT-2026-001', label: 'Authentic ACT', status: 'AUTHENTIC', color: 'text-emerald-400' },
    { id: 'KE-INS-2026-005', label: 'Cold-Chain Insulin', status: 'EXCURSION', color: 'text-amber-400' },
    { id: 'KE-PCM-2026-999', label: 'Recalled Syrup', status: 'RECALLED', color: 'text-red-400' },
    { id: 'FAKE-MOMBASA-404', label: 'Counterfeit Pack', status: 'FORGERY', color: 'text-rose-400' },
  ];

  return (
    <div className="space-y-10 sm:space-y-12 pb-12">
      {/* HERO BANNER — UN SDG 3 & Kenyan National Drug Traceability Ledger */}
      <section className="bg-[#001F54] text-white rounded-2xl overflow-hidden border border-[#002b75] shadow-sm">
        {/* Top SDG 3 Header Strip */}
        <div className="bg-[#00153B] border-b border-white/10 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#C9A227] text-[#001F54] font-mono text-[11px] font-bold">
              SDG 3
            </span>
            <span className="font-semibold tracking-wider text-[#C9A227] uppercase text-[11px] sm:text-xs">
              UN Sustainable Development Goal 3 · Good Health and Well-Being
            </span>
          </div>
          <div className="text-slate-300 font-mono text-[11px] flex items-center gap-2">
            <span>Channel: pharma-ke-channel</span>
            <span className="opacity-50">·</span>
            <span>ECDSA P-256 + SHA-256</span>
          </div>
        </div>

        {/* Main Hero Split */}
        <div className="p-6 sm:p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-white"
              style={{ textWrap: 'balance' }}
            >
              Permissioned Blockchain Pharmaceutical Traceability for Patient Safety
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-slate-200 leading-relaxed max-w-2xl font-normal">
              Counterfeit and degraded pharmaceuticals infiltrate developing supply chains,
              threatening patient lives through fragmented data systems. PharmaChain synchronizes
              manufacturers, distributors, dispensaries, and national regulators on a high-throughput,
              tamper-evident permissioned ledger.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('verify', selectedHeroBatchNo)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#C9A227] hover:bg-[#d8b132] text-[#001F54] font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer shadow-sm active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                Verify Batch ({selectedHeroBatchNo})
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap cursor-pointer active:scale-95"
              >
                <Building2 className="w-4 h-4 text-[#C9A227]" />
                Stakeholder Role Console
              </button>

              <button
                type="button"
                onClick={() => onNavigate('tests')}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg text-slate-200 hover:text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <Cpu className="w-4 h-4 text-[#C9A227]" />
                Run Test Suite (6 Tests)
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Live Network & Batch Preview */}
          <div className="lg:col-span-5 bg-[#001740] border border-white/15 rounded-xl p-5 sm:p-6 space-y-4 shadow-inner">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Kenya Consortium Ledger State
                </h2>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Synchronized CouchDB World State & Raft Consensus
                </p>
              </div>
              <span className="text-xs font-mono text-[#C9A227] font-bold">
                {totalOrgs} Certified MSPs
              </span>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-[11px] text-slate-300 font-medium">Permissioned Peers</div>
                <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
                  {totalOrgs}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  3 Mfg · 2 Dist · 2 Pharm · 1 Reg
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-[11px] text-slate-300 font-medium">Tracked Batches</div>
                <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
                  {totalBatches}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  CouchDB World State
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-[11px] text-slate-300 font-medium">Signed Blocks</div>
                <div className="text-xl font-bold font-mono tabular-nums text-[#C9A227] mt-1">
                  {totalBlocks}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  SHA-256 Merkle Rooted
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-[11px] text-slate-300 font-medium">Statutory Recalls</div>
                <div className="text-xl font-bold font-mono tabular-nums text-red-400 mt-1">
                  {recalledCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  PPB Instant Lockout
                </div>
              </div>
            </div>

            {/* Interactive Live Batch Selector Box */}
            <div className="bg-white/10 border border-white/15 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Interactive Batch Inspector:</span>
                <span className="text-[11px] font-mono text-[#C9A227]">Click to preview</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {quickHeroBatches.map((qb) => {
                  const isSelected = selectedHeroBatchNo === qb.id;
                  return (
                    <button
                      key={qb.id}
                      type="button"
                      onClick={() => setSelectedHeroBatchNo(qb.id)}
                      className={`px-2 py-1.5 rounded text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white text-[#001F54] font-bold shadow-xs'
                          : 'bg-white/5 hover:bg-white/15 text-slate-200'
                      }`}
                    >
                      <div className="font-mono text-[10px] truncate">{qb.id}</div>
                      <div className="text-[11px] font-sans truncate">{qb.label}</div>
                    </button>
                  );
                })}
              </div>

              {heroBatch ? (
                <div className="bg-black/30 rounded p-2.5 space-y-1 text-xs border border-white/10">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-slate-300 truncate">{heroBatch.drugName}</span>
                    <span
                      className={`font-bold ${
                        heroBatch.status === 'RECALLED'
                          ? 'text-red-400'
                          : heroBatch.status === 'FLAGGED'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {heroBatch.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Holder: {heroBatch.currentHolderName}</span>
                    <span className="font-mono">{heroBatch.currentQuantity.toLocaleString()} left</span>
                  </div>
                </div>
              ) : (
                <div className="bg-red-900/30 rounded p-2 text-xs border border-red-500/30 text-red-200">
                  Unregistered test serial: Zero genesis blocks found on ledger.
                </div>
              )}

              <button
                type="button"
                onClick={() => onNavigate('verify', selectedHeroBatchNo)}
                className="w-full py-2 rounded bg-[#C9A227] hover:bg-[#d8b132] text-[#001F54] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                Scan Selected Batch in Verifier →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM STATEMENT & PAIN POINT TO SOLUTION MAPPING */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Problem & Scope Card */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="text-xs font-semibold tracking-wider text-[#001F54] uppercase">
              01. Problem Statement & Scope Definition
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Why Fragmented Supply Chains Fail Patients
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed font-normal">
              In developing healthcare markets, pharmaceuticals pass through multiple handoffs—from
              local or importing manufacturers to national depots (such as KEMSA and MEDS) and
              regional hospital or retail pharmacies. When each stakeholder maintains an isolated
              database, falsified batch numbers and diverted shipments cannot be detected at the
              dispensing counter.
            </p>
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                System Scope
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                A permissioned blockchain drug tracking network where manufacturers, distributors,
                pharmacies, and the Pharmacy and Poisons Board (PPB) log every batch movement with
                Web Crypto ECDSA digital signatures, enabling instant consumer verification via
                mobile QR scan.
              </p>
            </div>
          </div>

          {/* Production Stack Mapping */}
          <div className="pt-4 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-500 mb-2.5">
              Production Architecture Mapped in Browser Simulation
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-[#001F54]">Hyperledger Fabric</div>
                <div className="text-slate-500 text-[11px] mt-0.5">ledger.ts & chaincode.ts</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-[#001F54]">Node.js SDK</div>
                <div className="text-slate-500 text-[11px] mt-0.5">crypto.ts (Web Crypto)</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-[#001F54]">CouchDB State</div>
                <div className="text-slate-500 text-[11px] mt-0.5">store.ts World State</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-[#001F54]">React SPA & PWA</div>
                <div className="text-slate-500 text-[11px] mt-0.5">Consumer Verifier</div>
              </div>
            </div>
          </div>
        </div>

        {/* Three Pain Points Mapped to Cryptographic Solutions */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div>
            <div className="text-xs font-semibold tracking-wider text-[#001F54] uppercase">
              02. Pain Point Mapping
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Three Supply Chain Vulnerabilities Solved by Smart Contracts
            </h2>
          </div>

          <div className="space-y-4">
            {/* Mapping 1 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#001F54] text-[#C9A227] flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="text-red-700">Counterfeit Drugs</span>
                  <ArrowRight className="w-4 h-4 text-[#C9A227]" />
                  <span className="text-[#001F54]">
                    Immutable, Cryptographically Signed Batch Tracking
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  Only licensed Manufacturer MSPs can invoke <code className="font-mono text-slate-800">registerBatch()</code>. Every custody transfer requires a valid ECDSA P-256 signature from the current holder, preventing counterfeit injection mid-stream.
                </p>
              </div>
            </div>

            {/* Mapping 2 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#001F54] text-[#C9A227] flex items-center justify-center shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="text-amber-700">Fragmented Data Silos</span>
                  <ArrowRight className="w-4 h-4 text-[#C9A227]" />
                  <span className="text-[#001F54]">
                    Shared Permissioned Ledger Among Authorized Stakeholders
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  Manufacturers (Dawa, Cosmos, Universal), Distributors (KEMSA, MEDS), Pharmacies
                  (KNH, Goodlife), and the Regulator (PPB) synchronize a single CouchDB World State
                  without surrendering control to a single commercial middleman.
                </p>
              </div>
            </div>

            {/* Mapping 3 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#001F54] text-[#C9A227] flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="text-red-700">Delayed Paper Recalls</span>
                  <ArrowRight className="w-4 h-4 text-[#C9A227]" />
                  <span className="text-[#001F54]">
                    Real-Time Smart Contract Alerts & Instant Lockout
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  When PPB invokes <code className="font-mono text-slate-800">recallBatch()</code>,
                  the smart contract locks the batch in World State, emits a real-time event banner
                  to every holding organization, and displays{' '}
                  <span className="font-semibold text-red-700">RECALLED, DO NOT USE</span> on any
                  consumer QR scan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE DEMO GUIDED SCENARIOS */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-semibold tracking-wider text-[#001F54] uppercase">
              03. Preloaded Kenyan Supply Chain Scenarios
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Test Every Smart Contract State Instantly
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('architecture')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#001F54] hover:underline cursor-pointer"
          >
            <Network className="w-4 h-4 text-[#C9A227]" />
            View Hyperledger Fabric Architecture Diagram →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Scenario 1: Authentic */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-emerald-700">AUTHENTIC</span>
                <span className="font-mono text-slate-500">KE-ACT-2026-001</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Coartem Antimalarial (Universal Corp → KEMSA → KNH)
              </h3>
              <p className="text-xs text-slate-600 font-normal">
                5,000 packs manufactured in Kikuyu, distributed via KEMSA Embakasi, received and
                partially dispensed (350 packs) at Kenyatta National Hospital.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('verify', 'KE-ACT-2026-001')}
              className="w-full py-2 px-3 rounded-lg bg-[#001F54] hover:bg-[#002b75] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Verify Authentic Batch
            </button>
          </div>

          {/* Scenario 2: Recalled */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-red-700">RECALLED</span>
                <span className="font-mono text-slate-500">KE-PCM-2026-999</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Cetamol Pediatric Syrup (PPB Class I Recall)
              </h3>
              <p className="text-xs text-slate-600 font-normal">
                Recalled by Pharmacy and Poisons Board after NQCL lab testing. Locked against
                transfers and dispensing; triggers real-time holder alerts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('verify', 'KE-PCM-2026-999')}
              className="w-full py-2 px-3 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Inspect Recalled Alert
            </button>
          </div>

          {/* Scenario 3: Expired */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-amber-700">EXPIRED</span>
                <span className="font-mono text-slate-500">KE-CIP-2024-089</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Ciproxin 500mg (Genuine Origin, Expired Shelf Life)
              </h3>
              <p className="text-xs text-slate-600 font-normal">
                Genuine Cosmos Ltd batch held at Goodlife Pharmacy whose 2025-08-15 expiry date has
                elapsed. Smart contract blocks dispensing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('verify', 'KE-CIP-2024-089')}
              className="w-full py-2 px-3 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Verify Expired Batch
            </button>
          </div>

          {/* Scenario 4: Counterfeit */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-red-700">COUNTERFEIT TEST</span>
                <span className="font-mono text-slate-500">FAKE-MOMBASA-404</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Unregistered / Cloned Packaging Serial
              </h3>
              <p className="text-xs text-slate-600 font-normal">
                Simulates a patient scanning a falsified box serial number that has no Manufacturer
                ECDSA genesis signature on the ledger.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('verify', 'FAKE-MOMBASA-404')}
              className="w-full py-2 px-3 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Simulate Counterfeit Scan
            </button>
          </div>
        </div>
      </section>

      {/* REGULATORY STANDARDS & SCIENTIFIC RESEARCH FRAMEWORK (ELEVATED PEER-REVIEWED SECTION) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#001F54] text-[#C9A227] tracking-wider uppercase">
                Consortium Governance
              </span>
              <span className="text-xs font-semibold text-slate-600">
                Standards & Peer-Reviewed Literature
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              Regulatory Standards & Scientific Research Foundation
            </h3>
            <p className="text-xs text-slate-500">
              PharmaChain translates peer-reviewed biomedical engineering and WHO Good Distribution
              Practices into mathematically enforced smart contracts.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowReferences(!showReferences)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              {showReferences ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Collapse References
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Inspect Research Papers & Standards
                </>
              )}
            </button>
          </div>
        </div>

        {showReferences && (
          <div className="space-y-4">
            {/* Interactive Tab Switcher */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setResearchTab('standards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  researchTab === 'standards'
                    ? 'bg-[#001F54] text-[#C9A227]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                1. Regulatory Mandates (PPB & WHO GDP)
              </button>
              <button
                type="button"
                onClick={() => setResearchTab('literature')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  researchTab === 'literature'
                    ? 'bg-[#001F54] text-[#C9A227]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                2. Peer-Reviewed Academic Literature
              </button>
              <button
                type="button"
                onClick={() => setResearchTab('crypto')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  researchTab === 'crypto'
                    ? 'bg-[#001F54] text-[#C9A227]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                3. Mathematical & Cryptographic Invariants
              </button>
            </div>

            {/* Tab 1: Standards */}
            {researchTab === 'standards' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    WHO Good Distribution Practices (GDP)
                  </div>
                  <p className="text-slate-600 leading-relaxed font-normal">
                    Requires continuous temperature logging for cold-chain biologicals and unbroken
                    chain-of-custody documentation across every wholesale transit waypoint.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-[#001F54]" />
                    Pharmacy and Poisons Board (PPB Kenya)
                  </div>
                  <p className="text-slate-600 leading-relaxed font-normal">
                    Enforces statutory Class I rapid recall authority under Cap 244 Laws of Kenya,
                    with direct integration into the National Pharmacovigilance Centre (NPVC).
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[#C9A227]" />
                    GS1 Healthcare Standard (ISO/IEC 15418)
                  </div>
                  <p className="text-slate-600 leading-relaxed font-normal">
                    Standardizes packaging identifiers: (01) GTIN, (17) Expiry Date, (10) Batch No,
                    and (21) Serial Number into 2D DataMatrix matrices and Web URIs.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Literature */}
            {researchTab === 'literature' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#001F54] flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#C9A227]" />
                      PubMed / Health Informatics Journal (2021)
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">Ref [12]</span>
                  </div>
                  <div className="font-semibold text-slate-900">
                    Uddin, M., Memon, M. S., et al. — “Blockchain for Drug Traceability: Architectures and Open Challenges”
                  </div>
                  <p className="text-slate-600 leading-relaxed font-normal">
                    Identified that permissioned consortia (Hyperledger Fabric) provide the optimal
                    balance between low transaction latency, zero gas fees for patients, and private
                    data collection capabilities for wholesale commercial pricing.
                  </p>
                  <div className="text-[11px] text-[#001F54] font-medium pt-1">
                    Mapped Implementation: Fabric Private Data Collections & Zero-Gas Verifier.
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#001F54] flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#C9A227]" />
                      IEEE Access / Khalifa University (2021)
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">Ref [16]</span>
                  </div>
                  <div className="font-semibold text-slate-900">
                    Musamih, A. et al. — “A Blockchain-Based Approach for Drug Traceability in Healthcare Supply Chain”
                  </div>
                  <p className="text-slate-600 leading-relaxed font-normal">
                    Demonstrated how smart contract access control models prevent non-holder custody
                    transfers, while IoT temperature oracles trigger automatic quarantine flags upon
                    cold-chain excursions.
                  </p>
                  <div className="text-[11px] text-[#001F54] font-medium pt-1">
                    Mapped Implementation: Chaincode Holder RBAC & ColdChainIotStream Oracles.
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Cryptography */}
            {researchTab === 'crypto' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">Web Crypto ECDSA P-256</div>
                  <p className="text-slate-600 font-normal">
                    Hardware-accelerated W3C SubtleCrypto API signs each transaction proposal.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">SHA-256 Merkle Rooting</div>
                  <p className="text-slate-600 font-normal">
                    O(log N) membership proofs verify inclusion without downloading the whole chain.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">MVCC Version Locks</div>
                  <p className="text-slate-600 font-normal">
                    Read-write set version checks abort stale concurrent double-spend attempts.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">Multi-Peer Endorsements</div>
                  <p className="text-slate-600 font-normal">
                    Transactions require signatures from both sender and recipient before orderer batching.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
