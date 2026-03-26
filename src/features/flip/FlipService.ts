/**
 * FlipService: wires DeviceMotion sensor → FlipMachine → LockSurface bridge.
 *
 * IMPORTANT background limitations:
 * - DeviceMotion will only deliver readings while the app is in the foreground
 *   or very recently backgrounded. There is no reliable way in Expo / RN to
 *   keep the sensor alive when the OS suspends the JS thread.
 * - This MVP is designed for foreground-first usage.
 * - When the app goes to background after session starts, the lock-screen
 *   surface continues (native) but sensor tracking may pause.
 */

import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import { FlipMachine, FlipMachineTransition } from './FlipMachine';
import { FlipMachineState } from './FlipMachine';
import { FlipReading, FlipThresholdConfig } from '../../core/types';
import { DEFAULT_THRESHOLDS } from './flipThresholds';
import { ILockSurface } from '../../core/lockSurface';
import { nowMs } from '../../core/time';

export type FlipServiceCallback = (state: FlipMachineState) => void;

export class FlipService {
  private machine: FlipMachine;
  private config: FlipThresholdConfig;
  private lockSurface: ILockSurface;
  private subscription: ReturnType<typeof DeviceMotion.addListener> | null = null;
  private onStateChange: FlipServiceCallback;
  private sessionStartMs: number | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(lockSurface: ILockSurface, onStateChange: FlipServiceCallback, config = DEFAULT_THRESHOLDS) {
    this.config = config;
    this.lockSurface = lockSurface;
    this.onStateChange = onStateChange;
    this.machine = new FlipMachine(this.handleTransition.bind(this), config);
  }

  start(): void {
    DeviceMotion.setUpdateInterval(300); // poll every 300ms
    this.subscription = DeviceMotion.addListener(this.handleMotion.bind(this));
    this.machine.send({ type: 'START_MONITORING' });
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.clearTick();
    this.machine.send({ type: 'STOP_MONITORING' });
  }

  reset(): void {
    this.stop();
    this.machine.send({ type: 'RESET' });
  }

  private handleMotion(measurement: DeviceMotionMeasurement): void {
    const z = measurement.accelerationIncludingGravity?.z ?? 0;
    const reading: FlipReading = {
      timestamp: nowMs(),
      z,
      isFaceDownCandidate: z < this.config.faceDownZThreshold,
      isFaceUpCandidate: z > this.config.faceUpZThreshold,
    };
    this.machine.send({ type: 'READING', reading });
  }

  private handleTransition(
    next: FlipMachineState,
    effect?: FlipMachineTransition['sideEffect'],
  ): void {
    this.onStateChange(next);

    switch (effect) {
      case 'START_SESSION':
        this.sessionStartMs = next.sessionStartedAt;
        this.lockSurface.start({ title: 'Focus active', elapsedSeconds: 0 });
        this.startTick();
        break;

      case 'END_SESSION':
        this.clearTick();
        this.lockSurface.end();
        break;

      case 'START_COOLDOWN':
        // Keep surface alive with "Wrapping up..." message
        this.lockSurface.update({ title: 'Wrapping up…' });
        break;

      case 'CANCEL_SUSTAIN':
      case 'START_SUSTAIN':
        // No lock surface action needed
        break;
    }
  }

  private startTick(): void {
    this.clearTick();
    this.tickInterval = setInterval(() => {
      if (this.sessionStartMs === null) return;
      const elapsed = Math.floor((nowMs() - this.sessionStartMs) / 1000);
      this.lockSurface.update({
        title: 'Focus active',
        elapsedSeconds: elapsed,
      });
    }, 1000);
  }

  private clearTick(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
