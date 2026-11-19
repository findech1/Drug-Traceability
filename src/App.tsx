import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertOctagon,
  KeyRound,
  X,
  Menu,
  Layers,
  LogOut,
  User,
} from 'lucide-react';
import { BatchWorldState } from './chaincode';
import {
  initializeOrLoadStore,
  ledgerEventBus,
  PersistedLedgerStore,
  RecallAlertEvent,
  resetDemoStore,
} from './store';
import { LandingPage } from './components/LandingPage';
import { RoleDashboard } from './components/RoleDashboard';
import { ConsumerVerifyPage } from './components/ConsumerVerifyPage';
import { LedgerExplorerPage } from './components/LedgerExplorerPage';
import { ArchitecturePage } from './components/ArchitecturePage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { QrCodeModal } from './components/QrCodeModal';
import { TestSuitePage } from './components/TestSuitePage';
import { FABRIC_CHANNELS } from './channels';
import { LoginPage, AuthSession, ORG_OFFICERS } from './components/LoginPage';

type NavTab =
  | 'landing'
  | 'dashboard'
  | 'verify'
  | 'explorer'
  | 'architecture'
  | 'analytics'
  | 'tests';

export function App() {
  const [store, setStore] = useState<PersistedLedgerStore | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    try {
      const saved = localStorage.getItem('pharmachain_auth_session');
      if (saved) {
        return JSON.parse(saved) as AuthSession;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState<NavTab>('landing');
  const [activeOrgId, setActiveOrgId] = useState<string>('REG-PPB');
  const [activeChannelId, setActiveChannelId] = useState<string>('pharma-ke-channel');
  const [verifyBatchNo, setVerifyBatchNo] = useState<string>('KE-ACT-2026-001');
  const [qrModalBatch, setQrModalBatch] = useState<BatchWorldState | null>(null);
  const [liveRecallAlert, setLiveRecallAlert] = useState<RecallAlertEvent | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const refreshStore = useCallback(async () => {
    const loaded = await initializeOrLoadStore();
    setStore({ ...loaded });
  }, []);

  useEffect(() => {
    refreshStore();

    const unsubStore = ledgerEventBus.onStoreChange(() => {
      refreshStore();
    });

    const unsubRecall = ledgerEventBus.onRecall((alert) => {
      setLiveRecallAlert(alert);
      refreshStore();
    });

    return () => {
      unsubStore();
      unsubRecall();
    };
  }, [refreshStore]);

  const handleNavigate = (tab: NavTab, batchNo?: string) => {
    if (batchNo) {
      setVerifyBatchNo(batchNo);
    }
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = (session: AuthSession, targetTab?: 'dashboard' | 'verify') => {
    setAuthSession(session);
    if (!session.isCitizen) {
      setActiveOrgId(session.orgId);
    }
    if (targetTab) {
      setActiveTab(targetTab);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('pharmachain_auth_session');
    } catch {
      // ignore
    }
    setAuthSession(null);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrgChange = (newOrgId: string) => {
    setActiveOrgId(newOrgId);
    if (store && store.organizations[newOrgId]) {
      const newOrg = store.organizations[newOrgId];
      const off = ORG_OFFICERS[newOrgId] || {
        name: 'Authorized Officer',
        title: 'Licensed System Operator',
        email: `officer@${newOrg.mspId.toLowerCase()}.ke`,
        avatarInitials: newOrg.name.slice(0, 2).toUpperCase(),
      };
      const updatedSession: AuthSession = {
        orgId: newOrg.id,
        orgName: newOrg.name,
        orgRole: newOrg.role,
        officerName: off.name,
        officerTitle: off.title,
        officerEmail: off.email,
        mspId: newOrg.mspId,
        loginTimestamp: new Date().toISOString(),
        isCitizen: false,
      };
      setAuthSession(updatedSession);
      try {
        localStorage.setItem('pharmachain_auth_session', JSON.stringify(updatedSession));
      } catch {
        // ignore
      }
    }
    if (activeTab === 'landing') {
      setActiveTab('dashboard');
    }
  };

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      const fresh = await resetDemoStore();
      setStore({ ...fresh });
      setLiveRecallAlert(null);
    } finally {
      setIsResetting(false);
    }
  };

  if (!store) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center space-y-3">
          <div className="w-10 h-10 rounded-lg bg-[#001F54] text-[#C9A227] font-mono font-bold flex items-center justify-center mx-auto">
            PC
          </div>
          <h1 className="text-base font-bold text-slate-900">
            Initializing Permissioned Ledger & Web Crypto MSP Keys...
          </h1>
          <p className="text-xs text-slate-500">
            Generating ECDSA P-256 key pairs for 8 Kenyan organizations and verifying SHA-256
            genesis chain.
          </p>
        </div>
      </div>
    );
  }

  // GATEWAY: User logs in before accessing platform
  if (!authSession) {
    return (
      <LoginPage
        organizations={store.organizations}
        onLogin={handleLogin}
        initialOrgId={activeOrgId}
      />
    );
  }

  const activeOrg = store.organizations[activeOrgId] || Object.values(store.organizations)[0];
  const allBatches = Object.values(store.worldState);

  // Check if current active organization holds any recalled batch
  const activeOrgRecalledBatches = allBatches.filter(
    (b) =>
      b.status === 'RECALLED' &&
      (b.currentHolderOrgId === activeOrg.id || b.pendingRecipientOrgId === activeOrg.id)
  );

  const navItems: Array<{ id: NavTab; label: string }> = [
    { id: 'landing', label: 'Overview' },
    { id: 'dashboard', label: 'Role Console' },
    { id: 'verify', label: 'Consumer Verify' },
    { id: 'explorer', label: 'Ledger Explorer' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'tests', label: 'Test Suite' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* TOP BAR CONTRACT: 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#001F54] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('landing');
            }}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            PharmaChain
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs xl:text-sm font-medium">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate(item.id);
                  }}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? 'text-[#C9A227] border-[#C9A227] font-semibold'
                      : 'text-slate-200 border-transparent hover:text-white hover:border-white/40'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Authenticated Officer / Citizen Pill + Primary Action */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Authenticated User Badge */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs">
              <div className="w-6 h-6 rounded-full bg-[#C9A227] text-[#001F54] font-bold text-[10px] flex items-center justify-center shrink-0">
                {authSession.isCitizen ? 'C' : authSession.officerName.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left max-w-[130px] lg:max-w-[180px]">
                <div className="font-semibold text-white truncate text-[11px] leading-tight">
                  {authSession.isCitizen ? 'Public Citizen' : authSession.officerName}
                </div>
                <div className="text-white/60 text-[9px] truncate leading-tight">
                  {authSession.isCitizen ? 'Patient Portal' : authSession.orgName}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer ml-0.5 transition-colors"
                title="Log Out & Switch Identity"
              >
                <LogOut className="w-3.5 h-3.5 text-white/70 hover:text-white" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleNavigate('verify', 'KE-ACT-2026-001')}
              className="px-3.5 py-2 text-xs font-semibold text-[#001F54] bg-[#C9A227] hover:bg-[#d8b132] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs active:scale-95"
            >
              Verify Batch
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 cursor-pointer"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#00153B] border-t border-white/10 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#C9A227] text-[#001F54] font-bold text-xs flex items-center justify-center shrink-0">
                  {authSession.isCitizen ? 'C' : authSession.officerName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate text-[#C9A227]">
                    {authSession.isCitizen ? 'Public Citizen' : authSession.officerName}
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">
                    {authSession.isCitizen ? 'Consumer Verification' : authSession.orgName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30 font-semibold text-xs flex items-center gap-1 cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                Log Out
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center justify-center ${
                    activeTab === item.id
                      ? 'bg-[#C9A227] text-[#001F54] shadow-xs'
                      : 'text-slate-200 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* WORKSPACE CONTEXT TOOLBAR: Quick Role/Org Switcher & Active Recall Notification */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <span className="font-semibold text-slate-600 flex items-center gap-1.5 shrink-0">
              <KeyRound className="w-3.5 h-3.5 text-[#001F54]" />
              Peer Login:
            </span>
            <select
              aria-label="Switch Active Organization Login"
              value={activeOrg.id}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="px-2.5 py-1 rounded-md border border-slate-300 bg-slate-50 font-semibold text-[#001F54] focus:outline-none focus:border-[#001F54] text-xs max-w-[240px] sm:max-w-none truncate cursor-pointer"
            >
              {Object.values(store.organizations).map((org) => (
                <option key={org.id} value={org.id}>
                  [{org.role}] {org.name} ({org.mspId})
                </option>
              ))}
            </select>
            <span className="hidden xl:inline text-slate-400 font-mono">
              · {activeOrg.keys.publicKeyFingerprint}
            </span>

            <div className="flex items-center gap-1.5 sm:pl-2 sm:border-l sm:border-slate-200">
              <span className="font-semibold text-slate-600 flex items-center gap-1 shrink-0">
                <Layers className="w-3.5 h-3.5 text-[#001F54]" />
                Channel:
              </span>
              <select
                aria-label="Switch Active Hyperledger Fabric Channel"
                value={activeChannelId}
                onChange={(e) => setActiveChannelId(e.target.value)}
                className="px-2 py-1 rounded-md border border-slate-300 bg-slate-50 font-semibold text-[#001F54] focus:outline-none focus:border-[#001F54] text-xs cursor-pointer"
              >
                {Object.values(FABRIC_CHANNELS).map((chan) => (
                  <option key={chan.id} value={chan.id}>
                    {chan.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
              title="Return to Login Gateway"
            >
              <LogOut className="w-3 h-3 text-slate-500" />
              <span>Log Out</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-slate-500 font-mono">
            <span>Blocks: {store.blocks.length}</span>
            <span>·</span>
            <span>Batches: {allBatches.length}</span>
            {activeOrgRecalledBatches.length > 0 && (
              <>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleNavigate('dashboard')}
                  className="text-red-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  {activeOrgRecalledBatches.length} Recalled Batch Held!
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GLOBAL REAL-TIME RECALL EVENT BROADCAST BANNER */}
      {liveRecallAlert && (
        <div
          role="alert"
          className="bg-red-700 text-white border-b border-red-900 px-4 sm:px-6 py-3"
        >
          <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm">
              <AlertOctagon className="w-5 h-5 text-white shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold uppercase tracking-wide">
                  LIVE SMART CONTRACT RECALL EVENT ({liveRecallAlert.batchNo}):
                </span>{' '}
                <span>
                  {liveRecallAlert.drugName} recalled by {liveRecallAlert.recalledBy}. Alert pushed
                  to current holder <strong>{liveRecallAlert.currentHolderName}</strong> —{' '}
                  <em>"{liveRecallAlert.reason}"</em>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleNavigate('verify', liveRecallAlert.batchNo)}
                className="px-3 py-1 rounded bg-white text-red-800 text-xs font-bold hover:bg-red-50 transition-colors cursor-pointer"
              >
                Inspect in Verifier
              </button>
              <button
                type="button"
                onClick={() => setLiveRecallAlert(null)}
                className="p-1 rounded hover:bg-red-800 text-white"
                aria-label="Dismiss Recall Banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN PAGE VIEWPORT */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 pt-6">
        {activeTab === 'landing' && (
          <LandingPage store={store} onNavigate={handleNavigate} />
        )}

        {activeTab === 'dashboard' && (
          <RoleDashboard
            store={store}
            activeOrgId={activeOrg.id}
            activeChannelId={activeChannelId}
            onSelectOrg={(orgId) => setActiveOrgId(orgId)}
            onSelectChannel={(chanId) => setActiveChannelId(chanId)}
            onOpenQrModal={(batch) => setQrModalBatch(batch)}
            onInspectInVerifier={(batchNo) => handleNavigate('verify', batchNo)}
          />
        )}

        {activeTab === 'verify' && (
          <ConsumerVerifyPage
            store={store}
            initialBatchNo={verifyBatchNo}
            activeOrgId={activeOrg.id}
          />
        )}

        {activeTab === 'explorer' && (
          <LedgerExplorerPage store={store} onResetDemo={handleResetDemo} />
        )}

        {activeTab === 'architecture' && <ArchitecturePage />}

        {activeTab === 'analytics' && (
          <AnalyticsPage
            store={store}
            onInspectBatch={(batchNo) => handleNavigate('verify', batchNo)}
          />
        )}

        {activeTab === 'tests' && <TestSuitePage />}
      </main>

      {/* QR CODE MODAL */}
      <QrCodeModal
        batch={qrModalBatch}
        onClose={() => setQrModalBatch(null)}
        onOpenInVerifier={(batchNo) => handleNavigate('verify', batchNo)}
      />

      {/* CLEAN FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-5 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong className="text-[#001F54]">PharmaChain</strong> — Permissioned Drug
            Traceability Ledger aligned with UN SDG 3 (Good Health and Well-Being).
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleNavigate('verify', 'KE-ACT-2026-001')}
              className="hover:text-[#001F54] underline cursor-pointer"
            >
              Consumer QR Verifier
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('explorer')}
              className="hover:text-[#001F54] underline cursor-pointer"
            >
              Validate SHA-256 Chain
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('architecture')}
              className="hover:text-[#001F54] underline cursor-pointer"
            >
              Fabric Architecture
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('tests')}
              className="hover:text-[#001F54] underline cursor-pointer"
            >
              Test Suite
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
