import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlipSession } from '../core/types';
import { formatElapsed } from '../core/time';

type Props = { session: FlipSession };

export function SessionSummaryCard({ session }: Props) {
  const date = new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.card}>
      <Text style={styles.time}>{date}</Text>
      <Text style={styles.duration}>{formatElapsed(session.elapsedSeconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    width: '100%',
  },
  time: { fontSize: 15, color: '#3c3c43' },
  duration: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
