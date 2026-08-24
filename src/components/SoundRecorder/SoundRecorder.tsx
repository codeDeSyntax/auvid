import React, { useState, useMemo } from 'react';
import {
  Mic, Play, Pause, Square, RotateCcw,
  Download, Scissors, FolderOpen, Trash2,
  RefreshCw, CheckCircle2, Radio, Sparkles,
  Sliders, Music, ChevronDown, Check, Disc, Loader2
} from 'lucide-react';
import { useTheme } from '@/Provider/Theme';
import { useMediaContext } from '@/Provider/MediaContext';
import { useSoundRecorder } from './useSoundRecorder';
import { LiveWaveformVisualizer } from './LiveWaveformVisualizer';
import { RECORDING_PRESETS, RecordingPreset } from '@/types/soundRecorder';
import { CustomDropdown, DropdownOption } from '@/components/common/CustomDropdown';

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
    saveProgress,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
    togglePreviewPlayback,
    saveRecording,
    deleteRecording,
    refreshDevices,
    openRecordingsFolder,
  } = useSoundRecorder();

  const [customName, setCustomName] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);

  const presetOptions: DropdownOption<string>[] = useMemo(() => {
    return RECORDING_PRESETS.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: `${p.bitrateKbps} kbps · ${
        p.bitrateKbps <= 48
          ? '~240 KB/min'
          : p.bitrateKbps <= 128
          ? '~960 KB/min'
          : p.bitrateKbps <= 192
          ? '~1.4 MB/min'
          : '~10.8 MB/min'
      } · ${p.channels === 1 ? 'Mono' : 'Stereo'}`,
      badge: `.${p.format.toUpperCase()}`,
    }));
  }, []);

  const handlePresetChange = (presetId: string) => {
    const found = RECORDING_PRESETS.find((p) => p.id === presetId);
    if (found && !isRecording) {
      setActivePreset(found);
    }
  };

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

        {/* Center Sleek Preset Select Dropdown */}
        <div className="hidden md:block w-72">
          <CustomDropdown
            value={activePreset.id}
            options={presetOptions}
            onChange={handlePresetChange}
            disabled={isRecording}
            buttonClassName="!py-2 !px-4 !rounded-full !bg-white/90 dark:!bg-zinc-900/90 !border-zinc-200 dark:!border-zinc-800 backdrop-blur-md shadow-xs text-xs font-semibold"
            menuClassName="!rounded-2xl !mt-2 shadow-2xl !w-80"
          />
        </div>

        {/* Right Section: Open Recordings Folder + Microphone Device Pill */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={openRecordingsFolder}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Open Recordings Folder in File Explorer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Recordings Folder</span>
          </button>

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
                <span>.{activePreset.format.toUpperCase()}</span>
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

          {/* Metadata Rows with Hairline Dividers */}
          <div className="pt-2 pb-1 space-y-2 text-xs font-mono border-t border-zinc-200/90 dark:border-zinc-800/80">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="text-[11px]">Active Profile</span>
              <span className="text-zinc-900 dark:text-zinc-200 font-bold">{activePreset.name}</span>
            </div>

            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="text-[11px]">Bitrate / Est. Size</span>
              <span className="text-zinc-800 dark:text-zinc-200">
                {activePreset.bitrateKbps} kbps ({activePreset.bitrateKbps <= 48 ? '~240 KB/min' : activePreset.bitrateKbps <= 128 ? '~960 KB/min' : activePreset.bitrateKbps <= 192 ? '~1.4 MB/min' : '~10.8 MB/min'})
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="text-[11px]">Sample Rate</span>
              <span className="text-zinc-800 dark:text-zinc-200">{activePreset.sampleRate / 1000} kHz · {activePreset.channels === 1 ? 'Mono' : 'Stereo'}</span>
            </div>

            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="text-[11px]">Noise Suppression</span>
              <span className={activePreset.noiseSuppression ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-zinc-400"}>
                {activePreset.noiseSuppression ? "Active Hardware Gate" : "Direct Pass-through"}
              </span>
            </div>
          </div>

          {/* Lower Section (Output info & Scrubber) */}

          <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              <span>Output Destination</span>
              <button
                type="button"
                onClick={openRecordingsFolder}
                className="flex items-center space-x-1 text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer group"
                title="Open Recordings Folder in File Explorer"
              >
                <span className="truncate max-w-[140px] group-hover:underline">AUVID / Recordings</span>
                <FolderOpen className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200" />
              </button>
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
                  className="relative w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2 overflow-hidden select-none disabled:cursor-wait"
                >
                  {/* Subtle in-button progress fill */}
                  {isSaving && (
                    <div
                      className="absolute inset-0 bg-black/15 transition-all duration-200 ease-out pointer-events-none"
                      style={{ width: `${Math.max(5, saveProgress)}%` }}
                    />
                  )}

                  <div className="relative z-10 flex items-center justify-center space-x-2">
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>{saveProgress > 0 ? `SAVING RECORDING… ${saveProgress}%` : 'OPTIMIZING & SAVING…'}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>SAVE RECORDING</span>
                      </>
                    )}
                  </div>
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
