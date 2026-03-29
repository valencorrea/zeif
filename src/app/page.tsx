import { CameraGrid } from '@/components/camera-grid';
import { StatusBar } from '@/components/status-bar';
import { CAMERA_ZONES } from '@/lib/mock-data';

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, margin: 0 }}>Store View</h1>
          <StatusBar variant="incident" text="INCIDENT DETECTED · DRINKS AISLE" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '12px 16px', border: '1.5px solid #1a1a1a', background: 'transparent', borderRadius: 7, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px' }}>
            EXPORT REPORT
          </button>
          <button style={{ padding: '12px 16px', border: 'none', background: '#1a1a1a', color: '#fff', borderRadius: 7, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px' }}>
            VIEW FOOTAGE
          </button>
        </div>
      </div>
      <CameraGrid zones={CAMERA_ZONES} />
    </div>
  );
}
