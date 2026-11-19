/**
 * ============================================================================
 * MODULE: iotTelemetry.ts
 * HYPERLEDGER FABRIC / ORACLE INTEGRATION EQUIVALENT:
 *   - Cold-Chain IoT Sensor Telemetry (BLE / Cellular Data Loggers)
 *   - Temperature & Humidity time-series data during pharmaceutical transit
 *   - Automated Chaincode Oracles triggering regulatory flags upon threshold breach
 * ============================================================================
 */

export interface TemperatureReading {
  timestamp: string;
  temperatureCelsius: number;
  humidityPercent: number;
  location: string;
  isBreached: boolean;
}

export interface ColdChainTelemetryRecord {
  batchNo: string;
  sensorDeviceId: string;
  minAllowedTemp: number; // e.g. 2°C
  maxAllowedTemp: number; // e.g. 8°C
  readings: TemperatureReading[];
  hasBreached: boolean;
  breachSummary?: string;
}

const IOT_STORAGE_KEY = 'pharmachain_iot_coldchain_telemetry_v1';

export const SEED_IOT_TELEMETRY: Record<string, ColdChainTelemetryRecord> = {
  'KE-INS-2026-005': {
    batchNo: 'KE-INS-2026-005',
    sensorDeviceId: 'IoT-Sens-MombasaRd-941',
    minAllowedTemp: 2.0,
    maxAllowedTemp: 8.0,
    hasBreached: true,
    breachSummary:
      'Thermal excursion detected: +9.4°C sustained for 45 minutes on Mombasa Road transit van (Exceeded 8.0°C threshold).',
    readings: [
      {
        timestamp: '2026-02-19T08:00:00Z',
        temperatureCelsius: 4.2,
        humidityPercent: 48,
        location: 'Cosmos Cold Storage Facility (Nairobi)',
        isBreached: false,
      },
      {
        timestamp: '2026-02-19T09:30:00Z',
        temperatureCelsius: 4.8,
        humidityPercent: 50,
        location: 'Loaded onto Refrigerated Transit Van KDH-204K',
        isBreached: false,
      },
      {
        timestamp: '2026-02-19T11:15:00Z',
        temperatureCelsius: 7.9,
        humidityPercent: 53,
        location: 'Mombasa Road Expressway Transit',
        isBreached: false,
      },
      {
        timestamp: '2026-02-19T12:00:00Z',
        temperatureCelsius: 9.4,
        humidityPercent: 56,
        location: 'Refrigeration compressor power interruption on Mombasa Rd',
        isBreached: true,
      },
      {
        timestamp: '2026-02-19T12:45:00Z',
        temperatureCelsius: 8.8,
        humidityPercent: 54,
        location: 'Backup diesel generator initiated',
        isBreached: true,
      },
      {
        timestamp: '2026-02-19T13:30:00Z',
        temperatureCelsius: 4.6,
        humidityPercent: 49,
        location: 'Temperature normalized to 4.6°C',
        isBreached: false,
      },
      {
        timestamp: '2026-02-19T14:40:00Z',
        temperatureCelsius: 4.1,
        humidityPercent: 48,
        location: 'Received at MEDS Mombasa Rd Supply Hub Cold Room B',
        isBreached: false,
      },
    ],
  },
  'KE-ACT-2026-001': {
    batchNo: 'KE-ACT-2026-001',
    sensorDeviceId: 'IoT-Sens-Universal-402',
    minAllowedTemp: 15.0,
    maxAllowedTemp: 30.0,
    hasBreached: false,
    readings: [
      {
        timestamp: '2026-01-18T11:15:00Z',
        temperatureCelsius: 22.1,
        humidityPercent: 42,
        location: 'Universal Kikuyu Plant Dispatch',
        isBreached: false,
      },
      {
        timestamp: '2026-01-18T14:00:00Z',
        temperatureCelsius: 24.5,
        humidityPercent: 44,
        location: 'Transit via Southern Bypass',
        isBreached: false,
      },
      {
        timestamp: '2026-01-19T14:20:00Z',
        temperatureCelsius: 21.8,
        humidityPercent: 41,
        location: 'KEMSA Embakasi Depot Ambient Bay #4',
        isBreached: false,
      },
    ],
  },
};

export function loadIotTelemetryStore(): Record<string, ColdChainTelemetryRecord> {
  try {
    const raw = window.localStorage.getItem(IOT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return { ...SEED_IOT_TELEMETRY };
}

export function saveIotTelemetryRecord(record: ColdChainTelemetryRecord): void {
  const current = loadIotTelemetryStore();
  current[record.batchNo] = record;
  try {
    window.localStorage.setItem(IOT_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}
