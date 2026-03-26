import { useState, useEffect, useCallback, useRef } from 'react';
import { FlipPhase, FlipSession } from '../../core/types';
import { FlipMachineState } from './FlipMachine';
import { FlipService } from './FlipService';
import { appendSession, loadSessions } from './FlipSessionStore';
import { getLockSurface } from '../../native/LockSurfaceBridge';
import { elapsedSeconds, nowMs } from '../../core/time';

type UseFlipModeReturn = {
  phase: FlipPhase;
  isMonitoring: boolean;
  elapsedSecs: number;
  sessions: FlipSession[];
  startMonitoring: () => void;
  stopMonitoring: () => void;
  resetSession: () => void;
};

export function useFlipMode(): UseFlipModeReturn {
  const [phase, setPhase] = useState<FlipPhase>('idle');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [sessions, setSessions] = useState<FlipSession[]>([]);

  const serviceRef = useRef<FlipService | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadSessions().then(setSessions);
  }, []);

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const handleStateChange = useCallback(async (state: FlipMachineState) => {
    setPhase(state.phase);

    if (state.phase === 'active' && state.sessionStartedAt) {
      sessionStartRef.current = state.sessionStartedAt;
      stopTick();
      tickRef.current = setInterval(() => {
        setElapsedSecs(elapsedSeconds(sessionStartRef.current!));
      }, 500);
    }

    if (state.phase === 'cooldown') {
      stopTick();
      if (sessionStartRef.current && state.sessionEndedAt) {
        setElapsedSecs(elapsedSeconds(sessionStartRef.current, state.sessionEndedAt));
      }
    }

    if (state.phase === 'ended' && sessionStartRef.current) {
      stopTick();
      // Use the locked sessionEndedAt (set when face-up detected, not now)
      const endedAt = state.sessionEndedAt ?? nowMs();
      const session: FlipSession = {
        id: String(sessionStartRef.current),
        startedAt: sessionStartRef.current,
        endedAt,
        elapsedSeconds: elapsedSeconds(sessionStartRef.current, endedAt),
      };
      sessionStartRef.current = null;
      const updated = await appendSession(session);
      setSessions(updated);
      setElapsedSecs(session.elapsedSeconds); // show final time, not 0
    }
  }, [stopTick]);

  const startMonitoring = useCallback(() => {
    const surface = getLockSurface();
    const service = new FlipService(surface, handleStateChange);
    serviceRef.current = service;
    service.start();
    setIsMonitoring(true);
    setPhase('idle');
    setElapsedSecs(0);
  }, [handleStateChange]);

  const stopMonitoring = useCallback(() => {
    serviceRef.current?.stop(); // fires END_SESSION if session was active
    serviceRef.current = null;
    stopTick();
    setIsMonitoring(false);
    setPhase('idle');
    setElapsedSecs(0);
  }, [stopTick]);

  const resetSession = useCallback(() => {
    serviceRef.current?.reset();
    serviceRef.current = null;
    stopTick();
    setIsMonitoring(false); // Fix: restore Start button
    setPhase('idle');
    setElapsedSecs(0);
  }, [stopTick]);

  useEffect(() => {
    return () => {
      serviceRef.current?.stop();
      stopTick();
    };
  }, [stopTick]);

  return { phase, isMonitoring, elapsedSecs, sessions, startMonitoring, stopMonitoring, resetSession };
}
