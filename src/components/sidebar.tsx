'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    label: 'DASHBOARD',
    href: '/',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z" />
      </svg>
    ),
  },
  {
    label: 'FLOOR VIEW',
    href: '/floor-view',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
      </svg>
    ),
  },
  {
    label: 'FACE DB',
    href: '/face-db',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  return (
    <div
      style={{
        width: 188,
        minWidth: 188,
        backgroundColor: '#e8e9da',
        borderRight: '1px solid #d4d5c6',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '18px 16px 10px' }}>
        <span
          style={{
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: -1,
            color: '#1a1a1a',
            lineHeight: 1,
          }}
        >
          Zeif
        </span>
      </div>

      {/* User section */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 8,
          padding: '9px 14px',
          borderTop: '1px solid #cfd0c2',
          borderBottom: '1px solid #cfd0c2',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            backgroundColor: '#c5e63a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: '#1a1a1a',
            flexShrink: 0,
          }}
        >
          SM
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a' }}>SARAH M.</span>
          <span style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', letterSpacing: '0.3px' }}>
            Store Manager
          </span>
        </div>
      </div>

      {/* Store pill */}
      <div style={{ margin: '10px 14px 4px' }}>
        <div
          style={{
            backgroundColor: '#c5e63a',
            borderRadius: 5,
            padding: '3px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 9,
            fontWeight: 700,
            color: '#1a1a1a',
          }}
        >
          ● Store
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isHovered = hoveredHref === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              onMouseEnter={() => setHoveredHref(item.href)}
              onMouseLeave={() => setHoveredHref(null)}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: '14px 10px',
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'none',
                backgroundColor: isActive
                  ? '#c5e63a'
                  : isHovered
                    ? 'rgba(197,230,58,0.15)'
                    : 'transparent',
                color: isActive ? '#1a1a1a' : '#555',
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* New report button */}
      <div style={{ margin: '0 12px 16px' }}>
        <button
          style={{
            width: '100%',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            borderRadius: 7,
            padding: '14px 0',
            fontSize: 11,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.3px',
          }}
        >
          NEW REPORT
        </button>
      </div>
    </div>
  );
}
