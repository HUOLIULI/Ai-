import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../../constants/theme';
import { useCameraGuidance } from '../../hooks/useCameraGuidance';
import { usePoseGuidance } from '../../hooks/usePoseGuidance';
import { digitalZoomFactor } from '../../lib/cameraGeometry';
import { getCompositionMessage } from '../../lib/compositionMessage';
import { useCaptureStore } from '../../store/captureStore';
import { CameraHeader } from './CameraHeader';
import { SceneModeRow, type CaptureMode } from './SceneModeRow';
import { CameraViewfinder } from './CameraViewfinder';
import { CameraParameterCard, type Parameter } from './CameraParameterCard';
import { CameraGuidanceControls } from './CameraGuidanceControls';
import { CameraParameterPanel } from './CameraParameterPanel';
import { CameraStyleStrip } from './CameraStyleStrip';
import { CaptureDeck } from './CaptureDeck';
import { ShutterDecisionCard } from '../ui/ShutterDecisionCard';

type Props = {
  cameraRef: React.RefObject<CameraView>;
  onClose: () => void;
  onCapture: (uri: string) => void;
  onConfigure: () => void;
  onOpenGallery?: () => void;
};

const WHITE_BALANCE_LABEL: Record<string, string> = {
  auto: '自动',
  daylight: '日光',
  cloudy: '阴天',
  tungsten: '钨丝灯',
  fluorescent: '荧光灯',
};

export function CameraCapture({ cameraRef, onClose, onCapture, onConfigure, onOpenGallery }: Props) {
  const [viewfinder, setViewfinder] = useState({ width: 0, height: 0 });
  const viewfinderAspect = viewfinder.height > 0 ? viewfinder.width / viewfinder.height : 3 / 4;
  const guide = useCameraGuidance(cameraRef, onCapture, viewfinderAspect);
  const pose = usePoseGuidance({
    sampleFrame: guide.sampleFrame,
    context: guide.context,
    cameraReady: guide.ready && !guide.switching && !guide.capturing,
    active: guide.active,
  });
  const [tuningOpen, setTuningOpen] = useState(false);
  const [tuningParameter, setTuningParameter] = useState<Parameter>('zoom');
  const openTuning = (parameter: Parameter) => {
    setTuningParameter(parameter);
    setTuningOpen(true);
  };
  const savedUris = useCaptureStore((state) => state.savedUris);
  const galleryThumb = savedUris[0];

  const { context } = guide;
  const blocked = !guide.active || !guide.ready || guide.capturing || guide.sampling || guide.adjustingParameters;
  const canShoot = guide.enabled && guide.executionPhase === 'ready';
  const message = guide.switching
    ? '正在切换镜头…'
    : getCompositionMessage(
        guide.enabled,
        guide.target,
        guide.result,
        guide.adjustingZoom,
        guide.autoZoom,
        guide.status,
        guide.executionPhase,
      );
  const bannerMessage = guide.enabled && guide.result && !canShoot
    ? `${message} · ${guide.result.advice.light}`
    : message;
  useEffect(() => {
    if (canShoot) Vibration.vibrate(25);
  }, [canShoot]);

  const aperture = guide.appliedTuning?.aperture ?? context.capabilities?.apertures[0] ?? null;
  const whiteBalance = guide.appliedTuning?.whiteBalance && guide.appliedTuning.whiteBalance !== 'keep'
    ? WHITE_BALANCE_LABEL[guide.appliedTuning.whiteBalance] ?? '自动'
    : '自动';
  const contrast = guide.appliedTuning?.contrast != null ? guide.appliedTuning.contrast.toFixed(2) : '系统';
  const params: { id: Parameter; label: string; value: string }[] = [
    { id: 'zoom', label: '变焦', value: `${digitalZoomFactor(context.zoom).toFixed(1)}x` },
    { id: 'aperture', label: '光圈', value: aperture ? `f/${aperture}` : '自动' },
    { id: 'whiteBalance', label: '白平衡', value: whiteBalance },
    { id: 'contrast', label: '对比度', value: contrast },
  ];
  const flashLabel = context.flash === 'on' ? '开' : context.flash === 'auto' ? '自动' : '关';
  const flashDisabled = blocked || guide.executionPhase === 'parameters';

  return (
    <View collapsable={false} style={styles.screen}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <CameraHeader onConfigure={onConfigure} onClose={onClose} />

        <View style={styles.body}>
          <SceneModeRow
            activeMode={context.mode as CaptureMode}
            capturing={guide.capturing}
            guidanceEnabled={guide.enabled}
            poseEnabled={pose.enabled}
            onChangeMode={guide.changeMode}
          />

          <CameraViewfinder
            cameraRef={cameraRef}
            active={guide.active}
            facing={context.facing}
            flash={context.flash}
            cameraReady={guide.ready}
            torchOn={context.flash === 'on' && context.facing === 'back' && guide.active && guide.ready}
            zoom={context.zoom}
            capturing={guide.capturing}
            width={viewfinder.width}
            height={viewfinder.height}
            canShoot={canShoot}
            target={guide.target}
            guidanceEnabled={guide.enabled}
            poseEnabled={pose.enabled}
            posePhase={pose.phase ?? 'off'}
            poseMessage={pose.message}
            poseSuggestion={pose.current}
            poseIndex={pose.index}
            poseTotal={pose.recommendation?.poses.length ?? 0}
            onNextPose={pose.next}
            onRefreshPose={pose.refresh}
            onCameraReady={guide.cameraReady}
            onCameraError={guide.cameraError}
            onLayout={(width, height) => {
              if (Math.abs(width - viewfinder.width) > 1 || Math.abs(height - viewfinder.height) > 1) {
                setViewfinder({ width, height });
              }
            }}
            onManualZoom={guide.manualZoom}
          />

          {guide.enabled && guide.executionPhase === 'manual' && (
            <View style={styles.confirmSlot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="手动确认已调整"
                disabled={guide.capturing || !guide.ready}
                onPress={guide.confirmAdjustment}
                style={({ pressed }) => [
                  styles.confirmStep,
                  (guide.capturing || !guide.ready) && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="checkmark" size={15} color={colors.secondaryFixed} />
                <Text style={styles.confirmStepText}>已调整，确认到位</Text>
              </Pressable>
            </View>
          )}

          <CameraParameterCard
            params={params}
            flashLabel={flashLabel}
            flashOn={context.flash === 'on'}
            flashDisabled={flashDisabled}
            disabled={blocked || guide.executionPhase === 'parameters'}
            tuningOpen={tuningOpen}
            tuningMessage={guide.tuningMessage}
            facing={context.facing}
            onOpenTuning={openTuning}
            onToggleFlash={() => void guide.adjustParameters({ flash: context.flash === 'on' ? 'off' : 'on' })}
          />

          <CameraGuidanceControls
            enabled={guide.enabled}
            starting={guide.starting}
            disabled={guide.capturing || guide.adjustingParameters}
            autoZoom={guide.autoZoom}
            status={
              guide.enabled && guide.status.phase !== 'error' && guide.result
                ? { phase: canShoot ? 'ready' : guide.status.phase, message: bannerMessage }
                : guide.status
            }
            configMissing={guide.configMissing}
            onToggle={() => void guide.toggleGuidance()}
            onAutoZoom={guide.toggleAutoZoom}
            onRefresh={guide.refresh}
            onConfigure={onConfigure}
            poseEnabled={pose.enabled}
            poseStarting={pose.starting}
            poseWorking={pose.phase === 'waiting' || pose.phase === 'analyzing'}
            poseError={pose.phase === 'error' ? pose.message : undefined}
            poseConfigMissing={pose.configMissing}
            onTogglePose={() => void pose.toggle()}
          />

          <CameraStyleStrip
            activeStyle={context.style}
            disabled={guide.capturing}
            autoStyle={guide.autoStyle}
            onChangeStyle={guide.changeStyle}
            onToggleAutoStyle={guide.toggleAutoStyle}
          />

          <View style={styles.autoRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: guide.autoFlash }}
              disabled={guide.capturing}
              onPress={guide.toggleAutoFlash}
              style={[styles.autoChip, guide.autoFlash && styles.autoChipOn]}
            >
              <Ionicons name="flash-outline" size={13} color={guide.autoFlash ? colors.secondaryFixed : colors.onSurfaceVariant} />
              <Text style={[styles.autoChipText, guide.autoFlash && styles.autoChipTextOn]}>自动补光</Text>
            </Pressable>
          </View>

          <ShutterDecisionCard decision={guide.shutterDecision} />

          <CaptureDeck
            galleryThumb={galleryThumb}
            canShoot={canShoot}
            ready={guide.ready}
            capturing={guide.capturing}
            adjustingParameters={guide.adjustingParameters}
            active={guide.active}
            executionPhase={guide.executionPhase}
            switching={guide.switching}
            blocked={blocked}
            onOpenGallery={() => onOpenGallery?.()}
            onCapture={() => void guide.capture()}
            onFlipCamera={guide.flipCamera}
          />
        </View>
      </SafeAreaView>
      {tuningOpen && <CameraParameterPanel visible={tuningOpen} initialParameter={tuningParameter} context={context}
        appliedTuning={guide.appliedTuning} disabled={blocked || guide.executionPhase === 'parameters'}
        busy={guide.adjustingParameters} message={guide.tuningMessage}
        onClose={() => setTuningOpen(false)} onChange={guide.adjustParameters} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  safe: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  confirmSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  autoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainer,
  },
  autoChipOn: {
    backgroundColor: colors.primary,
  },
  autoChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  autoChipTextOn: {
    color: colors.secondaryFixed,
  },
  confirmStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  confirmStepText: {
    color: colors.secondaryFixed,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
