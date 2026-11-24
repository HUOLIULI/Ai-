import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, shadows } from '../../constants/theme';
import { analyzePhotoQuality } from '../../lib/photoQualityGuard';
import { editPhotoFromInstruction, applyNlEditToPhoto } from '../../lib/nlEdit';
import { analyzeReferenceGrade, applyReferenceGradeToPhoto } from '../../lib/refColorMatch';
import { analyzeWhiteBalance, applyWbCorrectionToPhoto } from '../../lib/wbCorrection';
import { getSceneAdvice, applySceneAdviceToPhoto, type SceneAdvice } from '../../lib/sceneAdvice';
import { planAutoEnhance, applyAutoEnhanceToPhoto } from '../../lib/autoEnhance';
import { scorePhoto, DIMENSION_LABELS, SCORE_DIMENSIONS, type PhotoScore } from '../../lib/photoScore';
import { suggestCrop, getImageSize, cropBoxToRect, applyCropToPhoto, type CropSuggestion } from '../../lib/photoCrop';
import { loadDevicePhotos } from '../../lib/media';
import type { AlbumItem } from '../../lib/album';
import { toDataUrl } from '../../lib/photoDataUrl';
import { scaleColorGrade, scaleBeauty } from '../../lib/intensity';
import { getActiveAIConfig } from '../../lib/aiConfig';
import { defaultFilterBackend } from '../../plugin/builtin';
import { applyLutSpecToPhoto } from '../../plugin/builtin/filters';
import { withFilmTexture } from '../../lib/filmTexture';
import { IconButton } from '../ui/IconButton';
import { PrimaryButton } from '../ui/PrimaryButton';

type Props = { uri: string; onRetake: () => void; onSave: () => void; saving: boolean };

// Preset strength levels for dialing AI enhancements back toward neutral.
// 足量 (1) preserves the model's full output; the others scale it down.
const STRENGTH_LEVELS = [
  { label: '轻', value: 0.5 },
  { label: '适中', value: 0.75 },
  { label: '足量', value: 1 },
] as const;

// Film texture presets as segmented levels (no new slider dependency). Each is
// a 0..1 amount fed straight into the LUT grain/vignette fields.
const GRAIN_LEVELS = [
  { label: '无', value: 0 },
  { label: '轻', value: 0.15 },
  { label: '中', value: 0.3 },
  { label: '重', value: 0.5 },
] as const;

const VIGNETTE_LEVELS = [
  { label: '无', value: 0 },
  { label: '轻', value: 0.2 },
  { label: '中', value: 0.35 },
  { label: '重', value: 0.55 },
] as const;

export function PhotoReview({ uri, onRetake, onSave, saving }: Props) {
  const [qualityHints, setQualityHints] = useState<string[]>([]);
  const [instruction, setInstruction] = useState('');
  const [editedUri, setEditedUri] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showRefs, setShowRefs] = useState(false);
  const [refLoading, setRefLoading] = useState(false);
  const [refList, setRefList] = useState<AlbumItem[]>([]);
  const [refUri, setRefUri] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<SceneAdvice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [applyingAdvice, setApplyingAdvice] = useState(false);
  const [score, setScore] = useState<PhotoScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [grain, setGrain] = useState(0);
  const [vignette, setVignette] = useState(0);
  const [busyTexture, setBusyTexture] = useState(false);
  const [crop, setCrop] = useState<CropSuggestion | null>(null);
  const [cropping, setCropping] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [strength, setStrength] = useState(1);
  useEffect(() => {
    let cancelled = false;
    setQualityHints([]);
    void analyzePhotoQuality(uri).then((report) => {
      if (!cancelled && report.shouldRetake) setQualityHints(report.hints);
    });
    return () => { cancelled = true; };
  }, [uri]);
  useEffect(() => { setEditedUri(null); setEditError(null); setMatchError(null); setCorrectError(null); setAdvice(null); setAdviceError(null); setEnhanceError(null); setRefUri(null); setScore(null); setScoreError(null); setCrop(null); setCropError(null); }, [uri]);

  // Applies a natural-language instruction to the photo: the vision model
  // returns a grade + look parameter set, compiled to a LUT and applied. Fails
  // open with a visible message; the original photo is never destroyed.
  async function applyEdit() {
    const text = instruction.trim();
    if (!text || editing) return;
    setEditing(true); setEditError(null);
    try {
      const config = await getActiveAIConfig();
      const dataUrl = await toDataUrl(editedUri ?? uri);
      const edit = await editPhotoFromInstruction(config, text, dataUrl, new AbortController().signal);
      // Dial the model's grade + look toward neutral by the user's strength.
      const scaled = { grade: scaleColorGrade(edit.grade, strength), look: scaleBeauty(edit.look, strength) };
      const out = await applyNlEditToPhoto(editedUri ?? uri, scaled, defaultFilterBackend());
      setEditedUri(out);
    } catch {
      setEditError('修图未生效，请检查 AI 配置或换一句指令。');
    } finally {
      setEditing(false);
    }
  }

  const displayUri = editedUri ?? uri;

  // Loads the device's recent photos so the user can pick a reference whose
  // color look will be matched onto the current photo. Fails open to an empty
  // strip; loadDevicePhotos already swallows permission/IO errors on native and
  // returns [] on web.
  async function loadRefs() {
    if (refLoading || refList.length > 0) return;
    setRefLoading(true);
    try {
      const photos = await loadDevicePhotos();
      setRefList(photos);
      setShowRefs(photos.length > 0);
    } finally {
      setRefLoading(false);
    }
  }

  // Reference color match: send the current preview (which may already carry an
  // NL edit) plus the selected reference as two images, compile the returned
  // grade to a LUT and apply it on top. Fails open — the preview is kept and a
  // visible message explains the miss.
  async function applyMatch() {
    const reference = refUri;
    if (!reference || matching) return;
    setMatching(true); setMatchError(null);
    try {
      const config = await getActiveAIConfig();
      const sourceDataUrl = await toDataUrl(displayUri);
      const referenceDataUrl = await toDataUrl(reference);
      const params = await analyzeReferenceGrade(config, sourceDataUrl, referenceDataUrl, new AbortController().signal);
      // Dial the matched grade toward neutral by the user's strength.
      const out = await applyReferenceGradeToPhoto(displayUri, scaleColorGrade(params, strength), defaultFilterBackend());
      setEditedUri(out);
    } catch {
      setMatchError('匹配未生效，请检查 AI 配置或换张参考图。');
    } finally {
      setMatching(false);
    }
  }

  // Corrective white-balance / exposure pass: the model reads the preview for a
  // colour cast and an exposure error and we apply the counter-shift as a LUT.
  // Corrects rather than restyles, and stacks on the current preview. Fails open.
  async function applyCorrection() {
    if (correcting) return;
    setCorrecting(true); setCorrectError(null);
    try {
      const config = await getActiveAIConfig();
      const dataUrl = await toDataUrl(displayUri);
      const reading = await analyzeWhiteBalance(config, dataUrl, new AbortController().signal);
      const out = await applyWbCorrectionToPhoto(displayUri, reading, defaultFilterBackend(), strength);
      setEditedUri(out);
    } catch {
      setCorrectError('校正未生效，请检查 AI 配置或稍后再试。');
    } finally {
      setCorrecting(false);
    }
  }

  // Scene-aware advice: classify the photo and surface the matching style as a
  // one-tap suggestion. Composes the existing scene recognition + style table;
  // fails open with a visible message.
  async function loadAdvice() {
    if (adviceLoading || advice) return;
    setAdviceLoading(true); setAdviceError(null);
    try {
      const config = await getActiveAIConfig();
      const dataUrl = await toDataUrl(displayUri);
      setAdvice(await getSceneAdvice(config, dataUrl, new AbortController().signal));
    } catch {
      setAdviceError('未能识别场景，请检查 AI 配置或稍后再试。');
    } finally {
      setAdviceLoading(false);
    }
  }

  // Applies the recommended style LUT to the current preview. Fails open — the
  // preview is kept and a message explains the miss.
  async function applyAdvice() {
    if (!advice || applyingAdvice) return;
    setApplyingAdvice(true); setAdviceError(null);
    try {
      const out = await applySceneAdviceToPhoto(displayUri, advice);
      setEditedUri(out);
    } catch {
      setAdviceError('建议未生效，请稍后再试。');
    } finally {
      setApplyingAdvice(false);
    }
  }

  // AI photo score: the vision model grades the finished shot across five
  // dimensions and returns a summary plus tips so the user can judge which
  // shot to keep. Display-only; fails open with a visible message.
  async function loadScore() {
    if (scoreLoading || score) return;
    setScoreLoading(true); setScoreError(null);
    try {
      const config = await getActiveAIConfig();
      const dataUrl = await toDataUrl(displayUri);
      setScore(await scorePhoto(config, dataUrl, new AbortController().signal));
    } catch {
      setScoreError('未能生成评分，请检查 AI 配置或稍后再试。');
    } finally {
      setScoreLoading(false);
    }
  }

  // AI smart crop: the vision model proposes a normalized crop box that
  // tightens the composition; we compile it to a pixel rect and crop the
  // preview. Fails open — the original photo is kept and a message explains.
  async function applyCrop() {
    if (cropping) return;
    setCropping(true); setCropError(null);
    try {
      const config = await getActiveAIConfig();
      const dataUrl = await toDataUrl(displayUri);
      const suggestion = await suggestCrop(config, dataUrl, new AbortController().signal);
      setCrop(suggestion);
      const { width, height } = await getImageSize(displayUri);
      const rect = cropBoxToRect(suggestion.box, width, height);
      const out = await applyCropToPhoto(displayUri, rect);
      setEditedUri(out);
      setCrop(null); // consumed: the preview now shows the cropped result
    } catch {
      setCropError('未能完成裁剪，请检查 AI 配置或稍后再试。');
    } finally {
      setCropping(false);
    }
  }

  // Film texture: overlays grain + vignette onto the photo. Applies from the
  // original capture with an identity colour matrix so re-rendering as the
  // sliders move never compounds JPEG loss. Fails open — the preview is kept.
  async function applyTexture(nextGrain: number, nextVignette: number) {
    setBusyTexture(true);
    try {
      const texture = withFilmTexture(
        { name: 'film-texture', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
        { grain: nextGrain, vignette: nextVignette }
      );
      const out = await applyLutSpecToPhoto(uri, texture, defaultFilterBackend());
      setEditedUri(out);
    } catch {
      // Texture is a cosmetic overlay; keep the current preview on any failure.
    } finally {
      setBusyTexture(false);
    }
  }

  // One-tap auto-enhance: the "just make it good" action. Runs scene style and
  // corrective white-balance in parallel, then applies both (style LUT first,
  // corrective grade on top) scaled by the strength control. Fails open.
  async function applyEnhance() {
    if (enhancing) return;
    setEnhancing(true); setEnhanceError(null);
    try {
      const config = await getActiveAIConfig();
      const dataUrl = await toDataUrl(displayUri);
      const plan = await planAutoEnhance(config, dataUrl, new AbortController().signal);
      const out = await applyAutoEnhanceToPhoto(displayUri, plan, defaultFilterBackend(), strength);
      setEditedUri(out);
    } catch {
      setEnhanceError('增强未生效，请检查 AI 配置或稍后再试。');
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={saving ? undefined : onRetake} />
        <Text style={styles.headerTitle}>拍摄完成</Text>
        <IconButton icon="ellipsis-horizontal" onPress={() => undefined} />
      </View>

      <View style={styles.imageWrap}>
        <Image source={{ uri: displayUri }} style={styles.image} />
        <LinearGradient
          colors={['transparent', 'rgba(20,30,38,0.2)']}
          style={styles.imageOverlay}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={styles.imageBorder} />
      </View>

      {/* Apple 雾态卡片 */}
      <View style={styles.cardWrapper}>
        <View style={styles.card}>
          <BlurView
            intensity={65}
            tint="light"
            style={[
              StyleSheet.absoluteFill,
              styles.blurLayer,
            ]}
          />
          <View style={[StyleSheet.absoluteFill, styles.cardBg]} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.65)', 'rgba(255, 255, 255, 0.0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={[StyleSheet.absoluteFill, styles.sheen]}
            pointerEvents="none"
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cardBorder]} />

          <View style={styles.cardContent}>
            <View style={styles.score}>
              <View style={styles.checkWrapper}>
                <LinearGradient
                  colors={[colors.primary, colors.mistBlue]}
                  style={styles.check}
                >
                  <Ionicons name="checkmark" size={17} color={colors.whiteWarm} />
                </LinearGradient>
              </View>
              <View>
                <Text style={styles.scoreTitle}>照片已拍摄</Text>
                <Text style={styles.meta}>原图预览 · 相机自动参数</Text>
              </View>
            </View>

            <Text style={styles.note}>保存到相册后将自动继续拍摄，也可以重拍一次。</Text>

            {/* AI 增强工具区：分区标题建立视觉层次 */}
            <View style={styles.sectionHead}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>AI 增强</Text>
              <Text style={styles.sectionHint}>调色 · 修图 · 构图 · 质感</Text>
            </View>

            {/* 一键智能增强：场景风格 + 白平衡校正，一次搞定 */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="一键智能增强"
              onPress={() => void applyEnhance()}
              disabled={enhancing}
              style={({ pressed }) => [styles.enhanceButton, pressed && styles.matchPressed, enhancing && styles.matchDisabled]}
            >
              <Ionicons name="sparkles" size={14} color={colors.secondaryFixed} />
              <Text style={styles.enhanceButtonText}>{enhancing ? '增强中…' : '一键智能增强'}</Text>
            </Pressable>
            {enhanceError ? <Text style={styles.editError}>{enhanceError}</Text> : null}

            {/* 一句话修图：自然语言指令驱动 */}
            <View style={styles.editRow}>
              <TextInput
                value={instruction}
                onChangeText={setInstruction}
                placeholder="一句话修图，如：把天空调蓝一点"
                placeholderTextColor={colors.muted}
                style={styles.editInput}
                editable={!editing}
                accessibilityLabel="一句话修图指令"
              />
              {instruction.trim().length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="应用修图"
                  onPress={() => void applyEdit()}
                  disabled={editing}
                  style={({ pressed }) => [styles.editApply, pressed && styles.editPressed, editing && styles.editDisabled]}
                >
                  <Ionicons name="sparkles-outline" size={13} color={colors.secondaryFixed} />
                  <Text style={styles.editApplyText}>{editing ? '修图中' : '应用'}</Text>
                </Pressable>
              )}
            </View>
            {editError ? <Text style={styles.editError}>{editError}</Text> : null}

            {/* 参考图匹配：选一张参考图复刻其色调 */}
            <View style={styles.matchRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="选择参考图"
                onPress={() => void loadRefs()}
                disabled={refLoading}
                style={({ pressed }) => [styles.matchToggle, pressed && styles.matchPressed]}
              >
                <Ionicons name="images-outline" size={13} color={colors.ink} />
                <Text style={styles.matchToggleText}>
                  {refLoading ? '读取相册…' : showRefs ? '选择参考图' : '参考图匹配'}
                </Text>
              </Pressable>
              {refUri ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="应用参考图匹配"
                  onPress={() => void applyMatch()}
                  disabled={matching}
                  style={({ pressed }) => [styles.matchApply, pressed && styles.matchPressed, matching && styles.matchDisabled]}
                >
                  <Ionicons name="sparkles-outline" size={13} color={colors.secondaryFixed} />
                  <Text style={styles.matchApplyText}>{matching ? '匹配中' : '应用匹配'}</Text>
                </Pressable>
              ) : null}
            </View>

            {showRefs ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.refStrip} contentContainerStyle={styles.refStripContent}>
                {refList.map((item) => {
                  const selected = refUri === item.uri;
                  return (
                    <Pressable
                      key={item.uri}
                      accessibilityRole="button"
                      accessibilityLabel={`选用参考图 ${item.title}`}
                      onPress={() => setRefUri(item.uri)}
                      style={[styles.refThumb, selected && styles.refThumbSelected]}
                    >
                      <Image source={{ uri: item.uri }} style={styles.refThumbImage} />
                      {selected ? (
                        <View style={styles.refThumbCheck}>
                          <Ionicons name="checkmark" size={11} color={colors.whiteWarm} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            {matchError ? <Text style={styles.editError}>{matchError}</Text> : null}

            {/* 自动校正白平衡与曝光：检测色偏/过欠曝并反向修正 */}
            <View style={styles.matchRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="自动校正白平衡"
                onPress={() => void applyCorrection()}
                disabled={correcting}
                style={({ pressed }) => [styles.matchToggle, pressed && styles.matchPressed, correcting && styles.matchDisabled]}
              >
                <Ionicons name="color-wand-outline" size={13} color={colors.ink} />
                <Text style={styles.matchToggleText}>{correcting ? '校正中' : '自动校正白平衡'}</Text>
              </Pressable>
            </View>
            {correctError ? <Text style={styles.editError}>{correctError}</Text> : null}

            {/* AI 智能建议：识别场景并一键应用匹配风格 */}
            <View style={styles.matchRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="获取场景建议"
                onPress={() => void loadAdvice()}
                disabled={adviceLoading || !!advice}
                style={({ pressed }) => [styles.matchToggle, pressed && styles.matchPressed, (adviceLoading || !!advice) && styles.matchDisabled]}
              >
                <Ionicons name="bulb-outline" size={13} color={colors.ink} />
                <Text style={styles.matchToggleText}>{adviceLoading ? '识别中' : advice ? '已识别场景' : 'AI 场景建议'}</Text>
              </Pressable>
              {advice ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="应用场景建议"
                  onPress={() => void applyAdvice()}
                  disabled={applyingAdvice}
                  style={({ pressed }) => [styles.matchApply, pressed && styles.matchPressed, applyingAdvice && styles.matchDisabled]}
                >
                  <Ionicons name="sparkles-outline" size={13} color={colors.secondaryFixed} />
                  <Text style={styles.matchApplyText}>{applyingAdvice ? '应用中' : `应用${advice.style}`}</Text>
                </Pressable>
              ) : null}
            </View>
            {advice ? (
              <Text style={styles.adviceNote}>{advice.rationale}</Text>
            ) : null}
            {adviceError ? <Text style={styles.editError}>{adviceError}</Text> : null}

            {/* AI 照片评分：五维打分 + 总评 + 改进建议，帮助判断哪张值得留 */}
            <View style={styles.matchRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="生成照片评分"
                onPress={() => void loadScore()}
                disabled={scoreLoading || !!score}
                style={({ pressed }) => [styles.matchToggle, pressed && styles.matchPressed, (scoreLoading || !!score) && styles.matchDisabled]}
              >
                <Ionicons name="star-outline" size={13} color={colors.ink} />
                <Text style={styles.matchToggleText}>{scoreLoading ? '评分中' : score ? `总分 ${score.overall}` : 'AI 照片评分'}</Text>
              </Pressable>
            </View>
            {score ? (
              <View style={styles.scoreCard}>
                <View style={styles.scoreHead}>
                  <View style={styles.scoreRing}>
                    <Text style={styles.scoreRingValue}>{score.overall}</Text>
                    <Text style={styles.scoreRingUnit}>分</Text>
                  </View>
                  <View style={styles.scoreHeadText}>
                    <Text style={styles.scoreHeadTitle}>AI 综合评分</Text>
                    <Text style={styles.scoreHeadSub}>
                      {score.overall >= 80 ? '很出片，值得保留' : score.overall >= 60 ? '不错，还有提升空间' : '建议重拍或再修图'}
                    </Text>
                  </View>
                </View>
                <View style={styles.scoreDims}>
                  {SCORE_DIMENSIONS.map((dim) => (
                    <View key={dim} style={styles.scoreDimRow}>
                      <Text style={styles.scoreDimLabel}>{DIMENSION_LABELS[dim]}</Text>
                      <View style={styles.scoreBarTrack}>
                        <LinearGradient
                          colors={[colors.mistBlue, colors.secondaryFixed]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.scoreBarFill, { width: `${score.dimensions[dim]}%` }]}
                        />
                      </View>
                      <Text style={styles.scoreDimValue}>{score.dimensions[dim]}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.adviceNote}>{score.summary}</Text>
                {score.tips.length > 0 ? (
                  <View style={styles.scoreTips}>
                    {score.tips.map((tip, idx) => (
                      <View key={idx} style={styles.scoreTipRow}>
                        <View style={styles.scoreTipDot} />
                        <Text style={styles.scoreTip}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            {scoreError ? <Text style={styles.editError}>{scoreError}</Text> : null}

            {/* AI 智能裁剪：模型给裁剪框收紧构图，一键重构图预览 */}
            <View style={styles.matchRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="AI 智能裁剪"
                onPress={() => void applyCrop()}
                disabled={cropping}
                style={({ pressed }) => [styles.matchToggle, pressed && styles.matchPressed, cropping && styles.matchDisabled]}
              >
                <Ionicons name="crop-outline" size={13} color={colors.ink} />
                <Text style={styles.matchToggleText}>{cropping ? '裁剪中' : 'AI 智能裁剪'}</Text>
              </Pressable>
            </View>
            {crop ? (
              <Text style={styles.adviceNote}>{crop.rationale}</Text>
            ) : null}
            {cropError ? <Text style={styles.editError}>{cropError}</Text> : null}

            {/* 胶片质感：颗粒 + 暗角，纯像素叠加，独立于调色层 */}
            <View style={styles.strengthRow}>
              <Text style={styles.strengthLabel}>颗粒</Text>
              <View style={styles.strengthSegments}>
                {GRAIN_LEVELS.map((level) => {
                  const active = grain === level.value;
                  return (
                    <Pressable
                      key={level.label}
                      accessibilityRole="button"
                      accessibilityLabel={`颗粒${level.label}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => { setGrain(level.value); void applyTexture(level.value, vignette); }}
                      disabled={busyTexture}
                      style={({ pressed }) => [
                        styles.strengthSegment,
                        (active || pressed) && styles.strengthSegmentActive,
                      ]}
                    >
                      <Text style={[styles.strengthSegmentText, active && styles.strengthSegmentTextActive]}>
                        {level.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.strengthRow}>
              <Text style={styles.strengthLabel}>暗角</Text>
              <View style={styles.strengthSegments}>
                {VIGNETTE_LEVELS.map((level) => {
                  const active = vignette === level.value;
                  return (
                    <Pressable
                      key={level.label}
                      accessibilityRole="button"
                      accessibilityLabel={`暗角${level.label}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => { setVignette(level.value); void applyTexture(grain, level.value); }}
                      disabled={busyTexture}
                      style={({ pressed }) => [
                        styles.strengthSegment,
                        (active || pressed) && styles.strengthSegmentActive,
                      ]}
                    >
                      <Text style={[styles.strengthSegmentText, active && styles.strengthSegmentTextActive]}>
                        {level.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 强度：把 AI 增强效果向中性回调，避免过度处理 */}
            <View style={styles.strengthRow}>
              <Text style={styles.strengthLabel}>强度</Text>
              <View style={styles.strengthSegments}>
                {STRENGTH_LEVELS.map((level) => {
                  const active = strength === level.value;
                  return (
                    <Pressable
                      key={level.label}
                      accessibilityRole="button"
                      accessibilityLabel={`增强强度${level.label}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => setStrength(level.value)}
                      style={({ pressed }) => [styles.strengthSegment, active && styles.strengthSegmentActive, pressed && styles.matchPressed]}
                    >
                      <Text style={[styles.strengthSegmentText, active && styles.strengthSegmentTextActive]}>{level.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {qualityHints.length > 0 && (
              <View style={styles.qualityBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.tertiary} />
                <View style={styles.qualityTextWrap}>
                  {qualityHints.map((hint) => (
                    <Text key={hint} style={styles.qualityText}>{hint}</Text>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.actions}>
              {/* 重拍：雾态玻璃按钮 */}
              <View style={styles.retakeButton}>
                <PrimaryButton
                  label="重拍"
                  onPress={onRetake}
                  disabled={saving}
                  variant="glass"
                  compact
                  icon="refresh-outline"
                />
              </View>

              {/* 保存：雾态玻璃主按钮 */}
              <View style={styles.saveButton}>
                <PrimaryButton
                  label="保存到相册"
                  onPress={onSave}
                  loading={saving}
                  variant="primary"
                  compact
                  icon="download-outline"
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '600',
  },
  imageWrap: {
    width: '100%',
    height: '56%',
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: colors.paleMist,
    position: 'relative',
    ...shadows.glassMd,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  imageBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
  },
  cardWrapper: {
    marginTop: -20,
    borderRadius: 26,
    ...shadows.glassMd,
  },
  card: {
    borderRadius: 26,
    position: 'relative',
    overflow: 'hidden',
    padding: 20,
  },
  blurLayer: {
    borderRadius: 26,
  },
  cardBg: {
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  sheen: {
    borderRadius: 26,
    maxHeight: 36,
  },
  cardBorder: {
    borderRadius: 26,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  cardContent: {
    zIndex: 2,
  },
  score: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkWrapper: {
    ...shadows.glassSm,
  },
  check: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  scoreTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    marginBottom: 2,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.secondaryFixed,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionHint: {
    color: colors.subtle,
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
  },
  qualityBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  qualityTextWrap: {
    flex: 1,
    gap: 2,
  },
  qualityText: {
    color: colors.tertiary,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.body,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  editInput: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(24, 22, 18, 0.12)',
    color: colors.ink,
    fontSize: 12,
  },
  editApply: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
  },
  editPressed: {
    opacity: 0.85,
  },
  editDisabled: {
    opacity: 0.6,
  },
  editApplyText: {
    color: colors.secondaryFixed,
    fontSize: 11,
    fontWeight: '600',
  },
  editError: {
    color: colors.tertiary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  matchToggle: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(24, 22, 18, 0.12)',
  },
  matchToggleText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '600',
  },
  matchApply: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
  },
  matchPressed: {
    opacity: 0.85,
  },
  matchDisabled: {
    opacity: 0.6,
  },
  matchApplyText: {
    color: colors.secondaryFixed,
    fontSize: 11,
    fontWeight: '600',
  },
  refStrip: {
    marginTop: 8,
    maxHeight: 72,
  },
  refStripContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  refThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.paleMist,
  },
  refThumbSelected: {
    borderColor: colors.primary,
  },
  refThumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  refThumbCheck: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  strengthLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  strengthSegments: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  strengthSegment: {
    flex: 1,
    minHeight: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(24, 22, 18, 0.12)',
  },
  strengthSegmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  strengthSegmentText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '600',
  },
  strengthSegmentTextActive: {
    color: colors.secondaryFixed,
  },
  adviceNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  scoreCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 231, 150, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(227, 195, 110, 0.35)',
  },
  scoreHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  scoreRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.glassSm,
  },
  scoreRingValue: {
    color: colors.secondaryFixed,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  scoreRingUnit: {
    color: colors.secondaryFixedDim,
    fontSize: 9,
    fontWeight: '600',
    marginTop: -2,
  },
  scoreHeadText: {
    flex: 1,
    gap: 3,
  },
  scoreHeadTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  scoreHeadSub: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  scoreDims: {
    gap: 6,
  },
  scoreDimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreDimLabel: {
    color: colors.muted,
    fontSize: 11,
    width: 26,
  },
  scoreBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
    opacity: 0.12,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 6,
    borderRadius: 999,
  },
  scoreDimValue: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
    width: 22,
    textAlign: 'right',
  },
  scoreTips: {
    marginTop: 10,
    gap: 5,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(227, 195, 110, 0.3)',
  },
  scoreTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  scoreTipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondaryFixedDim,
    marginTop: 6,
  },
  scoreTip: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  enhanceButton: {
    minHeight: 40,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    marginTop: 14,
    ...shadows.glassSm,
  },
  enhanceButtonText: {
    color: colors.secondaryFixed,
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  retakeButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1.4,
  },
});
