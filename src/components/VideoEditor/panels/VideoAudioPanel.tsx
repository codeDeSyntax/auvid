// ─── VideoAudioPanel.tsx ──────────────────────────────────────────────────
// Audio mixer & background music panel:
//   - Primary clip volume & mute toggle
//   - Background music track loader & volume slider
//   - Audio fade-in & fade-out durations
//   - Audio ducking toggle
//   - Themed with AUVID var(--accent)

import React from 'react';
import { Volume2, VolumeX, Music, Plus, Trash2, Waves } from 'lucide-react';
import type { AudioLayer } from '../types';

interface VideoAudioPanelProps {
  gain: number;
  onGainChange: (gain: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  audioLayer: AudioLayer;
  onUpdateAudio: <K extends keyof AudioLayer>(key: K, value: AudioLayer[K]) => void;
  onBrowseBGM: () => void;
  onRemoveBGM: () => void;
  accentColor?: string;
  mode?: 'all' | 'audio-only' | 'fade-only';
}

const FADE_DURATIONS = [0, 0.5, 1, 2, 3];
const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5';

export const VideoAudioPanel: React.FC<VideoAudioPanelProps> = ({
  gain,
  onGainChange,
  isMuted,
  onToggleMute,
  audioLayer,
  onUpdateAudio,
  onBrowseBGM,
  onRemoveBGM,
  mode = 'all',
}) => {
  const bgmFileName = audioLayer.bgmPath ? audioLayer.bgmPath.split(/[/\\]/).pop() : null;

  return (
    <div className="space-y-5 select-none">
      {/* Primary Video Track Audio */}
      {(mode === 'all' || mode === 'audio-only') && (
        <div className="space-y-3 p-3.5 rounded-2xl bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Track Volume
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleMute}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                isMuted
                  ? 'bg-red-500/10 border-red-500/30 text-red-500 font-bold'
                  : 'bg-zinc-100 dark:bg-zinc-700/60 border-zinc-200 dark:border-zinc-600/50 text-zinc-600 dark:text-zinc-300'
              }`}
              title={isMuted ? 'Unmute video audio' : 'Mute video audio'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Level</span>
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {isMuted ? 'Muted' : `${Math.round(gain * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={3.0}
              step={0.05}
              value={isMuted ? 0 : gain}
              disabled={isMuted}
              onChange={(e) => onGainChange(parseFloat(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer disabled:opacity-40"
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>
        </div>
      )}

      {/* Background Music (BGM) */}
      {(mode === 'all' || mode === 'audio-only') && (
        <div className="space-y-3 p-3.5 rounded-2xl bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Background Audio
              </span>
            </div>
            {audioLayer.bgmPath && (
              <button
                type="button"
                onClick={onRemoveBGM}
                className="p-1 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                title="Remove background music"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {audioLayer.bgmPath ? (
            <div className="space-y-3">
              <div
                className="flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                  color: 'var(--accent)',
                  borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                }}
              >
                <Waves className="w-4 h-4 shrink-0 animate-pulse" />
                <span className="truncate flex-1 font-mono">{bgmFileName}</span>
              </div>

              {/* BGM Volume */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Music Level</span>
                  <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                    {Math.round(audioLayer.bgmVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.0}
                  step={0.05}
                  value={audioLayer.bgmVolume}
                  onChange={(e) => onUpdateAudio('bgmVolume', parseFloat(e.target.value))}
                  className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer"
                  style={{ accentColor: 'var(--accent)' }}
                />
              </div>

              {/* Audio Ducking */}
              <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={audioLayer.audioDucking}
                  onChange={(e) => onUpdateAudio('audioDucking', e.target.checked)}
                  className="rounded w-4 h-4 cursor-pointer"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                  Auto-duck BGM behind speech
                </span>
              </label>
            </div>
          ) : (
            <button
              type="button"
              onClick={onBrowseBGM}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center gap-2 transition-all bg-white/70 dark:bg-zinc-800/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Audio Track</span>
            </button>
          )}
        </div>
      )}

      {/* Audio Fades */}
      {(mode === 'all' || mode === 'fade-only') && (
        <div className="space-y-4">
          {/* Fade In */}
          <div>
            <label className={labelClass}>Fade In Duration</label>
            <div className="flex gap-1.5">
              {FADE_DURATIONS.map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => onUpdateAudio('audioFadeIn', dur)}
                  className={`flex-1 py-1.5 text-xs rounded-xl border font-mono font-bold transition-all cursor-pointer ${
                    audioLayer.audioFadeIn === dur
                      ? 'shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                  style={
                    audioLayer.audioFadeIn === dur
                      ? {
                          backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
                          color: 'var(--accent)',
                          borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                        }
                      : undefined
                  }
                >
                  {dur === 0 ? 'Off' : `${dur}s`}
                </button>
              ))}
            </div>
          </div>

          {/* Fade Out */}
          <div>
            <label className={labelClass}>Fade Out Duration</label>
            <div className="flex gap-1.5">
              {FADE_DURATIONS.map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => onUpdateAudio('audioFadeOut', dur)}
                  className={`flex-1 py-1.5 text-xs rounded-xl border font-mono font-bold transition-all cursor-pointer ${
                    audioLayer.audioFadeOut === dur
                      ? 'shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                  style={
                    audioLayer.audioFadeOut === dur
                      ? {
                          backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
                          color: 'var(--accent)',
                          borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                        }
                      : undefined
                  }
                >
                  {dur === 0 ? 'Off' : `${dur}s`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
