import Link from 'next/link';
import { FaceCard } from '@/components/face-card';
import { StatusBar } from '@/components/status-bar';
import type { FaceRecord } from '@/lib/mock-data';

interface FaceDBViewProps {
  records: FaceRecord[];
}

export function FaceDBView({ records }: FaceDBViewProps) {
  const highRiskCount = records.filter((r) => r.risk === 'high').length;
  const totalIncidents = records.reduce((sum, r) => sum + r.incidents, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
      {/* Live match banner */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#1a1a1a',
          color: '#c5e63a',
          borderRadius: 7,
          padding: '8px 14px',
          gap: 10,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#c5e63a',
            flexShrink: 0,
            display: 'inline-block',
            animation: 'pulse 1.5s infinite',
          }}
        />
        <span style={{ fontSize: 10, fontWeight: 700, flex: 1 }}>
          COINCIDENCIA ACTIVA · ZF-4829-LKQM detectado en ENTRADA PRINCIPAL · Confianza 94%
        </span>
        <Link
          href="/"
          style={{
            backgroundColor: '#c5e63a',
            color: '#1a1a1a',
            fontSize: 9,
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 4,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          VER CÁMARA →
        </Link>
      </div>

      {/* View header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Left: title + status + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#1a1a1a',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Face Database
            </h1>
            <StatusBar variant="normal" text={`${records.length} REGISTROS · ACTIVO`} />
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 1,
                height: 28,
                backgroundColor: '#d4d5c6',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{records.length}</span>
              <span style={{ fontSize: 8.5, color: '#888', textTransform: 'uppercase' }}>Registros</span>
            </div>
            <div style={{ width: 1, height: 28, backgroundColor: '#d4d5c6' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: '#c0304a', fontVariantNumeric: 'tabular-nums' }}>{highRiskCount}</span>
              <span style={{ fontSize: 8.5, color: '#888', textTransform: 'uppercase' }}>Alto riesgo</span>
            </div>
            <div style={{ width: 1, height: 28, backgroundColor: '#d4d5c6' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{totalIncidents}</span>
              <span style={{ fontSize: 8.5, color: '#888', textTransform: 'uppercase' }}>Incidentes/mes</span>
            </div>
          </div>
        </div>

        {/* Right: buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              padding: '12px 16px',
              border: '1.5px solid #1a1a1a',
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: '#1a1a1a',
            }}
          >
            EXPORTAR
          </button>
          <button
            style={{
              padding: '12px 16px',
              border: '1.5px solid #1a1a1a',
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: '#1a1a1a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            + AGREGAR
          </button>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          flex: 1,
          overflowY: 'auto',
          alignContent: 'start',
        }}
      >
        {records.map((record) => (
          <FaceCard key={record.id} record={record} />
        ))}
      </div>
    </div>
  );
}
