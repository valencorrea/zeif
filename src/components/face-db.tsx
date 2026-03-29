'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Search, X, Plus, AlertTriangle, CheckCircle2,
  Camera,
} from 'lucide-react';
import { LeftSidebar, TopNav } from '@/components/dashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

type ThreatLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type Tab = 'database' | 'live' | 'alerts';
type FilterLevel = 'ALL' | ThreatLevel;

// ─── Mock data ────────────────────────────────────────────────────────────────

interface Suspect {
  id: string;
  name: string;
  alias: string;
  threatLevel: ThreatLevel;
  lastSeen: string;
  incidents: number;
  status: 'ACTIVE' | 'INACTIVE';
  initials: string;
  note: string;
}

const suspects: Suspect[] = [
  { id: 'ZF-001', name: 'Unknown Male', alias: 'Hoodie Guy', threatLevel: 'HIGH', lastSeen: '14:22 · Zone A', incidents: 7, status: 'ACTIVE', initials: 'UM', note: 'Conceals items in jacket lining. Targets electronics.' },
  { id: 'ZF-002', name: 'Jane Doe', alias: '—', threatLevel: 'MEDIUM', lastSeen: '11:05 · Zone C', incidents: 3, status: 'ACTIVE', initials: 'JD', note: 'Uses distraction tactics with a suspected accomplice.' },
  { id: 'ZF-003', name: 'Unknown Female', alias: 'Red Jacket', threatLevel: 'HIGH', lastSeen: 'Yesterday · Zone B', incidents: 5, status: 'ACTIVE', initials: 'UF', note: 'Multiple confirmed incidents across Zones A–C.' },
  { id: 'ZF-004', name: 'Mark T.', alias: 'Cap Man', threatLevel: 'LOW', lastSeen: '3 days ago', incidents: 1, status: 'INACTIVE', initials: 'MT', note: 'Single opportunistic incident. Under passive monitoring.' },
  { id: 'ZF-005', name: 'Unknown Male', alias: 'Blue Parka', threatLevel: 'MEDIUM', lastSeen: 'Today · Zone E', incidents: 2, status: 'ACTIVE', initials: 'UP', note: 'Suspected bag-switching near stockroom access.' },
  { id: 'ZF-006', name: 'Lisa K.', alias: '—', threatLevel: 'HIGH', lastSeen: '09:17 · Zone A', incidents: 9, status: 'ACTIVE', initials: 'LK', note: 'High-frequency offender. Alert all security on sight.' },
  { id: 'ZF-007', name: 'Unknown Male', alias: 'Grey Beanie', threatLevel: 'LOW', lastSeen: '1 week ago', incidents: 1, status: 'INACTIVE', initials: 'UG', note: 'Possible opportunistic theft. No repeat sightings.' },
  { id: 'ZF-008', name: 'Tom R.', alias: 'Glasses', threatLevel: 'MEDIUM', lastSeen: 'Yesterday · Zone D', incidents: 4, status: 'ACTIVE', initials: 'TR', note: 'Exploits self-checkout blind spots to conceal items.' },
];

interface Alert {
  id: string;
  suspectId: string;
  suspectName: string;
  camera: string;
  zone: string;
  time: string;
  confidence: number;
  reviewed: boolean;
  threatLevel: ThreatLevel;
}

const alertsData: Alert[] = [
  { id: 'ALT-001', suspectId: 'ZF-006', suspectName: 'Lisa K.', camera: 'Main Entrance', zone: 'Zone A', time: '14:22:05', confidence: 94, reviewed: false, threatLevel: 'HIGH' },
  { id: 'ALT-002', suspectId: 'ZF-001', suspectName: 'Unknown Male', camera: 'Menswear', zone: 'Zone B', time: '13:18:42', confidence: 87, reviewed: false, threatLevel: 'HIGH' },
  { id: 'ALT-003', suspectId: 'ZF-003', suspectName: 'Unknown Female', camera: 'Main Entrance', zone: 'Zone A', time: '11:05:19', confidence: 91, reviewed: true, threatLevel: 'HIGH' },
  { id: 'ALT-004', suspectId: 'ZF-008', suspectName: 'Tom R.', camera: 'Checkout', zone: 'Zone D', time: '09:44:33', confidence: 82, reviewed: true, threatLevel: 'MEDIUM' },
  { id: 'ALT-005', suspectId: 'ZF-005', suspectName: 'Unknown Male', camera: 'Stockroom', zone: 'Zone E', time: '08:31:17', confidence: 78, reviewed: true, threatLevel: 'MEDIUM' },
];

// ─── Camera feeds with detection overlays ────────────────────────────────────

interface Detection {
  top: string; left: string; width: string; height: string;
  matched: boolean; suspectName?: string; confidence: number;
}

const cameraFeeds = [
  {
    zone: 'Zone A', location: 'Main Entrance', offline: false,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCS37D74_SI39WBv-9SkL6SISP6g5x1juaJ5oIrPEULuQboAyuZXp2Eo4Mw1V21kcJdV-QONuPJoi67-fu_dcTRhZ0mIhatf8qOWYrB_nzlAEVlAM82OZmIprhy2pGfTS-7WfQFvIUJUXaukUcSMNb8Kc2Z-ofUynkIFIlvhkV53OpRuICjaYJRxmeQp6bw1bBK17G2gwiG4rRttlrCyK31EbEIIHOQR6V-CozbhpuianpxOuosB-v5gxz2Qm76bPGGAfhymnMf9obq',
    detections: [
      { top: '14%', left: '31%', width: '18%', height: '26%', matched: true, suspectName: 'Lisa K.', confidence: 94 },
      { top: '27%', left: '61%', width: '13%', height: '19%', matched: false, confidence: 62 },
    ] as Detection[],
  },
  {
    zone: 'Zone B', location: 'Menswear', offline: false,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCEadaa0bOMftWUhV5GYL8_XBzreJvyUJQaQFr13wCvVbZaBM1Aac_8R0Flkuu_gMUp3dOqgS2JD7b40-ykMdFBB9HnYv9Dl76L3uXE7AAMKQOY2N9qjhsR10uZxM7tPtW12hEMeqpEIvdoctKAEUfVGw83IIYiNUgYOgkg7Og_IHQeRILOlODcnAVzh2HixkEJqVu82KD3W2YYH31ptLqEQ3_DVhrFeSis8UooCnnDROYKGVkXNpqRM1dSc-3XbSBZGbw_wK',
    detections: [
      { top: '22%', left: '43%', width: '16%', height: '23%', matched: true, suspectName: 'Unknown', confidence: 87 },
    ] as Detection[],
  },
  {
    zone: 'Zone C', location: 'Fitting Rooms', offline: false,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALjBPIGIO9vM-lzUsNgg_vPTXqVQDobvz0W8SwkJ7p9uEo-th-9c1mgbGgnMycEDOEccKzB295-Gwap54_8ux4L4Na4-b0ASQlqaf1l_gJh_h4Mv2LA5s74AX9XO6v1ZE0zpGiPeWKz55w6YX0e6hw2ekzp6YkBxvJRgoAYEI4GsNXbviHFUB4LVaVzeRl0UrfRG53s7JcuQ7EdhAwBQW3rELq5MFA0TeErUX1KDgzUA_d_Mta7_j-kEBlzijqwZuE2U7n6Q8y3CPr',
    detections: [
      { top: '37%', left: '27%', width: '15%', height: '21%', matched: false, confidence: 55 },
    ] as Detection[],
  },
  {
    zone: 'Zone D', location: 'Checkout', offline: true,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBs8L64jk7IV6jBa-oF79qpE-23_S_idMXKw8PM0oGSGaGctTHRD3E2U2hNfAjD4-bjaQhEjlO4NHSljZczLwWrJsX3zzKo5s4xSTsGilZIOYIvqrhnMTu7-YsZUaRBAG26cNvsHL7_Og9XCB8gUzPzvkQcyTo_1XyaRarf21GYV9C69j8kwPDzdWmoiLw2aCiYBl7qYDxI6e4hzcykq7bfMcDr9U_VrKsLkiD2suJiW97GWMF33H5E0QJHAZBU0u0U9vLQVRBnvR',
    detections: [] as Detection[],
  },
  {
    zone: 'Zone E', location: 'Stockroom', offline: false,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXEy6P4fGAZonY59jKPd4wlKwED9JHaOx7aqYOi-RM8dFqrskrOm5F2K9Of6Rn02puz0GzkGb0ftS4K7uhgTqhvLJ5o3XUY1Vz8dwx1u2E-nZWI7tkPTvqFVuIXZRr1juDLOH1w-frzLNNPr1hVZ7qYot5zRx2eiikMPMMHtPyvgWyRW5n4Q84FSrLlmXTjGrz39fhZgy2NrM7jJ_4Yumq-oW-jZS2GNeQLSQtU1gpi-C6-x0CD3EMl4eJ-UoSt0Kb8Izi0JDVewcL',
    detections: [
      { top: '29%', left: '47%', width: '14%', height: '20%', matched: true, suspectName: 'Unknown', confidence: 78 },
    ] as Detection[],
  },
  {
    zone: 'Zone F', location: 'Visual Displays', offline: false,
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJ6E6Mw0WiK5U5cnQ3H1s5qyKQck4TxLjDkkPJ53cwRhiUM8y-bgtuPCBYlT8UbcoU-ihG_CH3RMownROz5qtyNYEjN4GsNXbviHFUB4LVaVzeRl0UrfRG53s7JcuQ7EdhAwBQW3rELq5MFA0TeErUX1KDgzUA_d_Mta7_j-kEBlzijqwZuE2U7n6Q8y3CPr',
    detections: [] as Detection[],
  },
];

// ─── Threat styles ────────────────────────────────────────────────────────────

const THREAT: Record<ThreatLevel, { bg: string; text: string; dot: string }> = {
  HIGH:   { bg: 'bg-[#ffdad6]', text: 'text-[#93000a]', dot: 'bg-[#ba1a1a]' },
  MEDIUM: { bg: 'bg-[#e3e89a]', text: 'text-[#1b1d00]', dot: 'bg-[#5e6223]' },
  LOW:    { bg: 'bg-[#a6f3cc]', text: 'text-[#002114]', dot: 'bg-[#1b6b4d]' },
};

const AVATAR_BG: Record<ThreatLevel, string> = {
  HIGH:   '#ffdad6',
  MEDIUM: '#f3daff',
  LOW:    '#e3e89a',
};

// ─── Suspect Card ─────────────────────────────────────────────────────────────

function SuspectCard({ suspect }: { suspect: Suspect }) {
  const threat = THREAT[suspect.threatLevel];
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-[#c8c7bc]/10 p-6 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center font-black text-lg text-[#1b1d0e]/60 tracking-tight"
          style={{ backgroundColor: AVATAR_BG[suspect.threatLevel] }}
        >
          {suspect.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-sm tracking-tight text-[#1b1d0e]">{suspect.name}</span>
            {suspect.alias !== '—' && (
              <span className="text-[10px] text-[#47473f] font-bold uppercase tracking-widest">&quot;{suspect.alias}&quot;</span>
            )}
          </div>
          <p className="text-[10px] text-[#47473f] font-bold uppercase tracking-widest mt-0.5">{suspect.id}</p>
        </div>
        <span className={`${threat.bg} ${threat.text} px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0`}>
          {suspect.threatLevel}
        </span>
      </div>

      <p className="text-xs text-[#47473f] font-medium leading-relaxed">{suspect.note}</p>

      <div className="flex items-center justify-between pt-3 border-t border-[#c8c7bc]/10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#47473f]">Last seen</p>
          <p className="text-xs font-semibold text-[#1b1d0e] mt-0.5">{suspect.lastSeen}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#47473f]">Incidents</p>
          <p className="text-xl font-black tracking-tighter text-[#1b1d0e]">{suspect.incidents}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <span className={`${suspect.status === 'ACTIVE' ? 'bg-[#a6f3cc] text-[#002114]' : 'bg-[#e4e4cc] text-[#47473f]'} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5`}>
          {suspect.status === 'ACTIVE' && <span className="w-1.5 h-1.5 rounded-full bg-[#002114] animate-pulse" />}
          {suspect.status}
        </span>
        <button className="ml-auto text-[10px] font-black uppercase tracking-widest text-[#1b6b4d] hover:underline">
          View Profile
        </button>
      </div>
    </div>
  );
}

// ─── Database Tab ─────────────────────────────────────────────────────────────

function DatabaseTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterLevel>('ALL');

  const filtered = suspects.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.alias.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || s.threatLevel === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-[#f5f5dc] px-4 py-3 rounded-xl flex-1">
          <Search size={14} className="text-[#47473f] shrink-0" />
          <input
            className="bg-transparent border-none outline-none focus:ring-0 text-sm w-full placeholder:text-[#47473f]/50"
            placeholder="Search name, alias, ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[#47473f] hover:text-[#1b1d0e]">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as FilterLevel[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === f
                  ? 'bg-[#1b1d0e] text-[#fbfbe2]'
                  : 'bg-[#f5f5dc] text-[#47473f] hover:bg-[#e4e4cc]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#47473f]">
        {filtered.length} profile{filtered.length !== 1 ? 's' : ''} found
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(s => <SuspectCard key={s.id} suspect={s} />)}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[#47473f]">
          <Search size={32} className="opacity-20 mb-4" />
          <p className="font-black uppercase tracking-widest text-sm">No profiles match</p>
        </div>
      )}
    </div>
  );
}

// ─── Live Feed Tab ────────────────────────────────────────────────────────────

function LiveFeedTab() {
  const totalDetections = cameraFeeds.reduce((n, f) => n + f.detections.length, 0);
  const totalMatches = cameraFeeds.reduce((n, f) => n + f.detections.filter(d => d.matched).length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#a6f3cc] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#47473f]">
            {totalDetections} Face{totalDetections !== 1 ? 's' : ''} Detected
          </span>
        </div>
        {totalMatches > 0 && (
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-[#ba1a1a]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#ba1a1a]">
              {totalMatches} Suspect Match{totalMatches !== 1 ? 'es' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameraFeeds.map(feed => (
          <div key={feed.zone} className="relative aspect-square bg-[#efefd7] overflow-hidden shadow-md">
            {feed.offline ? (
              <>
                <Image src={feed.src} alt={feed.location} fill sizes="33vw" className="object-cover grayscale brightness-50" />
                <div className="absolute inset-0 bg-[#1b1d0e]/40 flex items-center justify-center">
                  <span className="bg-[#f3daff] text-[#2e014b] px-4 py-2 text-[10px] font-black uppercase tracking-widest">OFFLINE</span>
                </div>
              </>
            ) : (
              <>
                <Image src={feed.src} alt={feed.location} fill sizes="33vw" className="object-cover grayscale brightness-75" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                {/* Scanning indicator */}
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#a6f3cc] text-[#002114] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#002114] animate-pulse" />
                  SCANNING
                </div>

                {/* Face detection boxes */}
                {feed.detections.map((d, i) => (
                  <div
                    key={i}
                    className="absolute"
                    style={{ top: d.top, left: d.left, width: d.width, height: d.height }}
                  >
                    <div
                      className={`w-full h-full border-2 ${d.matched ? 'border-[#ba1a1a]' : 'border-[#a6f3cc]'}`}
                      style={{ boxShadow: d.matched ? '0 0 0 1px rgba(186,26,26,0.3)' : '0 0 0 1px rgba(166,243,204,0.3)' }}
                    />
                    <div
                      className={`absolute -bottom-5 left-0 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide whitespace-nowrap ${
                        d.matched ? 'bg-[#ba1a1a] text-white' : 'bg-[#1b1d0e]/80 text-[#a6f3cc]'
                      }`}
                    >
                      {d.matched ? `⚠ ${d.suspectName}` : `${d.confidence}%`}
                    </div>
                  </div>
                ))}

                <div className="absolute bottom-4 left-4 text-white">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-80">{feed.zone}</p>
                  <h3 className="text-xl font-black tracking-tight">{feed.location}</h3>
                </div>

                {feed.detections.length > 0 && (
                  <div className="absolute bottom-4 right-4">
                    <span className={`text-[10px] font-black px-2 py-1 ${
                      feed.detections.some(d => d.matched) ? 'bg-[#ba1a1a] text-white' : 'bg-[#1b1d0e]/60 text-[#a6f3cc]'
                    }`}>
                      {feed.detections.length} FACE{feed.detections.length !== 1 ? 'S' : ''}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

function AlertsTab() {
  const [alerts, setAlerts] = useState(alertsData);

  const markReviewed = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, reviewed: true } : a));
  };

  const unreviewed = alerts.filter(a => !a.reviewed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {unreviewed > 0 ? (
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-[#ba1a1a]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#ba1a1a]">
              {unreviewed} Unreviewed Alert{unreviewed !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-[#1b6b4d]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#1b6b4d]">
              All Alerts Reviewed
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {alerts.map(alert => {
          const threat = THREAT[alert.threatLevel];
          return (
            <div
              key={alert.id}
              className={`p-6 rounded-3xl border transition-all ${
                alert.reviewed
                  ? 'bg-white border-[#c8c7bc]/10 opacity-60'
                  : 'bg-white border-[#ffdad6] shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-black text-sm"
                    style={{ backgroundColor: AVATAR_BG[alert.threatLevel] }}
                  >
                    {alert.suspectName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-[#1b1d0e]">{alert.suspectName}</span>
                      <span className={`${threat.bg} ${threat.text} px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest`}>
                        {alert.threatLevel}
                      </span>
                      <span className="text-[10px] text-[#47473f] font-bold">{alert.suspectId}</span>
                    </div>
                    <p className="text-xs text-[#47473f] font-medium mt-1">
                      Detected at <span className="font-bold text-[#1b1d0e]">{alert.camera}</span> · {alert.zone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#47473f]">Confidence</p>
                    <p className="text-xl font-black tracking-tighter text-[#1b1d0e]">{alert.confidence}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#47473f]">Time</p>
                    <p className="text-xs font-bold text-[#1b1d0e]">{alert.time}</p>
                  </div>
                </div>
              </div>

              {!alert.reviewed && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-[#c8c7bc]/10">
                  <button
                    onClick={() => markReviewed(alert.id)}
                    className="px-5 py-2 bg-[#1b1d0e] text-[#fbfbe2] rounded-full text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                  >
                    Mark Reviewed
                  </button>
                  <button className="px-5 py-2 bg-[#ffdad6] text-[#93000a] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#ffb4ab] transition-all">
                    Dispatch Security
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Add Suspect Modal ────────────────────────────────────────────────────────

function AddSuspectModal({ onClose }: { onClose: () => void }) {
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>('MEDIUM');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(27,29,14,0.6)' }}>
      <div className="bg-[#fbfbe2] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#c8c7bc]/20">
          <h2 className="text-xl font-black tracking-tighter uppercase">Add Suspect</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#e4e4cc] transition-colors text-[#47473f]">
            <X size={18} />
          </button>
        </div>

        <div className="p-8 space-y-5">
          {/* Photo upload */}
          <div className="aspect-[3/1] rounded-2xl border-2 border-dashed border-[#c8c7bc] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#f5f5dc] transition-colors">
            <Camera size={24} className="text-[#47473f]/40" />
            <p className="text-[10px] font-black uppercase tracking-widest text-[#47473f]/60">Upload or Drop Photo</p>
            <p className="text-[9px] text-[#47473f]/40 uppercase tracking-wide">JPG, PNG — max 10 MB</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#47473f]">Name / Description</label>
              <input
                className="w-full bg-[#f5f5dc] rounded-xl px-4 py-3 text-sm font-semibold text-[#1b1d0e] outline-none focus:ring-2 focus:ring-[#a6f3cc] placeholder:text-[#47473f]/40"
                placeholder="e.g. Unknown Male"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#47473f]">Alias (optional)</label>
              <input
                className="w-full bg-[#f5f5dc] rounded-xl px-4 py-3 text-sm font-semibold text-[#1b1d0e] outline-none focus:ring-2 focus:ring-[#a6f3cc] placeholder:text-[#47473f]/40"
                placeholder="e.g. Blue Parka"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#47473f]">Threat Level</label>
            <div className="flex gap-2">
              {(['HIGH', 'MEDIUM', 'LOW'] as ThreatLevel[]).map(t => {
                const s = THREAT[t];
                return (
                  <button
                    key={t}
                    onClick={() => setThreatLevel(t)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                      threatLevel === t
                        ? `${s.bg} ${s.text} border-transparent`
                        : 'bg-transparent border-[#c8c7bc] text-[#47473f]'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#47473f]">Watch Zones</label>
            <div className="flex gap-2 flex-wrap">
              {['A', 'B', 'C', 'D', 'E', 'F'].map(z => (
                <label key={z} className="flex items-center gap-1.5 bg-[#f5f5dc] px-3 py-2 rounded-xl cursor-pointer hover:bg-[#e4e4cc] transition-colors">
                  <input type="checkbox" className="accent-[#1b1d0e] w-3 h-3" defaultChecked />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#1b1d0e]">Zone {z}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#47473f]">Notes</label>
            <textarea
              rows={3}
              className="w-full bg-[#f5f5dc] rounded-xl px-4 py-3 text-sm font-semibold text-[#1b1d0e] outline-none focus:ring-2 focus:ring-[#a6f3cc] placeholder:text-[#47473f]/40 resize-none"
              placeholder="Describe appearance, behaviour, known tactics…"
            />
          </div>
        </div>

        <div className="flex gap-3 px-8 pb-8">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-xl border-2 border-[#c8c7bc] text-[#47473f] font-black uppercase text-xs tracking-[0.2em] hover:bg-[#e4e4cc] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-xl bg-[#1b1d0e] text-[#fbfbe2] font-black uppercase text-xs tracking-[0.2em] hover:bg-[#1b6b4d] transition-colors"
          >
            Add to Database
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Right Sidebar — Recent Matches ──────────────────────────────────────────

function RecentMatchesSidebar() {
  const recent = alertsData.slice(0, 4);
  return (
    <aside className="hidden xl:flex flex-col w-[26rem] h-screen sticky right-0 top-0 bg-[#f5f5dc] py-12 px-10 gap-8 shadow-[-20px_0px_40px_rgba(27,29,14,0.02)]">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tighter uppercase">Matches</h2>
        <span className="bg-[#ffdad6] text-[#93000a] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
          {alertsData.filter(a => !a.reviewed).length} New
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {recent.map(alert => {
          const threat = THREAT[alert.threatLevel];
          return (
            <div
              key={alert.id}
              className={`p-5 rounded-2xl border ${alert.reviewed ? 'bg-white/60 border-[#c8c7bc]/10' : 'bg-white border-[#ffdad6] shadow-sm'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className={`${threat.bg} ${threat.text} px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest`}>
                    {alert.threatLevel}
                  </span>
                  {!alert.reviewed && <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] animate-pulse" />}
                </div>
                <span className="text-[10px] font-bold text-[#47473f]">{alert.time}</span>
              </div>
              <p className="text-sm font-black tracking-tight text-[#1b1d0e]">{alert.suspectName}</p>
              <p className="text-xs text-[#47473f] font-medium mt-1">{alert.camera} · {alert.zone}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#c8c7bc]/10">
                <span className="text-[10px] font-bold text-[#47473f] uppercase tracking-wide">
                  {alert.confidence}% match
                </span>
                <button className="text-[10px] font-black uppercase tracking-widest text-[#1b6b4d] hover:underline">
                  Review
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button className="w-full py-6 rounded-3xl border-2 border-dashed border-[#c8c7bc] text-[#47473f] font-black uppercase text-xs tracking-[0.2em] hover:bg-[#e4e4cc] transition-colors">
        View All Alerts
      </button>
    </aside>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function FaceDB() {
  const [tab, setTab] = useState<Tab>('database');
  const [showAddModal, setShowAddModal] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'database', label: 'Database' },
    { key: 'live', label: 'Live Feed' },
    { key: 'alerts', label: `Alerts (${alertsData.filter(a => !a.reviewed).length})` },
  ];

  return (
    <div className="flex min-h-screen text-[#1b1d0e]" style={{ backgroundColor: '#fbfbe2', fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
      <LeftSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <TopNav />

        <div className="p-12 space-y-10 mt-20 md:mt-0">
          {/* Page header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <h1 className="text-8xl font-black tracking-tighter text-[#1b1d0e]">Face DB</h1>
              <p className="mt-4 text-[#47473f] font-medium tracking-widest uppercase text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#a6f3cc] animate-pulse" />
                {suspects.filter(s => s.status === 'ACTIVE').length} Active Profiles · {alertsData.filter(a => !a.reviewed).length} Alerts Today
              </p>
            </div>
            <div className="flex gap-4">
              <button className="px-8 py-3 bg-[#ccffe3] text-[#307c5d] rounded-full font-bold uppercase text-xs tracking-widest hover:bg-[#a6f3cc] transition-all">
                Export DB
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-8 py-3 bg-[#1b1d0e] text-[#fbfbe2] rounded-full font-bold uppercase text-xs tracking-widest hover:opacity-90 transition-all flex items-center gap-2"
              >
                <Plus size={14} />
                Add Suspect
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Profiles', value: suspects.length, color: '#1b1d0e' },
              { label: 'Active', value: suspects.filter(s => s.status === 'ACTIVE').length, color: '#1b6b4d' },
              { label: 'Alerts Today', value: alertsData.length, color: '#ba1a1a' },
              { label: 'Cameras Online', value: `${cameraFeeds.filter(f => !f.offline).length}/${cameraFeeds.length}`, color: '#1b1d0e' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-3xl p-6 shadow-sm border border-[#c8c7bc]/10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#47473f]">{stat.label}</p>
                <p className="text-4xl font-black tracking-tighter mt-2" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  tab === t.key
                    ? 'bg-[#1b1d0e] text-[#fbfbe2] shadow-sm'
                    : 'bg-[#f5f5dc] text-[#47473f] hover:bg-[#e4e4cc]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'database' && <DatabaseTab />}
          {tab === 'live' && <LiveFeedTab />}
          {tab === 'alerts' && <AlertsTab />}
        </div>
      </main>

      <RecentMatchesSidebar />

      {showAddModal && <AddSuspectModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
