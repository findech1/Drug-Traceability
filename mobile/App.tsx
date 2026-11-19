import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  API_BASE_URL,
  verifyBatchApi,
  fetchLedgerStateApi,
  invokeFabricChaincodeApi,
  parseScannedPayloadToBatchNo,
  MobileBatchRecord,
} from './src/api';

type MobileTab = 'verify' | 'custody';

export default function App() {
  const [activeTab, setActiveTab] = useState<MobileTab>('verify');
  const [batchInput, setBatchInput] = useState<string>('KE-ACT-2026-001');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verifiedBatch, setVerifiedBatch] = useState<MobileBatchRecord | null>(null);
  const [dataSource, setDataSource] = useState<string>('');
  const [notFoundSerial, setNotFoundSerial] = useState<string | null>(null);

  const [scannerVisible, setScannerVisible] = useState<boolean>(false);
  const [permission, requestPermission] = useCameraPermissions();

  const [ledgerBatches, setLedgerBatches] = useState<MobileBatchRecord[]>([]);
  const [custodyFeedback, setCustodyFeedback] = useState<string | null>(null);

  const handleVerify = async (targetBatch?: string) => {
    const query = (targetBatch ?? batchInput).trim().toUpperCase();
    if (!query) return;
    setLoading(true);
    setErrorMsg(null);
    setNotFoundSerial(null);
    try {
      const res = await verifyBatchApi(query);
      setDataSource(res.source);
      const record = res.batch || (res.result && res.result.batchNo ? res.result : null);
      if (!record || res.result?.verified === false) {
        setVerifiedBatch(null);
        setNotFoundSerial(query);
      } else {
        setVerifiedBatch(record);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error connecting to Node.js Gateway');
    } finally {
      setLoading(false);
    }
  };

  const loadCustodyBatches = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchLedgerStateApi();
      setLedgerBatches(res.batches || []);
      setDataSource(res.source);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach Node.js Gateway');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void handleVerify('KE-ACT-2026-001');
  }, []);

  const openQrScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setErrorMsg('Camera permission is required to scan GS1 QR labels.');
        return;
      }
    }
    setScannerVisible(true);
  };

  const handleBarcodeScanned = (event: { data: string }) => {
    setScannerVisible(false);
    const extracted = parseScannedPayloadToBatchNo(event.data);
    setBatchInput(extracted);
    void handleVerify(extracted);
  };

  const handleReceiveAction = async (batchNo: string) => {
    setCustodyFeedback(null);
    try {
      await invokeFabricChaincodeApi('receiveBatch', [batchNo]);
      setCustodyFeedback(`Received ${batchNo} via Hyperledger Fabric Gateway.`);
      await loadCustodyBatches();
    } catch (err) {
      setCustodyFeedback(err instanceof Error ? err.message : 'Fabric invocation unavailable');
    }
  };

  const isExpired = verifiedBatch
    ? new Date(verifiedBatch.expiryDate).getTime() < Date.now()
    : false;
  const isRecalled = verifiedBatch?.status === 'RECALLED';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Sovereign Header */}
      <View style={styles.header}>
        <Text style={styles.sdgTag}>UN SDG 3 · PHARMACY & POISONS BOARD KENYA</Text>
        <Text style={styles.headerTitle}>PharmaChain Mobile</Text>
        <Text style={styles.headerSubtitle}>Gateway: {API_BASE_URL}</Text>

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'verify' && styles.tabBtnActive]}
            onPress={() => setActiveTab('verify')}
          >
            <Text style={[styles.tabText, activeTab === 'verify' && styles.tabTextActive]}>
              Verify & Scan QR
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'custody' && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab('custody');
              void loadCustodyBatches();
            }}
          >
            <Text style={[styles.tabText, activeTab === 'custody' && styles.tabTextActive]}>
              Field Custody
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'verify' ? (
          <View style={styles.sectionGap}>
            {/* Search & Camera Scan Box */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Inspect Medicine Batch</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={batchInput}
                  onChangeText={setBatchInput}
                  placeholder="Enter Batch No (e.g. KE-ACT-2026-001)"
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleVerify()}>
                  <Text style={styles.primaryBtnText}>Verify</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.scanBtn} onPress={() => void openQrScanner()}>
                <Text style={styles.scanBtnText}>Open Camera QR / GS1 DataMatrix Scanner</Text>
              </TouchableOpacity>

              {/* Quick Scenarios */}
              <View style={styles.quickRow}>
                {[
                  { label: 'Authentic', id: 'KE-ACT-2026-001' },
                  { label: 'Recalled', id: 'KE-PCM-2026-999' },
                  { label: 'Expired', id: 'KE-CIP-2024-089' },
                  { label: 'Counterfeit', id: 'FAKE-MOMBASA-404' },
                ].map((q) => (
                  <TouchableOpacity
                    key={q.id}
                    style={styles.quickChip}
                    onPress={() => {
                      setBatchInput(q.id);
                      void handleVerify(q.id);
                    }}
                  >
                    <Text style={styles.quickChipText}>{q.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {loading && <ActivityIndicator size="large" color="#001F54" />}

            {errorMsg && (
              <View style={[styles.card, styles.dangerBorder]}>
                <Text style={styles.dangerTitle}>Gateway Connection Notice</Text>
                <Text style={styles.bodyText}>{errorMsg}</Text>
              </View>
            )}

            {/* Counterfeit Alert */}
            {notFoundSerial && (
              <View style={[styles.card, styles.dangerBg]}>
                <Text style={styles.dangerTitle}>UNREGISTERED COUNTERFEIT ALERT</Text>
                <Text style={styles.bodyText}>
                  Serial "{notFoundSerial}" does not exist in CouchDB / Hyperledger Fabric World State. Do not dispense or consume.
                </Text>
              </View>
            )}

            {/* Verified Batch Card */}
            {verifiedBatch && (
              <View
                style={[
                  styles.card,
                  isRecalled ? styles.dangerBg : isExpired ? styles.warnBg : styles.safeBg,
                ]}
              >
                <Text style={styles.statusTag}>
                  {isRecalled
                    ? 'RECALLED — DO NOT USE'
                    : isExpired
                    ? 'EXPIRED — DISPENSING BLOCKED'
                    : 'AUTHENTIC & VERIFIED'}
                </Text>
                <Text style={styles.drugTitle}>{verifiedBatch.drugName}</Text>
                <Text style={styles.metaLine}>
                  Batch: {verifiedBatch.batchNo} · Source: {dataSource}
                </Text>
                <Text style={styles.metaLine}>
                  Custodian: {verifiedBatch.currentHolderName || verifiedBatch.currentHolderMspId}
                </Text>
                <Text style={styles.metaLine}>
                  Expiry: {verifiedBatch.expiryDate} · Remaining: {verifiedBatch.currentQuantity} units
                </Text>
                {verifiedBatch.recalledReason && (
                  <Text style={styles.recallText}>{verifiedBatch.recalledReason}</Text>
                )}

                {verifiedBatch.custodyHistory && verifiedBatch.custodyHistory.length > 0 && (
                  <View style={styles.timelineBox}>
                    <Text style={styles.timelineHeader}>
                      Signed Custody Trail ({verifiedBatch.custodyHistory.length} events)
                    </Text>
                    {verifiedBatch.custodyHistory.map((ev, idx) => (
                      <View key={ev.txId + idx} style={styles.timelineItem}>
                        <Text style={styles.timelineAction}>
                          #{idx + 1} {ev.action} · {ev.actorName || ev.actorMspId}
                        </Text>
                        {ev.notes && <Text style={styles.timelineNotes}>{ev.notes}</Text>}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          /* FIELD CUSTODY SCREEN */
          <View style={styles.sectionGap}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Consortium World State ({ledgerBatches.length})</Text>
              <Text style={styles.metaLine}>Source: {dataSource || 'Node.js API Gateway'}</Text>
              {custodyFeedback && <Text style={styles.feedbackText}>{custodyFeedback}</Text>}
            </View>

            {ledgerBatches.map((b) => (
              <View key={b.batchNo} style={styles.card}>
                <Text style={styles.drugTitle}>{b.drugName}</Text>
                <Text style={styles.metaLine}>
                  {b.batchNo} · Status: {b.status}
                </Text>
                <Text style={styles.metaLine}>
                  Holder: {b.currentHolderName || b.currentHolderMspId} · Qty: {b.currentQuantity}
                </Text>
                {b.status === 'IN_TRANSIT' && (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { marginTop: 10 }]}
                    onPress={() => void handleReceiveAction(b.batchNo)}
                  >
                    <Text style={styles.primaryBtnText}>Accept Custody on Fabric</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Camera QR Modal */}
      <Modal visible={scannerVisible} animationType="slide">
        <SafeAreaView style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'datamatrix'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerLabel}>Align Medicine GS1 QR / DataMatrix Code</Text>
            <TouchableOpacity style={styles.closeScanBtn} onPress={() => setScannerVisible(false)}>
              <Text style={styles.closeScanText}>Cancel Scan</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#001F54', padding: 16, paddingTop: 12 },
  sdgTag: { color: '#C9A227', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  headerSubtitle: { color: '#CBD5E1', fontSize: 11, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#C9A227' },
  tabText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#001F54' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionGap: { gap: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: '#F8FAFC',
  },
  primaryBtn: {
    backgroundColor: '#001F54',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  scanBtn: {
    marginTop: 10,
    backgroundColor: '#C9A227',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanBtnText: { color: '#001F54', fontWeight: '800', fontSize: 13 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickChipText: { fontSize: 11, fontWeight: '600', color: '#0F172A' },
  safeBg: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  warnBg: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  dangerBg: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  dangerBorder: { borderColor: '#EF4444' },
  statusTag: { fontSize: 11, fontWeight: '800', color: '#001F54', marginBottom: 4 },
  drugTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  metaLine: { fontSize: 12, color: '#475569', marginTop: 3 },
  recallText: { fontSize: 12, fontWeight: '700', color: '#B91C1C', marginTop: 8 },
  dangerTitle: { fontSize: 14, fontWeight: '800', color: '#B91C1C', marginBottom: 4 },
  bodyText: { fontSize: 12, color: '#334155' },
  feedbackText: { fontSize: 12, color: '#0369A1', fontWeight: '600', marginTop: 6 },
  timelineBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#CBD5E1', gap: 8 },
  timelineHeader: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  timelineItem: { backgroundColor: '#FFFFFF', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  timelineAction: { fontSize: 12, fontWeight: '700', color: '#001F54' },
  timelineNotes: { fontSize: 11, color: '#475569', marginTop: 2 },
  scannerContainer: { flex: 1, backgroundColor: '#000000' },
  scannerOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,31,84,0.9)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
  },
  scannerLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  closeScanBtn: { backgroundColor: '#C9A227', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  closeScanText: { color: '#001F54', fontWeight: '800', fontSize: 13 },
});
