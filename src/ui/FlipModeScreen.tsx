import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useFlipMode } from '../features/flip/useFlipMode';
import { FlipStatusCard } from './FlipStatusCard';
import { SessionSummaryCard } from './SessionSummaryCard';

export function FlipModeScreen() {
  const { phase, isMonitoring, elapsedSecs, sessions, startMonitoring, stopMonitoring, resetSession } = useFlipMode();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Flip Mode</Text>

      <FlipStatusCard phase={phase} elapsedSecs={elapsedSecs} />

      <View style={styles.controls}>
        {!isMonitoring ? (
          <Pressable style={styles.primaryBtn} onPress={startMonitoring}>
            <Text style={styles.btnText}>Start Flip Mode</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={styles.secondaryBtn} onPress={stopMonitoring}>
              <Text style={styles.btnText}>Stop</Text>
            </Pressable>
            {phase === 'ended' && (
              <Pressable style={styles.primaryBtn} onPress={resetSession}>
                <Text style={styles.btnText}>Reset</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {sessions.length > 0 && (
        <>
          <Text style={styles.sectionHeading}>Recent Sessions</Text>
          {sessions.slice(0, 10).map((s) => (
            <SessionSummaryCard key={s.id} session={s} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, alignItems: 'center' },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: 32 },
  controls: { marginTop: 24, gap: 12, width: '100%' },
  primaryBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtn: {
    backgroundColor: '#e5e5ea',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  sectionHeading: { fontSize: 17, fontWeight: '600', marginTop: 40, marginBottom: 8, alignSelf: 'flex-start' },
});
