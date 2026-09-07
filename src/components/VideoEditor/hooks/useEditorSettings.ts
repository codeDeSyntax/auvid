// ─── useEditorSettings.ts ─────────────────────────────────────────────────────
// All right-panel settings in one composable hook:
//   - Cut settings (speed, gain, save mode, cut action, format, resolution)
//   - Color grading (brightness, contrast, saturation, vibrance, temperature + presets)
//   - Audio layer (BGM track, volumes, fade curves, ducking)
//   - Canvas (aspect ratio, fill mode, rotate, flip)

import { useState, useCallback } from 'react';
import type {
  SaveMode, CutAction, TargetResolution, OutputFormat,
  ColorAdjustments, ColorPreset, AudioLayer,
  CanvasAspectRatio, CanvasFillMode, RotateDeg,
} from '../types';
import { DEFAULT_COLOR_ADJUSTMENTS, DEFAULT_AUDIO_LAYER } from '../types';

// ─── Color Presets ────────────────────────────────────────────────────────────
const COLOR_PRESETS: Record<ColorPreset, Partial<ColorAdjustments>> = {
  none:       { brightness: 0, contrast: 0, saturation: 0, vibrance: 100, temperature: 0 },
  cinematic:  { brightness: -8, contrast: 15, saturation: -10, vibrance: 120, temperature: -5 },
  noir:       { brightness: -5, contrast: 30, saturation: -100, vibrance: 100, temperature: 0 },
  warm:       { brightness: 5, contrast: 5, saturation: 15, vibrance: 130, temperature: 25 },
  vintage:    { brightness: -5, contrast: -10, saturation: -20, vibrance: 90, temperature: 20 },
  'cold-teal':{ brightness: 0, contrast: 10, saturation: 10, vibrance: 110, temperature: -30 },
};

export function useEditorSettings() {
  // ── Cut Settings ──────────────────────────────────────────────────────────
  const [speed, setSpeed] = useState(1.0);
  const [gain, setGain] = useState(1.0);
  const [saveMode, setSaveMode] = useState<SaveMode>('new-file');
  const [cutAction, setCutAction] = useState<CutAction>('keep');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('same');
  const [targetResolution, setTargetResolution] = useState<TargetResolution>('original');

  // ── Color Grading ─────────────────────────────────────────────────────────
  const [colorAdj, setColorAdj] = useState<ColorAdjustments>({ ...DEFAULT_COLOR_ADJUSTMENTS });

  const applyColorPreset = useCallback((preset: ColorPreset) => {
    const values = COLOR_PRESETS[preset];
    setColorAdj((prev) => ({ ...prev, ...values, preset }));
  }, []);

  const updateColor = useCallback(<K extends keyof Omit<ColorAdjustments, 'preset'>>(
    key: K,
    value: ColorAdjustments[K],
  ) => {
    setColorAdj((prev) => ({ ...prev, [key]: value, preset: 'none' }));
  }, []);

  const resetColor = useCallback(() => {
    setColorAdj({ ...DEFAULT_COLOR_ADJUSTMENTS });
  }, []);

  /** Whether any non-default color adjustments are active */
  const hasColorAdjustments =
    colorAdj.preset !== 'none' ||
    colorAdj.brightness !== 0 ||
    colorAdj.contrast !== 0 ||
    colorAdj.saturation !== 0 ||
    colorAdj.vibrance !== 100 ||
    colorAdj.temperature !== 0;

  /** CSS filter string for live video preview (no encode) */
  const colorCssFilter = (() => {
    const brightness = 1 + colorAdj.brightness / 100;
    const contrast   = 1 + colorAdj.contrast / 100;
    // saturation: 0 = grayscale, 1 = normal, higher = vivid
    const saturation = Math.max(0, 1 + colorAdj.saturation / 100);
    // temperature mapped to a subtle hue-rotate approximation
    const hueRotate = colorAdj.temperature * 0.3;
    return `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturation.toFixed(3)}) hue-rotate(${hueRotate.toFixed(1)}deg)`;
  })();

  // ── Audio Layer ───────────────────────────────────────────────────────────
  const [audioLayer, setAudioLayer] = useState<AudioLayer>({ ...DEFAULT_AUDIO_LAYER });

  const updateAudio = useCallback(<K extends keyof AudioLayer>(key: K, value: AudioLayer[K]) => {
    setAudioLayer((prev) => ({ ...prev, [key]: value }));
  }, []);

  const browseBGMFile = useCallback(async () => {
    try {
      const result = await window.ipcRenderer?.invoke('dialog:open-audio-file');
      const chosenPath = Array.isArray(result) ? result[0] : (typeof result === 'string' ? result : null);
      if (chosenPath) {
        setAudioLayer((prev) => ({ ...prev, bgmPath: chosenPath }));
      }
    } catch (err) {
      console.error('[useEditorSettings] BGM browse error:', err);
    }
  }, []);

  const removeBGM = useCallback(() => {
    setAudioLayer((prev) => ({ ...prev, bgmPath: null }));
  }, []);

  // ── Canvas / Transform ────────────────────────────────────────────────────
  const [canvasRatio, setCanvasRatio] = useState<CanvasAspectRatio>('16:9');
  const [canvasFillMode, setCanvasFillMode] = useState<CanvasFillMode>('blur-fill');
  const [rotateDeg, setRotateDeg] = useState<RotateDeg>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  const cycleRotate = useCallback((direction: 'cw' | 'ccw') => {
    setRotateDeg((prev) => {
      const d = direction === 'cw' ? 90 : -90;
      return ((prev + d + 360) % 360) as RotateDeg;
    });
  }, []);

  // ── Reset all settings for a new file ────────────────────────────────────
  const resetAllSettings = useCallback(() => {
    setSpeed(1.0);
    setGain(1.0);
    setCutAction('keep');
    setOutputFormat('same');
    setTargetResolution('original');
    setColorAdj({ ...DEFAULT_COLOR_ADJUSTMENTS });
    setAudioLayer({ ...DEFAULT_AUDIO_LAYER });
    setRotateDeg(0);
    setFlipH(false);
    setFlipV(false);
    // Intentionally keep saveMode and canvasRatio — user's preference
  }, []);

  return {
    // Cut
    speed, setSpeed,
    gain, setGain,
    saveMode, setSaveMode,
    cutAction, setCutAction,
    outputFormat, setOutputFormat,
    targetResolution, setTargetResolution,
    // Color
    colorAdj,
    hasColorAdjustments,
    colorCssFilter,
    updateColor,
    applyColorPreset,
    resetColor,
    // Audio
    audioLayer,
    updateAudio,
    browseBGMFile,
    removeBGM,
    // Canvas
    canvasRatio, setCanvasRatio,
    canvasFillMode, setCanvasFillMode,
    rotateDeg,
    flipH, setFlipH,
    flipV, setFlipV,
    cycleRotate,
    rotateCW: () => cycleRotate('cw'),
    toggleFlipH: () => setFlipH((prev) => !prev),
    toggleFlipV: () => setFlipV((prev) => !prev),
    transformCss: [
      rotateDeg !== 0 ? `rotate(${rotateDeg}deg)` : '',
      flipH ? 'scaleX(-1)' : '',
      flipV ? 'scaleY(-1)' : '',
    ].filter(Boolean).join(' ') || 'none',
    // Global
    resetAllSettings,
  };
}
