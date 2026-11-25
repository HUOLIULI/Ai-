import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows } from '../../constants/theme';
import { CameraDirectionOverlay } from './CameraDirectionOverlay';
import { CameraReadyFrame } from './CameraReadyEffects';
import { PoseGuideOverlay } from './PoseGuideOverlay';
import { digitalZoomFactor } from '../../lib/cameraGeometry';
import type { CompositionTarget } from '../../lib/compositionTarget';
import type { PosePhase } from '../../hooks/usePoseGuidance';
import type { PoseSuggestion } from '../../constants/poses';
import type { CameraView as CameraViewType } from 'expo-camera';

const ZOOM_STEPS = [0, 0.33, 0.66, 1];
const ZOOM_LABELS = ['1x', '2x', '3x', '4x'];

type Facing = 'front' | 'back';

type Props = {
  cameraRef: React.RefObject<CameraViewType>;
  active: boolean;
  facing: Facing;
  flash: 'off' | 'on' | 'auto';
  cameraReady: boolean;
  torchOn: boolean;
  zoom: number;
  capturing: boolean;
  width: number;
  height: number;
  canShoot: boolean;
  target: CompositionTarget | null;
  guidanceEnabled: boolean;
  poseEnabled: boolean;
  posePhase: PosePhase;
  poseMessage: string;
  poseSuggestion: PoseSuggestion | null;
  poseIndex: number;
  poseTotal: number;
  onNextPose: () => void;
  onRefreshPose: () => void;
  onCameraReady: () => void;
  onCameraError: (error: unknown) => void;
  onLayout: (width: number, height: number) => void;
  onManualZoom: (zoom: number) => void;
};

export function CameraViewfinder(props: Props) {
  const {
    cameraRef, active, facing, flash, cameraReady, torchOn, zoom, capturing,
    width, height, canShoot, target, guidanceEnabled,
    poseEnabled, posePhase, poseMessage, poseSuggestion, poseIndex, poseTotal,
    onNextPose, onRefreshPose, onCameraReady, onCameraError, onLayout, onManualZoom,
  } = props;
  const activeZoomStep = ZOOM_STEPS.findIndex((step) => Math.abs(step - zoom) < 0.06);

  return (
    <View
      testID="camera-viewfinder"
      collapsable={false}
      style={styles.viewfinderCard}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        onLayout(width, height);
      }}
    >
      {active && (
        <View
          collapsable={false}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: digitalZoomFactor(zoom) }] }]}
        >
          {/* Omit ratio: Android otherwise switches from FILL_CENTER to FIT_CENTER
              and adds black bars when the responsive viewfinder is not 3:4.
              Expo mirrors the front preview even when photos use mirror=false. */}
          <CameraView
            ref={cameraRef}
            style={[StyleSheet.absoluteFill, { transform: [{ scaleX: facing === 'front' ? -1 : 1 }] }]}
            facing={facing}
            zoom={0}
            mirror={false}
            flash={flash}
            // Flash only fires at capture; torch provides immediate rear-camera light.
            enableTorch={torchOn}
            autofocus="off"
            animateShutter={false}
            onCameraReady={onCameraReady}
            onMountError={onCameraError}
          />
        </View>
      )}

      {/* warm cinematic vignette */}
      <LinearGradient
        colors={['rgba(24, 22, 18, 0.28)', 'transparent', 'rgba(24, 22, 18, 0.46)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* rule-of-thirds grid */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.gridVertical, { left: '33.33%' }]} />
        <View style={[styles.gridVertical, { left: '66.66%' }]} />
        <View style={[styles.gridHorizontal, { top: '33.33%' }]} />
        <View style={[styles.gridHorizontal, { top: '66.66%' }]} />

        <CameraDirectionOverlay
          target={target}
          enabled={guidanceEnabled && cameraReady}
          width={width}
          height={height}
        />
        <CameraReadyFrame
          active={canShoot}
          width={width}
          height={height}
        />
      </View>

      {/* pose guidance overlay in top-right */}
      <PoseGuideOverlay
        visible={poseEnabled}
        phase={posePhase}
        message={poseMessage}
        suggestion={poseSuggestion}
        index={poseIndex}
        total={poseTotal}
        mirrored={facing === 'front'}
        onNext={onNextPose}
        onRefresh={onRefreshPose}
      />

      {/* focal length pill */}
      <View style={styles.focalWrap}>
        <View style={styles.focalPill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="缩小画面"
            disabled={capturing || zoom <= 0}
            onPress={() => onManualZoom(zoom - 0.05)}
            style={[styles.focalAdjust, (capturing || zoom <= 0) && styles.disabled]}
          >
            <Ionicons name="remove" size={15} color="#E4E2DF" />
          </Pressable>
          {ZOOM_STEPS.map((step, index) => {
            const active = activeZoomStep === index;
            return (
              <Pressable
                key={ZOOM_LABELS[index]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                disabled={capturing}
                onPress={() => onManualZoom(step)}
                style={[styles.focalStep, active && styles.focalStepActive]}
              >
                <Text style={[styles.focalStepText, active && styles.focalStepTextActive]}>
                  {ZOOM_LABELS[index]}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="放大画面"
            disabled={capturing || zoom >= 1}
            onPress={() => onManualZoom(zoom + 0.05)}
            style={[styles.focalAdjust, (capturing || zoom >= 1) && styles.disabled]}
          >
            <Ionicons name="add" size={15} color="#E4E2DF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewfinderCard: {
    flex: 1,
    minHeight: 180,
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
    position: 'relative',
    ...shadows.glassMd,
  },
  gridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  gridHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  focalWrap: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 12,
  },
  focalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(45, 42, 38, 0.72)',
    ...shadows.glassSm,
  },
  focalAdjust: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focalStep: {
    width: 32,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focalStepActive: {
    backgroundColor: colors.secondaryContainer,
  },
  focalStepText: {
    color: '#E4E2DF',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  focalStepTextActive: {
    color: colors.onSecondaryContainer,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
});
