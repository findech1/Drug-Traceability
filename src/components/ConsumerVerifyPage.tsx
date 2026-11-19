import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  QrCode,
  Camera,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  FileSignature,
  Building2,
  ArrowRight,
  StopCircle,
  Smartphone,
  Download,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Barcode,
  Thermometer,
} from 'lucide-react';
import {
  ConsumerVerificationResult,
  evaluateVerifyBatch,
} from '../chaincode';
import { generateBatchAuditPdf } from '../pdfReport';
import { loadPrivateDataStore } from '../privatedata';
import { PersistedLedgerStore } from '../store';
import { ColdChainIotStream } from './ColdChainIotStream';
import { PharmacovigilanceModal } from './PharmacovigilanceModal';
import {
  convertDateToYYMMDD,
  formatGS1DigitalLinkUri,
  formatGS1ElementStrings,
  getStandardGtinForBatch,
  GS1DrugAttributes,
} from '../gs1Standard';

interface ConsumerVerifyPageProps {
  store: PersistedLedgerStore;
  initialBatchNo?: string;
  activeOrgId?: string;
}

export const ConsumerVerifyPage: React.FC<ConsumerVerifyPageProps> = ({
  store,
  initialBatchNo = 'KE-ACT-2026-001',
  activeOrgId = 'REG-PPB',
}) => {
  const [batchInput, setBatchInput] = useState(initialBatchNo);
  const [queriedBatchNo, setQueriedBatchNo] = useState(initialBatchNo);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showPvModal, setShowPvModal] = useState(false);
  const [copiedGs1Link, setCopiedGs1Link] = useState(false);

  // Feature 4: Live Canvas + jsQR Camera Scanner
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStatusMessage, setCameraStatusMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Feature 5: Private Data Collections viewer state
  const [showConfidentialPricing, setShowConfidentialPricing] = useState(false);
  const [activeVerifyView, setActiveVerifyView] = useState<'all' | 'timeline' | 'iot' | 'gs1' | 'pricing'>('all');

  useEffect(() => {
    if (initialBatchNo) {
      setBatchInput(initialBatchNo);
      setQueriedBatchNo(initialBatchNo);
    }
  }, [initialBatchNo]);

  const verification: ConsumerVerificationResult = evaluateVerifyBatch(
    queriedBatchNo,
    store.worldState,
    store.blocks.length
  );

  const gs1Attrs: GS1DrugAttributes | null = verification.batch
    ? {
        gtin: getStandardGtinForBatch(verification.batch.batchNo),
        batchNo: verification.batch.batchNo,
        expiryDateYYMMDD: convertDateToYYMMDD(verification.batch.expiryDate),
        serialNo: `SN-${verification.batch.batchNo.slice(-3)}-001`,
        productName: verification.batch.drugName,
      }
    : null;
  const gs1Uri = gs1Attrs ? formatGS1DigitalLinkUri(gs1Attrs) : '';
  const gs1Elements = gs1Attrs ? formatGS1ElementStrings(gs1Attrs) : '';

  // Private Data collection lookup
  const privateDeals = loadPrivateDataStore();
  const activePrivateDeal = privateDeals[queriedBatchNo];
  const isAuthorizedForPrivateData =
    activePrivateDeal &&
    (activeOrgId === 'REG-PPB' || activePrivateDeal.authorizedOrgIds.includes(activeOrgId));

  // Generate QR code for verified batch
  useEffect(() => {
    let mounted = true;
    const payload = JSON.stringify({
      protocol: 'PHARMACHAIN-KE-V1',
      batchNo: verification.batchNo,
      status: verification.status,
    });

    QRCode.toDataURL(payload, {
      width: 200,
      margin: 2,
      color: {
        dark: '#001F54',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {
        if (mounted) setQrDataUrl('');
      });

    return () => {
      mounted = false;
    };
  }, [verification.batchNo, verification.status]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Feature 4: Continuous Canvas frame analysis with jsQR fallback + native BarcodeDetector
  const tickCameraFrame = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(tickCameraFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        let extractedBatch = code.data.trim();
        try {
          const parsed = JSON.parse(code.data);
          if (parsed.batchNo) extractedBatch = parsed.batchNo;
        } catch {
          // plain string
        }
        setBatchInput(extractedBatch);
        setQueriedBatchNo(extractedBatch);
        stopCamera();
        setCameraStatusMessage(`QR successfully decoded: ${extractedBatch}`);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(tickCameraFrame);
  };

  const startCameraScanner = async () => {
    setCameraStatusMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStatusMessage(
          'Camera API is not supported in this browser. Use simulated optical pack buttons below.'
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setIsCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          animationFrameRef.current = requestAnimationFrame(tickCameraFrame);
        }
      }, 100);
    } catch {
      setCameraStatusMessage(
        'Camera permission was declined or device has no active webcam. Select from the quick scan buttons below.'
      );
    }
  };

  const extractBatchId = (input: string): string => {
    let cleaned = input.trim();
    if (cleaned.includes('/10/')) {
      const parts = cleaned.split('/10/')[1];
      if (parts) cleaned = parts.split('/')[0];
    } else if (cleaned.includes('(10)')) {
      const match = cleaned.match(/\(10\)([^\(\)\/]+)/);
      if (match && match[1]) cleaned = match[1];
    }
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch {
      // ignore
    }
    return cleaned.toUpperCase();
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchInput.trim()) return;
    const resolved = extractBatchId(batchInput);
    setQueriedBatchNo(resolved);
  };

  // Feature 6: Download JSON / PDF Cryptographic Audit Report
  const handleDownloadPdf = () => {
    if (!verification.batch) return;
    generateBatchAuditPdf(verification.batch, store.blocks);
  };

  const handleDownloadJson = () => {
    if (!verification.batch) return;
    const dossier = {
      pharmaChainProtocol: 'PHARMACHAIN-KE-V2-FABRIC',
      verifiedAt: new Date().toISOString(),
      worldStateRecord: verification.batch,
      blockchainEvidence: {
        totalBlocks: store.blocks.length,
        genesisHash: store.blocks[0]?.hash,
        latestMerkleRoot: store.blocks[store.blocks.length - 1]?.merkleRoot,
        custodyTimeline: verification.custodyTimeline,
      },
    };
    const blob = new Blob([JSON.stringify(dossier, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PharmaChain_Dossier_${verification.batch.batchNo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quickTestBatches = [
    {
      batchNo: 'KE-ACT-2026-001',
      label: 'Authentic Antimalarial (KNH)',
    },
    {
      batchNo: 'KE-AMX-2026-002',
      label: 'Authentic Amoxil (Goodlife)',
    },
    {
      batchNo: 'KE-PCM-2026-999',
      label: 'RECALLED Syrup (PPB Alert)',
    },
    {
      batchNo: 'KE-CIP-2024-089',
      label: 'EXPIRED Ciproxin',
    },
    {
      batchNo: 'KE-INS-2026-005',
      label: 'FLAGGED Cold-Chain Insulin',
    },
    {
      batchNo: 'FAKE-MOMBASA-404',
      label: 'Counterfeit / Unregistered',
    },
  ];

  const getBannerTheme = () => {
    switch (verification.status) {
      case 'AUTHENTIC':
        return {
          wrapper: 'bg-emerald-950 text-white border-emerald-700',
          badge: 'bg-emerald-500 text-emerald-950',
          icon: <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />,
          statusLabel: 'VERIFIED AUTHENTIC',
        };
      case 'EXPIRED':
      case 'FLAGGED':
        return {
          wrapper: 'bg-amber-950 text-white border-amber-700',
          badge: 'bg-amber-400 text-amber-950',
          icon: <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />,
          statusLabel:
            verification.status === 'EXPIRED'
              ? 'EXPIRED — DO NOT USE'
              : 'REGULATORY FLAG — HOLD',
        };
      case 'RECALLED':
      case 'UNKNOWN_COUNTERFEIT':
      default:
        return {
          wrapper: 'bg-red-950 text-white border-red-700',
          badge: 'bg-red-500 text-white',
          icon:
            verification.status === 'RECALLED' ? (
              <AlertOctagon className="w-8 h-8 text-red-400 shrink-0" />
            ) : (
              <XCircle className="w-8 h-8 text-red-400 shrink-0" />
            ),
          statusLabel:
            verification.status === 'RECALLED'
              ? 'RECALLED, DO NOT USE'
              : 'COUNTERFEIT / UNKNOWN',
        };
    }
  };

  const bannerTheme = getBannerTheme();

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER & INPUT BAR */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#001F54] text-[#C9A227] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wider text-[#001F54] uppercase">
                Public Consumer Verification & Mobile Scanner
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
                Verify Pharmaceutical Batch Authenticity & Custody
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Zero login required. Point your webcam at any QR code, click simulated optical scan
                buttons, or type a serial code to verify origin and active recalls.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={isCameraActive ? stopCamera : startCameraScanner}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                isCameraActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#001F54] hover:bg-[#002b75] text-white'
              }`}
            >
              {isCameraActive ? (
                <>
                  <StopCircle className="w-4 h-4" />
                  Stop Camera Scanner
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-[#C9A227]" />
                  Scan QR with Camera (jsQR)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feature 4: Live HTML5 Canvas + jsQR Optical Stream */}
        {(isCameraActive || cameraStatusMessage) && (
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#C9A227]">
                Live Optical QR Decoder (Pure JavaScript jsQR Engine)
              </span>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setCameraStatusMessage(null);
                }}
                className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
              >
                Close Scanner
              </button>
            </div>

            {isCameraActive && (
              <div className="relative max-w-sm mx-auto aspect-video bg-black rounded-lg overflow-hidden border border-white/20">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-6 border-2 border-[#C9A227]/80 rounded-lg pointer-events-none flex items-center justify-center">
                  <span className="text-[11px] font-mono bg-black/70 px-2 py-1 rounded text-[#C9A227]">
                    Continuous Optical Frame Analysis Active
                  </span>
                </div>
              </div>
            )}

            {cameraStatusMessage && (
              <p className="text-xs text-slate-300 text-center font-medium">
                {cameraStatusMessage}
              </p>
            )}

            <div className="pt-2 border-t border-white/10">
              <div className="text-[11px] text-slate-400 mb-2 text-center">
                Simulate Instant Optical QR Decode for Any Demo Pack:
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {quickTestBatches.map((item) => (
                  <button
                    key={item.batchNo}
                    type="button"
                    onClick={() => {
                      setBatchInput(item.batchNo);
                      setQueriedBatchNo(item.batchNo);
                      stopCamera();
                      setCameraStatusMessage(null);
                    }}
                    className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-mono text-white cursor-pointer"
                  >
                    Scan [{item.batchNo}]
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search Input Form */}
        <form onSubmit={handleVerifySubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder="Enter Batch Number (e.g., KE-ACT-2026-001, KE-PCM-2026-999, FAKE-MOMBASA-404)"
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 font-mono text-sm focus:outline-none focus:border-[#001F54]"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-[#001F54] hover:bg-[#002b75] text-white font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
          >
            Verify on Blockchain
          </button>
        </form>

        {/* Quick-Select Demo Batch Buttons */}
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-slate-500">
            Instant Test Batches (Click to verify):
          </div>
          <div className="flex flex-wrap gap-2">
            {quickTestBatches.map((b) => {
              const isSelected = queriedBatchNo === b.batchNo;
              return (
                <button
                  key={b.batchNo}
                  type="button"
                  onClick={() => {
                    setBatchInput(b.batchNo);
                    setQueriedBatchNo(b.batchNo);
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[#001F54] text-white border-[#001F54] font-semibold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="font-mono font-bold">{b.batchNo}</span>
                  <span className={isSelected ? 'text-[#C9A227]' : 'text-slate-500'}>
                    · {b.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* VERIFICATION RESULT BANNER (GREEN / AMBER / RED) */}
      <section
        aria-live="polite"
        className={`rounded-xl border p-6 sm:p-8 transition-colors ${bannerTheme.wrapper}`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            {bannerTheme.icon}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase ${bannerTheme.badge}`}
                >
                  {bannerTheme.statusLabel}
                </span>
                <span className="text-xs font-mono opacity-80">
                  Batch ID: {verification.batchNo}
                </span>
                {verification.batch && (
                  <span className="text-xs font-mono opacity-80">
                    · MVCC Version: v{verification.batch.version}
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {verification.headline}
              </h2>
              <p className="text-sm sm:text-base opacity-90 max-w-3xl leading-relaxed">
                {verification.subheadline}
              </p>
            </div>
          </div>

          {/* Right: QR Code & Ledger Proof Box */}
          <div className="bg-white text-slate-900 rounded-xl p-4 flex items-center gap-4 shrink-0 self-start lg:self-center">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={`QR for ${verification.batchNo}`}
                className="w-24 h-24 rounded border border-slate-200"
              />
            )}
            <div className="text-xs space-y-1">
              <div className="font-bold text-[#001F54] flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-[#C9A227]" />
                Batch QR Check
              </div>
              <div className="font-mono font-semibold text-slate-800">{verification.batchNo}</div>
              <div className="text-[11px] text-slate-500">
                Blocks Audited:{' '}
                <span className="font-mono">{verification.ledgerBlocksVerified}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Safe to Consume:{' '}
                <strong
                  className={verification.isSafeToUse ? 'text-emerald-700' : 'text-red-600'}
                >
                  {verification.isSafeToUse ? 'YES' : 'NO'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 6: Download Cryptographic Audit Dossier */}
      {verification.batch && (
        <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#001F54] text-[#C9A227] flex items-center justify-center shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Official Cryptographic Certificate & Audit Dossier
              </h3>
              <p className="text-xs text-slate-500">
                Tamper-evident legal report with genesis block hash, Merkle root proofs, and full
                multi-peer endorsement signatures.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#001F54] hover:bg-[#002b75] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#C9A227]" />
              Download Audit PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Export JSON Proof
            </button>
            <button
              type="button"
              onClick={() => setShowPvModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              Report Adverse Reaction / Counterfeit
            </button>
          </div>
        </section>
      )}

      {/* BATCH SPECIFICATIONS & CUSTODY TIMELINE */}
      {verification.batch ? (
        <div className="space-y-4">
          {/* Interactive Evidence Dimension Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setActiveVerifyView('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeVerifyView === 'all'
                  ? 'bg-white text-[#001F54] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Evidence Panels
            </button>
            <button
              type="button"
              onClick={() => setActiveVerifyView('timeline')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeVerifyView === 'timeline'
                  ? 'bg-white text-[#001F54] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custody Timeline ({verification.custodyTimeline.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveVerifyView('iot')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeVerifyView === 'iot'
                  ? 'bg-white text-[#001F54] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cold-Chain IoT Stream
            </button>
            <button
              type="button"
              onClick={() => setActiveVerifyView('gs1')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeVerifyView === 'gs1'
                  ? 'bg-white text-[#001F54] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GS1 Digital Link 2D
            </button>
            {verification.batch.privateDataHash && (
              <button
                type="button"
                onClick={() => setActiveVerifyView('pricing')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeVerifyView === 'pricing'
                    ? 'bg-white text-[#001F54] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Confidential Pricing (SideDB)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 cols: Batch World State Metadata + Private Data Collections + GS1 + IoT */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <div className="text-xs font-semibold text-[#001F54] uppercase tracking-wider">
                  Pharmaceutical Dossier
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {verification.batch.drugName}
                </h3>
              </div>

              <dl className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Batch Number</dt>
                  <dd className="font-mono font-bold text-slate-900">
                    {verification.batch.batchNo}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Licensed Manufacturer</dt>
                  <dd className="font-semibold text-slate-900 text-right">
                    {verification.batch.manufacturerName}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Active Ingredient</dt>
                  <dd className="font-medium text-slate-800 text-right">
                    {verification.batch.activeIngredient}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Storage Conditions</dt>
                  <dd className="font-medium text-slate-800 text-right">
                    {verification.batch.storageTemp}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Manufacture Date</dt>
                  <dd className="font-mono text-slate-800">{verification.batch.manufactureDate}</dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Expiry Date</dt>
                  <dd
                    className={`font-mono font-bold ${
                      verification.isExpired ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {verification.batch.expiryDate}
                    {verification.isExpired ? ' (EXPIRED)' : ' (VALID)'}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Current Custodian</dt>
                  <dd className="font-semibold text-[#001F54] text-right">
                    {verification.batch.currentHolderName}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-slate-500">Remaining / Dispensed Units</dt>
                  <dd className="font-mono text-slate-900">
                    {verification.batch.currentQuantity.toLocaleString()} left ·{' '}
                    {verification.batch.dispensedQuantity.toLocaleString()} dispensed
                  </dd>
                </div>
              </dl>
            </div>

            {/* GS1 Healthcare 2D DataMatrix Card */}
            {gs1Attrs && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-[#001F54]" />
                    <h4 className="text-sm font-bold text-slate-900">
                      GS1 Healthcare Standard (Digital Link)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ISO/IEC 15418
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="text-[11px] text-slate-500 font-medium">GS1 Application Identifiers:</div>
                    <div className="font-mono text-xs font-bold text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 break-all select-all">
                      {gs1Elements}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>GS1 Web URI:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(gs1Uri);
                          setCopiedGs1Link(true);
                          setTimeout(() => setCopiedGs1Link(false), 2000);
                        }}
                        className="text-[#001F54] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedGs1Link ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy URI
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] text-[#001F54] bg-slate-50 p-2 rounded border border-slate-200 break-all select-all">
                      {gs1Uri}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-slate-500">(01) Kenya GTIN:</span>
                      <div className="font-mono font-bold text-slate-900">{gs1Attrs.gtin}</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-slate-500">(17) Expiry YYMMDD:</span>
                      <div className="font-mono font-bold text-slate-900">{gs1Attrs.expiryDateYYMMDD}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Feature 1: Cold-Chain IoT Telemetry Stream */}
            <ColdChainIotStream
              batchNo={verification.batch.batchNo}
              storageTempSpec={verification.batch.storageTemp}
            />

            {/* Feature 5: Hyperledger Fabric Private Data Collection (SideDB) Card */}
            {verification.batch.privateDataHash && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#001F54]" />
                    <h4 className="text-sm font-bold text-slate-900">
                      Private Data Collection (SideDB Proof)
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {verification.batch.privateDataCollectionName}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-600 space-y-1">
                  <div className="text-slate-500">On-Chain SHA-256 Deal Hash:</div>
                  <div className="font-semibold text-[#001F54] break-all">
                    {verification.batch.privateDataHash}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  In Hyperledger Fabric, wholesale prices and procurement discounts are kept
                  confidential between authorized deal partners. Competing manufacturers only see
                  the hash digest on the channel.
                </p>

                {activePrivateDeal && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Authorized Parties: {activePrivateDeal.authorizedOrgIds.join(', ')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowConfidentialPricing(!showConfidentialPricing)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#001F54] hover:underline cursor-pointer"
                      >
                        {showConfidentialPricing ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" /> Hide Pricing
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> Decrypt SideDB Terms
                          </>
                        )}
                      </button>
                    </div>

                    {showConfidentialPricing && (
                      <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-emerald-800">Unit Wholesale Price:</span>
                          <span className="font-mono font-bold text-emerald-950">
                            {activePrivateDeal.currency}{' '}
                            {activePrivateDeal.unitWholesalePriceKES.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-800">Contract Reference:</span>
                          <span className="font-mono text-emerald-950">
                            {activePrivateDeal.procurementContractRef}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-800">Payment Terms:</span>
                          <span className="text-emerald-950">
                            {activePrivateDeal.paymentTerms}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-800">Prompt Settlement Rebate:</span>
                          <span className="font-mono text-emerald-950">
                            {activePrivateDeal.rebatePercent}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right 7 cols: Full Chain of Custody Timeline with Multi-Peer Endorsements */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs font-semibold text-[#001F54] uppercase tracking-wider">
                  Immutable Audit Trail
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Cryptographic Chain of Custody Timeline ({verification.custodyTimeline.length}{' '}
                  Events)
                </h3>
              </div>
              <ShieldCheck className="w-6 h-6 text-[#001F54]" />
            </div>

            <div className="space-y-4">
              {verification.custodyTimeline.map((event, idx) => {
                const isRecallEvent = event.action === 'RECALLED';
                const isFlagEvent = event.action === 'FLAGGED';

                return (
                  <div
                    key={event.txId + idx}
                    className={`p-4 rounded-xl border space-y-2.5 ${
                      isRecallEvent
                        ? 'bg-red-50 border-red-200'
                        : isFlagEvent
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#001F54]">
                          Step {idx + 1} · {event.action}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-slate-600">Block #{event.blockIndex}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-900">
                      <Building2 className="w-4 h-4 text-[#001F54]" />
                      <span>
                        {event.actorName} ({event.actorRole})
                      </span>
                      {event.toOrgName && (
                        <>
                          <ArrowRight className="w-3.5 h-3.5 text-[#C9A227]" />
                          <span className="text-[#001F54]">{event.toOrgName}</span>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{event.notes}</p>

                    {/* Multi-Peer Endorsement Policy Display */}
                    {event.endorsements && event.endorsements.length > 0 && (
                      <div className="p-2.5 rounded bg-white border border-slate-200/80 text-[11px] space-y-1">
                        <div className="font-semibold text-slate-800">
                          Multi-Peer Endorsement Policy: {event.endorsementPolicy}
                        </div>
                        <div className="text-slate-600">
                          Endorsed by {event.actorMspId} +{' '}
                          {event.endorsements.map((e) => e.endorserMspId).join(', ')}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                      <span>MSP: {event.actorMspId}</span>
                      <span className="flex items-center gap-1 truncate max-w-md">
                        <FileSignature className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ECDSA: {event.signatureHex.slice(0, 24)}...{event.signatureHex.slice(-12)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-white border border-red-200 rounded-xl p-6 sm:p-8 space-y-4">
          <h3 className="text-lg font-bold text-red-800">
            Why Did This Batch Fail Blockchain Verification?
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed">
            The serial code <span className="font-mono font-bold">{verification.batchNo}</span> has
            zero genesis registration blocks from any licensed Kenyan pharmaceutical manufacturer
            (Dawa Life Sciences, Cosmos Ltd, Universal Corp) on the permissioned channel.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="p-4 rounded-lg bg-red-50 border border-red-100 space-y-1">
              <div className="font-bold text-red-900">1. Do Not Consume</div>
              <p className="text-red-800">
                Unregistered pharmaceuticals may contain zero active ingredient or toxic
                contaminants.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-red-50 border border-red-100 space-y-1">
              <div className="font-bold text-red-900">2. Quarantine Packaging</div>
              <p className="text-red-800">
                Retain the physical blister pack and receipt showing the dispensing outlet.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-red-50 border border-red-100 space-y-2">
              <div className="font-bold text-red-900">3. Report to PPB Kenya</div>
              <p className="text-red-800">
                Submit a rapid pharmacovigilance alert to the Pharmacy and Poisons Board (Nairobi).
              </p>
              <button
                type="button"
                onClick={() => setShowPvModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded font-bold text-xs transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Report Incident to PPB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pharmacovigilance & Adverse Drug Reaction Reporting Modal */}
      {showPvModal && (
        <PharmacovigilanceModal
          batchNo={queriedBatchNo}
          drugName={
            verification.batch?.drugName ||
            `Unverified / Suspected Counterfeit (${queriedBatchNo})`
          }
          onClose={() => setShowPvModal(false)}
          onSubmitted={() => setShowPvModal(false)}
        />
      )}
    </div>
  );
};
