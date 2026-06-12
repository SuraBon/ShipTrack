import { useEffect, useRef } from 'react';

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

interface UseIdleSessionProps {
  isActive: boolean;
  lastActivityAt: number | null;
  onActivity: () => void;
  onTimeout: () => void;
}

export function useIdleSession({ isActive, lastActivityAt, onActivity, onTimeout }: UseIdleSessionProps) {
  const lastActivityWriteRef = useRef(0);

  // Timeout check
  useEffect(() => {
    if (!isActive || !lastActivityAt) return;

    const msUntilExpiry = lastActivityAt + SESSION_MAX_AGE_MS - Date.now();
    if (msUntilExpiry <= 0) {
      onTimeout();
      return;
    }

    const timer = window.setTimeout(onTimeout, msUntilExpiry);
    return () => window.clearTimeout(timer);
  }, [isActive, lastActivityAt, onTimeout]);

  // Activity tracking
  useEffect(() => {
    if (!isActive) return;

    const markActivity = () => {
      const now = Date.now();
      // Throttle to once every 30 seconds
      if (now - lastActivityWriteRef.current < 30_000) return;
      lastActivityWriteRef.current = now;
      onActivity();
    };

    const events = ['click', 'keydown', 'touchstart', 'visibilitychange', 'focus'];
    events.forEach(eventName => window.addEventListener(eventName, markActivity, { passive: true }));
    
    return () => {
      events.forEach(eventName => window.removeEventListener(eventName, markActivity));
    };
  }, [isActive, onActivity]);
}
