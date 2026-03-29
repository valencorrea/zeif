'use client';

import { LeftSidebar, TopNav } from '@/components/dashboard';
import { CameraView } from '@/components/camera-view';

export default function FloorViewPage() {
  return (
    <div
      className="flex min-h-screen text-[#1b1d0e]"
      style={{ backgroundColor: '#fbfbe2' }}
    >
      <LeftSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <div className="p-12 mt-20 md:mt-0">
          <CameraView />
        </div>
      </main>
    </div>
  );
}
