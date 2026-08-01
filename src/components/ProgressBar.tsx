import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

type Props = {
  /** 0..1 */
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
};

/** Thick rounded progress track (12px) per Route Progress spec. */
export default function ProgressBar({
  progress,
  height = 12,
  trackColor,
  fillColor = colors.primaryContainer,
}: Props) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor ?? 'rgba(123,86,67,0.10)' },
      ]}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
});
