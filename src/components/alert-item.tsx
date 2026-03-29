'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/badge';
import type { Alert } from '@/lib/mock-data';
import type { BadgeVariant } from '@/lib/design-tokens';

interface AlertItemProps {
  alert: Alert;
  onAction?: () => void;
}

export function AlertItem({ alert, onAction }: AlertItemProps) {
  const badgeVariant = alert.type as BadgeVariant;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{
        padding: '10px 13px',
        borderBottom: '1px solid #f2f2f2',
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 5,
        }}
      >
        <Badge variant={badgeVariant}>{alert.badgeText}</Badge>
        <span style={{ fontSize: 8.5, color: '#bbb' }}>{alert.time}</span>
      </div>

      {/* Text */}
      <p
        style={{
          fontSize: 10.5,
          color: '#333',
          lineHeight: 1.5,
          marginBottom: 4,
          margin: '0 0 4px 0',
        }}
      >
        {alert.text}
      </p>

      {/* Meta */}
      <p
        style={{
          fontSize: 8.5,
          color: '#bbb',
          marginBottom: 5,
          margin: '0 0 5px 0',
        }}
      >
        {alert.meta}
      </p>

      {/* Action button (was <span onClick>) */}
      <button
        type="button"
        onClick={onAction}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          textDecoration: 'underline',
          cursor: 'pointer',
          color: hovered ? '#c5e63a' : '#1a1a1a',
          background: 'none',
          border: 'none',
          padding: '6px 0',
        }}
      >
        {alert.link}
      </button>
    </motion.div>
  );
}
