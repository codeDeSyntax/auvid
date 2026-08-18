// ─── SoundRecorder.tsx ──────────────────────────────────────────────────────
// High-end Studio Sound Recorder with 3D tactile acoustic fins ribbon,
// floating glassmorphic console, full light/dark theme support, and Opus voice compression.

import React, { useState } from 'react';
import {
  Mic, Play, Pause, Square, RotateCcw,
  Download, Scissors, FolderOpen, Trash2,
  RefreshCw, CheckCircle2, Radio, Sparkles,
  Sliders, Music, ChevronDown, Check
} from 'lucide-react';
import { useTheme } from '@/Provider/Theme';
import { useMediaContext } from '@/Provider/MediaContext';
import { useSoundRecorder } from './useSoundRecorder';
import { LiveWaveformVisualizer } from './LiveWaveformVisualizer';
import { RECORDING_PRESETS, RecordingPreset } from '@/types/soundRecorder';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTimer(secs: number): string {
  if (!secs || isNaN(secs) || secs < 0) return '00:00.00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export const SoundRecorder: React.FC = () => {
  const { accentColor, isDarkMode } = useTheme();
  const { setActiveTool } = useMediaContext();

  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    activePreset,
    setActivePreset,
    analyser,
    isRecording,
    isPaused,
    durationSec,
    estimatedBytes,
    recordedBlob,
    previewUrl,
    isPlayingPreview,
    previewProgress,
    savedRecordings,
    isSaving,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
    togglePreviewPlayback,
    saveRecording,
    deleteRecording,
    refreshDevices,
  } = useSoundRecorder();

  const [customName, setCustomName] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);

  const handleSave = async () => {
    const result = await saveRecording(customName);
    if (result) {
      setCustomName('');
      setSaveSuccessMsg(`Saved to ${result.name}`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  };

  const handleOpenInTrimmer = async () => {
    const result = await saveRecording(customName);
    if (result?.path) {
      setActiveTool('audio-trim');
    }
  };

  const selectedDevice = devices.find(d => d.deviceId === selectedDeviceId) || devices[0];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white select-none relative font-sans transition-colors duration-300">
      
      {/* ── Top Navigation Bar ── */}
      <div className="px-8 pt-5 pb-3 z-30 flex items-center justify-between">
        {/* Left Studio Badge */}
        <div className="flex items-center space-x-3">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center text-black font-black text-xs shadow-xs"
            style={{ backgroundColor: accentColor }}
          >
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black tracking-wider uppercase text-zinc-900 dark:text-zinc-100">
              AUVID STUDIO
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-mono">
              SOUND RECORDER · 48KHZ
            </span>
          </div>
        </div>

        {/* Center Mode Pills */}
        <div className="hidden md:flex items-center space-x-1 p-1 rounded-full bg-zinc-200/80 dark:bg-zinc-900/90 border border-zinc-300/80 dark:border-zinc-800/80 backdrop-blur-md">
          {RECORDING_PRESETS.map((preset) => {
            const isSelected = activePreset.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => !isRecording && setActivePreset(preset)}
                disabled={isRecording}
                className={`px-3.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                } disabled:opacity-40`}
                style={isSelected ? { color: accentColor } : {}}
              >
                {preset.name.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Right Microphone Device Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDeviceDropdownOpen(v => !v)}
            disabled={isRecording}
            className="flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-40"
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isRecording ? '#ef4444' : accentColor }} />
            <span className="max-w-[140px] truncate">{selectedDevice?.label || 'Default Mic'}</span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {deviceDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 p-1.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                <span>Input Interfaces</span>
                <button type="button" onClick={refreshDevices} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto no-scrollbar py-1 space-y-0.5">
                {devices.map((d) => (
                  <button
                    key={d.deviceId}
                    type="button"
                    onClick={() => {
                      setSelectedDeviceId(d.deviceId);
                      setDeviceDropdownOpen(false);
                    }}
                    className="w-full px-3 py-1.5 rounded-xl text-left text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="truncate">{d.label}</span>
                    {d.deviceId === selectedDeviceId && <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3D Acoustic Waveform Fins Ribbon Canvas (Spans full viewport width) ── */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[520px] max-h-[85vh] pointer-events-none z-10 opacity-95">
        <LiveWaveformVisualizer
          analyser={analyser}
          isRecording={isRecording}
          isPaused={isPaused}
          accentColor={accentColor}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* ── Center Floating Studio Card ── */}
      <div className="flex-1 flex items-center justify-center p-6 z-20 overflow-y-auto no-scrollbar">
        <div className="w-full max-w-sm rounded-[32px] bg-white/90 dark:bg-zinc-900/85 border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xl backdrop-blur-2xl p-6 flex flex-col space-y-4 relative overflow-hidden transition-all text-zinc-900 dark:text-zinc-100">
          
          {/* Subtle Ambient Radial Glow */}
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ backgroundColor: accentColor }}
          />

          {/* Card Top: You're Recording / Timer */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              <span className="uppercase tracking-wider">
                {isRecording ? "You're recording" : recordedBlob ? 'Audio Captured' : 'Ready to record'}
              </span>
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: isRecording ? '#ef4444' : accentColor }} />
                <span>{activePreset.format.toUpperCase()}</span>
              </div>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono tracking-tight text-zinc-900 dark:text-white">
                {formatTimer(durationSec)}
              </span>
              <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>
                {formatBytes(estimatedBytes || (recordedBlob ? recordedBlob.size : 0))}
              </span>
            </div>
          </div>

          {/* Preset Buttons Grid */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {RECORDING_PRESETS.map((preset) => {
              const isSelected = activePreset.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => !isRecording && setActivePreset(preset)}
                  disabled={isRecording}
                  className={`py-1.5 rounded-xl text-[10px] font-bold font-mono uppercase transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-400 dark:border-zinc-600 shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/60'
                  } disabled:opacity-40`}
                  style={isSelected ? { borderColor: accentColor, color: accentColor } : {}}
                >
                  {preset.id === 'compact-voice' ? 'Voice Note' : preset.id === 'podcast' ? 'Podcast' : preset.id === 'standard-mp3' ? 'MP3' : 'WAV'}
                </button>
              );
            })}
          </div>

          {/* Metadata Rows with Hairline Dividers */}
          <div className="pt-2 pb-1 space-y-2 text-xs font-mono border-t border-zinc-200/90 dark:border-zinc-800/80">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="text-[11px]">Compression</span>
              <span className="text-zinc-900 dark:text-zinc-200 font-bold">{activePreset.name}</span>
            </div>

            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="text-[11px]">Bitrate / Mode</span>
              <span className="text-zinc-800 dark:text-zinc-200">{activePreset.bitrateKbps} kbps (VoIP VBR)</span>
            </div>

            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="text-[11px]">Sample Rate</span>
              <span className="text-zinc-800 dark:text-zinc-200">{activePreset.sampleRate / 1000} kHz · {activePreset.channels === 1 ? 'Mono' : 'Stereo'}</span>
            </div>

            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="text-[11px]">Noise Suppression</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Active Hardware Gate</span>
            </div>
          </div>

          {/* Lower Section (Output info & Scrubber) */}
          <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              <span>Output Destination</span>
              <span className="text-zinc-800 dark:text-zinc-200 truncate max-w-[160px]">AUVID / Recordings</span>
            </div>

            {/* In-App Playback Scrubber if recorded */}
            {recordedBlob && (
              <div className="pt-1 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={togglePreviewPlayback}
                  className="w-7 h-7 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white flex items-center justify-center cursor-pointer shrink-0 transition-transform active:scale-95 shadow-xs"
                >
                  {isPlayingPreview ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                </button>
                <div className="flex-1 bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-100"
                    style={{ width: `${previewProgress * 100}%`, backgroundColor: accentColor }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Main Full-Width Action Button ── */}
          <div className="pt-1">
            {!isRecording && !recordedBlob && (
              <button
                type="button"
                onClick={startRecording}
                style={{ backgroundColor: accentColor }}
                className="w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
                <span>START RECORDING</span>
              </button>
            )}

            {isRecording && (
              <div className="flex items-center space-x-2">
                {isPaused ? (
                  <button
                    type="button"
                    onClick={resumeRecording}
                    className="flex-1 py-3.5 rounded-2xl bg-zinc-200 hover:bg-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pauseRecording}
                    className="flex-1 py-3.5 rounded-2xl bg-zinc-200 hover:bg-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex-1 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg shadow-red-500/20"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop &amp; Review</span>
                </button>
              </div>
            )}

            {recordedBlob && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{ backgroundColor: accentColor }}
                  className="w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>SAVE RECORDING</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleOpenInTrimmer}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Trim Audio</span>
                  </button>

                  <button
                    type="button"
                    onClick={discardRecording}
                    className="p-2.5 rounded-xl bg-zinc-100 hover:bg-red-500/10 hover:text-red-500 text-zinc-500 dark:bg-zinc-800 dark:hover:bg-red-500/20 dark:hover:text-red-400 dark:text-zinc-400 transition-all cursor-pointer shadow-xs"
                    title="Discard and record again"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {saveSuccessMsg && (
            <p className="text-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
              ✓ {saveSuccessMsg}
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom Minimalist Footer ── */}
      <div className="px-8 py-3.5 z-30 flex items-center justify-between text-[10px] font-mono text-zinc-400 dark:text-zinc-600 border-t border-zinc-200 dark:border-zinc-900">
        <span>AUVID AUDIO ENGINE V2.0</span>
        <div className="flex items-center space-x-4">
          <span>OPUS SILK/CELT HYBRID</span>
          <span>48KHZ STUDIO CAPTURE</span>
        </div>
      </div>
    </div>
  );
};
