import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

type Props = {
  onConfigure: () => void;
  onClose: () => void;
};

export function CameraHeader({ onConfigure, onClose }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <Ionicons name="camera-outline" size={29} color={colors.primary} />
        <View>
          <Text style={styles.headerTitle}>Drama相机</Text>
          <Text style={styles.headerSubtitle}>AI 电影画质</Text>
        </View>
      </View>

      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="AI 配置"
          onPress={onConfigure}
          style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
        >
          <Ionicons name="options-outline" size={21} color={colors.onSurfaceVariant} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭相机"
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="chevron-down" size={19} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 6,
    gap: 8,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: colors.onSurfaceVariant,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPressed: {
    backgroundColor: colors.surfaceContainer,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainer,
    borderWidth: 2,
    borderColor: 'rgba(254, 221, 132, 0.45)',
  },
});
