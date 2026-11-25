import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows } from '../../constants/theme';

const MODES = ['人像', '风景', '夜景'] as const;
export type CaptureMode = typeof MODES[number];

type Props = {
  activeMode: CaptureMode;
  capturing: boolean;
  guidanceEnabled: boolean;
  poseEnabled: boolean;
  onChangeMode: (mode: CaptureMode) => void;
};

export function SceneModeRow({ activeMode, capturing, guidanceEnabled, poseEnabled, onChangeMode }: Props) {
  return (
    <View style={styles.sceneRow}>
      <View style={styles.scenePill}>
        <View style={styles.sceneDot} />
        {MODES.map((mode) => {
          const active = activeMode === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              disabled={capturing}
              onPress={() => onChangeMode(mode)}
              style={[styles.sceneMode, active && styles.sceneModeActive]}
            >
              <Text style={[styles.sceneModeText, active && styles.sceneModeTextActive]}>
                {mode}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!guidanceEnabled && !poseEnabled && (
        <Text style={styles.outsideHint} numberOfLines={1}>
          开启 AI 指导，获取构图终点
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sceneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 2,
  },
  scenePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceLow,
    ...shadows.glassSm,
  },
  sceneDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.secondaryFixedDim,
    marginLeft: 6,
    marginRight: 2,
  },
  sceneMode: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sceneModeActive: {
    backgroundColor: colors.secondaryContainer,
  },
  sceneModeText: {
    color: colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  sceneModeTextActive: {
    color: colors.onSecondaryContainer,
    fontWeight: '700',
  },
  outsideHint: {
    flex: 1,
    textAlign: 'right',
    color: colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
    opacity: 0.82,
  },
});
