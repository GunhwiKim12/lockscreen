// Core domain types for Flip Mode

export type FlipPhase =
  | 'idle'
  | 'arming'
  | 'active'
  | 'cooldown'
  | 'ended';

export type LockSurfacePayload = {
  title: string;
  body?: string;
  elapsedSeconds?: number;
  progress?: number;
};

export type FlipReading = {
  timestamp: number;
  z: number;
  isFaceDownCandidate: boolean;
  isFaceUpCandidate: boolean;
};

export type FlipSession = {
  id: string;
  startedAt: number;
  endedAt?: number;
  elapsedSeconds: number;
};

export type FlipThresholdConfig = {
  faceDownZThreshold: number; // e.g. -0.8 (z < threshold = face down)
  faceUpZThreshold: number;   // e.g.  0.8 (z > threshold = face up)
  sustainMs: number;          // ms the reading must hold before state change
  cooldownMs: number;         // ms to stay in cooldown before returning to idle
};
