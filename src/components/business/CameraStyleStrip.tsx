import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows } from '../../constants/theme';
import { CAMERA_STYLES } from '../../constants/guidance';
import type { CameraStyle } from '../../types/guidance';

// Representative gradient per aesthetic so each chip previews its color mood at
// a glance. Purely decorative — the actual grade is the style's LUT.
const STYLE_SWATCHES: Record<CameraStyle, [string, string]> = {
  清透: ['#DCEBF5', '#F6FBFF'],
  奶杏: ['#F3D9B8', '#FBF0E2'],
  薄荷: ['#CDEBDC', '#EFFBF4'],
  胶片: ['#D9C9A6', '#EFE4CC'],
  黑白: ['#8A8A8A', '#E8E8E8'],
  港风: ['#C98A6B', '#F0C9A8'],
  日系: ['#E7DCE6', '#FBF4F7'],
  复古: ['#C9A87C', '#EED9B0'],
};

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
        const swatch = STYLE_SWATCHES[style];
        return (
          <Pressable
            key={style}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            disabled={disabled}
            onPress={() => onChangeStyle(style)}
            style={[styles.styleItem, active && styles.styleItemActive]}
          >
            <LinearGradient
              colors={swatch}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.styleSwatch}
            />
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
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 999,
  },
  styleSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(24, 22, 18, 0.10)',
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
