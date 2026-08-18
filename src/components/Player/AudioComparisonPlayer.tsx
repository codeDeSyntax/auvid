import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Repeat,
  X,
  Sparkles,
  Activity,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { AudioFileEntry } from "@/types/audioCompressor";
import { useTheme } from "@/Provider/Theme";
import { PlayingEqualizer } from "./PlayingEqualizer";

interface AudioComparisonPlayerProps {
  file: AudioFileEntry | null;
  onClose?: () => void;
  onReveal?: (path: string) => void;
}

type AudioMode = "before" | "after";

function formatTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AudioComparisonPlayer: React.FC<AudioComparisonPlayerProps> = ({
  file,
  onClose,
  onReveal,
}) => {
  const { accentColor } = useTheme();

  const [mode, setMode] = useState<AudioMode>("before");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const isCompressed = Boolean(file?.status === "done" && file?.result?.outputPath);

  // If a file is newly compressed, default mode to "after", otherwise "before"
  useEffect(() => {
    if (isCompressed) {
      setMode("after");
    } else {
      setMode("before");
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackError(null);
  }, [file?.id, isCompressed]);

  // Construct media URL using query parameter format for bulletproof file path handling
  const getAudioUrl = useCallback(
    (targetMode: AudioMode): string => {
      if (!file) return "";
      if (targetMode === "after" && file.result?.outputPath) {
        return `media://local-audio/?path=${encodeURIComponent(file.result.outputPath)}`;
      }
      if (file.path) {
        return `media://local-audio/?path=${encodeURIComponent(file.path)}`;
      }
      return "";
    },
    [file]
  );

  const currentAudioUrl = getAudioUrl(mode);

  // Reload audio whenever the source URL changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentAudioUrl) return;

    setPlaybackError(null);
    audio.load();
    if (isPlaying) {
      audio.play().catch((err) => {
        console.warn("[AudioPlayer] Autoplay after track switch prevented:", err);
        setIsPlaying(false);
      });
    }
  }, [currentAudioUrl]);

  // Handle mode toggle (Before vs After) while preserving current playback position
  const handleToggleMode = (newMode: AudioMode) => {
    if (newMode === mode) return;
    if (newMode === "after" && !isCompressed) return;

    const audio = audioRef.current;
    const prevTime = audio?.currentTime ?? 0;
    const wasPlaying = isPlaying;

    setMode(newMode);

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = prevTime;
        if (wasPlaying) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
            console.error("[AudioPlayer] Playback error on mode switch:", err);
            setIsPlaying(false);
          });
        }
      }
    }, 60);
  };

  // Play / Pause toggle
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    setPlaybackError(null);

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err: unknown) {
        console.error("[AudioPlayer] Playback error:", err);
        setIsPlaying(false);
        const msg = err instanceof Error ? err.message : String(err);
        setPlaybackError(msg);
      }
    }
  };

  // Skip 5s backward / forward with exact bounds checking
  const skip = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const maxDur = audio.duration || duration || file?.probe?.duration || 0;
    if (maxDur <= 0) return;
    const target = Math.max(0, Math.min(maxDur, (audio.currentTime || currentTime) + delta));
    audio.currentTime = target;
    setCurrentTime(target);
  };

  // Time update
  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
      if (!duration && audio.duration) {
        setDuration(audio.duration);
      }
    }
  };

  const onLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) {
      setDuration(audio.duration || file?.probe?.duration || 0);
      audio.volume = isMuted ? 0 : volume;
      audio.playbackRate = playbackRate;
      audio.loop = isLooping;
    }
  };

  const onEnded = () => {
    if (!isLooping) {
      setIsPlaying(false);
    }
  };

  const onError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const target = e.currentTarget;
    console.error("[AudioPlayer] HTML5 Audio Tag Error:", target.error);
    setIsPlaying(false);
    setPlaybackError(
      target.error?.message ||
        "Could not load audio track. Ensure the file exists on disk."
    );
  };

  // Seek on progress bar click
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const audio = audioRef.current;
    if (!bar || !audio) return;
    const rect = bar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const maxDur = audio.duration || duration || file?.probe?.duration || 0;
    if (maxDur <= 0) return;
    const targetTime = percent * maxDur;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(percent * (duration || file?.probe?.duration || 0));
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  // Volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.volume = nextMuted ? 0 : volume;
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  if (!file) return null;

  const effectiveDuration = duration || file.probe?.duration || 0;
  const progressPercent = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  // Metadata stats
  const origFormat = file.format || "AUDIO";
  const origSize = formatBytes(file.size);
  const origBitrate = file.probe?.bitrate ? `${file.probe.bitrate} kbps` : "Original";
  const origSampleRate = file.probe?.sampleRate ? `${file.probe.sampleRate} Hz` : "";

  const compFormat = (file.settings?.outputFormat || origFormat).toUpperCase();
  const compSize = file.result?.compressedSize ? formatBytes(file.result.compressedSize) : "—";
  const compBitrate = file.settings?.bitrate ? `${file.settings.bitrate} kbps` : "Compressed";
  const savedPercent = file.result?.savedPercent ?? 0;

  return (
    <div className="w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-l transition-all mb-3">
      {/* Hidden native HTML5 audio element */}
      <audio
        ref={audioRef}
        src={currentAudioUrl}
        preload="auto"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        onError={onError}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* ── Top Header Row: File Name + Pulsing Equalizer + A/B Switcher + Save & Close ── */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shadow-xs shrink-0 relative"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            {isPlaying ? (
              <PlayingEqualizer isPlaying={true} barCount={4} />
            ) : (
              <span>♫</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {file.name}
              </h4>
              {isPlaying && (
                <PlayingEqualizer isPlaying={true} barCount={4} className="shrink-0" />
              )}
            </div>
            <div className="flex items-center space-x-2 text-[10px] text-zinc-400 mt-0.5">
              <span>{origFormat}</span>
              <span>•</span>
              <span>{origSize}</span>
              {origSampleRate && (
                <>
                  <span>•</span>
                  <span>{origSampleRate}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── A/B Comparison Switcher Pill ── */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/60 shadow-xs">
            <button
              onClick={() => handleToggleMode("before")}
              className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === "before"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Before</span>
            </button>

            <button
              onClick={() => handleToggleMode("after")}
              disabled={!isCompressed}
              title={!isCompressed ? "Compress this file to listen to the edited version" : "Switch to compressed preview"}
              className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                !isCompressed
                  ? "opacity-40 cursor-not-allowed text-zinc-400"
                  : mode === "after"
                  ? "shadow-xs text-black"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              }`}
              style={mode === "after" && isCompressed ? { backgroundColor: accentColor } : undefined}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">After</span>
              {isCompressed && savedPercent > 0 && (
                <span className="hidden md:inline ml-1 text-[9px] px-1.5 py-0.2 bg-black/10 rounded-full font-mono font-bold">
                  -{savedPercent}%
                </span>
              )}
            </button>
          </div>

          {/* Reveal saved file */}
          {isCompressed && file.isSaved && file.savedPath && onReveal && (
            <button
              onClick={() => onReveal(file.savedPath!)}
              title="Show in folder"
              className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer hover:bg-emerald-500/25"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Saved</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Playback Error Banner ── */}
      {playbackError && (
        <div className="mt-2 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">{playbackError}</span>
        </div>
      )}

      {/* ── Middle: Interactive Progress Scrubber ── */}
      <div className="pt-3 pb-2 space-y-1.5">
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="group/track relative h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full cursor-pointer flex items-center overflow-hidden"
        >
          {/* Progress fill */}
          <div
            className="h-full rounded-full transition-all duration-75 relative"
            style={{
              width: `${Math.min(100, progressPercent)}%`,
              backgroundColor: accentColor,
            }}
          />

          {/* Hover timestamp tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-7 transform -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none z-10"
              style={{
                left: `${(hoverTime / (effectiveDuration || 1)) * 100}%`,
              }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Timestamps & Active Track indicator */}
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-0.5">
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {formatTime(currentTime)}
            </span>
            <span>/</span>
            <span>{formatTime(effectiveDuration)}</span>
          </div>

          <div className="flex items-center space-x-2 text-[10px]">
            {isPlaying && (
              <PlayingEqualizer isPlaying={true} barCount={4} className="shrink-0" />
            )}
            <span
              className="px-2 py-0.5 rounded-md font-bold uppercase tracking-wider"
              style={{
                backgroundColor: mode === "after" ? `${accentColor}20` : "rgba(120, 120, 120, 0.12)",
                color: mode === "after" ? accentColor : "inherit",
              }}
            >
              {mode === "after" ? `Playing: Compressed (${compBitrate})` : `Playing: Original (${origBitrate})`}
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom Controls Row: Play / Pause / Volume / Speed ── */}
      <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
        {/* Left: Quick Comparison Info */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1.5 text-zinc-500 dark:text-zinc-400">
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {mode === "after" ? compSize : origSize}
            </span>
          </div>

          {isCompressed && (
            <div className="hidden md:flex items-center space-x-1 text-[11px] text-zinc-400">
              <span>Savings:</span>
              <span className="font-bold text-emerald-500">
                {savedPercent}% smaller
              </span>
            </div>
          )}
        </div>

        {/* Center: Playback Buttons */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <button
            onClick={() => skip(-5)}
            title="Rewind 5s"
            className="p-1.5 sm:p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={togglePlay}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-black shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            style={{ backgroundColor: accentColor }}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => skip(5)}
            title="Forward 5s"
            className="p-1.5 sm:p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={() => setIsLooping(!isLooping)}
            title={isLooping ? "Loop enabled" : "Loop disabled"}
            className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer ${
              isLooping
                ? "bg-zinc-100 dark:bg-zinc-800 text-cyan-500 font-bold"
                : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Right: Volume & Playback Rate */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Speed Selector */}
          <div className="hidden sm:flex items-center space-x-0.5 text-xs">
            {[0.75, 1, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => changePlaybackRate(rate)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  playbackRate === rate
                    ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Volume control */}
          <div className="flex items-center space-x-1 sm:space-x-1.5">
            <button
              onClick={toggleMute}
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-12 sm:w-16 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioComparisonPlayer;
