import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  KeyRound,
  Lock,
  UserCheck,
  QrCode,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Layers,
  FileCheck2,
  Scale,
  Pill,
  Truck,
  HeartPulse,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react';
import { OrganizationMSP, OrgRole } from '../ledger';
import { FABRIC_CHANNELS, isOrgAuthorizedForChannel } from '../channels';

export interface OfficerProfile {
  name: string;
  title: string;
  email: string;
  avatarInitials: string;
}

export const ORG_OFFICERS: Record<string, OfficerProfile> = {
  'MFG-DAWA': {
    name: 'Dr. Patrick Kimani',
    title: 'Head of Quality Assurance & Serialization',
    email: 'p.kimani@dawalife.co.ke',
    avatarInitials: 'PK',
  },
  'MFG-COSMOS': {
    name: 'Beatrice Wanjala',
    title: 'Director of Pharmaceutical Manufacturing',
    email: 'b.wanjala@cosmos-pharm.ke',
    avatarInitials: 'BW',
  },
  'MFG-UNIVERSAL': {
    name: 'Kevin Kipkorir',
    title: 'Supply Chain Operations Superintendent',
    email: 'k.kipkorir@ucl.co.ke',
    avatarInitials: 'KK',
  },
  'DIST-KEMSA': {
    name: 'Eng. David Otieno',
    title: 'National Distribution & Cold-Chain Logistics Manager',
    email: 'd.otieno@kemsa.go.ke',
    avatarInitials: 'DO',
  },
  'DIST-MEDS': {
    name: 'Sister Angela Muthoni',
    title: 'Quality Verification & Supply Superintendent',
    email: 'a.muthoni@meds.or.ke',
    avatarInitials: 'AM',
  },
  'PHARM-GOODLIFE': {
    name: 'Dr. Mary Wanjiku, BPharm',
    title: 'Superintendent Dispensing Pharmacist',
    email: 'm.wanjiku@goodlife.co.ke',
    avatarInitials: 'MW',
  },
  'PHARM-KNH': {
    name: 'Dr. Samuel Karanja',
    title: 'Chief Hospital Pharmacist & Clinical Supply',
    email: 's.karanja@knh.or.ke',
    avatarInitials: 'SK',
  },
  'REG-PPB': {
    name: 'Dr. Amina Ochieng',
    title: 'Chief Inspector & Pharmacovigilance Director',
    email: 'a.ochieng@pharmacyboardkenya.org',
    avatarInitials: 'AO',
  },
};

export interface AuthSession {
  orgId: string;
  orgName: string;
  orgRole: OrgRole;
  officerName: string;
  officerTitle: string;
  officerEmail: string;
  mspId: string;
  loginTimestamp: string;
  isCitizen?: boolean;
}

interface LoginPageProps {
  organizations: Record<string, OrganizationMSP>;
  onLogin: (session: AuthSession, targetTab?: 'dashboard' | 'verify') => void;
  initialOrgId?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  organizations,
  onLogin,
  initialOrgId = 'REG-PPB',
}) => {
  const [authMode, setAuthMode] = useState<'enterprise' | 'citizen'>('enterprise');
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    organizations[initialOrgId] ? initialOrgId : Object.keys(organizations)[0] || 'REG-PPB'
  );
  const [password, setPassword] = useState<string>('••••••••••••');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [patientBatchNo, setPatientBatchNo] = useState<string>('KE-ACT-2026-001');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedOrg = organizations[selectedOrgId] || Object.values(organizations)[0];
  const officer = ORG_OFFICERS[selectedOrgId] || {
    name: 'Authorized Officer',
    title: 'Licensed System Operator',
    email: `officer@${selectedOrg.mspId.toLowerCase()}.ke`,
    avatarInitials: selectedOrg.name.slice(0, 2).toUpperCase(),
  };

  const handleEnterpriseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      const session: AuthSession = {
        orgId: selectedOrg.id,
        orgName: selectedOrg.name,
        orgRole: selectedOrg.role,
        officerName: officer.name,
        officerTitle: officer.title,
        officerEmail: officer.email,
        mspId: selectedOrg.mspId,
        loginTimestamp: new Date().toISOString(),
        isCitizen: false,
      };
      if (rememberMe) {
        try {
          localStorage.setItem('pharmachain_auth_session', JSON.stringify(session));
        } catch {
          // ignore quota
        }
      }
      setIsSubmitting(false);
      onLogin(session, 'dashboard');
    }, 400);
  };

  const handleCitizenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const session: AuthSession = {
      orgId: 'CITIZEN-PUBLIC',
      orgName: 'Public Citizen / Patient Portal',
      orgRole: 'Pharmacy',
      officerName: 'Kenyan Citizen / Patient',
      officerTitle: 'Public Consumer Verification',
      officerEmail: 'public-access@pharmacyboardkenya.org',
      mspId: 'PublicConsumerMSP',
      loginTimestamp: new Date().toISOString(),
      isCitizen: true,
    };
    if (rememberMe) {
      try {
        localStorage.setItem('pharmachain_auth_session', JSON.stringify(session));
      } catch {
        // ignore
      }
    }
    onLogin(session, 'verify');
  };

  const handleQuickPersona = (orgId: string) => {
    const org = organizations[orgId];
    if (!org) return;
    const off = ORG_OFFICERS[orgId] || {
      name: 'Authorized Officer',
      title: 'Licensed System Operator',
      email: `officer@${org.mspId.toLowerCase()}.ke`,
      avatarInitials: org.name.slice(0, 2).toUpperCase(),
    };
    const session: AuthSession = {
      orgId: org.id,
      orgName: org.name,
      orgRole: org.role,
      officerName: off.name,
      officerTitle: off.title,
      officerEmail: off.email,
      mspId: org.mspId,
      loginTimestamp: new Date().toISOString(),
      isCitizen: false,
    };
    if (rememberMe) {
      try {
        localStorage.setItem('pharmachain_auth_session', JSON.stringify(session));
      } catch {
        // ignore
      }
    }
    onLogin(session, 'dashboard');
  };

  const getRoleIcon = (role: OrgRole) => {
    switch (role) {
      case 'Regulator':
        return <Scale className="w-4 h-4 text-purple-600" />;
      case 'Manufacturer':
        return <Building2 className="w-4 h-4 text-emerald-600" />;
      case 'Distributor':
        return <Truck className="w-4 h-4 text-blue-600" />;
      case 'Pharmacy':
        return <Pill className="w-4 h-4 text-amber-600" />;
    }
  };

  const getRoleBadgeClass = (role: OrgRole) => {
    switch (role) {
      case 'Regulator':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Manufacturer':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Distributor':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Pharmacy':
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  const authorizedChannels = Object.values(FABRIC_CHANNELS).filter((chan) =>
    isOrgAuthorizedForChannel(selectedOrg.id, chan.id)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001438] via-[#001F54] to-[#0A2540] flex flex-col justify-between text-slate-100 p-4 sm:p-6 lg:p-8 selection:bg-[#C9A227] selection:text-[#001F54]">
      {/* Top Sovereign Bar */}
      <div className="max-w-5xl mx-auto w-full flex flex-wrap items-center justify-between gap-4 py-3 border-b border-white/10 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#C9A227] to-[#997300] text-[#001F54] font-bold flex items-center justify-center font-mono shadow-md">
            KE
          </div>
          <div>
            <div className="font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>Republic of Kenya</span>
              <span className="text-white/40">·</span>
              <span className="text-[#C9A227]">Ministry of Health</span>
            </div>
            <div className="text-[11px] text-slate-300">
              Pharmacy & Poisons Board (PPB) Traceability Gateway · Cap 244
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Hyperledger Fabric v2.5 Peer Gateway
          </span>
          <span className="hidden sm:inline text-white/40">MSP: PKI X.509</span>
        </div>
      </div>

      {/* Main Login Card Container */}
      <div className="max-w-4xl mx-auto w-full my-auto py-8">
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9A227]/15 border border-[#C9A227]/30 text-[#C9A227] text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Permissioned Identity & Cryptographic Access Control
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            PharmaChain Kenya Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            Log in with your permissioned organization MSP credentials or access the public
            patient portal to verify medicine packs.
          </p>
        </div>

        {/* Tab Switcher: Enterprise Peer vs. Public Citizen */}
        <div className="bg-white/10 p-1 rounded-xl max-w-md mx-auto grid grid-cols-2 gap-1 mb-6 backdrop-blur-sm border border-white/10">
          <button
            type="button"
            onClick={() => setAuthMode('enterprise')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              authMode === 'enterprise'
                ? 'bg-[#C9A227] text-[#001F54] shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Enterprise Peer (MSP)
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('citizen')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              authMode === 'citizen'
                ? 'bg-[#C9A227] text-[#001F54] shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" />
            Citizen & Patient Portal
          </button>
        </div>

        {/* Content Box */}
        <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          {authMode === 'enterprise' ? (
            /* ENTERPRISE PEER LOGIN FORM */
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Left Column: Organization & Officer Selector (7 cols) */}
              <div className="lg:col-span-7 p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-[#001F54] flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-[#C9A227]" />
                    Select Permissioned Peer Identity
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Choose your licensed Kenyan organization and verify your cryptographic ECDSA key
                    pair before accessing chaincode.
                  </p>
                </div>

                <form onSubmit={handleEnterpriseSubmit} className="space-y-5">
                  {/* Organization Selector */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="org-select"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                    >
                      Licensed Organization (MSP Member)
                    </label>
                    <div className="relative">
                      <select
                        id="org-select"
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        className="w-full pl-3 pr-9 py-2.5 rounded-lg border border-slate-300 bg-slate-50 font-semibold text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-[#001F54] focus:ring-1 focus:ring-[#001F54] cursor-pointer"
                      >
                        {Object.values(organizations).map((org) => (
                          <option key={org.id} value={org.id}>
                            [{org.role}] {org.name} · {org.mspId}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Active Officer Identity Card */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#001F54] text-[#C9A227] font-bold text-sm flex items-center justify-center shrink-0">
                      {officer.avatarInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {officer.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeClass(
                            selectedOrg.role
                          )}`}
                        >
                          {selectedOrg.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 truncate">{officer.title}</div>
                      <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                        {officer.email}
                      </div>
                    </div>
                  </div>

                  {/* Work Email / Username */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="officer-email"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                    >
                      Officer MSP Identity
                    </label>
                    <input
                      id="officer-email"
                      type="text"
                      readOnly
                      value={officer.email}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-100 font-mono text-xs text-slate-700 cursor-not-allowed"
                    />
                  </div>

                  {/* Hardware Token / Passkey / PIN */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="security-passphrase"
                        className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                      >
                        Security Passphrase / Hardware Key PIN
                      </label>
                      <span className="text-[10px] text-emerald-700 font-medium">
                        Demo auto-filled
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        id="security-passphrase"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password or hardware PIN"
                        className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-300 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none focus:border-[#001F54]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showPassword ? 'Hide passphrase' : 'Show passphrase'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-slate-300 text-[#001F54] focus:ring-[#001F54]"
                      />
                      <span>Stay signed in on this device</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">X.509 TLS 1.3</span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[46px] rounded-xl bg-[#001F54] hover:bg-[#002b75] text-[#C9A227] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-[#C9A227] border-t-transparent animate-spin" />
                        Verifying MSP Digital Signature...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Authenticate & Enter Platform
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right Column: MSP Cryptographic Certificate & Details (5 cols) */}
              <div className="lg:col-span-5 p-6 sm:p-8 bg-slate-50/80 flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Cryptographic MSP Badge
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      VALIDATED
                    </span>
                  </div>

                  <div className="mt-4 space-y-3.5 text-xs">
                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Organization Full Name
                      </div>
                      <div className="font-bold text-slate-900">{selectedOrg.name}</div>
                      <div className="text-[11px] text-slate-500">
                        Lic: {selectedOrg.licenseNo} · {selectedOrg.location}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        MSP Identification & Root CA
                      </div>
                      <div className="font-mono font-semibold text-[#001F54]">
                        {selectedOrg.mspId}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        CA: rca.pharmachain.ke (ECDSA P-256)
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Public Key Fingerprint (Web Crypto)
                      </div>
                      <div className="font-mono text-[11px] text-slate-800 break-all bg-slate-50 p-1.5 rounded border border-slate-100">
                        {selectedOrg.keys.publicKeyFingerprint}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Authorized Fabric Channels ({authorizedChannels.length})
                      </div>
                      <div className="space-y-1">
                        {authorizedChannels.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-1.5 text-[11px] font-mono text-slate-700"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>{c.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Compliant with Kenya Pharmacy and Poisons Act Cap 244 & GS1 Standards</span>
                </div>
              </div>
            </div>
          ) : (
            /* CITIZEN & PATIENT PORTAL */
            <div className="p-6 sm:p-10 space-y-8">
              <div className="max-w-2xl mx-auto text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-[#001F54] flex items-center justify-center mx-auto shadow-sm">
                  <HeartPulse className="w-6 h-6 text-[#C9A227]" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#001F54]">
                  Public Medicine Verification Portal
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Patients, healthcare workers, and citizens can verify the authenticity of any
                  pharmaceutical product dispensed in Kenya against the immutable blockchain registry
                  without requiring corporate credentials.
                </p>
              </div>

              <div className="max-w-lg mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-5">
                <form onSubmit={handleCitizenSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="patient-batch"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                    >
                      Enter Batch Number on Pack
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="patient-batch"
                        type="text"
                        value={patientBatchNo}
                        onChange={(e) => setPatientBatchNo(e.target.value)}
                        placeholder="e.g. KE-ACT-2026-001"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white font-mono text-sm text-slate-900 focus:outline-none focus:border-[#001F54]"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">Quick Test Batches:</span>{' '}
                    <button
                      type="button"
                      onClick={() => setPatientBatchNo('KE-ACT-2026-001')}
                      className="text-[#001F54] font-mono hover:underline cursor-pointer mr-2"
                    >
                      KE-ACT-2026-001 (Genuine)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientBatchNo('KE-PCM-2026-999')}
                      className="text-red-700 font-mono hover:underline cursor-pointer mr-2"
                    >
                      KE-PCM-2026-999 (Recalled)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientBatchNo('FAKE-MOMBASA-404')}
                      className="text-amber-700 font-mono hover:underline cursor-pointer"
                    >
                      FAKE-MOMBASA-404 (Counterfeit)
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[46px] rounded-xl bg-[#001F54] hover:bg-[#002b75] text-[#C9A227] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 transition-all"
                  >
                    <QrCode className="w-4 h-4" />
                    Verify Medicine on Chain
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-200 text-center">
                  <p className="text-xs text-slate-500">
                    No sign-up or fee required. Free statutory consumer health service by Pharmacy &
                    Poisons Board Kenya.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* QUICK ONE-CLICK DEMO ACCESS BAR */}
          <div className="p-4 bg-slate-100 border-t border-slate-200">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#C9A227]" />
                1-Click Quick Demo Sign-Ins:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleQuickPersona('REG-PPB')}
                  className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold cursor-pointer border border-purple-300 transition-colors"
                  title="Sign in as PPB Kenya Chief Inspector"
                >
                  ⚖️ PPB Regulator
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPersona('MFG-DAWA')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-semibold cursor-pointer border border-emerald-300 transition-colors"
                  title="Sign in as Dawa Life Sciences QA"
                >
                  🏭 Dawa (Mfg)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPersona('DIST-KEMSA')}
                  className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-semibold cursor-pointer border border-blue-300 transition-colors"
                  title="Sign in as KEMSA Logistics Manager"
                >
                  🚚 KEMSA (Dist)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPersona('PHARM-GOODLIFE')}
                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold cursor-pointer border border-amber-300 transition-colors"
                  title="Sign in as Goodlife Superintendent Pharmacist"
                >
                  🏥 Goodlife (Pharm)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const session: AuthSession = {
                      orgId: 'CITIZEN-PUBLIC',
                      orgName: 'Public Citizen / Patient Portal',
                      orgRole: 'Pharmacy',
                      officerName: 'Kenyan Citizen / Patient',
                      officerTitle: 'Public Consumer Verification',
                      officerEmail: 'public-access@pharmacyboardkenya.org',
                      mspId: 'PublicConsumerMSP',
                      loginTimestamp: new Date().toISOString(),
                      isCitizen: true,
                    };
                    onLogin(session, 'verify');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold cursor-pointer border border-slate-300 transition-colors"
                  title="Enter directly as a citizen"
                >
                  🧑 Public Citizen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Sovereign Notice */}
      <div className="max-w-5xl mx-auto w-full py-4 text-center text-slate-400 text-[11px] border-t border-white/10 space-y-1">
        <div>
          Official System of the Pharmacy and Poisons Board of Kenya · Hyperledger Fabric Enterprise
          Consortium
        </div>
        <div className="text-slate-500 font-mono">
          FIPS 186-4 ECDSA P-256 · ISO/IEC 16022 GS1 DataMatrix · WHO Technical Report Series No. 957
        </div>
      </div>
    </div>
  );
};
