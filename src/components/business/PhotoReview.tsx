import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, shadows } from '../../constants/theme';
import { analyzePhotoQuality } from '../../lib/photoQualityGuard';
import { editPhotoFromInstruction, applyNlEditToPhoto } from '../../lib/nlEdit';
import { analyzeReferenceGrade, applyReferenceGradeToPhoto } from '../../lib/refColorMatch';
import { loadDevicePhotos } from '../../lib/media';
import type { AlbumItem } from '../../lib/album';
import { toDataUrl } from '../../lib/photoDataUrl';
import { getActiveAIConfig } from '../../lib/aiConfig';
import { defaultFilterBackend } from '../../plugin/builtin';
import { IconButton } from '../ui/IconButton';
import { PrimaryButton } from '../ui/PrimaryButton';

type Props = { uri: string; onRetake: () => void; onSave: () => void; saving: boolean };

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
  useEffect(() => {
    let cancelled = false;
    setQualityHints([]);
    void analyzePhotoQuality(uri).then((report) => {
      if (!cancelled && report.shouldRetake) setQualityHints(report.hints);
    });
    return () => { cancelled = true; };
  }, [uri]);
  useEffect(() => { setEditedUri(null); setEditError(null); setMatchError(null); setRefUri(null); }, [uri]);

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
      const out = await applyNlEditToPhoto(editedUri ?? uri, edit, defaultFilterBackend());
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
      const out = await applyReferenceGradeToPhoto(displayUri, params, defaultFilterBackend());
      setEditedUri(out);
    } catch {
      setMatchError('匹配未生效，请检查 AI 配置或换张参考图。');
    } finally {
      setMatching(false);
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
