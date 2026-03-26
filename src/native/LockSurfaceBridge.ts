/**
 * LockSurfaceBridge: returns the correct ILockSurface implementation
 * for the current platform.
 *
 * - iOS  → IOSLockSurface  (ActivityKit Live Activity via Swift NativeModule)
 * - Android → AndroidLockSurface (ongoing notification via Kotlin NativeModule)
 * - Other → MockLockSurface (console logging)
 *
 * Native modules will return null from NativeModules if the native side
 * isn't wired (e.g. running in Expo Go or before Xcode/Gradle build).
 * In that case both iOS/Android implementations fall back to mock behavior.
 */

import { NativeModules, Platform } from 'react-native';
import { ILockSurface } from '../core/lockSurface';
import { LockSurfacePayload } from '../core/types';

const { LockSurfaceBridge: IOSNative, LockSurfaceModule: AndroidNative } = NativeModules;

// ---------------------------------------------------------------------------
// Mock (fallback when native module is unavailable)
// ---------------------------------------------------------------------------
class MockLockSurface implements ILockSurface {
  private active = false;

  async start(payload: LockSurfacePayload): Promise<void> {
    this.active = true;
    console.log('[MockLockSurface] start', payload);
  }
  async update(payload: LockSurfacePayload): Promise<void> {
    console.log('[MockLockSurface] update', payload);
  }
  async end(): Promise<void> {
    this.active = false;
    console.log('[MockLockSurface] end');
  }
  isActive(): boolean { return this.active; }
}

// ---------------------------------------------------------------------------
// iOS — wraps Swift LockSurfaceBridge via ActivityKit
// ---------------------------------------------------------------------------
class IOSLockSurface implements ILockSurface {
  private active = false;
  private native = IOSNative; // null if not yet wired in Xcode

  async start(payload: LockSurfacePayload): Promise<void> {
    this.active = true;
    if (this.native) {
      await this.native.startActivity(payload);
    } else {
      console.log('[IOSLockSurface] native not available — mock start', payload);
    }
  }

  async update(payload: LockSurfacePayload): Promise<void> {
    if (this.native) {
      await this.native.updateActivity(payload);
    } else {
      console.log('[IOSLockSurface] native not available — mock update', payload);
    }
  }

  async end(): Promise<void> {
    this.active = false;
    if (this.native) {
      await this.native.endActivity();
    } else {
      console.log('[IOSLockSurface] native not available — mock end');
    }
  }

  isActive(): boolean { return this.active; }
}

// ---------------------------------------------------------------------------
// Android — wraps Kotlin LockSurfaceModule via ongoing notification
// ---------------------------------------------------------------------------
class AndroidLockSurface implements ILockSurface {
  private active = false;
  private native = AndroidNative; // null if ReactPackage not registered yet

  async start(payload: LockSurfacePayload): Promise<void> {
    this.active = true;
    if (this.native) {
      await this.native.startNotification(payload);
    } else {
      console.log('[AndroidLockSurface] native not available — mock start', payload);
    }
  }

  async update(payload: LockSurfacePayload): Promise<void> {
    if (this.native) {
      await this.native.updateNotification(payload);
    } else {
      console.log('[AndroidLockSurface] native not available — mock update', payload);
    }
  }

  async end(): Promise<void> {
    this.active = false;
    if (this.native) {
      await this.native.cancelNotification();
    } else {
      console.log('[AndroidLockSurface] native not available — mock end');
    }
  }

  isActive(): boolean { return this.active; }
}

// ---------------------------------------------------------------------------
// Factory (singleton)
// ---------------------------------------------------------------------------
let _instance: ILockSurface | null = null;

export function getLockSurface(): ILockSurface {
  if (_instance) return _instance;

  if (Platform.OS === 'ios') {
    _instance = new IOSLockSurface();
  } else if (Platform.OS === 'android') {
    _instance = new AndroidLockSurface();
  } else {
    _instance = new MockLockSurface();
  }

  return _instance;
}

export function setLockSurface(surface: ILockSurface): void {
  _instance = surface;
}
