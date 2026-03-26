import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { FlipModeScreen } from '../src/ui/FlipModeScreen';

export default function Index() {
  return (
    <SafeAreaView style={styles.root}>
      <FlipModeScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
});
