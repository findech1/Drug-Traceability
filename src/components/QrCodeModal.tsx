import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  ExternalLink,
  X,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Barcode,
} from 'lucide-react';
import { BatchWorldState } from '../chaincode';
import {
  convertDateToYYMMDD,
  formatGS1DigitalLinkUri,
  formatGS1ElementStrings,
  getStandardGtinForBatch,
  GS1DrugAttributes,
} from '../gs1Standard';

interface QrCodeModalProps {
  batch: BatchWorldState | null;
  onClose: () => void;
  onOpenInVerifier: (batchNo: string) => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  batch,
  onClose,
  onOpenInVerifier,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [formatMode, setFormatMode] = useState<'STANDARD' | 'GS1'>('GS1');
  const [copiedLink, setCopiedLink] = useState(false);

  const gs1Attrs: GS1DrugAttributes | null = batch
    ? {
        gtin: getStandardGtinForBatch(batch.batchNo),
        batchNo: batch.batchNo,
        expiryDateYYMMDD: convertDateToYYMMDD(batch.expiryDate),
        serialNo: `SN-${batch.batchNo.slice(-3)}-001`,
        productName: batch.drugName,
      }
    : null;

  const gs1Uri = gs1Attrs ? formatGS1DigitalLinkUri(gs1Attrs) : '';
  const gs1Elements = gs1Attrs ? formatGS1ElementStrings(gs1Attrs) : '';

  useEffect(() => {
    if (!batch) return;
    let isMounted = true;

    const payload =
      formatMode === 'GS1' && gs1Attrs
        ? gs1Uri
        : JSON.stringify({
            protocol: 'PHARMACHAIN-KE-V1',
            batchNo: batch.batchNo,
            drugName: batch.drugName,
            mfg: batch.manufacturerName,
            exp: batch.expiryDate,
          });

    QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      color: {
        dark: '#001F54',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(String(err));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [batch, formatMode, gs1Uri]);

  if (!batch) return null;

  const latestSig =
    batch.custodyHistory.length > 0
      ? batch.custodyHistory[batch.custodyHistory.length - 1].signatureHex
      : '';

  const handleCopyLink = () => {
    if (!gs1Uri) return;
    navigator.clipboard.writeText(gs1Uri);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#001F54] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-[#C9A227]" />
            <div>
              <h3 id="qr-modal-title" className="text-base font-semibold tracking-tight">
                Cryptographic Batch Pack Label
              </h3>
              <p className="text-xs text-slate-300 font-mono">{batch.batchNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {batch.status === 'RECALLED' && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">STATUTORY RECALL ACTIVE:</span> Scanning this QR
                code immediately warns consumers and pharmacists not to use this batch.
              </div>
            </div>
          )}

          {/* Standard vs GS1 Digital Link Toggle */}
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setFormatMode('GS1')}
              className={`flex-1 py-1.5 px-3 rounded-md font-bold transition-colors ${
                formatMode === 'GS1'
                  ? 'bg-white text-[#001F54] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GS1 Digital Link 2D
            </button>
            <button
              type="button"
              onClick={() => setFormatMode('STANDARD')}
              className={`flex-1 py-1.5 px-3 rounded-md font-bold transition-colors ${
                formatMode === 'STANDARD'
                  ? 'bg-white text-[#001F54] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standard Ledger QR
            </button>
          </div>

          <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-4">
            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code for Batch ${batch.batchNo}`}
                className="w-52 h-52 rounded-lg border border-slate-200 bg-white p-2"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-xs text-slate-500">
                Generating Matrix...
              </div>
            )}

            <div className="mt-2 text-center">
              <p className="text-xs font-bold text-slate-900">{batch.drugName}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {batch.manufacturerName} · Exp:{' '}
                <span className="font-mono">{batch.expiryDate}</span>
              </p>
            </div>
          </div>

          {/* GS1 Healthcare Attributes Box */}
          {formatMode === 'GS1' && gs1Attrs && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5 text-[#001F54]" />
                  GS1 Application Identifiers
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">
                  ISO/IEC 15418
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200 break-all select-all">
                {gs1Elements}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500 text-[11px]">GS1 Web URI:</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1 text-[11px] text-[#001F54] font-semibold hover:underline"
                >
                  {copiedLink ? (
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
            </div>
          )}

          <div className="space-y-1.5 text-xs border-t border-slate-200 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Encoded Batch ID</span>
              <span className="font-mono font-semibold text-slate-900">{batch.batchNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Custodian</span>
              <span className="font-medium text-slate-800">{batch.currentHolderName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Latest Signature</span>
              <span className="font-mono text-slate-700">
                {latestSig ? `${latestSig.slice(0, 12)}...${latestSig.slice(-8)}` : 'Signed'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`PharmaChain-${formatMode}-${batch.batchNo}.png`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Download PNG
              </a>
            )}
            <button
              onClick={() => {
                const targetBatch = batch.batchNo;
                onClose();
                onOpenInVerifier(targetBatch);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#001F54] hover:bg-[#002b75] text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#C9A227]" />
              Scan in Verifier
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
