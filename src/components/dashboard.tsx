'use client';

import Image from 'next/image';
import {
  LayoutDashboard,
  Video,
  BarChart2,
  ShoppingBag,
  BookOpen,
  HelpCircle,
  LogOut,
  Bell,
  Settings,
  UserCircle,
  Search,
  ListFilter,
} from 'lucide-react';

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

function LeftSidebar() {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, active: true },
    { label: 'Floor View', icon: Video, active: false },
    { label: 'Analytics', icon: BarChart2, active: false },
    { label: 'Orders', icon: ShoppingBag, active: false },
    { label: 'Catalogue', icon: BookOpen, active: false },
  ];

  return (
    <aside className="hidden md:flex flex-col h-screen w-72 rounded-r-xl sticky left-0 top-0 bg-[#f5f5dc] py-12 px-6 gap-8 shadow-[20px_0px_40px_rgba(27,29,14,0.04)] z-40">
      {/* Brand + User */}
      <div className="flex flex-col gap-2 mb-4">
        <span className="text-xl font-black text-[#1b1d0e] tracking-tighter">
          Zeif
        </span>
        <div className="flex items-center gap-3 mt-6">
          <div className="w-10 h-10 rounded-full bg-[#d4d4b8] shrink-0 flex items-center justify-center">
            <span className="text-xs font-bold text-[#1b1d0e]">SM</span>
          </div>
          <div>
            <p className="font-semibold text-xs tracking-wide uppercase text-[#1b1d0e]">
              Sarah M.
            </p>
            <p className="text-[10px] text-[#47473f] tracking-widest uppercase">
              Regional Manager
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1">
        {navItems.map(({ label, icon: Icon, active }) => (
          <a
            key={label}
            href="#"
            className={`flex items-center gap-4 rounded-xl px-6 py-4 font-semibold text-sm tracking-wide uppercase transition-all active:scale-[0.98] ${
              active
                ? 'bg-[#a6f3cc] text-[#1b1d0e] shadow-sm'
                : 'text-[#1b1d0e]/70 hover:translate-x-1 hover:text-[#764d93] duration-200'
            }`}
          >
            <Icon size={18} />
            {label}
          </a>
        ))}
      </nav>

      <button className="mt-4 bg-[#1b1d0e] text-[#fbfbe2] py-4 rounded-xl font-bold tracking-widest text-xs uppercase hover:bg-[#1b6b4d] transition-colors">
        New Report
      </button>

      {/* Bottom links */}
      <div className="mt-auto flex flex-col gap-1 pt-8 border-t border-[#c8c7bc]/10">
        <a
          href="#"
          className="flex items-center gap-4 text-[#1b1d0e]/70 px-6 py-4 font-semibold text-sm tracking-wide uppercase hover:text-[#1b6b4d] transition-colors"
        >
          <HelpCircle size={18} />
          Support
        </a>
        <a
          href="#"
          className="flex items-center gap-4 text-[#1b1d0e]/70 px-6 py-4 font-semibold text-sm tracking-wide uppercase hover:text-[#ba1a1a] transition-colors"
        >
          <LogOut size={18} />
          Logout
        </a>
      </div>
    </aside>
  );
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────

function TopNav() {
  return (
    <header className="flex justify-between items-center w-full px-12 h-20 bg-[#fbfbe2] fixed top-0 z-50 md:sticky">
      <div className="flex items-center gap-8">
        <span className="md:hidden text-2xl font-black uppercase tracking-tighter text-[#1b1d0e]">
          Zeif
        </span>
        <div className="hidden md:flex items-center gap-2 bg-[#f5f5dc] px-4 py-2 rounded-full w-80">
          <Search size={14} className="text-[#47473f] shrink-0" />
          <input
            className="bg-transparent border-none outline-none focus:ring-0 text-sm w-full placeholder:text-[#47473f]/50"
            placeholder="Search products, orders, stores…"
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[Bell, Settings, UserCircle].map((Icon, i) => (
          <button
            key={i}
            className="p-2 rounded-full text-[#1b1d0e] hover:bg-[#a6f3cc]/20 transition-colors"
          >
            <Icon size={20} />
          </button>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 h-px w-full bg-[#f5f5dc]" />
    </header>
  );
}

// ─── Floor Feed Card ──────────────────────────────────────────────────────────

type FeedStatus = 'LIVE' | 'ACTIVE' | 'OFFLINE';

interface CameraFeedProps {
  src: string;
  alt: string;
  zone: string;
  location: string;
  status: FeedStatus;
  highlight?: boolean;
}

const STATUS_STYLES: Record<FeedStatus, { bg: string; text: string; pulse: boolean }> = {
  LIVE:    { bg: 'bg-[#a6f3cc]', text: 'text-[#002114]', pulse: true },
  ACTIVE:  { bg: 'bg-[#f3daff]', text: 'text-[#2e014b]', pulse: false },
  OFFLINE: { bg: 'bg-[#f3daff]', text: 'text-[#2e014b]', pulse: false },
};

function FloorFeed({ src, alt, zone, location, status, highlight }: CameraFeedProps) {
  const badge = STATUS_STYLES[status];

  return (
    <div
      className={`group relative aspect-square bg-[#efefd7] overflow-hidden shadow-md transition-all duration-300${
        highlight ? ' border-4 border-[#a6f3cc]/30' : ''
      }`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className={`object-cover transition-all duration-500 ${
          status === 'OFFLINE'
            ? 'grayscale brightness-50'
            : 'grayscale brightness-75 group-hover:grayscale-0 group-hover:brightness-100'
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

      {status === 'OFFLINE' ? (
        <div className="absolute inset-0 bg-[#1b1d0e]/40 flex items-center justify-center">
          <div className={`${badge.bg} ${badge.text} px-4 py-2 text-[10px] font-black uppercase tracking-widest shadow-lg`}>
            OFFLINE
          </div>
        </div>
      ) : (
        <div className={`absolute top-6 left-6 flex items-center gap-2 ${badge.bg} ${badge.text} px-3 py-1 text-[10px] font-black uppercase tracking-widest`}>
          {badge.pulse && <span className="w-1.5 h-1.5 rounded-full bg-[#002114] animate-pulse" />}
          {status}
        </div>
      )}

      <div className="absolute bottom-6 left-6 text-white">
        <p className="text-[10px] uppercase font-bold tracking-widest opacity-80">{zone}</p>
        <h3 className="text-2xl font-black tracking-tight">{location}</h3>
      </div>
    </div>
  );
}

// ─── Right Sidebar ────────────────────────────────────────────────────────────

const activity = [
  {
    tag: 'LOW STOCK',
    tagBg: 'bg-[#e3e89a]',
    tagText: 'text-[#1b1d00]',
    time: '14:22:05',
    desc: 'Menswear floor below reorder threshold. 3 SKUs need replenishment in Zone B.',
    meta: 'Zone: B / Menswear',
    metaColor: 'text-[#47473f]',
    action: 'Reorder',
    actionColor: 'text-[#1b6b4d]',
  },
  {
    tag: 'NEW ORDER',
    tagBg: 'bg-[#f3daff]',
    tagText: 'text-[#2e014b]',
    time: '13:45:12',
    desc: 'Online order #ZF-9921 placed for 4 items. Awaiting warehouse pick confirmation.',
    meta: 'Channel: Online',
    metaColor: 'text-[#47473f]',
    action: 'View Order',
    actionColor: 'text-[#1b6b4d]',
  },
  {
    tag: 'STOCK SYNC',
    tagBg: 'bg-[#a6f3cc]',
    tagText: 'text-[#002114]',
    time: '12:00:00',
    desc: 'Daily inventory count synced across all 42 active stores. Variance report ready.',
    meta: 'Status: Verified',
    metaColor: 'text-[#47473f]',
    action: 'View Report',
    actionColor: 'text-[#1b6b4d]',
  },
  {
    tag: 'TILL OFFLINE',
    tagBg: 'bg-[#ffdad6]',
    tagText: 'text-[#93000a]',
    time: '11:15:44',
    desc: 'POS terminal at Zone D / Checkout is unresponsive. Customers redirected to Zone A.',
    meta: 'Impact: High',
    metaColor: 'text-[#ba1a1a]',
    action: 'Get Support',
    actionColor: 'text-[#ba1a1a]',
  },
];

function RightSidebar() {
  return (
    <aside className="hidden xl:flex flex-col w-[26rem] h-screen sticky right-0 top-0 bg-[#f5f5dc] py-12 px-10 gap-8 shadow-[-20px_0px_40px_rgba(27,29,14,0.02)]">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tighter uppercase">Activity</h2>
        <button className="text-[#47473f] hover:text-[#1b1d0e] transition-colors">
          <ListFilter size={20} />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        {activity.map((item, i) => (
          <div
            key={i}
            className="p-6 bg-white rounded-3xl shadow-sm border border-[#c8c7bc]/10"
          >
            <div className="flex justify-between items-start mb-4">
              <span className={`${item.tagBg} ${item.tagText} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest`}>
                {item.tag}
              </span>
              <span className="text-[10px] font-bold text-[#47473f] shrink-0 ml-2">{item.time}</span>
            </div>
            <p className="text-sm font-semibold mb-2">{item.desc}</p>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#c8c7bc]/10">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${item.metaColor}`}>
                {item.meta}
              </span>
              <button className={`text-[10px] font-black uppercase tracking-widest hover:underline ${item.actionColor}`}>
                {item.action}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full py-6 rounded-3xl border-2 border-dashed border-[#c8c7bc] text-[#47473f] font-black uppercase text-xs tracking-[0.2em] hover:bg-[#e4e4cc] transition-colors">
        View All Activity
      </button>
    </aside>
  );
}

// ─── Floor feed data ──────────────────────────────────────────────────────────

const feeds: CameraFeedProps[] = [
  {
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCS37D74_SI39WBv-9SkL6SISP6g5x1juaJ5oIrPEULuQboAyuZXp2Eo4Mw1V21kcJdV-QONuPJoi67-fu_dcTRhZ0mIhatf8qOWYrB_nzlAEVlAM82OZmIprhy2pGfTS-7WfQFvIUJUXaukUcSMNb8Kc2Z-ofUynkIFIlvhkV53OpRuICjaYJRxmeQp6bw1bBK17G2gwiG4rRttlrCyK31EbEIIHOQR6V-CozbhpuianpxOuosB-v5gxz2Qm76bPGGAfhymnMf9obq',
    alt: 'Store entrance and welcome area with glass frontage',
    zone: 'Zone A',
    location: 'Main Entrance',
    status: 'LIVE',
  },
  {
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCEadaa0bOMftWUhV5GYL8_XBzreJvyUJQaQFr13wCvVbZaBM1Aac_8R0Flkuu_gMUp3dOqgS2JD7b40-ykMdFNtAJFGFB9HnYv9Dl76L3uXE7AAMKQOY2N9qjhsR10uZxM7tPtW12hEMeqpEIvdoctKAEUfVGw83IIYiNUgYOgkg7Og_IHQeRILOlODcnAVzh2HixkEJqVu82KD3W2YYH31ptLqEQ3_DVhrFeSis8UooCnnDROYKGVkXNpqRM1dSc-3XbSBZGbw_wK',
    alt: 'Menswear sales floor with display units',
    zone: 'Zone B',
    location: 'Menswear',
    status: 'LIVE',
  },
  {
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALjBPIGIO9vM-lzUsNgg_vPTXqVQDobvz0W8SwkJ7p9uEo-th-9c1mgbGgnMycEDOEccKzB295-Gwap54_8ux4L4Na4-b0ASQlqaf1l_gJh_h4Mv2LA5s74AX9XO6v1ZE0zpGiPeWKz55w6YX0e6hw2ekzp6YkBxvJRgoAYEI4GsNXbviHFUB4LVaVzeRl0UrfRG53s7JcuQ7EdhAwBQW3rELq5MFA0TeErUX1KDgzUA_d_Mta7_j-kEBlzijqwZuE2U7n6Q8y3CPr',
    alt: 'Fitting rooms corridor with ambient lighting',
    zone: 'Zone C',
    location: 'Fitting Rooms',
    status: 'ACTIVE',
    highlight: true,
  },
  {
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBs8L64jk7IV6jBa-oF79qpE-23_S_idMXKw8PM0oGSGaGctTHRD3E2U2hNfAjD4-bjaQhEjlO4NHSljZczLwWrJsX3zzKo5s4xSTsGilZIOYIvqrhnMTu7-YsZUaRBAG26cNvsHL7_Og9XCB8gUzPzvkQcyTo_1XyaRarf21GYV9C69j8kwPDzdWmoiLw2aCiYBl7qYDxI6e4hzcykq7bfMcDr9U_VrKsLkiD2suJiW97GWMF33H5E0QJHAZBU0u0U9vLQVRBnvR',
    alt: 'Checkout and payment area',
    zone: 'Zone D',
    location: 'Checkout',
    status: 'OFFLINE',
  },
  {
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXEy6P4fGAZonY59jKPd4wlKwED9JHaOx7aqYOi-RM8dFqrskrOm5F2K9Of6Rn02puz0GzkGb0ftS4K7uhgTqhvLJ5o3XUY1Vz8dwx1u2E-nZWI7tkPTvqFVuIXZRr1juDLOH1w-frzLNNPr1hVZ7qYot5zRx2eiikMPMMHtPyvgWyRW5n4Q84FSrLlmXTjGrz39fhZgy2NrM7jJ_4Yumq-oW-jZS2GNeQLSQtU1gpi-C6-x0CD3EMl4eJ-UoSt0Kb8Izi0JDVewcL',
    alt: 'Stockroom and fulfilment area with shelving',
    zone: 'Zone E',
    location: 'Stockroom',
    status: 'LIVE',
  },
  {
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJ6E6Mw0WiK5U5cnQ3H1s5qyKQck4TxLjDkkPJ53cwRhiUM8y-bgtuPCBYlT8UbcoU-ihG_CH3RMownROz5qtyNYEjN4Ea_yDQ-H-AtBViyR69jYdHy1vNA4Ua2WqiIiXsAIjxUh8bs2J3q_Dd-eM1102ip0DuLgMi058fBtPwQGa7vwqBNXxJO567U9SxLtbelmk1_1zj9hAeHwlsv9Gp8HqgCa6Jd8EoDWa_iO-7Eok9e2IVd3FA7-lQ7mKVjXzSQDpyBm99yiPU',
    alt: 'Visual merchandising and display window area',
    zone: 'Zone F',
    location: 'Visual Displays',
    status: 'LIVE',
  },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export function Dashboard() {
  return (
    <div
      className="flex min-h-screen text-[#1b1d0e]"
      style={{ backgroundColor: '#fbfbe2', fontFamily: 'var(--font-inter), Inter, sans-serif' }}
    >
      <LeftSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <TopNav />

        <div className="p-12 space-y-16 mt-20 md:mt-0">
          {/* Page title */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <h1 className="text-8xl font-black tracking-tighter text-[#1b1d0e]">
                Floor View
              </h1>
              <p className="mt-4 text-[#47473f] font-medium tracking-widest uppercase text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#a6f3cc] animate-pulse" />
                All Floors: Trading Normally
              </p>
            </div>
            <div className="flex gap-4">
              <button className="px-8 py-3 bg-[#ccffe3] text-[#307c5d] rounded-full font-bold uppercase text-xs tracking-widest hover:bg-[#a6f3cc] transition-all">
                Export Report
              </button>
              <button className="px-8 py-3 bg-[#1b1d0e] text-[#fbfbe2] rounded-full font-bold uppercase text-xs tracking-widest hover:opacity-90 transition-all">
                View Footage
              </button>
            </div>
          </div>

          {/* Floor feed grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feeds.map((feed) => (
              <FloorFeed key={feed.zone} {...feed} />
            ))}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-8 border-t border-[#c8c7bc]/20">
            {/* Stores open */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-[#47473f]">
                Stores Open
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black tracking-tighter">42</span>
                <span className="text-[#a6f3cc] text-xl font-bold">/48</span>
              </div>
              <div className="h-1 w-full bg-[#e4e4cc] rounded-full mt-2">
                <div className="h-full bg-[#a6f3cc] w-[87%] rounded-full" />
              </div>
            </div>

            {/* Stock alerts */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-[#47473f]">
                Stock Alerts
              </p>
              <div className="flex items-center gap-4">
                <span className="text-6xl font-black tracking-tighter text-[#5e6223]">LOW</span>
                <div className="flex gap-1">
                  <div className="w-3 h-8 bg-[#e3e89a] rounded-full" />
                  <div className="w-3 h-8 bg-[#e4e4cc] rounded-full" />
                  <div className="w-3 h-8 bg-[#e4e4cc] rounded-full" />
                </div>
              </div>
              <p className="text-xs font-semibold text-[#47473f] uppercase mt-1">
                Status: All Shelves Stocked
              </p>
            </div>

            {/* Revenue */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-[#47473f]">
                Revenue Today
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black tracking-tighter">£1.8</span>
                <span className="text-[#47473f] text-xl font-bold">M</span>
              </div>
              <div className="flex gap-2 items-center mt-2">
                <span className="text-[10px] font-bold text-[#47473f]">£0</span>
                <div className="h-1 flex-1 bg-[#e4e4cc] rounded-full overflow-hidden">
                  <div className="h-full bg-[#f3daff] w-[62%] rounded-full" />
                </div>
                <span className="text-[10px] font-bold text-[#47473f]">£4M target</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <RightSidebar />
    </div>
  );
}
