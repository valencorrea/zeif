'use client';

import { useEffect, useRef, useState } from 'react';
import { VideoOff } from 'lucide-react';

type CameraState = 'requesting' | 'active' | 'denied';

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>('requesting');

  useEffect(() => {
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setState('active');
      })
      .catch(() => {
        setState('denied');
      });

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-8xl font-black tracking-tighter text-[#1b1d0e]">
          Floor View
        </h1>
        <p className="mt-4 text-[#47473f] font-medium tracking-widest uppercase text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#a6f3cc] animate-pulse" />
          Live Camera
        </p>
      </div>

      <div className="relative w-full aspect-video bg-[#1b1d0e] rounded-2xl overflow-hidden shadow-xl">
        {state === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[#fbfbe2]/50 uppercase text-xs font-bold tracking-widest">
              Requesting camera access…
            </p>
          </div>
        )}

        {state === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <VideoOff size={40} className="text-[#fbfbe2]/30" />
            <p className="text-[#fbfbe2]/50 uppercase text-xs font-bold tracking-widest">
              Camera access denied
            </p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            state === 'active' ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {state === 'active' && (
          <div className="absolute top-6 left-6 flex items-center gap-2 bg-[#a6f3cc] text-[#002114] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#002114] animate-pulse" />
            LIVE
          </div>
        )}
      </div>
    </div>
  );
}
