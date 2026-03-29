'use client';

import { AnimatePresence } from 'framer-motion';
import { AlertItem } from '@/components/alert-item';
import type { Alert } from '@/lib/mock-data';

interface ActivityPanelProps {
  alerts: Alert[];
  onAlertAction?: (alert: Alert) => void;
}

export function ActivityPanel({ alerts, onAlertAction }: ActivityPanelProps) {
  const reversedAlerts = [...alerts].reverse();

  return (
    <div
      style={{
        width: 278,
        minWidth: 278,
        backgroundColor: '#f8f8ef',
        borderLeft: '1px solid #e0e1d2',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '13px 14px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #eee',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: '#1a1a1a',
          }}
        >
          ACTIVITY
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#888">
          <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
        </svg>
      </div>

      {/* Alert list */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          overflowY: 'auto',
        }}
      >
        <AnimatePresence>
          {reversedAlerts.map((alert, index) => (
            <AlertItem
              key={`${alert.type}-${alert.at}-${index}`}
              alert={alert}
              onAction={onAlertAction ? () => onAlertAction(alert) : undefined}
            />
          ))}
        </AnimatePresence>
        {alerts.length === 0 && (
          <div style={{ padding: '40px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>◎</div>
            <div style={{ fontSize: 10, color: '#bbb' }}>No activity yet</div>
            <div style={{ fontSize: 9, color: '#ccc', marginTop: 4 }}>Alerts will appear here in real-time</div>
          </div>
        )}
      </div>
    </div>
  );
}
