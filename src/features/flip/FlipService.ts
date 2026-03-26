/**
 * FlipService: wires DeviceMotion sensor → FlipMachine → LockSurface bridge.
 *
 * IMPORTANT background limitations:
 * - DeviceMotion only delivers readings while the app is in the foreground
 *   or very recently backgrounded. No reliable background sensor in Expo/RN.
 * - MVP is foreground-first. Lock-screen surface (native) persists after
 *   backgrounding, but the JS timer pauses.
 */

import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import { FlipMachine, FlipMachineState, FlipMachineTransition } from './FlipMachine';
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

  constructor(
    lockSurface: ILockSurface,
    onStateChange: FlipServiceCallback,
    config = DEFAULT_THRESHOLDS,
  ) {
    this.config = config;
    this.lockSurface = lockSurface;
    this.onStateChange = onStateChange;
    this.machine = new FlipMachine(this.handleTransition.bind(this), config);
  }

  start(): void {
    DeviceMotion.setUpdateInterval(300);
    this.subscription = DeviceMotion.addListener(this.handleMotion.bind(this));
    this.machine.send({ type: 'START_MONITORING' });
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    // If a session is active, STOP_MONITORING fires END_SESSION side effect first
    this.machine.send({ type: 'STOP_MONITORING' });
    this.clearTick();
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

      case 'START_COOLDOWN':
        this.clearTick();
        this.lockSurface.update({
          title: 'Wrapping up…',
          elapsedSeconds: this.getElapsedSeconds(next.sessionEndedAt),
        });
        break;

      case 'RESUME_SESSION':
        this.lockSurface.update({
          title: 'Focus active',
          elapsedSeconds: this.getElapsedSeconds(),
        });
        this.startTick();
        break;

      case 'END_SESSION':
        this.clearTick();
        this.lockSurface.end();
        this.sessionStartMs = null;
        break;

      case 'CANCEL_SUSTAIN':
      case 'START_SUSTAIN':
        break;
    }
  }

  private startTick(): void {
    this.clearTick();
    this.tickInterval = setInterval(() => {
      this.lockSurface.update({
        title: 'Focus active',
        elapsedSeconds: this.getElapsedSeconds(),
      });
    }, 1000);
  }

  private getElapsedSeconds(endMs?: number | null): number {
    if (this.sessionStartMs === null) return 0;
    const finalMs = endMs ?? nowMs();
    return Math.floor((finalMs - this.sessionStartMs) / 1000);
  }

  private clearTick(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
