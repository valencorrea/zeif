'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { VideoOff, AlertTriangle, ShieldCheck, ShieldAlert, Loader2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Types ───────────────────────────────────────────────────────────────── */

type CameraState =
  | 'requesting'
  | 'active'
  | 'recording'
  | 'analyzing'
  | 'denied'
  | 'no-camera';

interface AnalysisResult {
  shoplifting: boolean;
  confidence: number;
  reasoning: string;
}

const RECORD_DURATION_MS = 5_000;
const FETCH_TIMEOUT_MS = 30_000;

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function negotiateMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

/* ─── Result Overlay ──────────────────────────────────────────────────────── */

function ResultOverlay({ result, onDismiss }: { result: AnalysisResult; onDismiss: () => void }) {
  const isAlert = result.shoplifting;
  const Icon = isAlert ? ShieldAlert : ShieldCheck;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`absolute bottom-6 left-6 right-6 rounded-xl p-4 shadow-lg backdrop-blur-sm ${
        isAlert
          ? 'bg-[#ffdad6]/90 text-[#93000a]'
          : 'bg-[#a6f3cc]/90 text-[#002114]'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon size={24} />
        <span className="text-xs font-black uppercase tracking-widest">
          {isAlert ? 'Robbery Detected' : 'All Clear'}
        </span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest">
          Risk {Math.round(result.confidence * 100)}%
        </span>
      </div>
      <p className="text-sm font-medium">{result.reasoning}</p>
      <button
        onClick={onDismiss}
        className="mt-3 text-[10px] font-black uppercase tracking-widest underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
      >
        Dismiss
      </button>
    </motion.div>
  );
}

/* ─── Error Overlay ───────────────────────────────────────────────────────── */

function ErrorOverlay({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="absolute bottom-6 left-6 right-6 rounded-xl p-4 shadow-lg backdrop-blur-sm bg-[#e3e89a]/90 text-[#1b1d00]"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} />
        <span className="text-xs font-black uppercase tracking-widest">
          Analysis Error
        </span>
      </div>
      <p className="text-sm font-medium mt-1">{message}</p>
      <button
        onClick={onDismiss}
        className="mt-3 text-[10px] font-black uppercase tracking-widest underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
      >
        Dismiss
      </button>
    </motion.div>
  );
}

/* ─── Record Button ───────────────────────────────────────────────────────── */

function RecordButton({ state, onRecord }: { state: CameraState; onRecord: () => void }) {
  const isRecording = state === 'recording';
  const isAnalyzing = state === 'analyzing';
  const disabled = isRecording || isAnalyzing;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
      <button
        onClick={onRecord}
        disabled={disabled}
        className={`w-16 h-16 rounded-full border-4 border-[#fbfbe2]/80 flex items-center justify-center transition-all ${
          isRecording
            ? 'bg-[#93000a] scale-110'
            : isAnalyzing
              ? 'bg-[#e3e89a] cursor-wait'
              : 'bg-[#fbfbe2]/20 hover:bg-[#fbfbe2]/40 active:scale-95'
        }`}
      >
        {isRecording && (
          <span className="w-5 h-5 rounded-sm bg-[#fbfbe2] animate-pulse" />
        )}
        {isAnalyzing && (
          <Loader2 size={24} className="text-[#1b1d00] animate-spin" />
        )}
        {!isRecording && !isAnalyzing && (
          <Circle size={28} className="text-[#fbfbe2] fill-[#93000a]" />
        )}
      </button>
      <span className="text-[10px] font-black uppercase tracking-widest text-[#fbfbe2]/70">
        {isRecording ? 'Recording…' : isAnalyzing ? 'Analyzing…' : 'Record'}
      </span>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef('');

  const [state, setState] = useState<CameraState>('requesting');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ── Record and analyze (one-shot) ─────────────────────────────────────── */

  const handleRecord = useCallback(async () => {
    if (!recorderRef.current) return;
    if (state !== 'active') return;

    const recorder = recorderRef.current;
    chunksRef.current = [];
    setResult(null);
    setError(null);

    // Record for RECORD_DURATION_MS
    setState('recording');

    const blob = await new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: mimeTypeRef.current }));
      };
      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, RECORD_DURATION_MS);
    });

    // Validate
    if (blob.size === 0) {
      setError('Empty recording — try again.');
      setState('active');
      return;
    }

    // Analyze
    setState('analyzing');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const contentType = mimeTypeRef.current.split(';')[0] || 'video/webm';
      const res = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: blob,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ??
            (data as { detail?: string }).detail ??
            `HTTP ${res.status}`,
        );
      }

      const analysis: AnalysisResult = await res.json();
      setResult(analysis);
      setError(null);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Analysis timed out.'
          : err instanceof Error
            ? err.message
            : 'Unknown error';
      setError(msg);
      setResult(null);
    }

    setState('active');
  }, [state]);

  /* ── Camera init ────────────────────────────────────────────────────────── */

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

        const mime = negotiateMimeType();
        if (!mime) {
          setError('Browser does not support video recording.');
          return;
        }
        mimeTypeRef.current = mime;
        recorderRef.current = new MediaRecorder(s, { mimeType: mime });
      })
      .catch((err: DOMException) => {
        if (err.name === 'NotFoundError' || err.name === 'NotReadableError') {
          setState('no-camera');
        } else {
          setState('denied');
        }
      });

    return () => {
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const showRecordButton =
    state === 'active' || state === 'recording' || state === 'analyzing';

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
        {/* Requesting */}
        {state === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[#fbfbe2]/50 uppercase text-xs font-bold tracking-widest">
              Requesting camera access…
            </p>
          </div>
        )}

        {/* Denied */}
        {state === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <VideoOff size={40} className="text-[#fbfbe2]/30" />
            <p className="text-[#fbfbe2]/70 uppercase text-xs font-bold tracking-widest">
              Camera access denied
            </p>
            <p className="text-[#fbfbe2]/40 text-xs max-w-sm">
              Zeif needs camera access to detect security incidents. Please enable camera
              permissions in your browser settings and reload the page.
            </p>
          </div>
        )}

        {/* No camera */}
        {state === 'no-camera' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <VideoOff size={40} className="text-[#fbfbe2]/30" />
            <p className="text-[#fbfbe2]/70 uppercase text-xs font-bold tracking-widest">
              No camera found
            </p>
            <p className="text-[#fbfbe2]/40 text-xs max-w-sm">
              Connect a camera to this device and reload the page to start monitoring.
            </p>
          </div>
        )}

        {/* Video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            state !== 'denied' && state !== 'no-camera' && state !== 'requesting'
              ? 'opacity-100'
              : 'opacity-0'
          }`}
        />

        {/* Recording badge */}
        {state === 'recording' && (
          <div className="absolute top-6 left-6 flex items-center gap-2 bg-[#ffdad6] text-[#93000a] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#93000a] animate-pulse" />
            REC
          </div>
        )}

        {/* Analyzing badge */}
        {state === 'analyzing' && (
          <div className="absolute top-6 left-6 flex items-center gap-2 bg-[#e3e89a] text-[#1b1d00] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            <Loader2 size={12} className="animate-spin" />
            Analyzing…
          </div>
        )}

        {/* Active / idle badge */}
        {state === 'active' && !result && !error && (
          <div className="absolute top-6 left-6 flex items-center gap-2 bg-[#a6f3cc] text-[#002114] px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#002114] animate-pulse" />
            LIVE
          </div>
        )}

        {/* Record button */}
        {showRecordButton && !result && !error && (
          <RecordButton state={state} onRecord={handleRecord} />
        )}

        {/* Result / Error overlays */}
        <AnimatePresence>
          {result && (
            <ResultOverlay
              key="result"
              result={result}
              onDismiss={() => setResult(null)}
            />
          )}
          {error && !result && (
            <ErrorOverlay
              key="error"
              message={error}
              onDismiss={() => setError(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
