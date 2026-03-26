/**
 * Explicit state machine for Flip Mode.
 *
 * States:
 *   idle      - waiting for user to arm flip detection
 *   arming    - face-down candidate detected, sustain timer running
 *   active    - face-down sustained; session is live
 *   cooldown  - face-up detected after active; session time LOCKED, waiting before ended
 *   ended     - session completed; terminal state until user restarts
 *
 * Transitions:
 *   idle     + faceDownCandidate    → arming
 *   arming   + sustainedFaceDown    → active        (START_SESSION)
 *   arming   + faceUpCandidate      → idle          (CANCEL_SUSTAIN)
 *   active   + faceUpCandidate      → cooldown      (START_COOLDOWN) — sessionEndedAt locked here
 *   cooldown + faceDownCandidate    → active        (RESUME_SESSION) — sessionEndedAt cleared
 *   cooldown + cooldownExpired      → ended         (END_SESSION)
 *   active/cooldown + STOP          → ended         (END_SESSION) → idle (silent)
 *   ended    + RESET                → idle
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
  sustainStartedAt: number | null;
  sessionStartedAt: number | null;
  /** Set when entering cooldown — this is the authoritative session end time. */
  sessionEndedAt: number | null;
};

export type FlipMachineTransition = {
  nextState: FlipMachineState;
  sideEffect?:
    | 'START_SESSION'
    | 'END_SESSION'
    | 'RESUME_SESSION'
    | 'START_COOLDOWN'
    | 'CANCEL_SUSTAIN'
    | 'START_SUSTAIN';
};

const INITIAL_STATE: FlipMachineState = {
  phase: 'idle',
  sustainStartedAt: null,
  sessionStartedAt: null,
  sessionEndedAt: null,
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
        // Stay in idle; readings drive arming
        break;
      }

      case 'STOP_MONITORING': {
        this.clearAllTimers();
        if (phase === 'active' || phase === 'cooldown') {
          // Lock session end time if not already set (stopped while active)
          const sessionEndedAt = this.state.sessionEndedAt ?? Date.now();
          // Fire END_SESSION so observers can save the session
          this.transition({ ...this.state, phase: 'ended', sessionEndedAt }, 'END_SESSION');
        }
        // Silently reset internal state (stopMonitoring in useFlipMode handles UI reset)
        this.state = { ...INITIAL_STATE };
        break;
      }

      case 'READING': {
        this.handleReading(event.reading);
        break;
      }

      case 'SUSTAIN_TIMER_FIRED': {
        if (phase === 'arming') {
          this.transition(
            { ...this.state, phase: 'active', sessionStartedAt: Date.now() },
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
        this.clearSustainTimer();
        this.transition({ ...this.state, phase: 'idle', sustainStartedAt: null }, 'CANCEL_SUSTAIN');
      }
      return;
    }

    if (phase === 'active' && reading.isFaceUpCandidate) {
      this.startCooldownTimer();
      // Lock session end time at this exact moment
      this.transition(
        { ...this.state, phase: 'cooldown', sessionEndedAt: Date.now() },
        'START_COOLDOWN',
      );
      return;
    }

    if (phase === 'cooldown' && reading.isFaceDownCandidate) {
      // Re-flip: resume session, clear the locked end time
      this.clearCooldownTimer();
      this.transition({ ...this.state, phase: 'active', sessionEndedAt: null }, 'RESUME_SESSION');
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
