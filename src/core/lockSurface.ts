// Abstract interface for the lock-screen surface.
// Concrete implementations live in src/native/ and delegate to platform bridges.

import { LockSurfacePayload } from './types';

export interface ILockSurface {
  /** Start a new lock-screen surface (Live Activity on iOS, notification on Android). */
  start(payload: LockSurfacePayload): Promise<void>;

  /** Update the live content of the current surface. */
  update(payload: LockSurfacePayload): Promise<void>;

  /** Tear down the surface cleanly. */
  end(): Promise<void>;

  /** Whether a surface is currently active. */
  isActive(): boolean;
}
