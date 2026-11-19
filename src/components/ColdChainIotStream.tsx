import React, { useState } from 'react';
import {
  Thermometer,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Plus,
  Clock,
  MapPin,
  RefreshCw,
  Flame,
} from 'lucide-react';
import {
  ColdChainTelemetryRecord,
  loadIotTelemetryStore,
  saveIotTelemetryRecord,
  TemperatureReading,
} from '../iotTelemetry';

interface ColdChainIotStreamProps {
  batchNo: string;
  storageTempSpec: string;
}

export const ColdChainIotStream: React.FC<ColdChainIotStreamProps> = ({
  batchNo,
  storageTempSpec,
}) => {
  const [telemetryStore, setTelemetryStore] = useState(loadIotTelemetryStore);
  const [simTemp, setSimTemp] = useState<number>(5.5);
  const [simLocation, setSimLocation] = useState<string>('Nairobi Highway Cold Van');
  const [isSimulating, setIsSimulating] = useState(false);

  const record: ColdChainTelemetryRecord = telemetryStore[batchNo] || {
    batchNo,
    sensorDeviceId: `IoT-Sens-${batchNo.slice(-3)}`,
    minAllowedTemp: 2.0,
    maxAllowedTemp: 8.0,
    hasBreached: false,
    readings: [
      {
        timestamp: new Date().toISOString(),
        temperatureCelsius: 4.8,
        humidityPercent: 49,
        location: 'Monitored Storage Hub',
        isBreached: false,
      },
    ],
  };

  const latestReading = record.readings[record.readings.length - 1];

  const handleSimulatePing = (forcedBreach: boolean = false) => {
    setIsSimulating(true);
    const readingTemp = forcedBreach ? 9.8 : Number(simTemp);
    const isBreached =
      readingTemp < record.minAllowedTemp || readingTemp > record.maxAllowedTemp;

    const newReading: TemperatureReading = {
      timestamp: new Date().toISOString(),
      temperatureCelsius: readingTemp,
      humidityPercent: Math.round(45 + Math.random() * 10),
      location: simLocation || 'Expressway Logistics Van',
      isBreached,
    };

    const updatedRecord: ColdChainTelemetryRecord = {
      ...record,
      hasBreached: record.hasBreached || isBreached,
      breachSummary:
        isBreached && !record.breachSummary
          ? `Thermal excursion detected: +${readingTemp}°C exceeded ${record.maxAllowedTemp}°C safe boundary.`
          : record.breachSummary,
      readings: [...record.readings, newReading],
    };

    saveIotTelemetryRecord(updatedRecord);
    setTelemetryStore(loadIotTelemetryStore());
    setTimeout(() => setIsSimulating(false), 200);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#001F54] text-[#C9A227] flex items-center justify-center shrink-0">
            <Thermometer className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                Cold-Chain IoT Sensor Telemetry
              </h4>
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                LIVE SENSOR
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Device: {record.sensorDeviceId} · Safe Threshold: {record.minAllowedTemp}°C –{' '}
              {record.maxAllowedTemp}°C
            </p>
          </div>
        </div>

        {/* Current status pill */}
        <div>
          {record.hasBreached ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              THERMAL EXCURSION RECORDED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ALL READINGS WITHIN RANGE
            </span>
          )}
        </div>
      </div>

      {/* Excursion Warning Banner if breached */}
      {record.hasBreached && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">IoT Oracle Excursion Flag:</span>{' '}
            {record.breachSummary ||
              'Temperature exceeded acceptable threshold during cold-chain custody transit.'}
          </div>
        </div>
      )}

      {/* Current Gauge Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-slate-500 font-medium text-[11px] flex items-center gap-1">
            <Thermometer className="w-3.5 h-3.5 text-[#001F54]" />
            Current Temp
          </div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              latestReading?.isBreached ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {latestReading ? `${latestReading.temperatureCelsius.toFixed(1)}°C` : 'N/A'}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-slate-500 font-medium text-[11px] flex items-center gap-1">
            <Droplets className="w-3.5 h-3.5 text-blue-600" />
            Relative Humidity
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {latestReading ? `${latestReading.humidityPercent}%` : 'N/A'}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-slate-500 font-medium text-[11px]">Storage Target</div>
          <div className="text-xs font-semibold text-slate-800 mt-1 truncate">
            {storageTempSpec || `${record.minAllowedTemp}°C - ${record.maxAllowedTemp}°C`}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-slate-500 font-medium text-[11px]">Total Data Points</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {record.readings.length}
          </div>
        </div>
      </div>

      {/* Interactive Time-series Log Table */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Telemetry Transmission Log (Oracles)
        </div>
        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2">Timestamp</th>
                <th className="p-2">Location / Waypoint</th>
                <th className="p-2">Temperature</th>
                <th className="p-2">Humidity</th>
                <th className="p-2">Oracle Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...record.readings].reverse().map((r, idx) => (
                <tr
                  key={idx}
                  className={r.isBreached ? 'bg-amber-50/80 font-medium' : 'hover:bg-slate-50'}
                >
                  <td className="p-2 font-mono text-slate-500 whitespace-nowrap">
                    {r.timestamp.slice(11, 19)} ({r.timestamp.slice(5, 10)})
                  </td>
                  <td className="p-2 text-slate-800">{r.location}</td>
                  <td
                    className={`p-2 font-mono font-bold ${
                      r.isBreached ? 'text-amber-700' : 'text-slate-900'
                    }`}
                  >
                    {r.temperatureCelsius.toFixed(1)}°C
                  </td>
                  <td className="p-2 font-mono text-slate-600">{r.humidityPercent}%</td>
                  <td className="p-2">
                    {r.isBreached ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                        BREACH (+{r.temperatureCelsius}°C)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        NORMAL
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Simulation Controls */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
        <div className="font-bold text-slate-800 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-[#001F54]" />
          Simulate IoT Sensor Transmission Ping
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            step="0.1"
            value={simTemp}
            onChange={(e) => setSimTemp(parseFloat(e.target.value) || 0)}
            className="w-20 px-2 py-1.5 rounded border border-slate-300 bg-white font-mono text-xs focus:outline-none"
            placeholder="Temp °C"
          />
          <span className="text-slate-500">°C at</span>
          <input
            type="text"
            value={simLocation}
            onChange={(e) => setSimLocation(e.target.value)}
            className="flex-1 min-w-[150px] px-2 py-1.5 rounded border border-slate-300 bg-white text-xs focus:outline-none"
            placeholder="Waypoint location..."
          />
          <button
            type="button"
            disabled={isSimulating}
            onClick={() => handleSimulatePing(false)}
            className="px-3 py-1.5 rounded bg-[#001F54] hover:bg-[#002b75] text-white font-semibold cursor-pointer transition-colors"
          >
            Transmit Ping
          </button>
          <button
            type="button"
            disabled={isSimulating}
            onClick={() => handleSimulatePing(true)}
            className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer transition-colors"
          >
            Simulate Thermal Spike (+9.8°C)
          </button>
        </div>
      </div>
    </div>
  );
};
