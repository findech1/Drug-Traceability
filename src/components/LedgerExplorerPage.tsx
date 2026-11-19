import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Bug,
  RotateCcw,
  Blocks,
  FileSignature,
  Hash,
  CheckCircle2,
  XCircle,
  Lock,
  GitBranch,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ChainValidationReport, computeTransactionHash } from '../ledger';
import {
  buildMerkleTree,
  generateMerkleProof,
  MerkleProof,
  verifyMerkleProof,
} from '../merkle';
import {
  PersistedLedgerStore,
  runChainValidation,
  runTamperSimulation,
} from '../store';

interface LedgerExplorerPageProps {
  store: PersistedLedgerStore;
  onResetDemo: () => Promise<void>;
}

export const LedgerExplorerPage: React.FC<LedgerExplorerPageProps> = ({
  store,
  onResetDemo,
}) => {
  const [validationReport, setValidationReport] = useState<ChainValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [tamperBanner, setTamperBanner] = useState<string | null>(null);
  const [selectedTamperBlockIdx, setSelectedTamperBlockIdx] = useState<number>(2);

  // Feature 1: Interactive Merkle Proof Inspector state
  const [selectedMerkleBlockIdx, setSelectedMerkleBlockIdx] = useState<number>(1);
  const [activeProof, setActiveProof] = useState<MerkleProof | null>(null);
  const [proofAuditResult, setProofAuditResult] = useState<{
    tested: boolean;
    valid: boolean;
    recomputedRoot?: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    runChainValidation().then((report) => {
      if (mounted) setValidationReport(report);
    });
    return () => {
      mounted = false;
    };
  }, [store.blocks]);

  const handleValidateChain = async () => {
    setIsValidating(true);
    try {
      const report = await runChainValidation();
      setValidationReport(report);
    } finally {
      setIsValidating(false);
    }
  };

  const handleTamperDemo = async () => {
    setIsValidating(true);
    try {
      const result = await runTamperSimulation(selectedTamperBlockIdx);
      setTamperBanner(result.description);
      setValidationReport(result.validationReport);
    } finally {
      setIsValidating(false);
    }
  };

  const handleRepairChain = async () => {
    setIsValidating(true);
    try {
      setTamperBanner(null);
      await onResetDemo();
      const report = await runChainValidation();
      setValidationReport(report);
    } finally {
      setIsValidating(false);
    }
  };

  // Inspect Merkle Proof for a selected Block's transaction
  const handleInspectMerkle = async (blockIndex: number, txIndex: number = 0) => {
    setSelectedMerkleBlockIdx(blockIndex);
    const block = store.blocks[blockIndex];
    if (!block || block.transactions.length === 0) return;

    const leafHashes: string[] = [];
    for (const tx of block.transactions) {
      leafHashes.push(await computeTransactionHash(tx));
    }
    const tree = await buildMerkleTree(leafHashes);
    const proof = generateMerkleProof(tree, txIndex, block.transactions[txIndex].txId);
    setActiveProof(proof);
    setProofAuditResult(null);
  };

  const handleVerifyCurrentProof = async () => {
    if (!activeProof) return;
    const res = await verifyMerkleProof(
      activeProof.leafHash,
      activeProof.proof,
      activeProof.merkleRoot
    );
    setProofAuditResult({
      tested: true,
      valid: res.isValid,
      recomputedRoot: res.recomputedRoot,
    });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER & VALIDATE / TAMPER CONTROLS */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-semibold tracking-wider text-[#001F54] uppercase">
              Hyperledger Fabric Channel Block & Merkle Tree Explorer
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
              Immutable Ledger Explorer & Cryptographic Verification
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Inspect every ordered block, SHA-256 Merkle root, and multi-peer ECDSA endorsements.
              Use <strong>Tamper Demo</strong> to alter an old block and watch validation fail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleValidateChain}
              disabled={isValidating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#001F54] hover:bg-[#002b75] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#C9A227]" />
              {isValidating ? 'Verifying Merkle Roots & Signatures...' : 'Validate Chain'}
            </button>

            <div className="flex items-center rounded-lg border border-red-300 bg-red-50 p-0.5">
              <select
                aria-label="Select Block to Tamper"
                value={selectedTamperBlockIdx}
                onChange={(e) => setSelectedTamperBlockIdx(Number(e.target.value))}
                className="px-2 py-2 text-xs font-mono text-red-900 bg-transparent focus:outline-none"
              >
                {store.blocks.slice(1).map((b) => (
                  <option key={b.index} value={b.index}>
                    Block #{b.index} ({b.transactions[0]?.batchNo})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleTamperDemo}
                disabled={isValidating}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Bug className="w-3.5 h-3.5" />
                Tamper Demo
              </button>
            </div>

            {validationReport && !validationReport.isValid && (
              <button
                type="button"
                onClick={handleRepairChain}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Untampered Ledger
              </button>
            )}
          </div>
        </div>

        {/* VALIDATION STATUS SUMMARY BANNER */}
        {validationReport && (
          <div
            aria-live="polite"
            className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              validationReport.isValid
                ? 'bg-emerald-950 text-white border-emerald-700'
                : 'bg-red-950 text-white border-red-700'
            }`}
          >
            <div className="flex items-start gap-3.5">
              {validationReport.isValid ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-7 h-7 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-bold">
                  {validationReport.isValid
                    ? `CRYPTOGRAPHIC INTEGRITY VERIFIED — ALL ${validationReport.totalBlocks} BLOCKS, MERKLE ROOTS & ECDSA SIGNATURES VALID`
                    : `CRITICAL TAMPER ALERT — LEDGER INTEGRITY COMPROMISED AT BLOCK(S): ${validationReport.tamperedBlockIndices
                        .map((i) => `#${i}`)
                        .join(', ')}`}
                </div>
                <p className="text-xs opacity-90">
                  {validationReport.isValid
                    ? 'Every block Merkle Root and SHA-256 header matches, hash chain linkage is unbroken, and multi-peer endorsements are mathematically valid.'
                    : tamperBanner ||
                      'An unauthorized mutation was detected: block payload or Merkle root does not match recorded cryptographic state.'}
                </p>
              </div>
            </div>

            <div className="text-xs font-mono shrink-0 bg-black/25 px-3.5 py-2 rounded-lg border border-white/10">
              <div>Audited Blocks: {validationReport.totalBlocks}</div>
              <div>ECDSA Checks: {validationReport.totalTransactions}</div>
              <div>
                Status:{' '}
                <strong className={validationReport.isValid ? 'text-emerald-400' : 'text-red-400'}>
                  {validationReport.isValid ? 'IMMUTABLE / VALID' : 'TAMPERED / INVALID'}
                </strong>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Feature 1: Interactive Merkle Proof Inspector */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#001F54] text-[#C9A227] flex items-center justify-center shrink-0">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Interactive Merkle Proof Inspector (Lightweight SPV Verification)
              </h2>
              <p className="text-xs text-slate-500">
                Verify mathematically that a specific transaction belongs to an immutable block
                using an O(log N) cryptographic proof path without parsing the entire chain.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-medium">Select Block:</span>
            <select
              value={selectedMerkleBlockIdx}
              onChange={(e) => handleInspectMerkle(Number(e.target.value), 0)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
            >
              {store.blocks.map((b) => (
                <option key={b.index} value={b.index}>
                  Block #{b.index} ({b.transactions[0]?.batchNo || 'Genesis'})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleInspectMerkle(selectedMerkleBlockIdx, 0)}
              className="px-3 py-1.5 rounded-lg bg-[#001F54] hover:bg-[#002b75] text-white text-xs font-semibold cursor-pointer"
            >
              Generate Proof
            </button>
          </div>
        </div>

        {activeProof ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500">Transaction Leaf Hash [H(Tx)]:</span>
                <div className="text-[#001F54] font-semibold break-all text-[11px]">
                  {activeProof.leafHash}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500">Block Merkle Root:</span>
                <div className="text-emerald-800 font-semibold break-all text-[11px]">
                  {activeProof.merkleRoot}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">
                  Cryptographic Audit Path ({activeProof.proof.length} Hash Steps):
                </span>
                <button
                  type="button"
                  onClick={handleVerifyCurrentProof}
                  className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Verify Merkle Proof Now
                </button>
              </div>

              {activeProof.proof.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Single-leaf root. Leaf hash matches block Merkle root directly.
                </p>
              ) : (
                <div className="space-y-1.5 font-mono text-[11px]">
                  {activeProof.proof.map((p, i) => (
                    <div
                      key={i}
                      className="p-2 rounded bg-white border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <span className="text-slate-500">
                        Step #{i + 1} ({p.position.toUpperCase()} Sibling):
                      </span>
                      <span className="text-slate-800 break-all">{p.hash}</span>
                    </div>
                  ))}
                </div>
              )}

              {proofAuditResult && (
                <div
                  className={`mt-3 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                    proofAuditResult.valid
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-red-100 text-red-900 border border-red-300'
                  }`}
                >
                  {proofAuditResult.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span>
                    {proofAuditResult.valid
                      ? `PROOF VALIDATED: Hashes match the on-chain Merkle Root (${activeProof.merkleRoot.slice(0, 16)}...)`
                      : 'PROOF FAILED: Computed hash does not match Merkle Root'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Click "Generate Proof" above or select any block below to generate an interactive
            Merkle audit path.
          </p>
        )}
      </section>

      {/* BLOCKCHAIN LIST */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Blocks className="w-4 h-4 text-[#001F54]" />
            Ordered Channel Blocks (#0 Genesis → #{store.blocks.length - 1} Latest)
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            Consensus: Raft · Hash: SHA-256 · Merkle Root Verified
          </span>
        </div>

        <div className="space-y-4">
          {store.blocks.map((block) => {
            const blockAudit = validationReport?.blockResults[block.index];
            const isBlockValid = blockAudit ? blockAudit.isValid : true;

            return (
              <div
                key={block.index}
                className={`rounded-xl border transition-colors overflow-hidden ${
                  isBlockValid
                    ? 'bg-white border-slate-200'
                    : 'bg-red-50/90 border-red-500 ring-2 ring-red-500/30'
                }`}
              >
                {/* Block Header Bar */}
                <div
                  className={`px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b ${
                    isBlockValid
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-red-900 text-white border-red-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                        isBlockValid ? 'bg-[#001F54] text-[#C9A227]' : 'bg-red-500 text-white'
                      }`}
                    >
                      BLOCK #{block.index}
                    </span>
                    <span className="text-xs font-semibold">
                      Endorsed & Committed by: {block.creatingOrgName} ({block.creatingOrgMsp})
                    </span>
                    <span className="text-xs opacity-75 font-mono">
                      · {new Date(block.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono font-semibold">
                    <button
                      type="button"
                      onClick={() => handleInspectMerkle(block.index, 0)}
                      className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-200/60 text-slate-700 text-[11px] cursor-pointer"
                    >
                      Inspect Merkle
                    </button>
                    {isBlockValid ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-200">
                        <XCircle className="w-4 h-4 text-red-300" />
                        TAMPERED
                      </span>
                    )}
                  </div>
                </div>

                {/* Tamper Failure Explanations */}
                {!isBlockValid && blockAudit && (
                  <div className="px-5 py-3 bg-red-100 border-b border-red-300 text-red-900 text-xs space-y-1">
                    <div className="font-bold">
                      Cryptographic Verification Failures on Block #{block.index}:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {blockAudit.failureReasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Hashes & Transactions Body */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        PREVIOUS HASH
                      </div>
                      <div className="text-slate-700 break-all text-[11px]">
                        {block.previousHash}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <GitBranch className="w-3.5 h-3.5 text-[#001F54]" />
                        BLOCK MERKLE ROOT
                      </div>
                      <div className="text-slate-900 break-all text-[11px] font-semibold">
                        {block.merkleRoot}
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-lg border space-y-1 ${
                        isBlockValid
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-red-100/70 border-red-300'
                      }`}
                    >
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-[#001F54]" />
                        CURRENT BLOCK SHA-256 HASH
                      </div>
                      <div
                        className={`break-all text-[11px] font-semibold ${
                          isBlockValid ? 'text-[#001F54]' : 'text-red-800'
                        }`}
                      >
                        {block.hash}
                      </div>
                    </div>
                  </div>

                  {/* Transactions inside Block */}
                  <div className="space-y-3">
                    {block.transactions.map((tx) => {
                      const txAudit = blockAudit?.txResults.find((r) => r.txId === tx.txId);
                      const sigValid = txAudit ? txAudit.signatureValid : true;
                      const endorsementsValid = txAudit ? txAudit.endorsementsValid : true;

                      return (
                        <div
                          key={tx.txId}
                          className={`p-4 rounded-lg border text-xs space-y-2.5 ${
                            sigValid && endorsementsValid
                              ? 'bg-white border-slate-200'
                              : 'bg-red-100/90 border-red-400'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#001F54]">
                                fn: {tx.fn}()
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="font-mono font-semibold text-slate-800">
                                Batch: {tx.batchNo}
                              </span>
                            </div>
                            <span className="font-mono text-[11px] text-slate-500">
                              TxID: {tx.txId}
                            </span>
                          </div>

                          <p className="text-slate-800 font-medium">{tx.summary}</p>

                          {/* Feature 3: Read-Write Set View */}
                          {tx.rwSet && (
                            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-600 flex flex-wrap gap-4">
                              <span>
                                <strong>RWSet Reads:</strong>{' '}
                                {tx.rwSet.reads.length > 0
                                  ? tx.rwSet.reads.map((r) => `${r.key}@v${r.version}`).join(', ')
                                  : 'None (Insert)'}
                              </span>
                              <span>
                                <strong>Writes:</strong>{' '}
                                {tx.rwSet.writes.map((w) => w.key).join(', ')}
                              </span>
                            </div>
                          )}

                          {/* Feature 2: Multi-Peer Endorsement Policy & Signatures */}
                          <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                            <div className="font-semibold text-slate-800">
                              Endorsement Policy: {tx.endorsementPolicy || 'Single-Peer'}
                            </div>
                            <div className="text-slate-600">
                              Primary Signer: {tx.creatorMspId} (Fingerprint:{' '}
                              {tx.signerPublicKeyFingerprint})
                            </div>
                            {tx.endorsements && tx.endorsements.length > 0 && (
                              <div className="text-emerald-800">
                                Endorsing Peers Verified:{' '}
                                {tx.endorsements.map((e) => e.endorserMspId).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
