import { Platform } from 'react-native';

/**
 * Resolves the Node.js Express API Gateway URL:
 * - Set EXPO_PUBLIC_API_URL in mobile/.env for physical devices on LAN (e.g., http://192.168.1.42:3000)
 * - Uses 10.0.2.2 for Android Emulator, localhost for iOS Simulator / Web
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

export interface MobileCustodyEvent {
  txId: string;
  blockIndex?: number;
  timestamp: string;
  action: string;
  actorName?: string;
  actorMspId: string;
  notes?: string;
}

export interface MobileBatchRecord {
  batchNo: string;
  drugName: string;
  activeIngredient?: string;
  dosageForm?: string;
  manufacturerName?: string;
  manufacturerMspId?: string;
  manufactureDate: string;
  expiryDate: string;
  currentQuantity: number;
  initialQuantity: number;
  currentHolderName?: string;
  currentHolderMspId?: string;
  status: string;
  recalledReason?: string | null;
  storageTemp?: string;
  custodyHistory?: MobileCustodyEvent[];
}

export interface MobileVerifyResponse {
  found?: boolean;
  source: string;
  batch?: MobileBatchRecord | null;
  result?: MobileBatchRecord & { verified?: boolean; status?: string };
}

export async function verifyBatchApi(batchNo: string): Promise<MobileVerifyResponse> {
  const clean = batchNo.trim().toUpperCase();
  const res = await fetch(`${API_BASE_URL}/api/verify/${encodeURIComponent(clean)}`);
  if (!res.ok) {
    throw new Error(`API HTTP ${res.status}`);
  }
  return (await res.json()) as MobileVerifyResponse;
}

export async function fetchLedgerStateApi(): Promise<{
  source: string;
  count: number;
  batches: MobileBatchRecord[];
}> {
  const res = await fetch(`${API_BASE_URL}/api/ledger/state`);
  if (!res.ok) {
    throw new Error(`API HTTP ${res.status}`);
  }
  return res.json();
}

export async function invokeFabricChaincodeApi(fn: string, args: string[]) {
  const res = await fetch(`${API_BASE_URL}/api/fabric/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn, args }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

/**
 * Extracts Batch No from either raw serial ("KE-ACT-2026-001") or GS1 Digital Link URI
 * e.g. https://id.pharmachain.ke/01/616.../10/KE-ACT-2026-001/17/...
 */
export function parseScannedPayloadToBatchNo(rawData: string): string {
  const text = rawData.trim();
  const gs1Match = text.match(/\/10\/([^/]+)/i);
  if (gs1Match && gs1Match[1]) {
    return decodeURIComponent(gs1Match[1]).toUpperCase();
  }
  const paramMatch = text.match(/[?&]batch=([^&]+)/i);
  if (paramMatch && paramMatch[1]) {
    return decodeURIComponent(paramMatch[1]).toUpperCase();
  }
  return text.toUpperCase();
}
