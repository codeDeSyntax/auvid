// ─── VideoColorPanel.tsx ──────────────────────────────────────────────────
// Color adjustments & LUT filter presets panel:
//   - Presets: Normal, Cinematic, Neo-Noir, Golden Hour, Vintage 70s, Cold Teal
//   - Precision sliders for Brightness, Contrast, Saturation, Vibrance, Temperature
//   - Zero-lag instant live preview
//   - Fully themed with AUVID var(--accent) and soft glassmorphic cards

import React from 'react';
import { Sun, Contrast, Droplets, Flame, RotateCcw, Sparkles } from 'lucide-react';
import type { ColorAdjustments, ColorPreset } from '../types';

interface VideoColorPanelProps {
  colorAdj: ColorAdjustments;
  onUpdateColor: <K extends keyof Omit<ColorAdjustments, 'preset'>>(
    key: K,
    value: ColorAdjustments[K],
  ) => void;
  onApplyPreset: (preset: ColorPreset) => void;
  onResetColor: () => void;
  hasAdjustments: boolean;
  accentColor?: string;
  mode?: 'all' | 'presets-only' | 'adjustments-only';
}

const PRESETS: { id: ColorPreset; label: string; gradient: string }[] = [
  { id: 'none', label: 'Normal', gradient: 'from-zinc-500 to-zinc-600' },
  { id: 'cinematic', label: 'Cinematic', gradient: 'from-amber-600 to-indigo-900' },
  { id: 'noir', label: 'Neo-Noir', gradient: 'from-zinc-900 via-zinc-600 to-zinc-300' },
  { id: 'warm', label: 'Golden Hour', gradient: 'from-amber-500 to-rose-500' },
  { id: 'vintage', label: 'Vintage 70s', gradient: 'from-yellow-700 via-amber-600 to-stone-800' },
  { id: 'cold-teal', label: 'Cold Teal', gradient: 'from-teal-500 to-cyan-800' },
];

const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5';

export const VideoColorPanel: React.FC<VideoColorPanelProps> = ({
  colorAdj,
  onUpdateColor,
  onApplyPreset,
  onResetColor,
  hasAdjustments,
  mode = 'all',
}) => {
  return (
    <div className="space-y-5 select-none">
      {/* Reset Bar if adjustments exist */}
      {hasAdjustments && (
        <div className="flex items-center justify-between pb-1 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <span className="text-[11px] font-medium text-zinc-500">Custom adjustments active</span>
          <button
            type="button"
            onClick={onResetColor}
            className="flex items-center gap-1 text-[11px] font-bold transition-colors hover:opacity-80"
            style={{ color: 'var(--accent)' }}
            title="Reset color parameters to default"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* Preset Filters Grid */}
      {(mode === 'all' || mode === 'presets-only') && (
        <div>
          <label className={labelClass}>Filter Presets</label>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => {
              const isSelected = colorAdj.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onApplyPreset(p.id)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'shadow-sm'
                      : 'bg-zinc-100/70 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-700/60 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
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
                  <div
                    className={`w-full h-7 rounded-lg bg-gradient-to-tr ${p.gradient} shadow-inner flex items-center justify-center`}
                  />
                  <span className="text-[10px] font-bold truncate w-full">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sliders */}
      {(mode === 'all' || mode === 'adjustments-only') && (
        <div className="space-y-4">
          <label className={labelClass}>Adjust Colours</label>

          {/* Brightness */}
          <div className="bg-zinc-100/60 dark:bg-zinc-800/40 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/40 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium text-[11px]">
                <Sun className="w-3.5 h-3.5 opacity-70" />
                Brightness
              </span>
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {colorAdj.brightness > 0 ? `+${colorAdj.brightness}` : colorAdj.brightness}
              </span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={colorAdj.brightness}
              onChange={(e) => onUpdateColor('brightness', parseInt(e.target.value, 10))}
              className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>

          {/* Contrast */}
          <div className="bg-zinc-100/60 dark:bg-zinc-800/40 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/40 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium text-[11px]">
                <Contrast className="w-3.5 h-3.5 opacity-70" />
                Contrast
              </span>
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {colorAdj.contrast > 0 ? `+${colorAdj.contrast}` : colorAdj.contrast}
              </span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={colorAdj.contrast}
              onChange={(e) => onUpdateColor('contrast', parseInt(e.target.value, 10))}
              className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>

          {/* Saturation */}
          <div className="bg-zinc-100/60 dark:bg-zinc-800/40 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/40 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium text-[11px]">
                <Droplets className="w-3.5 h-3.5 opacity-70" />
                Saturation
              </span>
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {colorAdj.saturation > 0 ? `+${colorAdj.saturation}` : colorAdj.saturation}
              </span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={colorAdj.saturation}
              onChange={(e) => onUpdateColor('saturation', parseInt(e.target.value, 10))}
              className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>

          {/* Vibrance */}
          <div className="bg-zinc-100/60 dark:bg-zinc-800/40 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/40 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium text-[11px]">
                <Sparkles className="w-3.5 h-3.5 opacity-70" />
                Vibrance
              </span>
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {colorAdj.vibrance}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={colorAdj.vibrance}
              onChange={(e) => onUpdateColor('vibrance', parseInt(e.target.value, 10))}
              className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>

          {/* Temperature */}
          <div className="bg-zinc-100/60 dark:bg-zinc-800/40 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/40 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium text-[11px]">
                <Flame className="w-3.5 h-3.5 opacity-70" />
                Temperature (Cool / Warm)
              </span>
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {colorAdj.temperature > 0 ? `+${colorAdj.temperature}` : colorAdj.temperature}
              </span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={colorAdj.temperature}
              onChange={(e) => onUpdateColor('temperature', parseInt(e.target.value, 10))}
              className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
