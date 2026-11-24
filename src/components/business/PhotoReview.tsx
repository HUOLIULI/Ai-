import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, shadows } from '../../constants/theme';
import { analyzePhotoQuality } from '../../lib/photoQualityGuard';
import { editPhotoFromInstruction, applyNlEditToPhoto } from '../../lib/nlEdit';
import { getActiveAIConfig } from '../../lib/aiConfig';
import { canvasFilterBackend } from '../../plugin/builtin';
import { IconButton } from '../ui/IconButton';
import { PrimaryButton } from '../ui/PrimaryButton';

type Props = { uri: string; onRetake: () => void; onSave: () => void; saving: boolean };

export function PhotoReview({ uri, onRetake, onSave, saving }: Props) {
  const [qualityHints, setQualityHints] = useState<string[]>([]);
  const [instruction, setInstruction] = useState('');
  const [editedUri, setEditedUri] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setQualityHints([]);
    void analyzePhotoQuality(uri).then((report) => {
      if (!cancelled && report.shouldRetake) setQualityHints(report.hints);
    });
    return () => { cancelled = true; };
  }, [uri]);
  useEffect(() => { setEditedUri(null); setEditError(null); }, [uri]);

  // Applies a natural-language instruction to the photo: the vision model
  // returns a grade + look parameter set, compiled to a LUT and applied. Fails
  // open with a visible message; the original photo is never destroyed.
  async function applyEdit() {
    const text = instruction.trim();
    if (!text || editing) return;
    setEditing(true); setEditError(null);
    try {
      const config = await getActiveAIConfig();
      const edit = await editPhotoFromInstruction(config, text, editedUri ?? uri, new AbortController().signal);
      const out = await applyNlEditToPhoto(editedUri ?? uri, edit, canvasFilterBackend);
      setEditedUri(out);
    } catch {
      setEditError('修图未生效，请检查 AI 配置或换一句指令。');
    } finally {
      setEditing(false);
    }
  }

  const displayUri = editedUri ?? uri;

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
