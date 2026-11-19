import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Send,
  Building2,
  MapPin,
  ShieldAlert,
  CheckCircle2,
  Pill,
  User,
  Stethoscope,
} from 'lucide-react';
import {
  PharmacovigilanceReport,
  savePharmacovigilanceReport,
} from '../pharmacovigilance';

interface PharmacovigilanceModalProps {
  batchNo: string;
  drugName: string;
  onClose: () => void;
  onSubmitted: (report: PharmacovigilanceReport) => void;
}

export const PharmacovigilanceModal: React.FC<PharmacovigilanceModalProps> = ({
  batchNo,
  drugName,
  onClose,
  onSubmitted,
}) => {
  const [reporterCategory, setReporterCategory] = useState<
    'Patient' | 'Pharmacist' | 'Clinician' | 'Public Inspector'
  >('Patient');
  const [purchaseLocation, setPurchaseLocation] = useState('Nairobi Community Chemist');
  const [adverseSymptoms, setAdverseSymptoms] = useState('');
  const [packagingAnomaly, setPackagingAnomaly] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successReport, setSuccessReport] = useState<PharmacovigilanceReport | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adverseSymptoms.trim() && !packagingAnomaly.trim()) return;

    setIsSubmitting(true);
    const newReport: PharmacovigilanceReport = {
      id: `PV-KE-2026-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      batchNo,
      drugNameSuspected: drugName,
      reporterCategory,
      purchaseLocation,
      adverseSymptoms: adverseSymptoms.trim() || 'No acute clinical symptoms reported.',
      packagingAnomaly: packagingAnomaly.trim() || 'Packaging seal appeared compromised.',
      status: 'SUBMITTED',
      gpsCoordinates: '-1.2921, 36.8219 (Kenya)',
    };

    savePharmacovigilanceReport(newReport);
    setIsSubmitting(false);
    setSuccessReport(newReport);
    onSubmitted(newReport);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-red-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-white" />
            <div>
              <h3 className="text-base font-bold tracking-tight">
                Report Adverse Reaction / Counterfeit (PPB Kenya)
              </h3>
              <p className="text-xs text-red-100">
                Direct dispatch to Pharmacy and Poisons Board Pharmacovigilance Rapid Response
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-red-100 hover:text-white hover:bg-red-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {successReport ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">
                Pharmacovigilance Report Dispatched
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Report Reference:{' '}
                <span className="font-mono font-bold text-slate-800">
                  {successReport.id}
                </span>
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-left space-y-1.5">
              <div>
                <strong className="text-slate-700">Batch Number:</strong> {successReport.batchNo}
              </div>
              <div>
                <strong className="text-slate-700">Drug:</strong> {successReport.drugNameSuspected}
              </div>
              <div>
                <strong className="text-slate-700">Triage Queue:</strong> Sent to PPB National
                Pharmacovigilance Centre (NPVC) & NQCL Laboratory.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-[#001F54] text-white text-xs font-bold hover:bg-[#002b75] transition-colors"
            >
              Close & Return to Verifier
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Reporting for Batch</div>
                <div className="font-mono font-bold text-slate-900">{batchNo}</div>
                <div className="text-slate-600 font-semibold">{drugName}</div>
              </div>
              <div className="px-2.5 py-1 rounded bg-[#001F54] text-[#C9A227] font-bold text-[10px] uppercase tracking-wider">
                PPB Vigilance
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Your Role / Reporter Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Patient', 'Pharmacist', 'Clinician', 'Public Inspector'] as const).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setReporterCategory(cat)}
                      className={`p-2 rounded-lg border text-center transition-colors font-medium ${
                        reporterCategory === cat
                          ? 'border-red-600 bg-red-50 text-red-900 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Dispensing / Purchase Location
              </label>
              <input
                type="text"
                required
                value={purchaseLocation}
                onChange={(e) => setPurchaseLocation(e.target.value)}
                placeholder="e.g. Chemist in Kibera, Nairobi or Kenyatta National Hospital"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#001F54]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Adverse Symptoms Observed (if consumed)
              </label>
              <textarea
                rows={2}
                value={adverseSymptoms}
                onChange={(e) => setAdverseSymptoms(e.target.value)}
                placeholder="Describe any nausea, skin rashes, fever, lack of therapeutic effect, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#001F54]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Suspected Packaging or Physical Anomaly
              </label>
              <textarea
                rows={2}
                value={packagingAnomaly}
                onChange={(e) => setPackagingAnomaly(e.target.value)}
                placeholder="Missing hologram seal, blurry printing, irregular cap color, cloudy liquid, chipped tablets..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#001F54]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Incident to PPB
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
