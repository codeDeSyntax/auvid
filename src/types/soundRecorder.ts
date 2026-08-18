// ─── Sound Recorder Types ───────────────────────────────────────────────────

export type RecordingFormat = 'opus' | 'm4a' | 'mp3' | 'wav' | 'flac';

export type RecordingPresetId = 'compact-voice' | 'podcast' | 'studio-wav' | 'standard-mp3' | 'custom';

export interface RecordingPreset {
  id: RecordingPresetId;
  name: string;
  badge: string;
  description: string;
  format: RecordingFormat;
  bitrateKbps: number;
  sampleRate: number;
  channels: 1 | 2;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

export interface AudioInputDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface RecordedItem {
  id: string;
  name: string;
  path: string;
  size: number;
  duration: number;
  format: string;
  recordedAt: number;
  url?: string;
}

export interface SaveRecordingResult {
  path: string;
  name: string;
  size: number;
  duration: number;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  durationSec: number;
  estimatedBytes: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

export const RECORDING_PRESETS: RecordingPreset[] = [
  {
    id: 'compact-voice',
    name: 'Ultra-Compact Voice',
    badge: 'High Efficiency',
    description: 'High-density Opus voice compression (~20 KB per 10s) with active noise reduction',
    format: 'opus',
    bitrateKbps: 32,
    sampleRate: 48000,
    channels: 1,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  },
  {
    id: 'podcast',
    name: 'Podcast Voice',
    badge: '128 kbps AAC',
    description: 'Crystal-clear broadcast vocal profile with stereo warmth',
    format: 'm4a',
    bitrateKbps: 128,
    sampleRate: 48000,
    channels: 2,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: false,
  },
  {
    id: 'standard-mp3',
    name: 'Standard MP3',
    badge: '192 kbps',
    description: 'Universally compatible MP3 audio file for music and voice',
    format: 'mp3',
    bitrateKbps: 192,
    sampleRate: 44100,
    channels: 2,
    noiseSuppression: false,
    echoCancellation: false,
    autoGainControl: false,
  },
  {
    id: 'studio-wav',
    name: 'Lossless Master',
    badge: 'Studio WAV',
    description: 'Raw uncompressed 24-bit 48kHz audio directly from the audio interface',
    format: 'wav',
    bitrateKbps: 1411,
    sampleRate: 48000,
    channels: 2,
    noiseSuppression: false,
    echoCancellation: false,
    autoGainControl: false,
  },
];
