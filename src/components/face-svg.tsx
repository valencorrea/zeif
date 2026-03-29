'use client';

import { useMemo, useState, useEffect } from 'react';

interface FaceSVGProps {
  seed: number;
  isActive: boolean;
}

function prng(seed: number, n: number): number {
  const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function FaceSVG({ seed, isActive }: FaceSVGProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const id = setInterval(() => setTick((t) => t + 1), 150);
    return () => clearInterval(id);
  }, []);

  // Base points (static, from seed)
  const base = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        x: 12 + prng(seed, i * 2) * 76,
        y: 8 + prng(seed, i * 2 + 1) * 104,
      })),
    [seed],
  );

  // Mesh connections (static, from seed)
  const connections = useMemo(() => {
    const c: [number, number][] = [];
    for (let i = 0; i < 9; i++) {
      for (let j = i + 1; j < 9; j++) {
        if (prng(seed, i * 13 + j * 7) > 0.55) c.push([i, j]);
      }
    }
    return c;
  }, [seed]);

  // Animated points — each node drifts in a small orbit
  const points = base.map((pt, i) => {
    const speed = 0.02 + prng(seed, i + 100) * 0.03;
    const radius = 1.5 + prng(seed, i + 150) * 2.5;
    const phase = prng(seed, i + 50) * Math.PI * 2;
    return {
      x: pt.x + Math.sin(tick * speed + phase) * radius,
      y: pt.y + Math.cos(tick * speed * 0.7 + phase) * radius,
    };
  });

  const meshColor = isActive ? 'rgba(197,230,58,0.22)' : 'rgba(197,230,58,0.1)';
  const dotColor = isActive ? 'rgba(197,230,58,0.75)' : 'rgba(197,230,58,0.35)';

  // Face shape params
  const eyeOffsetX = 12 + prng(seed, 200) * 8;
  const eyeOffsetY = 35 + prng(seed, 201) * 6;
  const eyeWidth = 8 + prng(seed, 202) * 4;
  const noseY = 58 + prng(seed, 203) * 8;
  const mouthY = 78 + prng(seed, 204) * 6;

  return (
    <svg viewBox="0 0 100 120" width="100%" height="100%" style={{ display: 'block' }}>
      <defs>
        <filter id={`blur-${seed}`}>
          <feGaussianBlur stdDeviation="5.5" />
        </filter>
        <filter id={`blur-sm-${seed}`}>
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Background */}
      <rect width="100" height="120" fill="#0c0e0c" />

      {/* Blurred face */}
      <ellipse cx="50" cy="56" rx="31" ry="37" fill="#222a22" filter={`url(#blur-${seed})`} />
      <ellipse cx={50 - eyeOffsetX} cy={eyeOffsetY} rx={eyeWidth} ry="5.5" fill="#182818" opacity="0.85" filter={`url(#blur-sm-${seed})`} />
      <ellipse cx={50 + eyeOffsetX} cy={eyeOffsetY} rx={eyeWidth} ry="5.5" fill="#182818" opacity="0.85" filter={`url(#blur-sm-${seed})`} />
      <ellipse cx="50" cy={noseY} rx="5" ry="7" fill="#1c241c" opacity="0.7" filter={`url(#blur-sm-${seed})`} />
      <ellipse cx="50" cy={mouthY} rx="11" ry="4.5" fill="#182018" opacity="0.6" filter={`url(#blur-${seed})`} />

      {/* Mesh lines */}
      {connections.map(([i, j], idx) => (
        <line
          key={`l-${idx}`}
          x1={points[i].x.toFixed(1)}
          y1={points[i].y.toFixed(1)}
          x2={points[j].x.toFixed(1)}
          y2={points[j].y.toFixed(1)}
          stroke={meshColor}
          strokeWidth="0.45"
        />
      ))}

      {/* Landmark dots */}
      {points.map((pt, i) => (
        <circle
          key={`d-${i}`}
          cx={pt.x.toFixed(1)}
          cy={pt.y.toFixed(1)}
          r={0.9 + prng(seed, i + 50) * 1.1}
          fill={dotColor}
        />
      ))}

      {/* Scanlines */}
      {Array.from({ length: 30 }, (_, i) => (
        <line key={`s-${i}`} x1="0" y1={i * 4 + 2} x2="100" y2={i * 4 + 2} stroke="rgba(0,0,0,0.14)" strokeWidth="0.7" />
      ))}

      {/* Corner brackets if active */}
      {isActive && (
        <>
          <path d="M3,3 L3,13 M3,3 L13,3" stroke="#c5e63a" strokeWidth="1.5" fill="none" />
          <path d="M97,3 L97,13 M97,3 L87,3" stroke="#c5e63a" strokeWidth="1.5" fill="none" />
          <path d="M3,117 L3,107 M3,117 L13,117" stroke="#c5e63a" strokeWidth="1.5" fill="none" />
          <path d="M97,117 L97,107 M97,117 L87,117" stroke="#c5e63a" strokeWidth="1.5" fill="none" />
        </>
      )}
    </svg>
  );
}
