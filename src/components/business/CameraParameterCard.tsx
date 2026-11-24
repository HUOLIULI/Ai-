import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '../../constants/theme';

export type Parameter = 'zoom' | 'aperture' | 'whiteBalance' | 'contrast';

type Param = { id: Parameter; label: string; value: string };

type Props = {
  params: Param[];
  flashLabel: string;
  flashOn: boolean;
  flashDisabled: boolean;
  disabled: boolean;
  tuningOpen: boolean;
  tuningMessage: string | null;
  facing: 'front' | 'back';
  onOpenTuning: (parameter: Parameter) => void;
  onToggleFlash: () => void;
};

export function CameraParameterCard(props: Props) {
  const { params, flashLabel, flashOn, flashDisabled, disabled, tuningOpen, tuningMessage, facing, onOpenTuning, onToggleFlash } = props;
  return (
    <View style={styles.paramCard}>
      <View style={styles.paramHeader}>
        <View style={styles.paramTitleRow}>
          <View style={styles.paramDot} />
          <Text style={styles.paramTitle}>相机实时参数</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="微调相机参数"
          accessibilityState={{ expanded: tuningOpen }}
          disabled={disabled}
          onPress={() => onOpenTuning('zoom')}
          style={({ pressed }) => [styles.tuneButton, (disabled || pressed) && { opacity: 0.7 }]}
        >
          <Ionicons name="options-outline" size={13} color={colors.onSurfaceVariant} />
          <Text style={styles.tuneButtonText}>微调</Text>
        </Pressable>
      </View>

      <View style={styles.paramRow}>
        {params.map((param) => (
          <Pressable key={param.id}
            accessibilityRole="button"
            accessibilityLabel={`调整${param.label}，当前${param.value}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onOpenTuning(param.id)}
            style={({ pressed }) => [styles.paramCell, pressed && styles.disabled]}>
            <Text style={styles.paramLabel}>
              {param.label}
            </Text>
            <Text style={styles.paramValue} numberOfLines={1} adjustsFontSizeToFit>
              {param.value}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`闪光灯${flashLabel}，点击${flashOn ? '关闭' : '开启'}`}
          accessibilityState={{ disabled: flashDisabled, selected: flashOn }}
          disabled={flashDisabled}
          onPress={onToggleFlash}
          style={({ pressed }) => [styles.paramCell, styles.flashCell,
            flashOn && styles.flashCellActive,
            (flashDisabled || pressed) && styles.disabled]}
        >
          <Text style={styles.paramLabel}>闪光灯</Text>
          <Text style={styles.paramValue} numberOfLines={1} adjustsFontSizeToFit>{flashLabel}</Text>
        </Pressable>
      </View>

      <Text style={styles.tuningText} numberOfLines={1}>
        {tuningMessage} · {facing === 'front' ? '前置' : '后置'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  paramCard: {
    backgroundColor: colors.surfaceLow,
    borderRadius: 22,
    padding: 11,
    gap: 7,
    ...shadows.glassSm,
  },
  paramHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paramTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  paramDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  paramTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  tuneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceHighest,
  },
  tuneButtonText: {
    color: colors.onSurfaceVariant,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  paramRow: {
    flexDirection: 'row',
    gap: 5,
  },
  paramCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 12,
    gap: 1,
    backgroundColor: colors.surface,
    ...shadows.glassSm,
  },
  paramLabel: {
    color: colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.7,
  },
  flashCell: {
    borderWidth: 1,
    borderColor: colors.secondaryFixedDim,
  },
  flashCellActive: {
    backgroundColor: colors.secondaryContainer,
  },
  paramValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tuningText: {
    color: colors.onSurfaceVariant,
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.4,
  },
});
