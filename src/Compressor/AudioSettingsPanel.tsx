// ─── Audio Settings Panel ─────────────────────────────────────────────────────
// Right-side panel with compression controls. Reused for per-file & global modes.
// Streamlined with sleek CustomDropdowns and compact, clean controls.

import React from 'react';
import {
  AudioCompressSettings,
  AudioFormat,
  CompressionMode,
  BitrateMode,
  BITRATE_PRESETS,
  SAMPLE_RATE_OPTIONS,
  SampleRate,
  AudioFileEntry,
} from '@/types/audioCompressor';
import { CustomDropdown, DropdownOption } from '@/components/common/CustomDropdown';

const FORMAT_OPTIONS: DropdownOption<AudioFormat>[] = [
  { value: 'mp3', label: 'MP3 Audio (.mp3)', badge: 'Universal' },
  { value: 'aac', label: 'AAC Audio (.aac)', badge: 'Apple / Web' },
  { value: 'm4a', label: 'M4A Audio (.m4a)', badge: 'MPEG-4' },
  { value: 'flac', label: 'FLAC Lossless (.flac)', badge: 'Lossless' },
  { value: 'wav', label: 'WAV Audio (.wav)', badge: 'Raw PCM' },
  { value: 'opus', label: 'Opus Audio (.opus)', badge: 'Ultra Efficient' },
  { value: 'ogg', label: 'Ogg Vorbis (.ogg)', badge: 'Ogg' },
  { value: 'alac', label: 'Apple Lossless (.alac)', badge: 'Lossless' },
  { value: 'aiff', label: 'AIFF Audio (.aiff)', badge: 'Uncompressed' },
  { value: 'wma', label: 'Windows Media (.wma)', badge: 'WMA' },
  { value: 'ac3', label: 'Dolby Digital (.ac3)', badge: 'Surround' },
];

const MODES: { value: CompressionMode; label: string; badge: string; desc: string }[] = [
  { value: 'percentage', label: 'Target %', badge: 'Smart %', desc: 'Compress to a percentage of original size' },
  { value: 'quality', label: 'Quality', badge: 'VBR Level', desc: 'Perceptual adaptive audio quality' },
  { value: 'targetSize', label: 'Size (MB)', badge: 'Exact Size', desc: 'Target exact output file size in MB' },
  { value: 'bitrate', label: 'Bitrate', badge: 'Manual kbps', desc: 'Directly set audio bitrate' },
];

const BITRATE_OPTIONS: DropdownOption<number>[] = BITRATE_PRESETS.map(b => ({
  value: b,
  label: `${b} kbps`,
  badge: b >= 256 ? 'High' : b >= 128 ? 'Standard' : 'Compact',
}));

const BITRATE_MODES: { value: BitrateMode; label: string; badge: string; sublabel: string }[] = [
  { value: 'vbr', label: 'Variable Bitrate (VBR)', badge: 'Recommended', sublabel: 'Adaptive bitrate based on audio complexity' },
  { value: 'cbr', label: 'Constant Bitrate (CBR)', badge: 'Fixed', sublabel: 'Uniform bitrate throughout entire track' },
];

const SAMPLE_RATE_DROPDOWN_OPTIONS: DropdownOption<SampleRate | null>[] = SAMPLE_RATE_OPTIONS.map(opt => ({
  value: opt.value,
  label: opt.label,
  badge: opt.value === null ? 'Original' : `${(opt.value / 1000).toFixed(1)} kHz`,
}));

const AUDIO_CHANNELS: { value: 'stereo' | 'mono' | null; label: string; badge: string; sublabel: string }[] = [
  { value: null, label: 'Original Channels', badge: 'Auto', sublabel: 'Keep source channel configuration' },
  { value: 'stereo', label: 'Stereo (2.0)', badge: '2 Channels', sublabel: 'Standard left/right channel audio' },
  { value: 'mono', label: 'Mono (1.0)', badge: '1 Channel', sublabel: 'Downmix to single channel for size reduction' },
];

interface AudioSettingsPanelProps {
  selectedFile?: AudioFileEntry | null;
  settings: AudioCompressSettings;
  onChange: (patch: Partial<AudioCompressSettings>) => void;
  onApplyToAll?: () => void;
  onCompress?: () => void;
  isCustom?: boolean;
  onToggleCustom?: () => void;
  isCompressing?: boolean;
  estimatedSize?: string;
}

const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5';

export const AudioSettingsPanel: React.FC<AudioSettingsPanelProps> = ({
  selectedFile,
  settings,
  onChange,
  onApplyToAll,
  onCompress,
  isCustom,
  onToggleCustom,
  isCompressing,
  estimatedSize,
}) => {
  const percentFill = ((settings.percentageReduction - 5) / 90) * 100;

  return (
    <aside className="w-72 min-w-[260px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-md border-l border-zinc-200/80 dark:border-zinc-800/70 flex flex-col overflow-hidden transition-colors duration-200">
      {/* Panel header */}
      <div className="px-4 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/70 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Compression Settings</h3>
        {onToggleCustom && (
          <button
            onClick={onToggleCustom}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              isCustom
                ? 'border'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            style={
              isCustom
                ? {
                    backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                    color: 'var(--accent)',
                    borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)',
                  }
                : undefined
            }
          >
            {isCustom ? 'Custom' : 'Global'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
        {/* Output Format Custom Dropdown */}
        <CustomDropdown<AudioFormat>
          label="Output Format"
          value={settings.outputFormat}
          options={FORMAT_OPTIONS}
          onChange={fmt => onChange({ outputFormat: fmt })}
        />

        {/* Compression Mode Segmented Bar */}
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
                  onClick={() => onChange({ mode: m.value })}
                  title={m.desc}
                  className={`flex-1 py-1.5 px-1 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer truncate ${
                    isSelected
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/60 dark:border-zinc-700/60'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                  style={
                    isSelected
                      ? { color: 'var(--accent)' }
                      : undefined
                  }
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode-specific controls */}
        {settings.mode === 'quality' && (
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Quality Level
              </label>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
                {settings.qualityLevel} / 10
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-zinc-400 w-11 text-left shrink-0 font-medium">Smallest</span>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={settings.qualityLevel}
                onChange={e => onChange({ qualityLevel: Number(e.target.value) })}
                className="flex-1 h-1.5 appearance-none rounded-full outline-none cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-[10px] text-zinc-400 w-11 text-right shrink-0 font-medium">Best</span>
            </div>

            {/* VBR/CBR vertical list for mp3 */}
            {settings.outputFormat === 'mp3' && (
              <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-700/60">
                <label className={labelClass}>Bitrate Mode</label>
                <div className="flex flex-col gap-[1px]">
                  {BITRATE_MODES.map((bm) => {
                    const isSelected = settings.bitrateMode === bm.value;
                    return (
                      <button
                        key={bm.value}
                        type="button"
                        onClick={() => onChange({ bitrateMode: bm.value })}
                        className={`w-full px-2.5 py-1.5 text-left flex flex-col items-start gap-0.5 transition-colors cursor-pointer border-b border-solid border-zinc-200/80 dark:border-zinc-700/60 ${
                          isSelected
                            ? 'bg-zinc-100/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 font-medium'
                        }`}
                      >
                        <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                          {bm.label}
                        </span>
                        <div className="flex items-center gap-1.5 w-full">
                          <span
                            className={`text-[9px] font-mono font-bold uppercase px-1 py-0.2 tracking-wider ${
                              isSelected
                                ? 'bg-zinc-900 text-white dark:bg-cyan-500 dark:text-black'
                                : 'bg-zinc-200/80 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {bm.badge}
                          </span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate leading-tight">
                            {bm.sublabel}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {settings.mode === 'bitrate' && (
          <div className="space-y-3">
            {/* Target Bitrate Custom Dropdown */}
            <CustomDropdown<number>
              label="Target Bitrate"
              value={settings.bitrate}
              options={BITRATE_OPTIONS}
              onChange={b => onChange({ bitrate: b })}
            />

            {/* Bitrate Mode Vertical List */}
            <div>
              <label className={labelClass}>Bitrate Mode</label>
              <div className="flex flex-col gap-[1px]">
                {BITRATE_MODES.map((bm) => {
                  const isSelected = settings.bitrateMode === bm.value;
                  return (
                    <button
                      key={bm.value}
                      type="button"
                      onClick={() => onChange({ bitrateMode: bm.value })}
                      className={`w-full px-2.5 py-1.5 text-left flex flex-col items-start gap-0.5 transition-colors cursor-pointer border-b border-solid border-zinc-200/80 dark:border-zinc-700/60 ${
                        isSelected
                          ? 'bg-zinc-100/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 font-medium'
                      }`}
                    >
                      <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                        {bm.label}
                      </span>
                      <div className="flex items-center gap-1.5 w-full">
                        <span
                          className={`text-[9px] font-mono font-bold uppercase px-1 py-0.2 tracking-wider ${
                            isSelected
                              ? 'bg-zinc-900 text-white dark:bg-cyan-500 dark:text-black'
                              : 'bg-zinc-200/80 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {bm.badge}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate leading-tight">
                          {bm.sublabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {settings.mode === 'targetSize' && (
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Target File Size
              </label>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
                {settings.targetSizeMB} MB
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-zinc-400 w-8 text-left shrink-0 font-medium">0.5</span>
              <input
                type="range"
                min={0.5}
                max={50}
                step={0.5}
                value={settings.targetSizeMB}
                onChange={e => onChange({ targetSizeMB: Number(e.target.value) })}
                className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-[10px] text-zinc-400 w-10 text-right shrink-0 font-medium">50 MB</span>
            </div>
          </div>
        )}

        {settings.mode === 'percentage' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Target Output Size</label>
              <span className="font-black text-xs px-2.5 py-1 rounded-xl bg-zinc-900 text-white dark:bg-cyan-500/20 dark:text-cyan-400 dark:border dark:border-cyan-500/30 shadow-xs">
                {settings.percentageReduction}% of Original
              </span>
            </div>

            {/* Slider with high-visibility fill track */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2.5">
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 w-7 shrink-0 text-left">5%</span>
                <div className="flex-1 relative flex items-center">
                  <input
                    type="range"
                    min={5}
                    max={95}
                    step={5}
                    value={settings.percentageReduction}
                    onChange={e => onChange({ percentageReduction: Number(e.target.value) })}
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
                {[10, 25, 50, 75].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onChange({ percentageReduction: pct })}
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

            {/* Live Size Preview Calculation */}
            {selectedFile && selectedFile.size > 0 && (
              <div className="p-3 rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 text-xs space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-[11px]">
                  <span>Original Size:</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex items-center justify-between font-bold text-xs pt-1 border-t border-zinc-200/80 dark:border-zinc-700/60">
                  <span className="text-zinc-800 dark:text-zinc-200">Target Output ({settings.percentageReduction}%):</span>
                  <span className="text-zinc-900 dark:text-cyan-400 font-black">
                    ~{((selectedFile.size * (settings.percentageReduction / 100)) / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold pt-1 border-t border-zinc-200/80 dark:border-zinc-700/60">
                  <span>Space Saved:</span>
                  <span>
                    ~{((selectedFile.size * (1 - settings.percentageReduction / 100)) / (1024 * 1024)).toFixed(2)} MB (-{100 - settings.percentageReduction}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom Sample Rate Dropdown (opens upwards) */}
        <CustomDropdown<SampleRate | null>
          label="Sample Rate"
          value={settings.sampleRate}
          options={SAMPLE_RATE_DROPDOWN_OPTIONS}
          onChange={sr => onChange({ sampleRate: sr })}
          placement="top"
        />

        {/* Audio Channels Vertical List */}
        <div>
          <label className={labelClass}>Audio Channels</label>
          <div className="flex flex-col gap-[1px]">
            {AUDIO_CHANNELS.map((ch) => {
              const isSelected = settings.channels === ch.value;
              return (
                <button
                  key={String(ch.value)}
                  type="button"
                  onClick={() => onChange({ channels: ch.value })}
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

        {/* Estimated output size */}
        {estimatedSize && (
          <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl px-3.5 py-3 border border-zinc-200 dark:border-zinc-700/40">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold mb-0.5">Est. Output Size</p>
            <p className="text-sm font-black" style={{ color: 'var(--accent)' }}>{estimatedSize}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5 shrink-0 bg-zinc-50 dark:bg-zinc-950/40">
        {onApplyToAll && (
          <button
            onClick={onApplyToAll}
            className="w-full py-2 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-colors border border-zinc-200 dark:border-zinc-700 shadow-sm cursor-pointer"
          >
            Apply to All Files
          </button>
        )}
        {onCompress && (
          <button
            onClick={onCompress}
            disabled={isCompressing}
            className="w-full py-2.5 rounded-xl text-xs font-black transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105"
          >
            {isCompressing ? (
              <span className="flex items-center justify-center space-x-2">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Compressing…</span>
              </span>
            ) : (
              'Compress This File'
            )}
          </button>
        )}
      </div>
    </aside>
  );
};
