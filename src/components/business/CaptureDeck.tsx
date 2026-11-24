import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows } from '../../constants/theme';
import { CameraShutterHalo } from './CameraReadyEffects';

type Props = {
  galleryThumb: string | undefined;
  canShoot: boolean;
  ready: boolean;
  capturing: boolean;
  adjustingParameters: boolean;
  active: boolean;
  executionPhase: string | null;
  switching: boolean;
  blocked: boolean;
  onOpenGallery: () => void;
  onCapture: () => void;
  onFlipCamera: () => void;
};

export function CaptureDeck(props: Props) {
  const {
    galleryThumb, canShoot, ready, capturing, adjustingParameters, active,
    executionPhase, switching, blocked, onOpenGallery, onCapture, onFlipCamera,
  } = props;
  return (
    <View style={styles.captureDeck}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="查看最近相片"
        onPress={onOpenGallery}
        style={({ pressed }) => [
          styles.galleryButton,
          { transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
      >
        {galleryThumb ? (
          <Image source={{ uri: galleryThumb }} style={styles.galleryImage} />
        ) : (
          <View style={styles.galleryPlaceholder}>
            <Ionicons name="images-outline" size={19} color={colors.onSurfaceVariant} />
          </View>
        )}
        <View pointerEvents="none" style={styles.galleryRing} />
      </Pressable>

      <View style={styles.shutterArea}>
        <CameraShutterHalo active={canShoot} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="拍照"
          disabled={!ready || capturing || adjustingParameters || !active || executionPhase === 'parameters'}
          onPress={onCapture}
          style={({ pressed }) => [
            styles.shutter,
            canShoot && styles.readyShutter,
            (!ready || capturing) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={
              canShoot
                ? ['#FFE08E', '#FEDD84', '#F6E3B4']
                : ['#E3C36E', '#FEDD84', '#FBF4E4']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.shutterInner}
          >
            {capturing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="camera" size={25} color={colors.primary} />
            )}
          </LinearGradient>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="切换前后镜头"
        disabled={blocked}
        accessibilityState={{ disabled: blocked, busy: switching }}
        onPress={onFlipCamera}
        style={({ pressed }) => [
          styles.flipButton,
          blocked && styles.disabled,
          { transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
      >
        {switching ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons name="camera-reverse-outline" size={22} color={colors.primary} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  captureDeck: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginTop: 2,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    backgroundColor: colors.surfaceContainer,
    ...shadows.glassSm,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  galleryPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHighest,
  },
  galleryRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.secondaryContainer,
  },
  shutterArea: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glassLg,
  },
  readyShutter: {
    backgroundColor: '#1E1B17',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainer,
    ...shadows.glassSm,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
