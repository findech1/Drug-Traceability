import React, { useMemo } from 'react';
import {
  BarChart3,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Pill,
  Building2,
} from 'lucide-react';
import { isBatchExpired } from '../chaincode';
import { PersistedLedgerStore } from '../store';

interface AnalyticsPageProps {
  store: PersistedLedgerStore;
  onInspectBatch: (batchNo: string) => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  store,
  onInspectBatch,
}) => {
  const batches = useMemo(() => Object.values(store.worldState), [store.worldState]);

  const metrics = useMemo(() => {
    const totalBatches = batches.length;
    let inTransitCount = 0;
    let recalledCount = 0;
    let flaggedCount = 0;
    let expiredCount = 0;
    let authenticActiveCount = 0;
    let batchesWithDispensing = 0;

    let totalManufacturedUnits = 0;
    let totalRemainingUnits = 0;
    let totalDispensedUnits = 0;
    let totalInTransitUnits = 0;
    let totalRecalledUnits = 0;

    for (const b of batches) {
      const expired = isBatchExpired(b.expiryDate);
      totalManufacturedUnits += b.initialQuantity;
      totalRemainingUnits += b.currentQuantity;
      totalDispensedUnits += b.dispensedQuantity;

      if (b.dispensedQuantity > 0) {
        batchesWithDispensing++;
      }

      if (b.status === 'RECALLED') {
        recalledCount++;
        totalRecalledUnits += b.currentQuantity;
      } else if (b.status === 'FLAGGED') {
        flaggedCount++;
      } else if (expired) {
        expiredCount++;
      } else if (b.status === 'IN_TRANSIT') {
        inTransitCount++;
        totalInTransitUnits += b.inTransitQuantity;
      } else {
        authenticActiveCount++;
      }
    }

    return {
      totalBatches,
      authenticActiveCount,
      inTransitCount,
      batchesWithDispensing,
      flaggedCount,
      recalledCount,
      expiredCount,
      totalManufacturedUnits,
      totalRemainingUnits,
      totalDispensedUnits,
      totalInTransitUnits,
      totalRecalledUnits,
    };
  }, [batches]);

  // Blocks created per Organization
  const orgBlockCounts = useMemo(() => {
    const counts: Record<string, { name: string; role: string; count: number }> = {};
    Object.values(store.organizations).forEach((o) => {
      counts[o.id] = { name: o.name, role: o.role, count: 0 };
    });
    store.blocks.forEach((b) => {
      if (counts[b.creatingOrgId]) {
        counts[b.creatingOrgId].count += 1;
      }
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [store.blocks, store.organizations]);

  const maxOrgBlocks = Math.max(...orgBlockCounts.map((o) => o.count), 1);

  const statusChartRows = [
    {
      label: 'Authentic & Active (Verified Safe)',
      count: metrics.authenticActiveCount,
      color: 'bg-emerald-600',
      textColor: 'text-emerald-700',
    },
    {
      label: 'In-Transit Shipments (Pending Receipt)',
      count: metrics.inTransitCount,
      color: 'bg-blue-600',
      textColor: 'text-blue-700',
    },
    {
      label: 'Batches with Verified Patient Dispensing',
      count: metrics.batchesWithDispensing,
      color: 'bg-[#001F54]',
      textColor: 'text-[#001F54]',
    },
    {
      label: 'Flagged by Regulator (Inspection Hold)',
      count: metrics.flaggedCount,
      color: 'bg-amber-500',
      textColor: 'text-amber-700',
    },
    {
      label: 'Expired Batches (Dispensing Blocked)',
      count: metrics.expiredCount,
      color: 'bg-amber-700',
      textColor: 'text-amber-800',
    },
    {
      label: 'Statutory Recalled (Locked & Alerted)',
      count: metrics.recalledCount,
      color: 'bg-red-600',
      textColor: 'text-red-700',
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
        <div className="text-xs font-semibold tracking-wider text-[#001F54] uppercase">
          National Supply Chain Telemetry & UN SDG 3 Impact Metrics
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Pharmaceutical Ledger Analytics & Custody Distribution
        </h1>
        <p className="text-xs text-slate-500">
          Real-time aggregation computed directly from the CouchDB World State and signed
          blockchain blocks across all Kenyan consortium stakeholders.
        </p>
      </section>

      {/* KPI SUMMARY STRIP */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Batches</span>
            <Package className="w-4 h-4 text-[#001F54]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.totalBatches}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {metrics.totalManufacturedUnits.toLocaleString()} total units
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>In-Transit</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-blue-700">
            {metrics.inTransitCount}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {metrics.totalInTransitUnits.toLocaleString()} units moving
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Dispensed</span>
            <Pill className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {metrics.totalDispensedUnits.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Across {metrics.batchesWithDispensing} pharmacy batches
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Flagged (PPB)</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700">
            {metrics.flaggedCount}
          </div>
          <div className="text-[11px] text-slate-500">Cold-chain / QA review</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Expired</span>
            <AlertTriangle className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-800">
            {metrics.expiredCount}
          </div>
          <div className="text-[11px] text-slate-500">Auto-blocked at pharmacy</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Recalled</span>
            <AlertOctagon className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-red-700">
            {metrics.recalledCount}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {metrics.totalRecalledUnits.toLocaleString()} units quarantined
          </div>
        </div>
      </section>

      {/* CHARTS GRID */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Batch Status Distribution */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Batch Status Breakdown (World State)
              </h2>
              <p className="text-xs text-slate-500">
                Distribution of registered batches by current smart contract state
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-[#001F54]" />
          </div>

          <div className="space-y-4">
            {statusChartRows.map((row) => {
              const pct =
                metrics.totalBatches > 0
                  ? Math.round((row.count / metrics.totalBatches) * 100)
                  : 0;
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{row.label}</span>
                    <span className={`font-mono font-bold tabular-nums ${row.textColor}`}>
                      {row.count} batches ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${row.color}`}
                      style={{ width: `${Math.max(pct, row.count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Blockchain Endorsements per Permissioned Organization */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Signed Blocks Committed by Organization MSP
              </h2>
              <p className="text-xs text-slate-500">
                Total ECDSA-signed ledger blocks endorsed per Kenyan stakeholder
              </p>
            </div>
            <Building2 className="w-5 h-5 text-[#001F54]" />
          </div>

          <div className="space-y-3.5">
            {orgBlockCounts.map((org) => {
              const widthPct = Math.round((org.count / maxOrgBlocks) * 100);
              return (
                <div key={org.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 truncate">
                      {org.name}{' '}
                      <span className="text-slate-400 font-mono text-[11px]">({org.role})</span>
                    </span>
                    <span className="font-mono font-bold text-[#001F54] tabular-nums">
                      {org.count} blocks
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#001F54] rounded-full transition-all"
                      style={{ width: `${Math.max(widthPct, org.count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* UNIT INVENTORY & CUSTODY VELOCITY TABLE */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Batch-Level Quantity & Dispensing Utilization
            </h2>
            <p className="text-xs text-slate-500">
              Unit accounting across manufactured, dispensed, in-transit, and remaining stock
            </p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Batch ID</th>
                <th className="py-3 px-4">Drug Name</th>
                <th className="py-3 px-4">Current Custodian</th>
                <th className="py-3 px-4 text-right">Initial Qty</th>
                <th className="py-3 px-4 text-right">Dispensed Qty</th>
                <th className="py-3 px-4 text-right">Remaining Stock</th>
                <th className="py-3 px-4 text-right">Custody Hops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {batches.map((b) => (
                <tr key={b.batchNo} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold">
                    <button
                      type="button"
                      onClick={() => onInspectBatch(b.batchNo)}
                      className="text-[#001F54] hover:underline cursor-pointer"
                    >
                      {b.batchNo}
                    </button>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">{b.drugName}</td>
                  <td className="py-3 px-4 text-slate-700">{b.currentHolderName}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {b.initialQuantity.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                    {b.dispensedQuantity.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                    {b.currentQuantity.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {b.custodyHistory.length} events
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
