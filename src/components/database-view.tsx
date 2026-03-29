'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { StorageFile } from '@/app/api/storage/route';

type LoadState = 'loading' | 'ready' | 'error';

export function DatabaseView() {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    fetch('/api/storage')
      .then((res) => res.json())
      .then((body) => {
        setFiles(body.files ?? []);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  const images = files.filter((f) => f.type === 'image');
  const videos = files.filter((f) => f.type === 'video');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-8xl font-black tracking-tighter text-[#1b1d0e]">
          Suspicious behavior
        </h1>
      </div>

      {state === 'loading' && (
        <p className="text-[#47473f] uppercase text-xs font-bold tracking-widest animate-pulse">
          Loading…
        </p>
      )}

      {state === 'error' && (
        <p className="text-[#ba1a1a] uppercase text-xs font-bold tracking-widest">
          Failed to load files from storage.
        </p>
      )}

      {state === 'ready' && files.length === 0 && (
        <p className="text-[#47473f] uppercase text-xs font-bold tracking-widest">
          No files found in the people bucket.
        </p>
      )}

      {state === 'ready' && images.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#47473f]">
            Images ({images.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {images.map((file) => (
              <div
                key={file.name}
                className="relative aspect-square bg-[#e4e4cc] rounded-xl overflow-hidden"
              >
                <Image
                  src={file.url}
                  alt={file.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 20vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {state === 'ready' && videos.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#47473f]">
            Videos ({videos.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((file) => (
              <video
                key={file.name}
                src={file.url}
                controls
                className="w-full rounded-xl bg-[#1b1d0e]"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
