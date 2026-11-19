/**
 * ============================================================================
 * MODULE: pharmacovigilance.ts
 * HYPERLEDGER FABRIC REGULATORY INVESTIGATION EQUIVALENT:
 *   - Patient Adverse Drug Reaction (ADR) and Counterfeit Incident Reporting
 *   - Direct dispatch to Pharmacy and Poisons Board (PPB Kenya) rapid triage queue
 * ============================================================================
 */

export interface PharmacovigilanceReport {
  id: string;
  timestamp: string;
  batchNo: string;
  drugNameSuspected: string;
  reporterCategory: 'Patient' | 'Pharmacist' | 'Clinician' | 'Public Inspector';
  purchaseLocation: string; // e.g. "Chemist in Kibera, Nairobi"
  adverseSymptoms: string; // e.g. "Severe nausea, packaging lacked holographic seal"
  packagingAnomaly: string;
  status: 'SUBMITTED' | 'INVESTIGATING' | 'RECALL_INITIATED' | 'RESOLVED';
  regulatoryNotes?: string;
  gpsCoordinates?: string;
}

const PV_STORAGE_KEY = 'pharmachain_pharmacovigilance_reports_v1';

export const SEED_PV_REPORTS: PharmacovigilanceReport[] = [
  {
    id: 'PV-KE-2026-081',
    timestamp: '2026-02-27T14:30:00Z',
    batchNo: 'KE-PCM-2026-999',
    drugNameSuspected: 'Cetamol Pediatric Syrup 120mg/5ml',
    reporterCategory: 'Clinician',
    purchaseLocation: 'Pumwani Area Community Dispensary',
    adverseSymptoms:
      'Patient presented with acute abdominal spasms and vomiting after 10ml dose.',
    packagingAnomaly:
      'Color deviation on amber bottle cap; precipitate observed in syrup suspension.',
    status: 'RECALL_INITIATED',
    regulatoryNotes:
      'Verified by NQCL laboratory assay; diethylene glycol contaminant identified. Class I Statutory Recall enacted on ledger.',
    gpsCoordinates: '-1.286389, 36.817223 (Nairobi)',
  },
];

export function loadPharmacovigilanceReports(): PharmacovigilanceReport[] {
  try {
    const raw = window.localStorage.getItem(PV_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return [...SEED_PV_REPORTS];
}

export function savePharmacovigilanceReport(report: PharmacovigilanceReport): void {
  const current = loadPharmacovigilanceReports();
  const updated = [report, ...current.filter((r) => r.id !== report.id)];
  try {
    window.localStorage.setItem(PV_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
