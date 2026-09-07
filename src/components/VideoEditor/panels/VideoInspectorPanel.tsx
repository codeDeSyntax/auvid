// ─── VideoInspectorPanel.tsx ──────────────────────────────────────────────
// Microsoft Clipchamp-inspired vertical icon rail + sleek slide-out settings drawer:
//   - Vertical rail on far right: Audio, Fade, Filters, Colours, Speed, Canvas, Cut, Export
//   - Collapsible slide-out inspector drawer with soft cards and glassmorphic finish
//   - Styled exclusively with AUVID's signature var(--accent) theme
//   - Visual indicator dots when non-default adjustments are active

import React, { useState } from 'react';
import {
  Scissors, Sparkles, Volume2, Maximize2, Download,
  RotateCw, FlipHorizontal, FlipVertical, Gauge, Waves, Sun,
  X, Check,
} from 'lucide-react';
import type {
  SaveMode, CutAction, TargetResolution, OutputFormat,
  ColorAdjustments, ColorPreset, AudioLayer,
  CanvasAspectRatio, CanvasFillMode, RotateDeg, AudioExtractFormat,
} from '../types';
import { VideoColorPanel } from './VideoColorPanel';
import { VideoAudioPanel } from './VideoAudioPanel';

export type ClipchampTab =
  | 'audio'
  | 'fade'
  | 'filters'
  | 'colors'
  | 'speed'
  | 'canvas'
  | 'cut'
  | 'export';

interface VideoInspectorPanelProps {
  // Cut settings
  speed: number;
  onSpeedChange: (speed: number) => void;
  gain: number;
  onGainChange: (gain: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  saveMode: SaveMode;
  onSaveModeChange: (mode: SaveMode) => void;
  cutAction: CutAction;
  onCutActionChange: (action: CutAction) => void;
  outputFormat: OutputFormat;
  onOutputFormatChange: (fmt: OutputFormat) => void;
  targetResolution: TargetResolution;
  onTargetResolutionChange: (res: TargetResolution) => void;

  // Color settings
  colorAdj: ColorAdjustments;
  onUpdateColor: <K extends keyof Omit<ColorAdjustments, 'preset'>>(
    key: K,
    value: ColorAdjustments[K],
  ) => void;
  onApplyPreset: (preset: ColorPreset) => void;
  onResetColor: () => void;
  hasColorAdjustments: boolean;

  // Audio settings
  audioLayer: AudioLayer;
  onUpdateAudio: <K extends keyof AudioLayer>(key: K, value: AudioLayer[K]) => void;
  onBrowseBGM: () => void;
  onRemoveBGM: () => void;

  // Canvas / Transform settings
  canvasRatio: CanvasAspectRatio;
  onCanvasRatioChange: (ratio: CanvasAspectRatio) => void;
  canvasFillMode: CanvasFillMode;
  onCanvasFillModeChange: (mode: CanvasFillMode) => void;
  rotateDeg: RotateDeg;
  onRotateCW: () => void;
  flipH: boolean;
  onToggleFlipH: () => void;
  flipV: boolean;
  onToggleFlipV: () => void;

  // Export actions
  onTriggerExport: () => void;
  onExtractAudio: (format: AudioExtractFormat) => void;
  isExporting: boolean;

  isDarkMode: boolean;
  accentColor?: string;
}

const ASPECT_RATIOS: { id: CanvasAspectRatio; label: string; desc: string }[] = [
  { id: '16:9', label: '16:9', desc: 'YouTube, Landscape' },
  { id: '9:16', label: '9:16', desc: 'TikTok, Reels, Shorts' },
  { id: '1:1', label: '1:1', desc: 'Instagram Square' },
  { id: '4:5', label: '4:5', desc: 'Instagram Portrait' },
  { id: '4:3', label: '4:3', desc: 'Standard TV' },
  { id: '21:9', label: '21:9', desc: 'Ultrawide Cinema' },
];

const SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const RESOLUTIONS: TargetResolution[] = ['original', '1080p', '720p', '480p'];
const FORMATS: OutputFormat[] = ['same', 'mp4', 'mkv', 'mov', 'webm'];
const AUDIO_FORMATS: AudioExtractFormat[] = ['mp3', 'wav', 'aac', 'flac'];

const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5';

export const VideoInspectorPanel: React.FC<VideoInspectorPanelProps> = ({
  speed,
  onSpeedChange,
  gain,
  onGainChange,
  isMuted,
  onToggleMute,
  saveMode,
  onSaveModeChange,
  cutAction,
  onCutActionChange,
  outputFormat,
  onOutputFormatChange,
  targetResolution,
  onTargetResolutionChange,

  colorAdj,
  onUpdateColor,
  onApplyPreset,
  onResetColor,
  hasColorAdjustments,

  audioLayer,
  onUpdateAudio,
  onBrowseBGM,
  onRemoveBGM,

  canvasRatio,
  onCanvasRatioChange,
  canvasFillMode,
  onCanvasFillModeChange,
  rotateDeg,
  onRotateCW,
  flipH,
  onToggleFlipH,
  flipV,
  onToggleFlipV,

  onTriggerExport,
  onExtractAudio,
  isExporting,
}) => {
  const [activeTab, setActiveTab] = useState<ClipchampTab | null>('audio');

  // Badge indicators for active custom adjustments
  const hasAudioMod = gain !== 1.0 || isMuted || Boolean(audioLayer.bgmPath);
  const hasFadeMod = audioLayer.audioFadeIn > 0 || audioLayer.audioFadeOut > 0;
  const hasFilterMod = colorAdj.preset !== 'none';
  const hasColorMod =
    colorAdj.brightness !== 0 ||
    colorAdj.contrast !== 0 ||
    colorAdj.saturation !== 0 ||
    colorAdj.temperature !== 0 ||
    colorAdj.vibrance !== 100;
  const hasSpeedMod = speed !== 1.0;
  const hasCanvasMod = canvasRatio !== '16:9' || rotateDeg !== 0 || flipH || flipV;

  const RAIL_ITEMS: {
    id: ClipchampTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    hasBadge?: boolean;
  }[] = [
    { id: 'audio', label: 'Audio', icon: Volume2, hasBadge: hasAudioMod },
    { id: 'fade', label: 'Fade', icon: Waves, hasBadge: hasFadeMod },
    { id: 'filters', label: 'Filters', icon: Sparkles, hasBadge: hasFilterMod },
    { id: 'colors', label: 'Colours', icon: Sun, hasBadge: hasColorMod },
    { id: 'speed', label: 'Speed', icon: Gauge, hasBadge: hasSpeedMod },
    { id: 'canvas', label: 'Canvas', icon: Maximize2, hasBadge: hasCanvasMod },
    { id: 'cut', label: 'Cut', icon: Scissors },
    { id: 'export', label: 'Export', icon: Download },
  ];

  const handleTabClick = (tab: ClipchampTab) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  const getTabTitle = (tab: ClipchampTab) => {
    switch (tab) {
      case 'audio': return 'Audio & Mixer';
      case 'fade': return 'Audio Fades';
      case 'filters': return 'LUT Filter Presets';
      case 'colors': return 'Adjust Colours';
      case 'speed': return 'Playback & Speed';
      case 'canvas': return 'Social Canvas & Aspect';
      case 'cut': return 'Cut & Container';
      case 'export': return 'Export Studio';
    }
  };

  return (
    <div className="flex h-full shrink-0 select-none overflow-hidden transition-all duration-200 bg-transparent rounded-tr-3xl">
      {/* ── Slide-Out Drawer ────────────────────────────────────────────── */}
      {activeTab !== null && (
        <aside className="w-80 bg-zinc-50/70 dark:bg-zinc-800/40 backdrop-blur-sm border-l border-zinc-200/80 dark:border-zinc-800/60 flex flex-col overflow-hidden transition-all duration-200 animate-in slide-in-from-right-4 shadow-xl">
          {/* Panel Header */}
          <div className="px-4 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/60 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {getTabTitle(activeTab)}
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panel Content Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 no-scrollbar">
            {/* 1. AUDIO TAB */}
            {activeTab === 'audio' && (
              <VideoAudioPanel
                gain={gain}
                onGainChange={onGainChange}
                isMuted={isMuted}
                onToggleMute={onToggleMute}
                audioLayer={audioLayer}
                onUpdateAudio={onUpdateAudio}
                onBrowseBGM={onBrowseBGM}
                onRemoveBGM={onRemoveBGM}
                mode="audio-only"
              />
            )}

            {/* 2. FADE TAB */}
            {activeTab === 'fade' && (
              <VideoAudioPanel
                gain={gain}
                onGainChange={onGainChange}
                isMuted={isMuted}
                onToggleMute={onToggleMute}
                audioLayer={audioLayer}
                onUpdateAudio={onUpdateAudio}
                onBrowseBGM={onBrowseBGM}
                onRemoveBGM={onRemoveBGM}
                mode="fade-only"
              />
            )}

            {/* 3. FILTERS TAB */}
            {activeTab === 'filters' && (
              <VideoColorPanel
                colorAdj={colorAdj}
                onUpdateColor={onUpdateColor}
                onApplyPreset={onApplyPreset}
                onResetColor={onResetColor}
                hasAdjustments={hasColorAdjustments}
                mode="presets-only"
              />
            )}

            {/* 4. COLOURS TAB */}
            {activeTab === 'colors' && (
              <VideoColorPanel
                colorAdj={colorAdj}
                onUpdateColor={onUpdateColor}
                onApplyPreset={onApplyPreset}
                onResetColor={onResetColor}
                hasAdjustments={hasColorAdjustments}
                mode="adjustments-only"
              />
            )}

            {/* 5. SPEED TAB */}
            {activeTab === 'speed' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelClass}>Clip Speed</label>
                    <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                      {speed}x
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onSpeedChange(s)}
                        className={`py-2 text-xs rounded-xl border font-mono font-bold transition-all cursor-pointer ${
                          speed === s
                            ? 'shadow-sm'
                            : 'border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                        style={
                          speed === s
                            ? {
                                backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
                                color: 'var(--accent)',
                                borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                              }
                            : undefined
                        }
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Range Slider for Speed */}
                <div className="bg-zinc-100/60 dark:bg-zinc-800/40 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/40 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Smooth Slider</span>
                    <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                      {speed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={2.0}
                    step={0.05}
                    value={speed}
                    onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div className="flex justify-between text-[9px] text-zinc-400 font-mono pt-0.5">
                    <span>0.25x (Slow)</span>
                    <span>1.0x (Normal)</span>
                    <span>2.0x (Fast)</span>
                  </div>
                </div>
              </div>
            )}

            {/* 6. CANVAS TAB */}
            {activeTab === 'canvas' && (
              <div className="space-y-5">
                {/* Aspect Ratio Picker */}
                <div>
                  <label className={labelClass}>Aspect Ratio</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ASPECT_RATIOS.map((r) => {
                      const isSelected = canvasRatio === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => onCanvasRatioChange(r.id)}
                          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'shadow-sm'
                              : 'border-zinc-200 dark:border-zinc-700/60 bg-zinc-100/60 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                          }`}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                                  color: 'var(--accent)',
                                  borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                                }
                              : undefined
                          }
                        >
                          <div className="text-xs font-black font-mono">
                            {r.label}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                            {r.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fill Mode */}
                <div>
                  <label className={labelClass}>Fill Mode</label>
                  <div className="flex rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700/60">
                    {(['blur-fill', 'letterbox', 'crop'] as CanvasFillMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onCanvasFillModeChange(mode)}
                        className={`flex-1 py-1.5 text-[11px] font-bold capitalize transition-colors cursor-pointer ${
                          canvasFillMode === mode
                            ? ''
                            : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                        }`}
                        style={
                          canvasFillMode === mode
                            ? {
                                backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
                                color: 'var(--accent)',
                              }
                            : undefined
                        }
                      >
                        {mode.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rotate & Flip */}
                <div>
                  <label className={labelClass}>Orientation & Transform</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={onRotateCW}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-100/60 dark:bg-zinc-800/40 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      <RotateCw className="w-4 h-4 opacity-75" />
                      <span className="text-[10px] font-mono font-bold">{rotateDeg}°</span>
                    </button>

                    <button
                      type="button"
                      onClick={onToggleFlipH}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors cursor-pointer ${
                        flipH
                          ? 'shadow-sm'
                          : 'border-zinc-200 dark:border-zinc-700/60 bg-zinc-100/60 dark:bg-zinc-800/40 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                      style={
                        flipH
                          ? {
                              backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
                              color: 'var(--accent)',
                              borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                            }
                          : undefined
                      }
                    >
                      <FlipHorizontal className="w-4 h-4 opacity-75" />
                      <span className="text-[10px] font-bold">Flip H</span>
                    </button>

                    <button
                      type="button"
                      onClick={onToggleFlipV}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors cursor-pointer ${
                        flipV
                          ? 'shadow-sm'
                          : 'border-zinc-200 dark:border-zinc-700/60 bg-zinc-100/60 dark:bg-zinc-800/40 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                      style={
                        flipV
                          ? {
                              backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
                              color: 'var(--accent)',
                              borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                            }
                          : undefined
                      }
                    >
                      <FlipVertical className="w-4 h-4 opacity-75" />
                      <span className="text-[10px] font-bold">Flip V</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 7. CUT TAB */}
            {activeTab === 'cut' && (
              <div className="space-y-4">
                {/* Region Action */}
                <div>
                  <label className={labelClass}>Selection Cut Action</label>
                  <div className="flex rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700/60">
                    <button
                      type="button"
                      onClick={() => onCutActionChange('keep')}
                      className={`flex-1 py-2 text-[11px] font-bold transition-colors cursor-pointer ${
                        cutAction === 'keep'
                          ? ''
                          : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                      style={
                        cutAction === 'keep'
                          ? {
                              backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
                              color: 'var(--accent)',
                            }
                          : undefined
                      }
                    >
                      Keep Selection
                    </button>
                    <button
                      type="button"
                      onClick={() => onCutActionChange('delete')}
                      className={`flex-1 py-2 text-[11px] font-bold transition-colors cursor-pointer ${
                        cutAction === 'delete'
                          ? 'bg-red-500/20 text-red-500 font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      Delete Selection
                    </button>
                  </div>
                </div>

                {/* Save Mode */}
                <div>
                  <label className={labelClass}>Save Mode</label>
                  <div className="flex rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700/60">
                    <button
                      type="button"
                      onClick={() => onSaveModeChange('new-file')}
                      className={`flex-1 py-2 text-[11px] font-bold transition-colors cursor-pointer ${
                        saveMode === 'new-file'
                          ? ''
                          : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                      style={
                        saveMode === 'new-file'
                          ? {
                              backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
                              color: 'var(--accent)',
                            }
                          : undefined
                      }
                    >
                      New File
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveModeChange('in-place')}
                      className={`flex-1 py-2 text-[11px] font-bold transition-colors cursor-pointer ${
                        saveMode === 'in-place'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      In-Place Overwrite
                    </button>
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className={labelClass}>Target Resolution</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {RESOLUTIONS.map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => onTargetResolutionChange(res)}
                        className={`py-2 text-xs rounded-xl border font-mono capitalize font-bold transition-all cursor-pointer ${
                          targetResolution === res
                            ? 'shadow-sm'
                            : 'border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                        style={
                          targetResolution === res
                            ? {
                                backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
                                color: 'var(--accent)',
                                borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                              }
                            : undefined
                        }
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Container format */}
                <div>
                  <label className={labelClass}>Output Format</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {FORMATS.map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => onOutputFormatChange(fmt)}
                        className={`py-2 text-xs rounded-xl border font-mono uppercase font-bold transition-all cursor-pointer ${
                          outputFormat === fmt
                            ? 'shadow-sm'
                            : 'border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                        style={
                          outputFormat === fmt
                            ? {
                                backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
                                color: 'var(--accent)',
                                borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                              }
                            : undefined
                        }
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 8. EXPORT TAB */}
            {activeTab === 'export' && (
              <div className="space-y-4">
                {/* Extract Soundtrack Direct */}
                <div className="space-y-2 p-3.5 rounded-2xl bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60">
                  <label className={labelClass}>Extract Audio Soundtrack</label>
                  <p className="text-[11px] text-zinc-500">
                    Quickly extract the soundtrack directly into your Music folder without video re-encoding.
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {AUDIO_FORMATS.map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        disabled={isExporting}
                        onClick={() => onExtractAudio(fmt)}
                        className="py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 font-mono uppercase font-bold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer disabled:opacity-40"
                        style={{ color: 'var(--accent)' }}
                      >
                        .{fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary card */}
                <div className="bg-zinc-100/60 dark:bg-zinc-800/40 rounded-2xl p-3 border border-zinc-200/60 dark:border-zinc-700/40 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-zinc-500">
                    <span>Format:</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold uppercase">{outputFormat}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Resolution:</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold uppercase">{targetResolution}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Canvas:</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold uppercase">{canvasRatio}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Speed:</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold">{speed}x</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer Button matching AudioSettingsPanel style */}
          <div className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50 dark:bg-zinc-950/40">
            <button
              type="button"
              disabled={isExporting}
              onClick={onTriggerExport}
              className="w-full py-2.5 rounded-xl text-xs font-black transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105"
            >
              Export Trimmed Video
            </button>
          </div>
        </aside>
      )}

      {/* ── Vertical Clipchamp Right Rail (Pure white in light mode matching workspace) ─ */}
      <nav className="w-16 shrink-0 flex flex-col items-center py-2 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 overflow-y-auto no-scrollbar rounded-tr-3xl">
        <div className="flex flex-col items-center gap-1 w-full px-1">
          {RAIL_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id)}
                className={`relative w-full py-2 flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer group ${
                  isActive
                    ? 'shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/50'
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                        color: 'var(--accent)',
                      }
                    : undefined
                }
                title={item.label}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span
                    className="absolute right-0 inset-y-1.5 w-1 rounded-l-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                  />
                )}

                {/* Icon */}
                <div className="relative flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                  {/* Customized adjustment dot badge */}
                  {item.hasBadge && (
                    <span
                      className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full ring-1 ring-white dark:ring-zinc-950"
                      style={{ backgroundColor: 'var(--accent)' }}
                    />
                  )}
                </div>

                {/* Under-icon text label */}
                <span className="text-[9px] font-bold tracking-tight mt-1 truncate max-w-[52px]">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
