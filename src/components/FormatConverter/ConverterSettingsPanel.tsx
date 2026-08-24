// ─── ConverterSettingsPanel.tsx ──────────────────────────────────────────────
// Settings sidebar for configuring fine-tuned audio, video, and GIF conversion parameters.

import React from 'react';
import {
  Sliders, Volume2, Video, Sparkles, Cpu,
  Film, Image, Shield, Check, Info
} from 'lucide-react';
import { ConverterSettings, TargetFormat } from '@/types/formatConverter';

interface ConverterSettingsPanelProps {
  settings: ConverterSettings;
  onChange: (newSettings: ConverterSettings) => void;
  selectedFormat: TargetFormat;
  accentColor: string;
}

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
    <div className="w-80 shrink-0 border-l border-zinc-200/80 dark:border-zinc-800/70 flex flex-col overflow-hidden bg-white/40 dark:bg-zinc-900/30">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/60 dark:bg-zinc-900/40 shrink-0 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Conversion Parameters
        </span>
        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
          .{selectedFormat}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">

        {/* ── GIF Specific Settings ── */}
        {isGif && (
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
              <Image className="w-3 h-3 text-amber-500" />
              <span>Animated GIF Settings</span>
            </label>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Frame Rate (FPS)</span>
                <span className="font-mono font-bold">{settings.gifFps} fps</span>
              </div>
              <input
                type="range"
                min={10}
                max={30}
                step={1}
                value={settings.gifFps}
                onChange={e => update({ gifFps: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor }}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Max Width</span>
                <span className="font-mono font-bold">{settings.gifWidth}px</span>
              </div>
              <input
                type="range"
                min={240}
                max={720}
                step={40}
                value={settings.gifWidth}
                onChange={e => update({ gifWidth: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor }}
              />
            </div>
          </div>
        )}

        {/* ── Audio Settings (Audio files or Video soundtracks) ── */}
        {!isGif && (
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
              <Volume2 className="w-3 h-3 text-zinc-400" />
              <span>Audio Configuration</span>
            </label>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Audio Bitrate</span>
                <span className="font-mono font-bold">
                  {settings.audioBitrate === 0 ? 'Auto (Source)' : `${settings.audioBitrate} kbps`}
                </span>
              </div>
              <select
                value={settings.audioBitrate}
                onChange={e => update({ audioBitrate: parseInt(e.target.value, 10) })}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl cursor-pointer"
              >
                <option value={0}>Auto (Match Source — Same Size)</option>
                <option value={64}>64 kbps (Voice / Speech)</option>
                <option value={96}>96 kbps (Compact Audio)</option>
                <option value={128}>128 kbps (Standard MP3)</option>
                <option value={192}>192 kbps (High Quality)</option>
                <option value={256}>256 kbps (Near Lossless)</option>
                <option value={320}>320 kbps (Studio MP3/AAC)</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Sample Rate</span>
                <span className="font-mono font-bold">
                  {settings.audioSampleRate === 0 ? 'Original' : `${settings.audioSampleRate / 1000} kHz`}
                </span>
              </div>
              <select
                value={settings.audioSampleRate}
                onChange={e => update({ audioSampleRate: parseInt(e.target.value, 10) })}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl cursor-pointer"
              >
                <option value={0}>Original (Keep Source Sample Rate)</option>
                <option value={44100}>44.1 kHz (CD Standard)</option>
                <option value={48000}>48.0 kHz (Studio Video)</option>
                <option value={96000}>96.0 kHz (Hi-Res Audio)</option>
                <option value={22050}>22.05 kHz (Compact)</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Channels</span>
                <span className="font-mono font-bold capitalize">{settings.audioChannels}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['original', 'stereo', 'mono'] as ('original' | 'stereo' | 'mono')[]).map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => update({ audioChannels: ch })}
                    className={`py-1 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                      settings.audioChannels === ch
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Video Specific Settings (Only for Video Target) ── */}
        {!isAudio && !isGif && (
          <>
            <div className="h-px bg-zinc-100 dark:bg-zinc-800/60" />

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
                <Video className="w-3 h-3 text-zinc-400" />
                <span>Video Stream Settings</span>
              </label>

              <div className="space-y-1">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Resolution Scaling</span>
                <div className="grid grid-cols-4 gap-1">
                  {(['original', '1080p', '720p', '480p'] as ('original' | '1080p' | '720p' | '480p')[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => update({ videoResolution: r })}
                      className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        settings.videoResolution === r
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                      }`}
                    >
                      {r === 'original' ? 'Source' : r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">Visual Quality (CRF)</span>
                  <span className="font-mono font-bold">{settings.videoCrf}</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={38}
                  step={1}
                  value={settings.videoCrf}
                  onChange={e => update({ videoCrf: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor }}
                />
              </div>

              <div className="space-y-1">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Video Codec</span>
                <div className="grid grid-cols-4 gap-1">
                  {(['auto', 'h264', 'hevc', 'av1'] as ('auto' | 'h264' | 'hevc' | 'av1')[]).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => update({ videoCodec: c })}
                      className={`py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        settings.videoCodec === c
                          ? 'text-black shadow-xs font-black'
                          : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                      }`}
                      style={settings.videoCodec === c ? { backgroundColor: accentColor } : {}}
                    >
                      {c === 'hevc' ? 'H.265' : c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
