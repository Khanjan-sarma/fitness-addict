import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { LockOpen, Loader2, CheckCircle2, XCircle, DoorOpen } from 'lucide-react';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

export const OpenDoorButton: React.FC = () => {
  const [state, setState] = useState<ButtonState>('idle');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = still checking

  // Check if the current user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
      }
    };

    checkAuth();
  }, []);

  // Auto-reset after success/error
  useEffect(() => {
    if (state === 'success' || state === 'error') {
      const timer = setTimeout(() => setState('idle'), 4000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const handleOpenDoor = useCallback(async () => {
    if (state === 'loading') return;

    setState('loading');
    try {
      const response = await fetch('/api/gate/open', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to open door');
      }

      setState('success');
    } catch (err: any) {
      console.error('Door open failed:', err);
      setState('error');
    }
  }, [state]);

  // Don't render anything while checking or if not authenticated
  if (isAuthenticated === null || isAuthenticated === false) return null;

  const config = {
    idle: {
      icon: LockOpen,
      text: '🔓 Open Door',
      bg: 'bg-emerald-600 hover:bg-emerald-500',
      shadow: 'shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30',
      ring: 'focus:ring-emerald-500/50',
      disabled: false,
    },
    loading: {
      icon: Loader2,
      text: '⏳ Sending...',
      bg: 'bg-bullBorder',
      shadow: '',
      ring: '',
      disabled: true,
    },
    success: {
      icon: CheckCircle2,
      text: '✅ Opening in ~5 seconds',
      bg: 'bg-emerald-600',
      shadow: 'shadow-lg shadow-emerald-600/20',
      ring: '',
      disabled: true,
    },
    error: {
      icon: XCircle,
      text: '❌ Failed — Retry',
      bg: 'bg-red-600 hover:bg-red-500',
      shadow: 'shadow-lg shadow-red-600/20',
      ring: 'focus:ring-red-500/50',
      disabled: false,
    },
  };

  const current = config[state];
  const Icon = current.icon;

  return (
    <button
      id="open-door-button"
      onClick={handleOpenDoor}
      disabled={current.disabled}
      className={`
        w-full flex items-center justify-center gap-3
        px-8 py-4 rounded-xl
        text-white font-bold text-base uppercase tracking-widest
        transition-all duration-300 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bullSurface
        disabled:cursor-not-allowed disabled:opacity-80
        ${current.bg} ${current.shadow} ${current.ring}
      `}
    >
      <Icon
        className={`h-6 w-6 ${state === 'loading' ? 'animate-spin' : ''}`}
        strokeWidth={2.5}
      />
      <span>{current.text}</span>
    </button>
  );
};
