// ─── VideoSettingsPanel.tsx ──────────────────────────────────────────────────
// Streamlined settings sidebar for configuring video compression parameters.
// Styled to match AudioSettingsPanel with sleek CustomDropdowns, segmented bars,
// and compact vertical lists.

import React from 'react';
import {
  Cpu, Volume2, Shield, Check, Info
} from 'lucide-react';
import {
  VideoCompressSettings,
  VideoCompressMode,
  VideoCodec,
  VideoResolution,
  VideoFps,
  VideoAudioCodec,
  HWAccelInfo,
} from '@/types/videoCompressor';
import { CustomDropdown, DropdownOption } from '@/components/common/CustomDropdown';

interface VideoSettingsPanelProps {
  settings: VideoCompressSettings;
  onChange: (newSettings: VideoCompressSettings) => void;
  hwInfo: HWAccelInfo | null;
  accentColor: string;
}

const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5';

const MODES: { value: VideoCompressMode; label: string; badge: string; desc: string }[] = [
  { value: 'percentage', label: 'Target %', badge: 'Smart %', desc: 'Compress to a percentage of original size' },
  { value: 'crf', label: 'Quality', badge: 'CRF Level', desc: 'Perceptual constant rate factor' },
  { value: 'targetSize', label: 'Size (MB)', badge: 'Exact Size', desc: 'Target exact output file size in MB' },
  { value: 'bitrate', label: 'Bitrate', badge: 'Manual kbps', desc: 'Directly set video bitrate' },
];

const CODECS: { value: VideoCodec; label: string }[] = [
  { value: 'h264', label: 'H.264' },
  { value: 'hevc', label: 'H.265' },
  { value: 'av1', label: 'AV1' },
  { value: 'vp9', label: 'VP9' },
];

const RESOLUTION_OPTIONS: DropdownOption<VideoResolution>[] = [
  { value: 'original', label: 'Source Resolution', badge: 'Original' },
  { value: '1080p', label: '1080p Full HD (1920×1080)', badge: 'FHD' },
  { value: '720p', label: '720p HD (1280×720)', badge: 'HD' },
  { value: '480p', label: '480p SD (854×480)', badge: 'SD' },
  { value: '360p', label: '360p Mobile (640×360)', badge: '360p' },
  { value: '240p', label: '240p Compact (426×240)', badge: '240p' },
];

const FPS_OPTIONS: DropdownOption<VideoFps | 'original'>[] = [
  { value: 'original', label: 'Keep Source FPS', badge: 'Source' },
  { value: 60, label: '60 fps (Smooth)', badge: '60 FPS' },
  { value: 30, label: '30 fps (Standard)', badge: '30 FPS' },
  { value: 24, label: '24 fps (Cinema)', badge: '24 FPS' },
  { value: 15, label: '15 fps (Micro Size)', badge: '15 FPS' },
];

const AUDIO_CODECS: { value: VideoAudioCodec; label: string }[] = [
  { value: 'aac', label: 'AAC' },
  { value: 'opus', label: 'Opus' },
  { value: 'mp3', label: 'MP3' },
  { value: 'copy', label: 'Copy' },
];

const AUDIO_BITRATE_OPTIONS: DropdownOption<number>[] = [
  { value: 32, label: '32 kbps (Speech/Tiny)', badge: '32k' },
  { value: 64, label: '64 kbps (Low)', badge: '64k' },
  { value: 96, label: '96 kbps (Voice/Web)', badge: '96k' },
  { value: 128, label: '128 kbps (Standard)', badge: '128k' },
  { value: 192, label: '192 kbps (High)', badge: '192k' },
  { value: 320, label: '320 kbps (Studio)', badge: '320k' },
];

const AUDIO_CHANNELS: { value: 'original' | 'stereo' | 'mono'; label: string; badge: string; sublabel: string }[] = [
  { value: 'original', label: 'Original Channels', badge: 'Auto', sublabel: 'Keep source channel configuration' },
  { value: 'stereo', label: 'Stereo (2.0)', badge: '2 Channels', sublabel: 'Standard left/right channel audio' },
  { value: 'mono', label: 'Mono (1.0)', badge: '1 Channel', sublabel: 'Downmix to single channel for size reduction' },
];

export const VideoSettingsPanel: React.FC<VideoSettingsPanelProps> = ({
  settings,
  onChange,
  hwInfo,
  accentColor,
}) => {
  const update = (partial: Partial<VideoCompressSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const percentFill = ((settings.percentageReduction - 10) / 85) * 100;

  return (
    <aside className="w-72 min-w-[260px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-md border-l border-zinc-200/80 dark:border-zinc-800/70 flex flex-col overflow-hidden transition-colors duration-200">
      {/* Panel header */}
      <div className="px-4 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/70 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Compression Settings</h3>
        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
          .{settings.container}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
        {/* ── 1. Compression Mode Segmented Bar ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelClass}>Compression Mode</label>
            <span className="text-[10px] font-bold text-zinc-400">
              {MODES.find(m => m.value === settings.mode)?.badge}
            </span>
          </div>
          <div className="p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl flex items-center gap-1 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs">
            {MODES.map(m => {
              const isSelected = settings.mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => update({ mode: m.value })}
                  title={m.desc}
                  className={`flex-1 py-1.5 px-1 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer truncate ${
                    isSelected
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/60 dark:border-zinc-700/60'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                  style={isSelected ? { color: 'var(--accent)' } : undefined}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode-specific controls */}
        {settings.mode === 'percentage' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Reduction Target</label>
              <span className="font-black text-xs px-2.5 py-1 rounded-xl bg-zinc-900 text-white dark:bg-cyan-500/20 dark:text-cyan-400 dark:border dark:border-cyan-500/30 shadow-xs">
                {settings.percentageReduction}% smaller
              </span>
            </div>

            {/* Slider with high-visibility fill track */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2.5">
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 w-7 shrink-0 text-left">10%</span>
                <div className="flex-1 relative flex items-center">
                  <input
                    type="range"
                    min={10}
                    max={95}
                    step={5}
                    value={settings.percentageReduction}
                    onChange={e => update({ percentageReduction: parseInt(e.target.value, 10) })}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-zinc-200 dark:bg-zinc-700 accent-zinc-900 dark:accent-cyan-400"
                    style={{
                      background: `linear-gradient(to right, #06B6D4 0%, #06B6D4 ${percentFill}%, rgb(228 228 231) ${percentFill}%, rgb(228 228 231) 100%)`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 w-7 shrink-0 text-right">95%</span>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex items-center justify-between gap-1 pt-0.5">
                {[25, 50, 75, 85].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => update({ percentageReduction: pct })}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      settings.percentageReduction === pct
                        ? 'bg-zinc-900 text-white dark:bg-cyan-500 dark:text-black shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {settings.mode === 'crf' && (
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                CRF Quality Level
              </label>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
                {settings.crf} {settings.crf <= 18 ? '(Lossless)' : settings.crf >= 32 ? '(Small)' : '(Optimal)'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-zinc-400 w-11 text-left shrink-0 font-medium">16 (HQ)</span>
              <input
                type="range"
                min={16}
                max={42}
                step={1}
                value={settings.crf}
                onChange={e => update({ crf: parseInt(e.target.value, 10) })}
                className="flex-1 h-1.5 appearance-none rounded-full outline-none cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-[10px] text-zinc-400 w-11 text-right shrink-0 font-medium">42 (Tiny)</span>
            </div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
              Lower CRF = higher quality & larger size. Recommended: 23 for H.264, 28 for H.265.
            </p>
          </div>
        )}

        {settings.mode === 'targetSize' && (
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Target Maximum Size
              </label>
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
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                >
                  <option value="MB">MB</option>
                  <option value="KB">KB</option>
                </select>
              </div>
            </div>

            {/* Quick Presets for Target Size */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              {[8, 16, 25, 50].map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => update({ targetSizeMB: sz, targetSizeUnit: 'MB' })}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    settings.targetSizeMB === sz && settings.targetSizeUnit === 'MB'
                      ? 'bg-zinc-900 text-white dark:bg-cyan-500 dark:text-black shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60'
                  }`}
                >
                  {sz}MB
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
              Calculates 2-pass bitrate automatically to guarantee output fits under {settings.targetSizeMB} {settings.targetSizeUnit}.
            </p>
          </div>
        )}

        {settings.mode === 'bitrate' && (
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Target Bitrate
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={100}
                  max={25000}
                  step={100}
                  value={settings.videoBitrateKbps}
                  onChange={e => update({ videoBitrateKbps: parseInt(e.target.value, 10) || 500 })}
                  className="w-20 px-2 py-0.5 text-right font-mono font-bold text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                />
                <span className="text-[10px] text-zinc-400 font-mono">kbps</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1 pt-0.5">
              {[500, 1000, 2500, 5000].map(kb => (
                <button
                  key={kb}
                  type="button"
                  onClick={() => update({ videoBitrateKbps: kb })}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    settings.videoBitrateKbps === kb
                      ? 'bg-zinc-900 text-white dark:bg-cyan-500 dark:text-black shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60'
                  }`}
                >
                  {kb >= 1000 ? `${kb / 1000}M` : `${kb}k`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 2. Video Codec Segmented Bar ── */}
        <div>
          <label className={labelClass}>Video Codec</label>
          <div className="p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl flex items-center gap-1 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs">
            {CODECS.map(c => {
              const isSelected = settings.codec === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => update({ codec: c.value, container: c.value === 'vp9' ? 'webm' : settings.container })}
                  className={`flex-1 py-1.5 px-1 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer truncate ${
                    isSelected
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/60 dark:border-zinc-700/60'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                  style={isSelected ? { color: 'var(--accent)' } : undefined}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Hardware Acceleration Toggle */}
          <div className="mt-2 flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800/60">
            <div className="flex items-center space-x-2">
              <Cpu className="w-3.5 h-3.5 text-zinc-500" />
              <div>
                <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                  {settings.useHWAccel ? 'GPU HW Acceleration' : 'CPU Max Density'}
                </p>
                <p className="text-[9px] text-zinc-400">
                  {settings.useHWAccel ? 'Fast hardware encoding' : 'Slow software encode (smallest)'}
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.useHWAccel}
              onChange={e => update({ useHWAccel: e.target.checked })}
              className="w-4 h-4 rounded cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>
        </div>

        {/* ── 3. Resolution Scaling Custom Dropdown ── */}
        <CustomDropdown<VideoResolution>
          label="Resolution Scaling"
          value={settings.resolution}
          options={RESOLUTION_OPTIONS}
          onChange={res => update({ resolution: res })}
        />

        {/* ── 4. Target Frame Rate Custom Dropdown (opens upwards) ── */}
        <CustomDropdown<VideoFps | 'original'>
          label="Frame Rate (FPS)"
          value={settings.fps}
          options={FPS_OPTIONS}
          onChange={f => update({ fps: f })}
          placement="top"
        />

        {/* ── 5. Audio Settings ── */}
        <div className="space-y-3 pt-1 border-t border-zinc-200/80 dark:border-zinc-800/70">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Audio Optimization</label>
            <button
              type="button"
              onClick={() => update({ audioCodec: settings.audioCodec === 'mute' ? 'aac' : 'mute' })}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                settings.audioCodec === 'mute'
                  ? 'bg-red-500/15 text-red-500 border border-red-500/30'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
              }`}
            >
              {settings.audioCodec === 'mute' ? 'Muted (Stripped)' : 'Mute Track'}
            </button>
          </div>

          {settings.audioCodec !== 'mute' && (
            <div className="space-y-3">
              {/* Audio Codec Segmented Bar */}
              <div>
                <label className={labelClass}>Audio Codec</label>
                <div className="p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl flex items-center gap-1 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs">
                  {AUDIO_CODECS.map(ac => {
                    const isSelected = settings.audioCodec === ac.value;
                    return (
                      <button
                        key={ac.value}
                        type="button"
                        onClick={() => update({ audioCodec: ac.value })}
                        className={`flex-1 py-1.5 px-1 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer truncate ${
                          isSelected
                            ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/60 dark:border-zinc-700/60'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                        }`}
                        style={isSelected ? { color: 'var(--accent)' } : undefined}
                      >
                        {ac.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Audio Bitrate Custom Dropdown (opens upwards) */}
              {settings.audioCodec !== 'copy' && (
                <CustomDropdown<number>
                  label="Audio Bitrate"
                  value={settings.audioBitrateKbps}
                  options={AUDIO_BITRATE_OPTIONS}
                  onChange={b => update({ audioBitrateKbps: b })}
                  placement="top"
                />
              )}

              {/* Audio Channels Vertical List */}
              <div>
                <label className={labelClass}>Audio Channels</label>
                <div className="flex flex-col gap-[1px]">
                  {AUDIO_CHANNELS.map(ch => {
                    const isSelected = settings.audioChannels === ch.value;
                    return (
                      <button
                        key={ch.value}
                        type="button"
                        onClick={() => update({ audioChannels: ch.value })}
                        className={`w-full px-2.5 py-1.5 text-left flex flex-col items-start gap-0.5 transition-colors cursor-pointer border-b border-solid border-zinc-200/80 dark:border-zinc-700/60 ${
                          isSelected
                            ? 'bg-zinc-100/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 font-medium'
                        }`}
                      >
                        <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                          {ch.label}
                        </span>
                        <div className="flex items-center gap-1.5 w-full">
                          <span
                            className={`text-[9px] font-mono font-bold uppercase px-1 py-0.2 tracking-wider ${
                              isSelected
                                ? 'bg-zinc-900 text-white dark:bg-cyan-500 dark:text-black'
                                : 'bg-zinc-200/80 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {ch.badge}
                          </span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate leading-tight">
                            {ch.sublabel}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
