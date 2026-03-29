'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FallingPattern } from '@/components/ui/falling-pattern';
import { Dashboard } from '@/components/dashboard';

type Phase = 'welcome' | 'curtain-in' | 'curtain-out' | 'dashboard';

export default function Home() {
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem('zeif_intro_shown')) {
      setPhase('dashboard');
      return;
    }
    setPhase('welcome');
    const t = setTimeout(() => setPhase('curtain-in'), 3200);
    return () => clearTimeout(t);
  }, []);

  if (phase === null) return null;

  return (
    <div className={`relative w-full min-h-screen ${phase !== 'dashboard' ? 'overflow-hidden' : ''}`}>

      {/* Welcome screen */}
      {(phase === 'welcome' || phase === 'curtain-in') && (
        <div className="absolute inset-0">
          <FallingPattern className="h-screen [mask-image:radial-gradient(ellipse_at_center,transparent,var(--background))]" />
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <style>{`
              @keyframes zeif-glisten {
                /* sit still (highlight parked off-screen right) */
                0%, 60%  { background-position: 220% 50%; }
                /* sweep across */
                88%      { background-position: -120% 50%; }
                /* hold off-screen left until loop resets */
                100%     { background-position: -120% 50%; }
              }
            `}</style>
            <h1
              className="font-mono font-extrabold tracking-tighter select-none"
              style={{
                fontSize: 'clamp(4rem, 20vw, 22rem)',
                backgroundImage:
                  'linear-gradient(105deg, var(--foreground) 44%, white 50%, var(--foreground) 56%)',
                backgroundSize: '350% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'zeif-glisten 3.5s ease-in-out infinite',
              }}
            >
              Zeif
            </h1>
          </div>
        </div>
      )}

      {/* Dashboard — rendered behind the outgoing curtain */}
      {(phase === 'curtain-out' || phase === 'dashboard') && (
        <div className={phase === 'dashboard' ? '' : 'absolute inset-0'}>
          <Dashboard />
        </div>
      )}

      {/* Curtain — same colour as the dashboard background */}
      <AnimatePresence>
        {(phase === 'curtain-in' || phase === 'curtain-out') && (
          <motion.div
            key="curtain"
            className="absolute inset-0 z-50"
            style={{ backgroundColor: '#fbfbe2' }}
            initial={{ y: '-100%' }}
            animate={phase === 'curtain-in' ? { y: '0%' } : { y: '100%' }}
            transition={
              phase === 'curtain-in'
                ? { duration: 0.75, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0.65, ease: [0.55, 0, 0.9, 0.45] }
            }
            onAnimationComplete={() => {
              if (phase === 'curtain-in') setPhase('curtain-out');
              else {
                sessionStorage.setItem('zeif_intro_shown', '1');
                setPhase('dashboard');
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
