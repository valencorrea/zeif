'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { TopBar } from '@/components/top-bar';
import { ActivityPanel } from '@/components/activity-panel';
import { ALERT_SEQUENCE, type Alert } from '@/lib/mock-data';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isDesktop, setIsDesktop] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const timeouts = ALERT_SEQUENCE.map((alert) =>
      setTimeout(() => {
        setAlerts((prev) => [...prev, alert]);
      }, alert.at)
    );
    return () => timeouts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  function handleAlertAction(alert: Alert) {
    if (alert.link === 'VIEW PROFILE') {
      router.push('/face-db');
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        minHeight: '100vh',
        backgroundColor: '#eef0e2',
      }}
    >
      <a
        href="#main-content"
        style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden', zIndex: 9999 }}
        onFocus={(e) => {
          e.currentTarget.style.position = 'static';
          e.currentTarget.style.width = 'auto';
          e.currentTarget.style.height = 'auto';
        }}
      >
        Skip to main content
      </a>

      {/* Left: Sidebar */}
      {isDesktop && <Sidebar />}

      {/* Center: Main content */}
      <main
        id="main-content"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <TopBar />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '14px 16px',
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          {children}
        </div>
      </main>

      {/* Right: Activity panel */}
      {isDesktop && <ActivityPanel alerts={alerts} onAlertAction={handleAlertAction} />}
    </div>
  );
}
