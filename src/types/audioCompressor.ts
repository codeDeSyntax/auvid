// ─── Audio Compressor — Shared IPC Contract ───────────────────────────────────
// Used by both Electron main process and React renderer for type-safe IPC calls.

export type AudioFormat =
  | 'mp3'
  | 'aac'
  | 'm4a'
  | 'ogg'
  | 'opus'
  | 'flac'
  | 'wav'
  | 'wma'
  | 'ac3'
  | 'aiff'
  | 'amr'
  | 'alac';

export type CompressionMode = 'quality' | 'bitrate' | 'targetSize' | 'percentage';
export type BitrateMode = 'cbr' | 'vbr';
export type ChannelMode = 'stereo' | 'mono';

export type SampleRate = 8000 | 11025 | 16000 | 22050 | 32000 | 44100 | 48000 | 96000;

export type JobStatus = 'queued' | 'processing' | 'done' | 'error' | 'cancelled';

/** Settings controlling how a single file is compressed */
export interface AudioCompressOptions {
  inputPath: string;
  outputDir: string;
  outputFormat: AudioFormat;
  mode: CompressionMode;

  // Quality mode (1–10)
  qualityLevel?: number;

  // Bitrate mode
  bitrate?: number;       // kbps, e.g. 128
  bitrateMode?: BitrateMode;

  // Target size mode
  targetSizeMB?: number;

  // Percentage reduction mode (0–99%)
  percentageReduction?: number;

  // Optional audio adjustments
  sampleRate?: SampleRate | null; // null means keep original
  channels?: ChannelMode | null;  // null means keep original

  // Hardware acceleration hint
  useHWAccel?: boolean;
}

/** Raw probe data returned for a file */
export interface AudioProbeResult {
  fileId: string;
  duration: number;       // seconds
  bitrate: number;        // kbps
  sampleRate: number;     // Hz
  channels: number;
  codec: string;
  format: string;
  error?: string;
}

/** Progress event pushed from main → renderer */
export interface CompressionProgress {
  fileId: string;
  percent: number;        // 0–100
  timeRemaining?: number; // seconds estimate
  processedBytes?: number;
}

/** Final result pushed from main → renderer when a job finishes */
export interface CompressionResult {
  fileId: string;
  outputPath: string;
  originalSize: number;   // bytes
  compressedSize: number; // bytes
  savedPercent: number;   // e.g. 34.2
  duration: number;       // ms processing time
}

/** Error event from main → renderer */
export interface CompressionError {
  fileId: string;
  message: string;
}

/** A single file entry in the compressor queue */
export interface AudioFileEntry {
  id: string;
  name: string;
  path: string;
  size: number;           // bytes
  format: string;         // original extension, uppercase
  probe?: AudioProbeResult;
  status: JobStatus;
  progress: number;       // 0–100
  result?: CompressionResult;
  errorMessage?: string;
  isSaved?: boolean;
  savedPath?: string;
  // Per-file custom settings (null = use global)
  customSettings: boolean;
  settings: AudioCompressSettings;
}

/** Settings that can be configured per-file or globally */
export interface AudioCompressSettings {
  outputFormat: AudioFormat;
  mode: CompressionMode;
  qualityLevel: number;   // 1–10
  bitrate: number;        // kbps
  bitrateMode: BitrateMode;
  targetSizeMB: number;
  percentageReduction: number;
  sampleRate: SampleRate | null;
  channels: ChannelMode | null;
}

export const DEFAULT_SETTINGS: AudioCompressSettings = {
  outputFormat: 'mp3',
  mode: 'quality',
  qualityLevel: 7,
  bitrate: 128,
  bitrateMode: 'vbr',
  targetSizeMB: 5,
  percentageReduction: 50,
  sampleRate: null,
  channels: null,
};

export const SUPPORTED_FORMATS: AudioFormat[] = [
  'mp3', 'aac', 'm4a', 'ogg', 'opus', 'flac', 'wav', 'wma', 'ac3', 'aiff', 'alac',
];

export const BITRATE_PRESETS = [32, 48, 64, 96, 128, 160, 192, 256, 320] as const;

export const SAMPLE_RATE_OPTIONS: Array<{ label: string; value: SampleRate | null }> = [
  { label: 'Auto (keep original)', value: null },
  { label: '8,000 Hz', value: 8000 },
  { label: '11,025 Hz', value: 11025 },
  { label: '16,000 Hz', value: 16000 },
  { label: '22,050 Hz', value: 22050 },
  { label: '32,000 Hz', value: 32000 },
  { label: '44,100 Hz (CD)', value: 44100 },
  { label: '48,000 Hz (Pro)', value: 48000 },
  { label: '96,000 Hz (Studio)', value: 96000 },
];
