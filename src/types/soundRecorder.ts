// ─── Sound Recorder Types ───────────────────────────────────────────────────

export type RecordingFormat = 'm4a' | 'opus' | 'mp3' | 'wav' | 'flac';

export type RecordingPresetId = 'compact-m4a' | 'compact-opus' | 'podcast' | 'standard-mp3' | 'studio-wav' | 'custom';

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
    id: 'compact-m4a',
    name: 'M4A Voice',
    badge: 'M4A',
    description: 'Small 32 kbps AAC mono voice memo (~240 KB/min) with 100% universal device playback',
    format: 'm4a',
    bitrateKbps: 32,
    sampleRate: 48000,
    channels: 1,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  },
  {
    id: 'compact-opus',
    name: 'Opus Voice',
    badge: 'Opus',
    description: 'Small 32 kbps Opus mono voice memo (~240 KB/min) with VoIP tuning for WhatsApp / Telegram',
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
    name: 'Podcast AAC',
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
    badge: '192 kbps MP3',
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
    name: 'Lossless WAV',
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

