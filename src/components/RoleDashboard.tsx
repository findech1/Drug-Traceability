import React, { useState, useMemo } from 'react';
import {
  Building2,
  KeyRound,
  PackagePlus,
  Send,
  PackageCheck,
  Pill,
  AlertOctagon,
  Flag,
  QrCode,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRightLeft,
  Layers,
  Thermometer,
} from 'lucide-react';
import { BatchWorldState, isBatchExpired } from '../chaincode';
import { OrganizationMSP, OrgRole } from '../ledger';
import {
  executeDispenseUnits,
  executeFlagBatch,
  executeRecallBatch,
  executeReceiveBatch,
  executeRegisterBatch,
  executeTransferBatch,
  PersistedLedgerStore,
} from '../store';
import {
  loadPharmacovigilanceReports,
  PharmacovigilanceReport,
} from '../pharmacovigilance';
import {
  FABRIC_CHANNELS,
  isBatchOnChannel,
  isOrgAuthorizedForChannel,
} from '../channels';

interface RoleDashboardProps {
  store: PersistedLedgerStore;
  activeOrgId: string;
  activeChannelId?: string;
  onSelectOrg: (orgId: string) => void;
  onSelectChannel?: (channelId: string) => void;
  onOpenQrModal: (batch: BatchWorldState) => void;
  onInspectInVerifier: (batchNo: string) => void;
}

const KENYAN_DRUG_PRESETS = [
  {
    batchNo: 'KE-ALU-2026-108',
    drugName: 'Coartem Dispersible (Artemether 20mg / Lumefantrine 120mg)',
    activeIngredient: 'Artemether 20mg + Lumefantrine 120mg',
    dosageForm: 'Dispersible Tablets (24s Blister)',
    storageTemp: 'Store below 30°C',
    manufactureDate: '2026-03-10',
    expiryDate: '2029-03-10',
    quantity: 4000,
  },
  {
    batchNo: 'KE-LOS-2026-214',
    drugName: 'Cozaar (Losartan Potassium 50mg Tablets)',
    activeIngredient: 'Losartan Potassium USP 50mg',
    dosageForm: 'Film-Coated Tablets (30s Pack)',
    storageTemp: 'Store below 25°C',
    manufactureDate: '2026-03-12',
    expiryDate: '2029-03-12',
    quantity: 2500,
  },
  {
    batchNo: 'KE-ORS-2026-309',
    drugName: 'WHO Low-Osmolarity ORS + Zinc Sulfate Pediatric Co-Pack',
    activeIngredient: 'Oral Rehydration Salts + Zinc 20mg',
    dosageForm: 'Sachets + 10 Dispersible Tablets',
    storageTemp: 'Store in a cool dry place below 25°C',
    manufactureDate: '2026-03-14',
    expiryDate: '2028-09-14',
    quantity: 6000,
  },
];

export const RoleDashboard: React.FC<RoleDashboardProps> = ({
  store,
  activeOrgId,
  activeChannelId = 'pharma-ke-channel',
  onSelectOrg,
  onSelectChannel,
  onOpenQrModal,
  onInspectInVerifier,
}) => {
  const organizations = Object.values(store.organizations);
  const activeOrg: OrganizationMSP =
    store.organizations[activeOrgId] || organizations[0];
  const [pvReports, setPvReports] = useState<PharmacovigilanceReport[]>(loadPharmacovigilanceReports);

  const allBatches = useMemo(
    () =>
      Object.values(store.worldState).sort((a, b) =>
        b.lastUpdated.localeCompare(a.lastUpdated)
      ),
    [store.worldState]
  );

  // Batches currently held by activeOrg (and not in transit to someone else, or in transit from them)
  const heldBatches = useMemo(
    () => allBatches.filter((b) => b.currentHolderOrgId === activeOrg.id),
    [allBatches, activeOrg.id]
  );

  // Transferable batches (held by activeOrg, not IN_TRANSIT, not RECALLED, quantity > 0)
  const transferableBatches = useMemo(
    () =>
      heldBatches.filter(
        (b) =>
          b.status !== 'RECALLED' &&
          b.status !== 'IN_TRANSIT' &&
          !b.pendingRecipientOrgId &&
          b.currentQuantity > 0
      ),
    [heldBatches]
  );

  // Incoming batches consigned to activeOrg
  const incomingBatches = useMemo(
    () => allBatches.filter((b) => b.pendingRecipientOrgId === activeOrg.id),
    [allBatches, activeOrg.id]
  );

  // Recalled batches that affect this organization (either current holder, pending recipient, or in custody history)
  const recalledBatchesForOrg = useMemo(() => {
    return allBatches.filter((b) => {
      if (b.status !== 'RECALLED') return false;
      if (activeOrg.role === 'Regulator') return true;
      if (b.currentHolderOrgId === activeOrg.id) return true;
      if (b.pendingRecipientOrgId === activeOrg.id) return true;
      if (b.manufacturerOrgId === activeOrg.id) return true;
      return b.custodyHistory.some(
        (ev) => ev.actorOrgId === activeOrg.id || ev.toOrgId === activeOrg.id
      );
    });
  }, [allBatches, activeOrg]);

  // Feedback banner state
  const [txFeedback, setTxFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register Batch Form State (Manufacturer)
  const [regBatchNo, setRegBatchNo] = useState('KE-ALU-2026-108');
  const [regDrugName, setRegDrugName] = useState(
    'Coartem Dispersible (Artemether 20mg / Lumefantrine 120mg)'
  );
  const [regIngredient, setRegIngredient] = useState(
    'Artemether 20mg + Lumefantrine 120mg'
  );
  const [regDosage, setRegDosage] = useState('Dispersible Tablets (24s Blister)');
  const [regTemp, setRegTemp] = useState('Store below 30°C');
  const [regMfgDate, setRegMfgDate] = useState('2026-03-10');
  const [regExpDate, setRegExpDate] = useState('2029-03-10');
  const [regQuantity, setRegQuantity] = useState('4000');

  // Transfer Batch Form State
  const [transferBatchNo, setTransferBatchNo] = useState('');
  const [transferTargetOrgId, setTransferTargetOrgId] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Receive Batch Notes
  const [receiveNotesByBatch, setReceiveNotesByBatch] = useState<Record<string, string>>({});

  // Dispense Units Form State (Pharmacy)
  const [dispenseBatchNo, setDispenseBatchNo] = useState('');
  const [dispenseQty, setDispenseQty] = useState('25');
  const [dispensePatientRef, setDispensePatientRef] = useState(
    'Outpatient prescription verified via NHIF/SHIF smart card'
  );

  // Regulator Forms State (Flag / Recall)
  const [regActionType, setRegActionType] = useState<'recall' | 'flag'>('recall');
  const [regTargetBatchNo, setRegTargetBatchNo] = useState('');
  const [regReason, setRegReason] = useState(
    'Class I Statutory Recall (PPB Rapid Alert): Failed dissolution & impurity threshold in NQCL post-market sampling.'
  );

  // Table Search & Expandable Row State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'mine' | 'all'>('mine');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'transit' | 'recalled' | 'expired'>('all');
  const [expandedBatchNo, setExpandedBatchNo] = useState<string | null>(null);

  // Keep default selections valid when switching organizations
  const effectiveTransferBatchNo =
    transferBatchNo && transferableBatches.some((b) => b.batchNo === transferBatchNo)
      ? transferBatchNo
      : transferableBatches[0]?.batchNo || '';

  const selectedTransferBatch = transferableBatches.find(
    (b) => b.batchNo === effectiveTransferBatchNo
  );

  const recipientOrganizations = useMemo(() => {
    return organizations.filter(
      (o) => o.id !== activeOrg.id && o.role !== 'Regulator'
    );
  }, [organizations, activeOrg.id]);

  const effectiveTargetOrgId =
    transferTargetOrgId && recipientOrganizations.some((o) => o.id === transferTargetOrgId)
      ? transferTargetOrgId
      : recipientOrganizations.find((o) =>
          activeOrg.role === 'Manufacturer'
            ? o.role === 'Distributor'
            : o.role === 'Pharmacy'
        )?.id ||
        recipientOrganizations[0]?.id ||
        '';

  const dispensableBatches = useMemo(
    () =>
      heldBatches.filter(
        (b) =>
          !b.pendingRecipientOrgId &&
          b.currentQuantity > 0
      ),
    [heldBatches]
  );

  const effectiveDispenseBatchNo =
    dispenseBatchNo && dispensableBatches.some((b) => b.batchNo === dispenseBatchNo)
      ? dispenseBatchNo
      : dispensableBatches[0]?.batchNo || '';

  const regulatorSelectableBatches = useMemo(
    () => allBatches.filter((b) => b.status !== 'RECALLED'),
    [allBatches]
  );

  const effectiveRegTargetBatchNo =
    regTargetBatchNo && regulatorSelectableBatches.some((b) => b.batchNo === regTargetBatchNo)
      ? regTargetBatchNo
      : regulatorSelectableBatches[0]?.batchNo || '';

  const handleApplyPreset = (index: number) => {
    const preset = KENYAN_DRUG_PRESETS[index % KENYAN_DRUG_PRESETS.length];
    const randomSuffix = Math.floor(100 + Math.random() * 899);
    const prefix = preset.batchNo.split('-').slice(0, 3).join('-');
    setRegBatchNo(`${prefix}-${randomSuffix}`);
    setRegDrugName(preset.drugName);
    setRegIngredient(preset.activeIngredient);
    setRegDosage(preset.dosageForm);
    setRegTemp(preset.storageTemp);
    setRegMfgDate(preset.manufactureDate);
    setRegExpDate(preset.expiryDate);
    setRegQuantity(String(preset.quantity));
  };

  const handleRegisterBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxFeedback(null);
    setIsSubmitting(true);
    try {
      const qtyNum = parseInt(regQuantity, 10);
      const created = await executeRegisterBatch({
        actorOrgId: activeOrg.id,
        batchNo: regBatchNo,
        drugName: regDrugName,
        activeIngredient: regIngredient,
        dosageForm: regDosage,
        storageTemp: regTemp,
        manufactureDate: regMfgDate,
        expiryDate: regExpDate,
        quantity: qtyNum,
      });
      setTxFeedback({
        type: 'success',
        message: `Block committed! Registered batch ${created.batchNo} (${created.drugName}) signed with ${activeOrg.mspId}'s ECDSA P-256 private key.`,
      });
      // Advance batch number slightly for convenience
      const nextSuffix = Math.floor(100 + Math.random() * 899);
      setRegBatchNo(`KE-DRG-2026-${nextSuffix}`);
    } catch (err) {
      setTxFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTransferBatchNo) return;
    setTxFeedback(null);
    setIsSubmitting(true);
    try {
      const batch = store.worldState[effectiveTransferBatchNo];
      const qtyToUse = transferQty ? parseInt(transferQty, 10) : batch.currentQuantity;
      const updated = await executeTransferBatch({
        actorOrgId: activeOrg.id,
        targetOrgId: effectiveTargetOrgId,
        batchNo: effectiveTransferBatchNo,
        quantity: qtyToUse,
        transportNotes: transferNotes,
        expectedVersion: batch.version,
      });
      setTxFeedback({
        type: 'success',
        message: `Block committed! Multi-peer endorsed by AND('${activeOrg.mspId}.peer', '${updated.pendingRecipientName}') and sealed in block. Status is now IN_TRANSIT (v${updated.version}).`,
      });
      setTransferNotes('');
      setTransferQty('');
    } catch (err) {
      setTxFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Feature 3: MVCC Conflict / Double-Spend Simulation
  const handleSimulateMvccDoubleSpend = async () => {
    if (!effectiveTransferBatchNo) return;
    setTxFeedback(null);
    setIsSubmitting(true);
    try {
      const batch = store.worldState[effectiveTransferBatchNo];
      // Intentionally pass an outdated version (v - 1) to simulate concurrent conflicting execution
      const staleVersion = Math.max(0, batch.version - 1);
      await executeTransferBatch({
        actorOrgId: activeOrg.id,
        targetOrgId: effectiveTargetOrgId,
        batchNo: effectiveTransferBatchNo,
        quantity: Math.min(100, batch.currentQuantity),
        transportNotes: 'Simulated concurrent race condition attack',
        expectedVersion: staleVersion,
      });
    } catch (err) {
      setTxFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiveBatch = async (batchNo: string) => {
    setTxFeedback(null);
    setIsSubmitting(true);
    try {
      const updated = await executeReceiveBatch({
        actorOrgId: activeOrg.id,
        batchNo,
        conditionNotes: receiveNotesByBatch[batchNo],
      });
      setTxFeedback({
        type: 'success',
        message: `Block committed! Confirmed physical receipt of batch ${updated.batchNo} (${updated.currentQuantity.toLocaleString()} units) by ${activeOrg.name}.`,
      });
    } catch (err) {
      setTxFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveDispenseBatchNo) return;
    setTxFeedback(null);
    setIsSubmitting(true);
    try {
      const qtyNum = parseInt(dispenseQty, 10);
      const updated = await executeDispenseUnits({
        actorOrgId: activeOrg.id,
        batchNo: effectiveDispenseBatchNo,
        qty: qtyNum,
        patientRef: dispensePatientRef,
      });
      setTxFeedback({
        type: 'success',
        message: `Block committed! Dispensed ${qtyNum.toLocaleString()} units of ${updated.batchNo}. Remaining verified stock: ${updated.currentQuantity.toLocaleString()} units.`,
      });
    } catch (err) {
      setTxFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegulatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveRegTargetBatchNo) return;
    setTxFeedback(null);
    setIsSubmitting(true);
    try {
      if (regActionType === 'recall') {
        const { updatedBatch } = await executeRecallBatch({
          actorOrgId: activeOrg.id,
          batchNo: effectiveRegTargetBatchNo,
          reason: regReason,
        });
        setTxFeedback({
          type: 'success',
          message: `EMERGENCY RECALL COMMITTED ON BLOCKCHAIN: Batch ${updatedBatch.batchNo} is now locked across all peers and real-time recall alerts have been broadcast to ${updatedBatch.currentHolderName}!`,
        });
      } else {
        const updatedBatch = await executeFlagBatch({
          actorOrgId: activeOrg.id,
          batchNo: effectiveRegTargetBatchNo,
          reason: regReason,
        });
        setTxFeedback({
          type: 'success',
          message: `Regulatory Flag recorded on ledger for batch ${updatedBatch.batchNo}.`,
        });
      }
    } catch (err) {
      setTxFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedBatches = useMemo(() => {
    return allBatches.filter((batch) => {
      const matchesChannel = isBatchOnChannel(batch.batchNo, activeChannelId);
      if (!matchesChannel) return false;

      const matchesRole =
        activeOrg.role === 'Regulator' || roleFilter === 'all'
          ? true
          : batch.currentHolderOrgId === activeOrg.id ||
            batch.pendingRecipientOrgId === activeOrg.id ||
            batch.manufacturerOrgId === activeOrg.id;

      if (!matchesRole) return false;

      const expired = isBatchExpired(batch.expiryDate);
      if (statusFilter === 'active' && (batch.status === 'RECALLED' || expired || batch.status === 'IN_TRANSIT')) return false;
      if (statusFilter === 'transit' && batch.status !== 'IN_TRANSIT') return false;
      if (statusFilter === 'recalled' && batch.status !== 'RECALLED') return false;
      if (statusFilter === 'expired' && !expired) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        batch.batchNo.toLowerCase().includes(q) ||
        batch.drugName.toLowerCase().includes(q) ||
        batch.currentHolderName.toLowerCase().includes(q) ||
        batch.manufacturerName.toLowerCase().includes(q)
      );
    });
  }, [allBatches, activeOrg, roleFilter, activeChannelId, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const base = allBatches.filter((batch) => {
      if (!isBatchOnChannel(batch.batchNo, activeChannelId)) return false;
      if (activeOrg.role === 'Regulator' || roleFilter === 'all') return true;
      return (
        batch.currentHolderOrgId === activeOrg.id ||
        batch.pendingRecipientOrgId === activeOrg.id ||
        batch.manufacturerOrgId === activeOrg.id
      );
    });
    return {
      all: base.length,
      active: base.filter((b) => b.status !== 'RECALLED' && !isBatchExpired(b.expiryDate) && b.status !== 'IN_TRANSIT').length,
      transit: base.filter((b) => b.status === 'IN_TRANSIT').length,
      recalled: base.filter((b) => b.status === 'RECALLED').length,
      expired: base.filter((b) => isBatchExpired(b.expiryDate)).length,
    };
  }, [allBatches, activeChannelId, activeOrg, roleFilter]);

  const roleGroups: OrgRole[] = ['Manufacturer', 'Distributor', 'Pharmacy', 'Regulator'];

  return (
    <div className="space-y-8 pb-12">
      {/* 1. PERMISSIONED ORGANIZATION / ROLE SWITCHER */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-semibold tracking-wider text-[#001F54] uppercase">
              Hyperledger Fabric MSP Identity Switcher
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
              Stakeholder Role Console & Smart Contract Execution
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Switch between Kenyan permissioned organizations below. Every transaction is signed
              in-browser using that organization’s unique Web Crypto ECDSA P-256 private key.
            </p>
          </div>

          {/* Active MSP Cryptographic Identity Box */}
          <div className="bg-[#001F54] text-white rounded-xl px-4 py-3 flex items-center gap-3.5 shrink-0">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-[#C9A227] shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{activeOrg.name}</span>
                <span className="text-[#C9A227] font-mono">({activeOrg.role})</span>
              </div>
              <div className="text-slate-300 font-mono text-[11px]">
                MSP: {activeOrg.mspId} · {activeOrg.keys.publicKeyFingerprint}
              </div>
              <div className="text-slate-400 text-[11px]">
                {activeOrg.location} · License: {activeOrg.licenseNo}
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Organization Selector Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roleGroups.map((roleName) => {
            const orgsInRole = organizations.filter((o) => o.role === roleName);
            return (
              <div
                key={roleName}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{roleName} Peers</span>
                  <span className="font-mono text-slate-400">{orgsInRole.length}</span>
                </div>
                <div className="space-y-1.5">
                  {orgsInRole.map((org) => {
                    const isSelected = org.id === activeOrg.id;
                    const incomingCount = allBatches.filter(
                      (b) => b.pendingRecipientOrgId === org.id
                    ).length;
                    const heldRecallCount = allBatches.filter(
                      (b) => b.currentHolderOrgId === org.id && b.status === 'RECALLED'
                    ).length;

                    return (
                      <button
                        key={org.id}
                        onClick={() => {
                          onSelectOrg(org.id);
                          setTxFeedback(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#001F54] text-white font-semibold shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                        }`}
                      >
                        <div className="truncate">
                          <div className="truncate">{org.name}</div>
                          <div
                            className={`text-[10px] font-mono truncate ${
                              isSelected ? 'text-[#C9A227]' : 'text-slate-400'
                            }`}
                          >
                            {org.mspId}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                          {heldRecallCount > 0 && (
                            <span
                              title="Holds Recalled Batch"
                              className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold"
                            >
                              !
                            </span>
                          )}
                          {incomingCount > 0 && (
                            <span
                              title="Incoming Shipment Pending Receipt"
                              className="px-1.5 py-0.5 rounded bg-[#C9A227] text-[#001F54] font-bold"
                            >
                              +{incomingCount}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. REAL-TIME RECALL ALERT BANNER FOR HOLDERS OF RECALLED BATCHES */}
      {recalledBatchesForOrg.length > 0 && (
        <section
          aria-live="polite"
          className="bg-red-950 text-white border border-red-800 rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <AlertOctagon className="w-6 h-6 text-red-400 shrink-0" />
              <div>
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-white">
                  STATUTORY SMART CONTRACT RECALL ALERT — IMMEDIATE QUARANTINE REQUIRED
                </h2>
                <p className="text-xs text-red-200">
                  Real-time chaincode event received from Pharmacy and Poisons Board (PPB Kenya) for{' '}
                  {activeOrg.name}:
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-red-300 shrink-0 hidden sm:inline">
              Event: BatchRecalled
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {recalledBatchesForOrg.map((rb) => (
              <div
                key={rb.batchNo}
                className="bg-red-900/50 border border-red-700/80 rounded-lg p-3.5 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-red-200">{rb.batchNo}</span>
                    <span className="text-[11px] text-red-200">
                      Current Holder: <strong>{rb.currentHolderName}</strong>
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white">{rb.drugName}</div>
                  <p className="text-xs text-red-100 leading-relaxed">{rb.recalledReason}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-red-800/70 text-xs">
                  <span className="font-mono text-[11px] text-red-200">
                    Locked Qty: {rb.currentQuantity.toLocaleString()} units
                  </span>
                  <button
                    onClick={() => onInspectInVerifier(rb.batchNo)}
                    className="font-semibold text-[#C9A227] hover:underline cursor-pointer"
                  >
                    View Recall Notice & Custody →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TRANSACTION EXECUTION FEEDBACK BANNER */}
      {txFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs sm:text-sm ${
            txFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {txFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">
                {txFeedback.type === 'success'
                  ? 'Smart Contract Transaction Endorsed & Sealed in Block'
                  : 'Smart Contract Policy / Validation Rejection'}
              </div>
              <div className="mt-0.5">{txFeedback.message}</div>
            </div>
          </div>
          <button
            onClick={() => setTxFeedback(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. ROLE-SPECIFIC SMART CONTRACT ACTION FORMS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Primary Role Action */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {activeOrg.role === 'Manufacturer' && (
            <>
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#001F54] text-[#C9A227] flex items-center justify-center">
                    <PackagePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      1. Register New Drug Batch
                    </h2>
                    <p className="text-xs text-slate-500 font-mono">
                      chaincode.registerBatch() · Manufacturer Only
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {KENYAN_DRUG_PRESETS.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(idx)}
                      className="px-2.5 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
                    >
                      Preset #{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleRegisterBatchSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Batch Number (Unique Key)
                    </label>
                    <input
                      type="text"
                      required
                      value={regBatchNo}
                      onChange={(e) => setRegBatchNo(e.target.value)}
                      placeholder="e.g. KE-ALU-2026-108"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-[#001F54]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Batch Quantity (Units/Packs)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={regQuantity}
                      onChange={(e) => setRegQuantity(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-[#001F54]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pharmaceutical Product Name & Strength
                  </label>
                  <input
                    type="text"
                    required
                    value={regDrugName}
                    onChange={(e) => setRegDrugName(e.target.value)}
                    placeholder="e.g. Coartem (Artemether 20mg / Lumefantrine 120mg)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#001F54]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Active Ingredient (INN)
                    </label>
                    <input
                      type="text"
                      value={regIngredient}
                      onChange={(e) => setRegIngredient(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#001F54]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dosage Form & Pack Size
                    </label>
                    <input
                      type="text"
                      value={regDosage}
                      onChange={(e) => setRegDosage(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#001F54]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Manufacture Date
                    </label>
                    <input
                      type="date"
                      required
                      value={regMfgDate}
                      onChange={(e) => setRegMfgDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-[#001F54]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      required
                      value={regExpDate}
                      onChange={(e) => setRegExpDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-[#001F54]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#001F54] hover:bg-[#002b75] disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#C9A227]" />
                  {isSubmitting
                    ? 'Signing with ECDSA P-256 & Committing Block...'
                    : `Sign & Register Batch as ${activeOrg.name}`}
                </button>
              </form>
            </>
          )}

          {(activeOrg.role === 'Distributor' || activeOrg.role === 'Pharmacy') && (
            <>
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#001F54] text-[#C9A227] flex items-center justify-center">
                    <PackageCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      1. Incoming Shipments Queue (Receive Custody)
                    </h2>
                    <p className="text-xs text-slate-500 font-mono">
                      chaincode.receiveBatch() · Designated Recipient Only
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold text-[#001F54]">
                  {incomingBatches.length} Pending
                </span>
              </div>

              {incomingBatches.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <Clock className="w-6 h-6 text-slate-400 mx-auto" />
                  <div className="text-xs font-semibold text-slate-700">
                    No Incoming Shipments Pending Receipt for {activeOrg.name}
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Tip: Switch to <strong>Goodlife Pharmacy — Westlands</strong> to receive preloaded
                    in-transit batch <span className="font-mono font-semibold">KE-MET-2026-003</span>, or
                    switch to a Manufacturer/Distributor to dispatch a new shipment here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incomingBatches.map((batch) => (
                    <div
                      key={batch.batchNo}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-mono font-bold text-[#001F54]">
                            {batch.batchNo}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">{batch.drugName}</h3>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Dispatched From: <strong>{batch.currentHolderName}</strong> · Qty:{' '}
                            <span className="font-mono font-semibold">
                              {batch.inTransitQuantity.toLocaleString()} units
                            </span>
                          </p>
                        </div>
                        <span className="text-xs font-mono text-amber-700 font-semibold">
                          IN_TRANSIT
                        </span>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={receiveNotesByBatch[batch.batchNo] || ''}
                          onChange={(e) =>
                            setReceiveNotesByBatch((prev) => ({
                              ...prev,
                              [batch.batchNo]: e.target.value,
                            }))
                          }
                          placeholder="Optional receiving QA & tamper-seal inspection note..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:border-[#001F54]"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleReceiveBatch(batch.batchNo)}
                        className="w-full py-2 px-4 rounded-lg bg-[#001F54] hover:bg-[#002b75] text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Confirm Physical Receipt & Sign Custody Block ({batch.batchNo})
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeOrg.role === 'Regulator' && (
            <>
              {/* PPB Pharmacovigilance Rapid Response Queue */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        PPB Pharmacovigilance & Incident Triage Queue
                      </h3>
                      <p className="text-xs text-slate-500">
                        Adverse Drug Reactions & Counterfeit Incidents reported via Consumer Verifier
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-red-100 text-red-800 font-bold text-xs">
                    {pvReports.length} Reports Logged
                  </span>
                </div>

                <div className="space-y-3">
                  {pvReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{report.id}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#001F54] text-[#C9A227]">
                            {report.reporterCategory}
                          </span>
                          <span className="font-mono text-red-700 font-bold">{report.batchNo}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {report.timestamp.slice(0, 10)}
                        </span>
                      </div>
                      <div className="text-slate-800">
                        <strong>Drug:</strong> {report.drugNameSuspected} · <strong>Outlet:</strong>{' '}
                        {report.purchaseLocation}
                      </div>
                      <div className="text-slate-600 bg-white p-2 rounded border border-slate-200">
                        <span className="font-semibold text-slate-700">Clinical Symptoms:</span>{' '}
                        {report.adverseSymptoms}
                        {report.packagingAnomaly && (
                          <div className="mt-1 text-slate-700">
                            <span className="font-semibold text-red-800">Packaging Anomaly:</span>{' '}
                            {report.packagingAnomaly}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] font-bold text-slate-500">
                          Status:{' '}
                          <span className="uppercase text-red-700 font-mono">
                            {report.status}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onInspectInVerifier(report.batchNo)}
                            className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                          >
                            Inspect Dossier
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRegActionType('recall');
                              setRegTargetBatchNo(report.batchNo);
                              setRegReason(
                                `Class I Statutory Recall triggered by Pharmacovigilance Report ${report.id}: ${report.adverseSymptoms} at ${report.purchaseLocation}`
                              );
                            }}
                            className="px-2.5 py-1 rounded bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer"
                          >
                            Pre-fill Recall
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 pb-4 pt-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-red-700 text-white flex items-center justify-center">
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Regulatory Enforcement: Flag or Recall Batch
                    </h2>
                    <p className="text-xs text-slate-500 font-mono">
                      chaincode.recallBatch() / flagBatch() · PPB Regulator Only
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleRegulatorSubmit} className="space-y-4">
                {/* Action Type Selector */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setRegActionType('recall');
                      setRegReason(
                        'Class I Statutory Recall (PPB Rapid Alert): Failed dissolution & impurity threshold in NQCL post-market sampling.'
                      );
                    }}
                    className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      regActionType === 'recall'
                        ? 'bg-red-700 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Statutory Recall (Lock + Alert)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegActionType('flag');
                      setRegReason(
                        'Post-market cold-chain excursion inspection required before retail dispensing.'
                      );
                    }}
                    className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      regActionType === 'flag'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Regulatory Flag (Inspection)
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Active Batch to {regActionType === 'recall' ? 'Recall' : 'Flag'}
                  </label>
                  <select
                    value={effectiveRegTargetBatchNo}
                    onChange={(e) => setRegTargetBatchNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:border-[#001F54]"
                  >
                    {regulatorSelectableBatches.map((b) => (
                      <option key={b.batchNo} value={b.batchNo}>
                        {b.batchNo} — {b.drugName} (Holder: {b.currentHolderName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Regulatory Directive / Lab Finding
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={regReason}
                    onChange={(e) => setRegReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#001F54]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !effectiveRegTargetBatchNo}
                  className={`w-full py-2.5 px-4 rounded-lg text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                    regActionType === 'recall'
                      ? 'bg-red-700 hover:bg-red-800'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {regActionType === 'recall' ? (
                    <>
                      <AlertOctagon className="w-4 h-4" />
                      Execute Emergency Recall & Broadcast Real-Time Alert
                    </>
                  ) : (
                    <>
                      <Flag className="w-4 h-4" />
                      Sign & Record Regulatory Inspection Flag
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Secondary Role Action (Transfer or Dispense) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          {activeOrg.role === 'Pharmacy' && (
            <div className="space-y-4 pb-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      2. Dispense Verified Units to Patients
                    </h2>
                    <p className="text-xs text-slate-500 font-mono">
                      chaincode.dispenseUnits() · Pharmacy Only
                    </p>
                  </div>
                </div>
              </div>

              {dispensableBatches.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  No active batches in stock ready for dispensing. Receive an incoming shipment first.
                </p>
              ) : (
                <form onSubmit={handleDispenseSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Pharmacy Batch in Stock
                    </label>
                    <select
                      value={effectiveDispenseBatchNo}
                      onChange={(e) => setDispenseBatchNo(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                    >
                      {dispensableBatches.map((b) => {
                        const expired = isBatchExpired(b.expiryDate);
                        return (
                          <option key={b.batchNo} value={b.batchNo}>
                            {b.batchNo} — {b.drugName} ({b.currentQuantity.toLocaleString()} left)
                            {expired ? ' [EXPIRED - WILL REJECT]' : ''}
                            {b.status === 'RECALLED' ? ' [RECALLED - WILL REJECT]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Quantity to Dispense
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={dispenseQty}
                        onChange={(e) => setDispenseQty(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Clinical / Prescription Reference
                      </label>
                      <input
                        type="text"
                        value={dispensePatientRef}
                        onChange={(e) => setDispensePatientRef(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Sign & Dispense Units from {activeOrg.name}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Transfer Custody Form (Available to Manufacturer, Distributor, Pharmacy) */}
          {activeOrg.role !== 'Regulator' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#001F54] text-[#C9A227] flex items-center justify-center">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {activeOrg.role === 'Pharmacy'
                        ? '3. Inter-Facility Custody Transfer'
                        : '2. Transfer Batch Custody to Next Stakeholder'}
                    </h2>
                    <p className="text-xs text-slate-500 font-mono">
                      chaincode.transferBatch() · Current Holder Only
                    </p>
                  </div>
                </div>
              </div>

              {transferableBatches.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  {activeOrg.name} currently has no transferable batches on hand (batches that are
                  already IN_TRANSIT or RECALLED cannot be transferred).
                </div>
              ) : (
                <form onSubmit={handleTransferSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Batch Currently Held by {activeOrg.name}
                    </label>
                    <select
                      value={effectiveTransferBatchNo}
                      onChange={(e) => {
                        setTransferBatchNo(e.target.value);
                        const found = transferableBatches.find(
                          (b) => b.batchNo === e.target.value
                        );
                        if (found) setTransferQty(String(found.currentQuantity));
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                    >
                      {transferableBatches.map((b) => (
                        <option key={b.batchNo} value={b.batchNo}>
                          {b.batchNo} — {b.drugName} ({b.currentQuantity.toLocaleString()} units)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Recipient Organization (MSP)
                      </label>
                      <select
                        value={effectiveTargetOrgId}
                        onChange={(e) => setTransferTargetOrgId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                      >
                        {recipientOrganizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            [{org.role}] {org.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Quantity to Transfer (Max:{' '}
                        {selectedTransferBatch?.currentQuantity.toLocaleString()})
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder={String(selectedTransferBatch?.currentQuantity || '')}
                        value={transferQty}
                        onChange={(e) => setTransferQty(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GDP Logistics & Cold-Chain Dispatch Notes
                    </label>
                    <input
                      type="text"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="e.g. Dispatched via GDP temperature-controlled vehicle..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>

                  <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-center justify-between">
                    <span>
                      <strong>Endorsement Policy:</strong> AND('{activeOrg.mspId}.peer', 'Recipient.peer')
                    </span>
                    <span className="font-mono text-[10px] text-blue-700">
                      MVCC Checked (v{selectedTransferBatch?.version ?? 1})
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-[#001F54] hover:bg-[#002b75] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-[#C9A227]" />
                      Sign & Transfer Custody of {effectiveTransferBatchNo}
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSimulateMvccDoubleSpend}
                      title="Simulates an attacker attempting to double-spend/transfer an outdated version of this batch concurrently"
                      className="py-2.5 px-3 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Test MVCC Double-Spend Defense
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Regulator Right Column: Negative / Access Control Test Bench */
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  Smart Contract Access Control & Policy Enforcement Matrix
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hyperledger Fabric Chaincode strictly validates the caller’s MSP role and custody
                  state before endorsing any transaction.
                </p>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800">registerBatch()</span>
                  <span className="text-slate-600">Manufacturer MSPs only · Unique batchNo</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800">transferBatch()</span>
                  <span className="text-slate-600">Current Holder only · Rejects if RECALLED</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800">receiveBatch()</span>
                  <span className="text-slate-600">Designated Recipient only · Verifies transit</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800">dispenseUnits()</span>
                  <span className="text-slate-600">
                    Pharmacy MSPs only · Blocks EXPIRED & RECALLED
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800">
                    flagBatch() / recallBatch()
                  </span>
                  <span className="text-slate-600">
                    Regulator (PPB) only · Emits real-time recall alert
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. WORLD STATE HOLDINGS & SUPPLY CHAIN TABLE */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">
                CouchDB World State — Pharmaceutical Batches
              </h2>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#001F54] text-[#C9A227] flex items-center gap-1 font-mono">
                <Layers className="w-3 h-3" />
                {FABRIC_CHANNELS[activeChannelId]?.name || activeChannelId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {FABRIC_CHANNELS[activeChannelId]?.description ||
                'Showing live state records synchronized across the permissioned channel. Click any row’s QR button to generate its pack label or inspect its custody chain.'}
            </p>
            {!isOrgAuthorizedForChannel(activeOrg.id, activeChannelId) && (
              <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium">
                <strong>Channel Isolation Warning:</strong> {activeOrg.name} has not joined{' '}
                {FABRIC_CHANNELS[activeChannelId]?.name}. World state and transactions are restricted to member peers.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeOrg.role !== 'Regulator' && (
              <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setRoleFilter('mine')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    roleFilter === 'mine'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Org Batches
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    roleFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Channel Batches ({allBatches.length})
                </button>
              </div>
            )}

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter batch, drug, holder..."
                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#001F54]"
              />
            </div>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Status Filter:</span>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              statusFilter === 'all'
                ? 'bg-[#001F54] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({statusCounts.all})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              statusFilter === 'active'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active Stock ({statusCounts.active})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('transit')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              statusFilter === 'transit'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            In Transit ({statusCounts.transit})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('recalled')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              statusFilter === 'recalled'
                ? 'bg-red-700 text-white shadow-xs'
                : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Recalled ({statusCounts.recalled})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('expired')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              statusFilter === 'expired'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Expired ({statusCounts.expired})
          </button>
        </div>

        {/* Desktop / Tablet Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Batch No</th>
                <th className="py-3 px-4">Pharmaceutical Product</th>
                <th className="py-3 px-4">Current Holder / Transit</th>
                <th className="py-3 px-4 text-right">Stock / Initial</th>
                <th className="py-3 px-4">Expiry</th>
                <th className="py-3 px-4">Ledger Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {displayedBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No batches match the current filter. Switch to &quot;All Channel Batches&quot; or clear the status filter to view
                    batches on the ledger.
                  </td>
                </tr>
              ) : (
                displayedBatches.map((batch) => {
                  const expired = isBatchExpired(batch.expiryDate);
                  const isExpanded = expandedBatchNo === batch.batchNo;

                  let statusText = batch.status.replace('_', ' ');
                  let statusColorClass = 'text-emerald-700 font-semibold';
                  if (batch.status === 'RECALLED') {
                    statusText = 'RECALLED (LOCKED)';
                    statusColorClass = 'text-red-700 font-bold';
                  } else if (expired) {
                    statusText = 'EXPIRED';
                    statusColorClass = 'text-amber-700 font-bold';
                  } else if (batch.status === 'FLAGGED') {
                    statusText = 'FLAGGED BY PPB';
                    statusColorClass = 'text-amber-700 font-semibold';
                  } else if (batch.status === 'IN_TRANSIT') {
                    statusText = `IN TRANSIT → ${batch.pendingRecipientName}`;
                    statusColorClass = 'text-blue-700 font-semibold';
                  }

                  return (
                    <React.Fragment key={batch.batchNo}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#001F54] whitespace-nowrap">
                          <div>{batch.batchNo}</div>
                          <div className="text-[10px] text-slate-500 font-normal">v{batch.version} (MVCC)</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {batch.drugName}
                            {batch.privateDataHash && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 border border-slate-300 font-mono text-slate-700">
                                SideDB
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Mfg: {batch.manufacturerName} · {batch.dosageForm}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800">
                            {batch.currentHolderName}
                          </div>
                          {batch.pendingRecipientName && (
                            <div className="text-[11px] text-blue-700 font-medium">
                              Consigned to: {batch.pendingRecipientName}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="font-semibold text-slate-900">
                            {batch.currentQuantity.toLocaleString()}
                          </span>{' '}
                          <span className="text-slate-400">
                            / {batch.initialQuantity.toLocaleString()}
                          </span>
                          {batch.dispensedQuantity > 0 && (
                            <div className="text-[10px] text-emerald-700">
                              {batch.dispensedQuantity.toLocaleString()} dispensed
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap">
                          <span className={expired ? 'text-red-600 font-bold' : 'text-slate-700'}>
                            {batch.expiryDate}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`font-mono text-[11px] ${statusColorClass}`}>
                            {statusText}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenQrModal(batch)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
                              title="Generate Batch QR Code"
                            >
                              <QrCode className="w-3.5 h-3.5 text-[#001F54]" />
                              QR
                            </button>
                            <button
                              type="button"
                              onClick={() => onInspectInVerifier(batch.batchNo)}
                              className="px-2.5 py-1.5 rounded-md bg-[#001F54] hover:bg-[#002b75] text-white font-medium cursor-pointer"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBatchNo(isExpanded ? null : batch.batchNo)
                              }
                              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                              title="Toggle Custody History"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={7} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-[#001F54]">
                                  Signed Custody History ({batch.custodyHistory.length} Ledger
                                  Events)
                                </span>
                                <span className="text-slate-500 font-mono">
                                  Storage: {batch.storageTemp}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                {batch.custodyHistory.map((ev, i) => (
                                  <div
                                    key={ev.txId + i}
                                    className="p-3 rounded-lg bg-white border border-slate-200 space-y-1"
                                  >
                                    <div className="flex items-center justify-between text-[11px] font-mono">
                                      <span className="font-bold text-[#001F54]">
                                        #{i + 1} {ev.action}
                                      </span>
                                      <span className="text-slate-400">Block #{ev.blockIndex}</span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-800">
                                      {ev.actorName} ({ev.actorRole})
                                    </div>
                                    <p className="text-[11px] text-slate-600">{ev.notes}</p>
                                    <div className="text-[10px] font-mono text-slate-400 truncate">
                                      Sig: {ev.signatureHex.slice(0, 28)}...
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Card View (sm:hidden) */}
        <div className="sm:hidden divide-y divide-slate-200">
          {displayedBatches.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs px-4">
              No batches match the current filter. Switch to &quot;All Channel Batches&quot; or reset the filter.
            </div>
          ) : (
            displayedBatches.map((batch) => {
              const expired = isBatchExpired(batch.expiryDate);
              const isExpanded = expandedBatchNo === batch.batchNo;

              let statusBadgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
              let statusLabel = batch.status.replace('_', ' ');
              if (batch.status === 'RECALLED') {
                statusBadgeBg = 'bg-red-50 text-red-800 border-red-200';
                statusLabel = 'RECALLED';
              } else if (expired) {
                statusBadgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
                statusLabel = 'EXPIRED';
              } else if (batch.status === 'IN_TRANSIT') {
                statusBadgeBg = 'bg-blue-50 text-blue-800 border-blue-200';
                statusLabel = 'IN TRANSIT';
              }

              return (
                <div key={batch.batchNo} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-sm text-[#001F54]">{batch.batchNo}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">v{batch.version}</span>
                        {batch.privateDataHash && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700">SideDB</span>
                        )}
                      </div>
                      <div className="font-semibold text-slate-900 text-sm mt-0.5">{batch.drugName}</div>
                      <div className="text-xs text-slate-500">Mfg: {batch.manufacturerName} · {batch.dosageForm}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBadgeBg}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Current Holder</span>
                      <span className="font-medium text-slate-800 truncate block">{batch.currentHolderName}</span>
                      {batch.pendingRecipientName && (
                        <span className="text-[10px] text-blue-700 font-medium block truncate">→ {batch.pendingRecipientName}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Stock / Initial</span>
                      <span className="font-mono font-bold text-slate-900">{batch.currentQuantity.toLocaleString()}</span>
                      <span className="text-slate-400 font-mono text-[10px]"> / {batch.initialQuantity.toLocaleString()}</span>
                      {batch.dispensedQuantity > 0 && (
                        <span className="text-[10px] text-emerald-700 block">{batch.dispensedQuantity.toLocaleString()} dispensed</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Expiry Date</span>
                      <span className={`font-mono text-xs ${expired ? 'text-red-700 font-bold' : 'text-slate-800'}`}>
                        {batch.expiryDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Storage Condition</span>
                      <span className="text-slate-700 font-mono text-xs">{batch.storageTemp}</span>
                    </div>
                  </div>

                  {/* Touch-Friendly Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onOpenQrModal(batch)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer active:scale-95 transition-all"
                    >
                      <QrCode className="w-4 h-4 text-[#001F54]" />
                      QR Label
                    </button>
                    <button
                      type="button"
                      onClick={() => onInspectInVerifier(batch.batchNo)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#001F54] hover:bg-[#002b75] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-all shadow-xs"
                    >
                      Verify on Chain
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedBatchNo(isExpanded ? null : batch.batchNo)}
                    className="w-full py-1.5 flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide' : 'Show'} Custody Trail ({batch.custodyHistory.length} events)</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      {batch.custodyHistory.map((ev, i) => (
                        <div key={ev.txId + i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-[#001F54]">#{i + 1} {ev.action}</span>
                            <span className="text-slate-400">Block #{ev.blockIndex}</span>
                          </div>
                          <div className="font-semibold text-slate-800">{ev.actorName} ({ev.actorRole})</div>
                          <p className="text-[11px] text-slate-600">{ev.notes}</p>
                          <div className="text-[10px] font-mono text-slate-400 truncate">Sig: {ev.signatureHex.slice(0, 24)}...</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
