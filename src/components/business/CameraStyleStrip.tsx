import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows } from '../../constants/theme';
import { CAMERA_STYLES } from '../../constants/guidance';
import type { CameraStyle } from '../../types/guidance';

type Props = {
  activeStyle: CameraStyle;
  disabled: boolean;
  autoStyle: boolean;
  onChangeStyle: (style: CameraStyle) => void;
  onToggleAutoStyle: () => void;
};

export function CameraStyleStrip({ activeStyle, disabled, autoStyle, onChangeStyle, onToggleAutoStyle }: Props) {
  return (
    <View style={styles.styleStrip}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: autoStyle }}
        disabled={disabled}
        onPress={onToggleAutoStyle}
        style={[styles.styleItem, autoStyle && styles.styleItemAuto]}
      >
        <Text style={[styles.styleText, autoStyle && styles.styleTextAuto]}>自动</Text>
      </Pressable>
      {(Object.keys(CAMERA_STYLES) as CameraStyle[]).map((style) => {
        const active = !autoStyle && activeStyle === style;
        return (
          <Pressable
            key={style}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            disabled={disabled}
            onPress={() => onChangeStyle(style)}
            style={[styles.styleItem, active && styles.styleItemActive]}
          >
            <Text style={[styles.styleText, active && styles.styleTextActive]}>{style}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  styleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainer,
  },
  styleItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 999,
  },
  styleItemActive: {
    backgroundColor: colors.surface,
    ...shadows.glassSm,
  },
  styleItemAuto: {
    backgroundColor: colors.primary,
    ...shadows.glassSm,
  },
  styleText: {
    color: colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  styleTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  styleTextAuto: {
    color: colors.secondaryFixed,
    fontWeight: '700',
  },
});
