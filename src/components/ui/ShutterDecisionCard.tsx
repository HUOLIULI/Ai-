import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../constants/theme';
import type { ShutterDecision } from '../../lib/shutterDecision';

type Props = { decision: ShutterDecision | null };

// Offline shutter decision card: shows why the current frame is advised
// (exposure / stability / style) using on-device signals only. Renders nothing
// when no decision is available yet.
export function ShutterDecisionCard({ decision }: Props) {
  if (!decision) return null;
  const exposureIcon = decision.exposure.level === 'dark' ? 'moon-outline' : decision.exposure.level === 'bright' ? 'sunny-outline' : 'checkmark-circle-outline';
  const stabilityIcon = decision.stability.level === 'shaky' ? 'alert-circle-outline' : 'hand-left-outline';
  return (
    <View style={styles.card} pointerEvents="none">
      <View style={styles.row}>
        <Ionicons name={exposureIcon} size={14} color={colors.onSurfaceVariant} />
        <Text style={styles.text} numberOfLines={1}>{decision.exposure.hint}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name={stabilityIcon} size={14} color={colors.onSurfaceVariant} />
        <Text style={styles.text} numberOfLines={1}>{decision.stability.hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
    fontFamily: fonts.body,
  },
});
