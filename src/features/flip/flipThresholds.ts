import { FlipThresholdConfig } from '../../core/types';

export const DEFAULT_THRESHOLDS: FlipThresholdConfig = {
  // DeviceMotion gravity.z: -1 = pure face-down, +1 = pure face-up
  faceDownZThreshold: -0.75,
  faceUpZThreshold: 0.75,
  sustainMs: 1500,   // reading must hold 1.5 s before state transition
  cooldownMs: 2000,  // 2 s cooldown between sessions
};
