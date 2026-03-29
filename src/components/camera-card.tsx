'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/badge';
import type { CameraZone } from '@/lib/mock-data';

interface CameraCardProps {
  zone: CameraZone;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function CameraCard({ zone }: CameraCardProps) {
  const [timestamp, setTimestamp] = useState(() =>
    formatTimestamp(Date.now() + zone.timeOffset * 1000)
  );
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (zone.status === 'offline') return;
    const id = setInterval(() => {
      setTimestamp(formatTimestamp(Date.now() + zone.timeOffset * 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [zone.timeOffset, zone.status]);

  const badgeVariant = zone.status === 'live' ? 'live' : zone.status === 'active' ? 'active' : 'offline';
  const badgeLabel = zone.status === 'live' ? '● LIVE' : zone.status === 'active' ? '▲ ACTIVE' : '⊘ OFFLINE';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#1b1d1b',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: zone.incident
          ? '0 0 0 2.5px #c5e63a'
          : hovered
            ? '0 4px 16px rgba(0,0,0,0.35)'
            : undefined,
        opacity: zone.status === 'offline' ? 0.5 : 1,
        transform: hovered ? 'scale(1.01)' : undefined,
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
      }}
    >
      {/* Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: zone.bgStyle ?? 'linear-gradient(135deg,#191b19 0%,#252722 50%,#1c1e1a 100%)',
          zIndex: 1,
        }}
      />

      {/* Video */}
      {zone.videoSrc && (
        <video
          src={zone.videoSrc}
          muted
          autoPlay
          loop
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'grayscale(1)',
            zIndex: 2,
          }}
        />
      )}

      {/* Offline label */}
      {zone.status === 'offline' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 7,
            fontFamily: 'monospace',
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.15em',
          }}
        >
          NO SIGNAL
        </div>
      )}

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, transparent 55%, black 100%)',
          zIndex: 4,
          pointerEvents: 'none',
        }}
      />

      {/* Scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)',
          pointerEvents: 'none',
          zIndex: 6,
        }}
      />

      {/* Bounding box */}
      {zone.bbox && (
        <div
          style={{
            position: 'absolute',
            left: zone.bbox.left,
            top: zone.bbox.top,
            width: zone.bbox.width,
            height: zone.bbox.height,
            border: '2px solid #c5e63a',
            borderRadius: 3,
            zIndex: 8,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: -18,
              left: 0,
              backgroundColor: '#c5e63a',
              color: '#1a1a1a',
              fontSize: 7,
              fontWeight: 800,
              padding: '2px 5px',
              borderRadius: '3px 3px 0 0',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
            }}
          >
            {zone.bbox.label}
          </span>
        </div>
      )}

      {/* Content layer */}
      <div
        style={{
          position: 'relative',
          zIndex: 9,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 120,
          padding: 8,
        }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          <span
            style={{
              fontSize: 8.5,
              color: 'rgba(255,255,255,0.4)',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'monospace',
            }}
          >
            {zone.status !== 'offline' ? timestamp : '--:--:--'}
          </span>
        </div>

        {/* Bottom labels */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>
            {zone.zone}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#fff',
              fontWeight: 700,
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {zone.name}
          </div>
        </div>
      </div>
    </div>
  );
}
