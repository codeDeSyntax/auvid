// ─── VideoSettingsPanel.tsx ──────────────────────────────────────────────────
// Full-featured settings sidebar for configuring video compression parameters.

import React from 'react';
import {
  Sliders, Zap, Cpu, HardDrive, Sparkles, Film,
  Volume2, VolumeX, Shield, Check, Info, Gauge
} from 'lucide-react';
import {
  VideoCompressSettings,
  VideoCompressMode,
  VideoCodec,
  VideoContainer,
  VideoResolution,
  VideoFps,
  VideoAudioCodec,
  VIDEO_COMPRESS_PRESETS,
  HWAccelInfo,
} from '@/types/videoCompressor';

interface VideoSettingsPanelProps {
  settings: VideoCompressSettings;
  onChange: (newSettings: VideoCompressSettings) => void;
  hwInfo: HWAccelInfo | null;
  accentColor: string;
}

export const VideoSettingsPanel: React.FC<VideoSettingsPanelProps> = ({
  settings,
  onChange,
  hwInfo,
  accentColor,
}) => {
  const update = (partial: Partial<VideoCompressSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const applyPreset = (presetId: string) => {
    const preset = VIDEO_COMPRESS_PRESETS.find(p => p.id === presetId);
    if (preset) {
      onChange({ ...settings, ...preset.settings });
    }
  };

  return (
    <div className="w-80 shrink-0 border-l border-zinc-200/80 dark:border-zinc-800/70 flex flex-col overflow-hidden bg-white/40 dark:bg-zinc-900/30">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/60 dark:bg-zinc-900/40 shrink-0 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Compression Settings
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">

        {/* ── 1. Presets Selector ── */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Target Presets</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {VIDEO_COMPRESS_PRESETS.slice(0, 6).map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className="px-2.5 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white/80 dark:bg-zinc-800/40 text-left transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                    {preset.name}
                  </span>
                  {preset.badge && (
                    <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                      {preset.badge}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800/60" />

        {/* ── 2. Compression Mode ── */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Compression Mode
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl">
            {(['targetSize', 'percentage', 'crf', 'bitrate'] as VideoCompressMode[]).map(m => {
              const titles: Record<VideoCompressMode, string> = {
                targetSize: 'Target Size',
                percentage: 'Percentage',
                crf: 'Quality (CRF)',
                bitrate: 'Custom Bitrate',
              };
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => update({ mode: m })}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    settings.mode === m
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {titles[m]}
                </button>
              );
            })}
          </div>

          {/* Mode Controls */}
          {settings.mode === 'targetSize' && (
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Target Maximum Size</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min={0.1}
                    max={5000}
                    step={0.5}
                    value={settings.targetSizeMB}
                    onChange={e => update({ targetSizeMB: parseFloat(e.target.value) || 1 })}
                    className="w-16 px-2 py-0.5 text-right font-mono font-bold text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                  <select
                    value={settings.targetSizeUnit}
                    onChange={e => update({ targetSizeUnit: e.target.value as 'MB' | 'KB' })}
                    className="px-1.5 py-0.5 text-[10px] font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  >
                    <option value="MB">MB</option>
                    <option value="KB">KB</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                Calculates precise 2-pass bitrate based on video length to fit under {settings.targetSizeMB} {settings.targetSizeUnit}.
              </p>
            </div>
          )}

          {settings.mode === 'percentage' && (
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Reduction Level</span>
                <span className="font-mono font-bold" style={{ color: accentColor }}>
                  {settings.percentageReduction}% smaller
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={95}
                step={5}
                value={settings.percentageReduction}
                onChange={e => update({ percentageReduction: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor }}
              />
              <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                <span>Light (25%)</span>
                <span>Balanced (50%)</span>
                <span>Heavy (80%)</span>
              </div>
            </div>
          )}

          {settings.mode === 'crf' && (
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Constant Rate Factor (CRF)</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                  {settings.crf} {settings.crf <= 18 ? '(Near Lossless)' : settings.crf >= 32 ? '(High Compression)' : '(Optimal)'}
                </span>
              </div>
              <input
                type="range"
                min={16}
                max={42}
                step={1}
                value={settings.crf}
                onChange={e => update({ crf: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor }}
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                Lower CRF = higher quality &amp; larger file. Recommended: 23 for H.264, 28 for H.265.
              </p>
            </div>
          )}

          {settings.mode === 'bitrate' && (
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Video Bitrate</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min={100}
                    max={20000}
                    step={100}
                    value={settings.videoBitrateKbps}
                    onChange={e => update({ videoBitrateKbps: parseInt(e.target.value, 10) || 500 })}
                    className="w-20 px-2 py-0.5 text-right font-mono font-bold text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                  <span className="text-[10px] text-zinc-400 font-mono">kbps</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800/60" />

        {/* ── 3. Video Codec & Container ── */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Video Codec
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['h264', 'hevc', 'av1', 'vp9'] as VideoCodec[]).map(c => (
              <button
                key={c}
                type="button"
                onClick={() => update({ codec: c, container: c === 'vp9' ? 'webm' : settings.container })}
                className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  settings.codec === c
                    ? 'text-black shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                style={settings.codec === c ? { backgroundColor: accentColor } : {}}
              >
                {c === 'hevc' ? 'H.265' : c === 'h264' ? 'H.264' : c.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Hardware Acceleration Switch */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-zinc-500" />
              <div>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {settings.useHWAccel ? 'GPU HW Acceleration' : 'CPU Max Density'}
                </p>
                <p className="text-[9px] text-zinc-400">
                  {settings.useHWAccel ? 'Fast hardware encoding (NVENC/QSV)' : 'Slow software encode (Smallest sizes)'}
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.useHWAccel}
              onChange={e => update({ useHWAccel: e.target.checked })}
              className="w-4 h-4 rounded cursor-pointer"
              style={{ accentColor }}
            />
          </div>
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800/60" />

        {/* ── 4. Resolution & FPS Scaling ── */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Resolution Scaling
          </label>
          <div className="grid grid-cols-4 gap-1">
            {(['original', '1080p', '720p', '480p', '360p', '240p'] as VideoResolution[]).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => update({ resolution: r })}
                className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  settings.resolution === r
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                }`}
              >
                {r === 'original' ? 'Source' : r}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Target Frame Rate</span>
            <select
              value={settings.fps}
              onChange={e => update({ fps: e.target.value === 'original' ? 'original' : parseInt(e.target.value, 10) as VideoFps })}
              className="px-2 py-1 text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
            >
              <option value="original">Keep Source FPS</option>
              <option value={60}>60 fps (Smooth)</option>
              <option value={30}>30 fps (Standard)</option>
              <option value={24}>24 fps (Cinema)</option>
              <option value={15}>15 fps (Micro Size)</option>
            </select>
          </div>
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800/60" />

        {/* ── 5. Audio Settings ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
              <Volume2 className="w-3 h-3 text-zinc-400" />
              <span>Audio Optimization</span>
            </label>
            <button
              type="button"
              onClick={() => update({ audioCodec: settings.audioCodec === 'mute' ? 'aac' : 'mute' })}
              className={`text-[10px] font-bold cursor-pointer ${settings.audioCodec === 'mute' ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              {settings.audioCodec === 'mute' ? 'Muted (Stripped)' : 'Mute Track'}
            </button>
          </div>

          {settings.audioCodec !== 'mute' && (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1">
                {(['aac', 'opus', 'mp3', 'copy'] as VideoAudioCodec[]).map(ac => (
                  <button
                    key={ac}
                    type="button"
                    onClick={() => update({ audioCodec: ac })}
                    className={`py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      settings.audioCodec === ac
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                    }`}
                  >
                    {ac}
                  </button>
                ))}
              </div>

              {settings.audioCodec !== 'copy' && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Audio Bitrate</span>
                  <select
                    value={settings.audioBitrateKbps}
                    onChange={e => update({ audioBitrateKbps: parseInt(e.target.value, 10) })}
                    className="px-2 py-1 text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                  >
                    <option value={32}>32 kbps (Speech/Tiny)</option>
                    <option value={64}>64 kbps (Low)</option>
                    <option value={96}>96 kbps (Voice/Web)</option>
                    <option value={128}>128 kbps (Standard)</option>
                    <option value={192}>192 kbps (High)</option>
                    <option value={320}>320 kbps (Studio)</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
