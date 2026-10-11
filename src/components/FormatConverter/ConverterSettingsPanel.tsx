// ─── ConverterSettingsPanel.tsx ──────────────────────────────────────────────
// Settings sidebar for configuring fine-tuned audio, video, and GIF conversion parameters.
// Styled to match AudioSettingsPanel with sleek CustomDropdowns, segmented bars,
// and compact vertical lists.

import React from 'react';
import {
  Volume2, Video, Sparkles, Cpu, Image as ImageIcon, Info
} from 'lucide-react';
import { ConverterSettings, TargetFormat } from '@/types/formatConverter';
import { CustomDropdown, DropdownOption } from '@/components/common/CustomDropdown';

interface ConverterSettingsPanelProps {
  settings: ConverterSettings;
  onChange: (newSettings: ConverterSettings) => void;
  selectedFormat: TargetFormat;
  accentColor: string;
}

const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5';

const AUDIO_BITRATE_OPTIONS: DropdownOption<number>[] = [
  { value: 0, label: 'Auto (Match Source)', badge: 'Auto' },
  { value: 64, label: '64 kbps (Voice / Speech)', badge: '64k' },
  { value: 96, label: '96 kbps (Compact Audio)', badge: '96k' },
  { value: 128, label: '128 kbps (Standard MP3)', badge: '128k' },
  { value: 192, label: '192 kbps (High Quality)', badge: '192k' },
  { value: 256, label: '256 kbps (Near Lossless)', badge: '256k' },
  { value: 320, label: '320 kbps (Studio MP3/AAC)', badge: '320k' },
];

const SAMPLE_RATE_OPTIONS: DropdownOption<number>[] = [
  { value: 0, label: 'Original (Keep Source)', badge: 'Auto' },
  { value: 44100, label: '44.1 kHz (CD Standard)', badge: '44.1k' },
  { value: 48000, label: '48.0 kHz (Studio Video)', badge: '48k' },
  { value: 96000, label: '96.0 kHz (Hi-Res Audio)', badge: '96k' },
  { value: 22050, label: '22.05 kHz (Compact Voice)', badge: '22k' },
];

const AUDIO_CHANNELS: { value: 'original' | 'stereo' | 'mono'; label: string; badge: string; sublabel: string }[] = [
  { value: 'original', label: 'Original Channels', badge: 'Auto', sublabel: 'Keep source channel configuration' },
  { value: 'stereo', label: 'Stereo (2.0)', badge: '2 Channels', sublabel: 'Standard left/right channel audio' },
  { value: 'mono', label: 'Mono (1.0)', badge: '1 Channel', sublabel: 'Downmix to single channel for size reduction' },
];

const VIDEO_CODECS: { value: 'auto' | 'h264' | 'hevc' | 'av1'; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'h264', label: 'H.264' },
  { value: 'hevc', label: 'H.265' },
  { value: 'av1', label: 'AV1' },
];

const VIDEO_RESOLUTIONS: DropdownOption<'original' | '4k' | '2k' | '1080p' | '720p' | '480p' | '360p'>[] = [
  { value: 'original', label: 'Source Resolution', badge: 'Source' },
  { value: '1080p', label: '1080p Full HD (1920×1080)', badge: 'FHD' },
  { value: '720p', label: '720p HD (1280×720)', badge: 'HD' },
  { value: '480p', label: '480p SD (854×480)', badge: 'SD' },
  { value: '360p', label: '360p Mobile (640×360)', badge: '360p' },
];

const VIDEO_FPS_OPTIONS: DropdownOption<'original' | 60 | 30 | 24 | 15>[] = [
  { value: 'original', label: 'Keep Source FPS', badge: 'Source' },
  { value: 60, label: '60 fps (Smooth)', badge: '60 FPS' },
  { value: 30, label: '30 fps (Standard)', badge: '30 FPS' },
  { value: 24, label: '24 fps (Cinema)', badge: '24 FPS' },
  { value: 15, label: '15 fps (Micro Size)', badge: '15 FPS' },
];

export const ConverterSettingsPanel: React.FC<ConverterSettingsPanelProps> = ({
  settings,
  onChange,
  selectedFormat,
  accentColor,
}) => {
  const update = (partial: Partial<ConverterSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const isGif = selectedFormat === 'gif';
  const isAudio = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'alac', 'ac3'].includes(selectedFormat);

  return (
    <aside className="w-72 min-w-[260px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-md border-l border-zinc-200/80 dark:border-zinc-800/70 flex flex-col overflow-hidden transition-colors duration-200">
      {/* Panel header */}
      <div className="px-4 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/70 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Conversion Parameters</h3>
        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
          .{selectedFormat}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
        {/* ── GIF Specific Settings ── */}
        {isGif && (
          <div className="space-y-3">
            <div className="flex items-center space-x-1.5 pb-1 border-b border-zinc-200/80 dark:border-zinc-800/60">
              <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
              <label className={labelClass}>Animated GIF Parameters</label>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Frame Rate (FPS)</span>
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
                  {settings.gifFps} fps
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={30}
                step={1}
                value={settings.gifFps}
                onChange={e => update({ gifFps: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Max Canvas Width</span>
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
                  {settings.gifWidth}px
                </span>
              </div>
              <input
                type="range"
                min={240}
                max={720}
                step={40}
                value={settings.gifWidth}
                onChange={e => update({ gifWidth: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
            </div>

            {/* GIF Quality Segmented Bar */}
            <div>
              <label className={labelClass}>Palette Quality</label>
              <div className="p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl flex items-center gap-1 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs">
                {(['high', 'standard'] as ('high' | 'standard')[]).map(q => {
                  const isSelected = settings.gifQuality === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => update({ gifQuality: q })}
                      className={`flex-1 py-1.5 px-1 rounded-xl text-[11px] font-bold text-center capitalize transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/60 dark:border-zinc-700/60'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                      style={isSelected ? { color: 'var(--accent)' } : undefined}
                    >
                      {q === 'high' ? 'High (Diffused)' : 'Standard'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Audio Settings (Audio files or Video soundtracks) ── */}
        {!isGif && (
          <div className="space-y-4">
            <div className="flex items-center space-x-1.5 pb-1 border-b border-zinc-200/80 dark:border-zinc-800/60">
              <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
              <label className={labelClass}>Audio Configuration</label>
            </div>

            {/* Audio Bitrate Custom Dropdown */}
            <CustomDropdown<number>
              label="Audio Bitrate"
              value={settings.audioBitrate}
              options={AUDIO_BITRATE_OPTIONS}
              onChange={b => update({ audioBitrate: b })}
            />

            {/* Sample Rate Custom Dropdown (opens upwards) */}
            <CustomDropdown<number>
              label="Sample Rate"
              value={settings.audioSampleRate}
              options={SAMPLE_RATE_OPTIONS}
              onChange={sr => update({ audioSampleRate: sr })}
              placement="top"
            />

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

        {/* ── Video Specific Settings (Only for Video Target) ── */}
        {!isAudio && !isGif && (
          <div className="space-y-4 pt-1 border-t border-zinc-200/80 dark:border-zinc-800/70">
            <div className="flex items-center space-x-1.5 pb-1 border-b border-zinc-200/80 dark:border-zinc-800/60">
              <Video className="w-3.5 h-3.5 text-zinc-400" />
              <label className={labelClass}>Video Stream Settings</label>
            </div>

            {/* Video Codec Segmented Bar */}
            <div>
              <label className={labelClass}>Video Codec</label>
              <div className="p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl flex items-center gap-1 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs">
                {VIDEO_CODECS.map(c => {
                  const isSelected = settings.videoCodec === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => update({ videoCodec: c.value })}
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
            </div>

            {/* Resolution Scaling Custom Dropdown */}
            <CustomDropdown<'original' | '4k' | '2k' | '1080p' | '720p' | '480p' | '360p'>
              label="Resolution Scaling"
              value={settings.videoResolution}
              options={VIDEO_RESOLUTIONS}
              onChange={res => update({ videoResolution: res })}
            />

            {/* Visual Quality (CRF) Slider */}
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Quality (CRF)</span>
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
                  {settings.videoCrf} {settings.videoCrf <= 18 ? '(Lossless)' : settings.videoCrf >= 30 ? '(Small)' : '(Optimal)'}
                </span>
              </div>
              <input
                type="range"
                min={16}
                max={38}
                step={1}
                value={settings.videoCrf}
                onChange={e => update({ videoCrf: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
                Recommended: 23 for H.264, 28 for H.265. Lower = higher quality.
              </p>
            </div>

            {/* Target FPS Custom Dropdown (opens upwards) */}
            <CustomDropdown<'original' | 60 | 30 | 24 | 15>
              label="Target Frame Rate"
              value={settings.videoFps}
              options={VIDEO_FPS_OPTIONS}
              onChange={fps => update({ videoFps: fps })}
              placement="top"
            />

            {/* Hardware Acceleration Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800/60">
              <div className="flex items-center space-x-2">
                <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                <div>
                  <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                    {settings.useHWAccel ? 'GPU HW Acceleration' : 'CPU Software Encoding'}
                  </p>
                  <p className="text-[9px] text-zinc-400">
                    {settings.useHWAccel ? 'High speed hardware encoding' : 'CPU density encode (smaller)'}
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
        )}
      </div>
    </aside>
  );
};
