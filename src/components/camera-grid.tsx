import { CameraCard } from '@/components/camera-card';
import type { CameraZone } from '@/lib/mock-data';

interface CameraGridProps {
  zones: CameraZone[];
}

export function CameraGrid({ zones }: CameraGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: 9,
        flex: 1,
        minHeight: 0,
      }}
    >
      {zones.map((zone) => (
        <CameraCard key={zone.id} zone={zone} />
      ))}
    </div>
  );
}
