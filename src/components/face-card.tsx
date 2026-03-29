'use client';

import { useState, useEffect } from 'react';
import { FaceSVG } from '@/components/face-svg';
import { Badge } from '@/components/badge';
import type { FaceRecord } from '@/lib/mock-data';
import type { BadgeVariant } from '@/lib/design-tokens';

interface FaceCardProps {
  record: FaceRecord;
  isActive?: boolean;
}

function prng(seed: number, n: number): number {
  const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function generateVector(seed: number): string {
  const v = Array.from({ length: 6 }, (_, i) => {
    const val = (prng(seed, i + 200) * 2 - 1).toFixed(3);
    return Number(val) >= 0 ? ' ' + val : val;
  });
  return `[${v[0]}, ${v[1]}, ${v[2]}]\n[${v[3]}, ${v[4]}, ${v[5]}]`;
}

export function FaceCard({ record, isActive = false }: FaceCardProps) {
  const [hovered, setHovered] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const glowing = hovered || isActive;

  useEffect(() => {
    setPrefersReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const riskBadge = `risk-${record.risk}` as BadgeVariant;
  const riskLabels = { high: 'ALTO RIESGO', medium: 'MEDIO RIESGO', low: 'BAJO RIESGO' } as const;
  const riskLabel = riskLabels[record.risk];

  const vector = generateVector(record.seed);

  const borderColor = glowing ? '#c5e63a' : '#e8e9da';

  return (
    <>
      <style>{`
        @keyframes cardGlow {
          0%, 100% { box-shadow: 0 0 0 2px rgba(197,230,58,0.3); }
          50%      { box-shadow: 0 0 0 5px rgba(197,230,58,0.15); }
        }
      `}</style>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          backgroundColor: '#fff',
          borderRadius: 10,
          border: `1.5px solid ${borderColor}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          transition: 'border-color 0.3s, box-shadow 0.3s',
          animation: glowing && !prefersReduced ? 'cardGlow 2s ease-in-out infinite' : undefined,
          boxShadow: glowing
            ? '0 0 0 2px rgba(197,230,58,0.3)'
            : undefined,
        }}
      >
        {/* Visual area */}
        <div
          style={{
            position: 'relative',
            backgroundColor: '#0d0f0d',
            aspectRatio: '5 / 6',
            overflow: 'hidden',
          }}
        >
          <FaceSVG seed={record.seed} isActive={glowing} />

          {/* Active tag — data-driven, only for in-store suspects */}
          {record.active && (
            <div
              style={{
                position: 'absolute',
                top: 7,
                left: 7,
                backgroundColor: '#c5e63a',
                color: '#1a1a1a',
                fontSize: 7.5,
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: 3,
                letterSpacing: '0.8px',
              }}
            >
              ● EN TIENDA
            </div>
          )}

          {/* ID overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: 7,
              right: 7,
              fontSize: 8,
              fontFamily: 'monospace',
              color: 'rgba(197,230,58,0.5)',
              letterSpacing: '0.5px',
            }}
          >
            {record.id}
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '9px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            flex: 1,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', color: '#1a1a1a' }}>
            {record.id}
          </div>
          <div>
            <Badge variant={riskBadge}>● {riskLabel}</Badge>
          </div>
          <div style={{ fontSize: 9.5, color: '#555' }}>
            {record.incidents} incidente{record.incidents !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 8.5, color: '#aaa' }}>{record.lastSeen}</div>
          <pre
            style={{
              fontSize: 7.5,
              fontFamily: 'monospace',
              color: '#bbb',
              backgroundColor: '#f7f8f0',
              borderRadius: 4,
              padding: '4px 6px',
              margin: 0,
              marginTop: 2,
              lineHeight: 1.5,
              letterSpacing: '0.2px',
              whiteSpace: 'pre',
            }}
          >
            {vector}
          </pre>
        </div>
      </div>
    </>
  );
}
