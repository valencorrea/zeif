'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Bell,
  Settings,
  UserCircle,
  Search,
  ListFilter,
  ScanFace,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

export function LeftSidebar({ isOpen = true }: { isOpen?: boolean }) {
  const pathname = usePathname();
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { label: 'Face DB', icon: ScanFace, href: '/face-db' },
  ];

  return (
    <motion.aside
      animate={{ width: isOpen ? 288 : 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="hidden md:block sticky left-0 top-0 h-screen shrink-0 overflow-hidden z-40"
    >
    <div className="w-72 h-full flex flex-col rounded-r-xl bg-[#f5f5dc] py-12 px-6 gap-8 shadow-[20px_0px_40px_rgba(27,29,14,0.04)]">
      {/* Brand + User */}
      <div className="flex flex-col gap-2 mb-4">
        <span className="text-[6.5rem] font-black text-[#1b1d0e] tracking-tighter leading-none">
          Zeif
        </span>
        <div className="flex items-center gap-3 mt-6">
          <div className="relative w-10 h-10 rounded-full bg-[#e4e4cc] overflow-hidden shrink-0">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfM0CVCnxbrjcgPCHo5m9tvXV-18k9VKannn-1RzWa-v4enzqw8gsgavnIFumQDM9o-uXEXAKgA1WPIgUmdNzgCiWn1lxJpuf2YrpDxS1laIhWBFqDSz_mqesns0y6crW0QDrNhRb9Z5r2Iak5pGbIRYLAlJz8w8slUjYqYwrctzs4TozsRxhpKqqv59OgDZMbBi02u4NS8xKmhTCnUZkjzj9twosW-i1fYXJ1wSXbUiO-BdpBSg7SGJt8CIzXJKzB7nE"
              alt="Store manager portrait"
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="font-semibold text-xs tracking-wide uppercase text-[#1b1d0e]">
              Sarah M.
            </p>
            <p className="text-[10px] text-[#47473f] tracking-widest uppercase">
              Store Manager
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1">
        {navItems.map(({ label, icon: Icon, href }) => {
          const active = pathname === href;
          return (
            <a
              key={label}
              href={href}
              className={`flex items-center gap-4 rounded-xl px-6 py-4 font-semibold text-sm tracking-wide uppercase transition-all active:scale-[0.98] ${
                active
                  ? 'bg-[#a6f3cc] text-[#1b1d0e] shadow-sm'
                  : 'text-[#1b1d0e]/70 hover:translate-x-1 hover:text-[#764d93] duration-200'
              }`}
            >
              <Icon size={18} />
              {label}
            </a>
          );
        })}
      </nav>

      <button className="mt-4 bg-[#1b1d0e] text-[#fbfbe2] py-4 rounded-xl font-bold tracking-widest text-xs uppercase hover:bg-[#1b6b4d] transition-colors">
        New Report
      </button>

    </div>
    </motion.aside>
  );
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────

export function TopNav({
  leftOpen,
  onLeftToggle,
  rightOpen,
  onRightToggle,
}: {
  leftOpen?: boolean;
  onLeftToggle?: () => void;
  rightOpen?: boolean;
  onRightToggle?: () => void;
} = {}) {
  return (
    <header className="flex justify-between items-center w-full px-6 h-20 bg-[#fbfbe2] fixed top-0 z-50 md:sticky">
      <div className="flex items-center gap-3">
        {onLeftToggle && (
          <button
            onClick={onLeftToggle}
            className="hidden md:flex p-2 rounded-full text-[#1b1d0e] hover:bg-[#a6f3cc]/20 transition-colors"
            title={leftOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {leftOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
        )}
        <span className="md:hidden text-2xl font-black uppercase tracking-tighter text-[#1b1d0e]">
          Zeif
        </span>
        <div className="hidden md:flex items-center gap-2 bg-[#f5f5dc] px-4 py-2 rounded-full w-80">
          <Search size={14} className="text-[#47473f] shrink-0" />
          <input
            className="bg-transparent border-none outline-none focus:ring-0 text-sm w-full placeholder:text-[#47473f]/50"
            placeholder="Search incidents, products, tills…"
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
        {onRightToggle && (
          <button
            onClick={onRightToggle}
            className="hidden xl:flex p-2 rounded-full text-[#1b1d0e] hover:bg-[#a6f3cc]/20 transition-colors"
            title={rightOpen ? 'Collapse activity' : 'Expand activity'}
          >
            {rightOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          </button>
        )}
      </div>

      <div className="absolute bottom-0 left-0 h-px w-full bg-[#f5f5dc]" />
    </header>
  );
}

// ─── Floor Feed Card ──────────────────────────────────────────────────────────

type FeedStatus = 'LIVE' | 'ACTIVE' | 'OFFLINE';

interface CameraFeedProps {
  src: string;
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

function FloorFeed({ src, zone, location, status, highlight, onClick }: CameraFeedProps & { onClick?: () => void }) {
  const badge = STATUS_STYLES[status];

  return (
    <motion.div
      layoutId={`feed-${zone}`}
      onClick={onClick}
      className={`group relative aspect-square bg-[#efefd7] overflow-hidden shadow-md transition-all duration-300 cursor-pointer${
        highlight ? ' border-4 border-[#a6f3cc]/30' : ''
      }`}
      whileHover={{ scale: 1.01 }}
      transition={{ layout: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
    >
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
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
    </motion.div>
  );
}

// ─── Expanded Feed Overlay ────────────────────────────────────────────────────

function ExpandedFeed({ feed, onClose, onNext, onPrev, hasNext, hasPrev }: {
  feed: CameraFeedProps;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}) {
  const badge = STATUS_STYLES[feed.status];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85"
        onClick={onClose}
      />

      {/* Expanded card */}
      <motion.div
        layoutId={`feed-${feed.zone}`}
        className="relative z-10 overflow-hidden shadow-2xl"
        style={{ width: 'min(90vw, 160vh)', aspectRatio: '16/9' }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <video
          src={feed.src}
          autoPlay
          muted
          loop
          playsInline
          className={`absolute inset-0 w-full h-full object-cover ${feed.status === 'OFFLINE' ? 'grayscale brightness-50' : 'brightness-90'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

        {/* Status badge */}
        {feed.status !== 'OFFLINE' ? (
          <div className={`absolute top-6 left-6 flex items-center gap-2 ${badge.bg} ${badge.text} px-3 py-1 text-[10px] font-black uppercase tracking-widest`}>
            {badge.pulse && <span className="w-1.5 h-1.5 rounded-full bg-[#002114] animate-pulse" />}
            {feed.status}
          </div>
        ) : (
          <div className="absolute inset-0 bg-[#1b1d0e]/40 flex items-center justify-center pointer-events-none">
            <div className={`${badge.bg} ${badge.text} px-4 py-2 text-[10px] font-black uppercase tracking-widest`}>
              OFFLINE
            </div>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Prev button */}
        {hasPrev && (
          <button
            onClick={onPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Next button */}
        {hasNext && (
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight size={22} />
          </button>
        )}

        {/* Info bar */}
        <div className="absolute bottom-0 left-0 right-0 px-8 py-6 flex items-end justify-between">
          <div className="text-white">
            <p className="text-xs uppercase font-bold tracking-widest opacity-70">{feed.zone}</p>
            <h2 className="text-4xl font-black tracking-tighter mt-1">{feed.location}</h2>
          </div>
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest">← → or Esc</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Right Sidebar ────────────────────────────────────────────────────────────

const activity = [
  {
    tag: 'FACE MATCH',
    tagBg: 'bg-[#ffdad6]',
    tagText: 'text-[#93000a]',
    time: '14:22:05',
    desc: 'Known suspect "Lisa K." detected at Front Entrance. 94% confidence. Flagged as high-risk.',
    meta: 'Zone: A / Front Entrance',
    metaColor: 'text-[#ba1a1a]',
    action: 'View Profile',
    actionColor: 'text-[#ba1a1a]',
  },
  {
    tag: 'SUSPICIOUS',
    tagBg: 'bg-[#e3e89a]',
    tagText: 'text-[#1b1d00]',
    time: '13:45:12',
    desc: 'Individual loitering near Tobacco Counter for 8+ minutes. No purchase made.',
    meta: 'Zone: C / Tobacco Counter',
    metaColor: 'text-[#47473f]',
    action: 'Review Footage',
    actionColor: 'text-[#1b6b4d]',
  },
  {
    tag: 'CONCEALMENT',
    tagBg: 'bg-[#ffdad6]',
    tagText: 'text-[#93000a]',
    time: '12:38:50',
    desc: 'Possible item concealment detected in Drinks Aisle. Subject placed item inside jacket.',
    meta: 'Zone: B / Drinks Aisle',
    metaColor: 'text-[#ba1a1a]',
    action: 'Review Footage',
    actionColor: 'text-[#ba1a1a]',
  },
  {
    tag: 'FACE MATCH',
    tagBg: 'bg-[#ffdad6]',
    tagText: 'text-[#93000a]',
    time: '11:15:44',
    desc: 'Unknown Male "Hoodie Guy" re-entered store 20 mins after prior incident. Alert raised.',
    meta: 'Zone: A / Front Entrance',
    metaColor: 'text-[#ba1a1a]',
    action: 'View Profile',
    actionColor: 'text-[#ba1a1a]',
  },
];

function RightSidebar({ isOpen = true }: { isOpen?: boolean }) {
  return (
    <motion.aside
      animate={{ width: isOpen ? 416 : 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="hidden xl:block sticky right-0 top-0 h-screen shrink-0 overflow-hidden z-40"
    >
    <div className="w-[26rem] h-full flex flex-col bg-[#f5f5dc] py-12 px-10 gap-8 shadow-[-20px_0px_40px_rgba(27,29,14,0.02)]">
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

    </div>
    </motion.aside>
  );
}

// ─── Floor feed data ──────────────────────────────────────────────────────────

const feeds: CameraFeedProps[] = [
  { src: '/videos/shoplift1.mp4', zone: 'Zone A', location: 'Front Entrance', status: 'LIVE' },
  { src: '/videos/shoplift2.mp4', zone: 'Zone B', location: 'Drinks Aisle',   status: 'LIVE' },
  { src: '/videos/shoplift3.mp4', zone: 'Zone C', location: 'Tobacco Counter',status: 'ACTIVE', highlight: true },
  { src: '/videos/shoplift4.mp4', zone: 'Zone D', location: 'Self-Checkout',  status: 'OFFLINE' },
  { src: '/videos/shoplift5.mp4', zone: 'Zone E', location: 'Stockroom',      status: 'LIVE' },
  { src: '/videos/shoplift1.mp4', zone: 'Zone F', location: 'Car Park',       status: 'LIVE' },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export function Dashboard() {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <div
      className="flex min-h-screen text-[#1b1d0e]"
      style={{ backgroundColor: '#fbfbe2', fontFamily: 'var(--font-inter), Inter, sans-serif' }}
    >
      <LeftSidebar isOpen={leftOpen} />

      <main className="flex-1 flex flex-col min-w-0">
        <TopNav
          leftOpen={leftOpen}
          onLeftToggle={() => setLeftOpen(o => !o)}
          rightOpen={rightOpen}
          onRightToggle={() => setRightOpen(o => !o)}
        />

        <div className="p-12 space-y-16 mt-20 md:mt-0">
          {/* Page title */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <h1 className="text-5xl font-black tracking-tighter text-[#1b1d0e] whitespace-nowrap">
                Store View
              </h1>
              <p className="mt-4 text-[#47473f] font-medium tracking-widest uppercase text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#a6f3cc] animate-pulse" />
                All Areas: Trading Normally
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
            {feeds.map((feed, i) => (
              <FloorFeed key={feed.zone} {...feed} onClick={() => setSelectedIndex(i)} />
            ))}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-8 border-t border-[#c8c7bc]/20">
            {/* Stores open */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-[#47473f]">
                Tills Active
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black tracking-tighter">3</span>
                <span className="text-[#a6f3cc] text-xl font-bold">/4</span>
              </div>
              <div className="h-1 w-full bg-[#e4e4cc] rounded-full mt-2">
                <div className="h-full bg-[#a6f3cc] w-[75%] rounded-full" />
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
                Status: Drinks Aisle Low
              </p>
            </div>

            {/* Revenue */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-[#47473f]">
                Revenue Today
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black tracking-tighter">£4.2</span>
                <span className="text-[#47473f] text-xl font-bold">K</span>
              </div>
              <div className="flex gap-2 items-center mt-2">
                <span className="text-[10px] font-bold text-[#47473f]">£0</span>
                <div className="h-1 flex-1 bg-[#e4e4cc] rounded-full overflow-hidden">
                  <div className="h-full bg-[#f3daff] w-[70%] rounded-full" />
                </div>
                <span className="text-[10px] font-bold text-[#47473f]">£6K target</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <RightSidebar isOpen={rightOpen} />

      <AnimatePresence>
        {selectedIndex !== null && (
          <ExpandedFeed
            key={selectedIndex}
            feed={feeds[selectedIndex]}
            onClose={() => setSelectedIndex(null)}
            onNext={() => setSelectedIndex(i => i !== null ? Math.min(i + 1, feeds.length - 1) : null)}
            onPrev={() => setSelectedIndex(i => i !== null ? Math.max(i - 1, 0) : null)}
            hasNext={selectedIndex < feeds.length - 1}
            hasPrev={selectedIndex > 0}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
