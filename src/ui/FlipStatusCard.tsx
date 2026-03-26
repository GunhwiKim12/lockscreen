import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlipPhase } from '../core/types';
import { formatElapsed } from '../core/time';

const PHASE_LABEL: Record<FlipPhase, string> = {
  idle: 'Waiting…',
  arming: 'Getting ready…',
  active: 'Focus active',
  cooldown: 'Wrapping up…',
  ended: 'Session complete',
};

const PHASE_COLOR: Record<FlipPhase, string> = {
  idle: '#8e8e93',
  arming: '#ff9f0a',
  active: '#30d158',
  cooldown: '#ff9f0a',
  ended: '#0a84ff',
};

type Props = {
  phase: FlipPhase;
  elapsedSecs: number;
};

export function FlipStatusCard({ phase, elapsedSecs }: Props) {
  return (
    <View style={[styles.card, { borderColor: PHASE_COLOR[phase] }]}>
      <Text style={[styles.phaseLabel, { color: PHASE_COLOR[phase] }]}>
        {PHASE_LABEL[phase]}
      </Text>
      {(phase === 'active' || phase === 'cooldown' || phase === 'ended') && (
        <Text style={styles.timer}>{formatElapsed(elapsedSecs)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 2,
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
  },
  phaseLabel: { fontSize: 20, fontWeight: '600' },
  timer: { fontSize: 48, fontWeight: '300', marginTop: 16, fontVariant: ['tabular-nums'] },
});
