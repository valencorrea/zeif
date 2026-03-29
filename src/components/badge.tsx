'use client';

import React from 'react';
import { badgeColors, type BadgeVariant } from '@/lib/design-tokens';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  const { bg, text } = badgeColors[variant];
  return (
    <span
      style={{
        backgroundColor: bg,
        color: text,
        fontSize: 9,
        fontWeight: 800,
        padding: '2px 7px',
        borderRadius: 4,
        letterSpacing: '0.7px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}
