/**
 * Explicit state machine for Flip Mode.
 *
 * States:
 *   idle      - waiting for user to arm flip detection
 *   arming    - face-down candidate detected, sustain timer running
 *   active    - face-down sustained; session is live
 *   cooldown  - face-up detected after active; waiting before returning to idle
 *   ended     - session completed; terminal state until user restarts
 *
 * Transitions (simplified):
 *   idle     + startMonitoring          → arming (or idle if no reading yet)
 *   idle     + faceDownCandidate        → arming
 *   arming   + sustainedFaceDown        → active
 *   arming   + faceUpCandidate          → idle  (cancelled before activation)
 *   active   + faceUpCandidate          → cooldown
 *   cooldown + cooldownExpired          → ended
 *   cooldown + faceDownCandidate        → active (re-flip within cooldown)
 *   ended    + reset                    → idle
 */

import { FlipPhase, FlipReading, FlipThresholdConfig } from '../../core/types';
import { DEFAULT_THRESHOLDS } from './flipThresholds';

export type FlipMachineEvent =
  | { type: 'START_MONITORING' }
  | { type: 'STOP_MONITORING' }
  | { type: 'READING'; reading: FlipReading }
  | { type: 'SUSTAIN_TIMER_FIRED' }
  | { type: 'COOLDOWN_TIMER_FIRED' }
  | { type: 'RESET' };

export type FlipMachineState = {
  phase: FlipPhase;
  sustainStartedAt: number | null; // timestamp when sustain timer started
  sessionStartedAt: number | null;
};

export type FlipMachineTransition = {
  nextState: FlipMachineState;
  sideEffect?: 'START_SESSION' | 'END_SESSION' | 'CANCEL_SUSTAIN' | 'START_SUSTAIN' | 'START_COOLDOWN';
};

const INITIAL_STATE: FlipMachineState = {
  phase: 'idle',
  sustainStartedAt: null,
  sessionStartedAt: null,
};

export class FlipMachine {
  private state: FlipMachineState = { ...INITIAL_STATE };
  private config: FlipThresholdConfig;
  private sustainTimer: ReturnType<typeof setTimeout> | null = null;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private onTransition: (next: FlipMachineState, effect?: FlipMachineTransition['sideEffect']) => void;

  constructor(
    onTransition: (next: FlipMachineState, effect?: FlipMachineTransition['sideEffect']) => void,
    config: FlipThresholdConfig = DEFAULT_THRESHOLDS,
  ) {
    this.onTransition = onTransition;
    this.config = config;
  }

  getPhase(): FlipPhase {
    return this.state.phase;
  }

  getState(): Readonly<FlipMachineState> {
    return this.state;
  }

  send(event: FlipMachineEvent): void {
    const { phase } = this.state;

    switch (event.type) {
      case 'START_MONITORING': {
        if (phase === 'idle') {
          // Stay in idle; readings will drive arming
        }
        break;
      }

      case 'STOP_MONITORING': {
        this.clearAllTimers();
        this.transition({ phase: 'idle', sustainStartedAt: null, sessionStartedAt: null });
        break;
      }

      case 'READING': {
        this.handleReading(event.reading);
        break;
      }

      case 'SUSTAIN_TIMER_FIRED': {
        if (phase === 'arming') {
          const sessionStartedAt = Date.now();
          this.transition(
            { ...this.state, phase: 'active', sessionStartedAt },
            'START_SESSION',
          );
        }
        break;
      }

      case 'COOLDOWN_TIMER_FIRED': {
        if (phase === 'cooldown') {
          this.transition({ ...this.state, phase: 'ended' }, 'END_SESSION');
        }
        break;
      }

      case 'RESET': {
        this.clearAllTimers();
        this.transition({ ...INITIAL_STATE });
        break;
      }
    }
  }

  private handleReading(reading: FlipReading): void {
    const { phase } = this.state;

    if (phase === 'idle' && reading.isFaceDownCandidate) {
      this.startSustainTimer();
      this.transition({ ...this.state, phase: 'arming', sustainStartedAt: Date.now() }, 'START_SUSTAIN');
      return;
    }

    if (phase === 'arming') {
      if (reading.isFaceUpCandidate) {
        // Cancelled before activation
        this.clearSustainTimer();
        this.transition({ ...this.state, phase: 'idle', sustainStartedAt: null }, 'CANCEL_SUSTAIN');
      }
      // If still face-down: sustain timer is already running, no action needed
      return;
    }

    if (phase === 'active' && reading.isFaceUpCandidate) {
      this.startCooldownTimer();
      this.transition({ ...this.state, phase: 'cooldown' }, 'START_COOLDOWN');
      return;
    }

    if (phase === 'cooldown' && reading.isFaceDownCandidate) {
      // Re-flip during cooldown: snap back to active
      this.clearCooldownTimer();
      this.transition({ ...this.state, phase: 'active' });
    }
  }

  private startSustainTimer(): void {
    this.clearSustainTimer();
    this.sustainTimer = setTimeout(() => {
      this.send({ type: 'SUSTAIN_TIMER_FIRED' });
    }, this.config.sustainMs);
  }

  private clearSustainTimer(): void {
    if (this.sustainTimer !== null) {
      clearTimeout(this.sustainTimer);
      this.sustainTimer = null;
    }
  }

  private startCooldownTimer(): void {
    this.clearCooldownTimer();
    this.cooldownTimer = setTimeout(() => {
      this.send({ type: 'COOLDOWN_TIMER_FIRED' });
    }, this.config.cooldownMs);
  }

  private clearCooldownTimer(): void {
    if (this.cooldownTimer !== null) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  private clearAllTimers(): void {
    this.clearSustainTimer();
    this.clearCooldownTimer();
  }

  private transition(next: FlipMachineState, effect?: FlipMachineTransition['sideEffect']): void {
    this.state = next;
    this.onTransition(next, effect);
  }
}
