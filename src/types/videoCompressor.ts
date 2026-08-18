// ─── Video Compressor Types ──────────────────────────────────────────────────

export type VideoCompressMode = 'percentage' | 'targetSize' | 'crf' | 'bitrate';

export type VideoCodec = 'h264' | 'hevc' | 'av1' | 'vp9';

export type VideoContainer = 'mp4' | 'mkv' | 'mov' | 'webm';

export type VideoResolution = 'original' | '4k' | '2k' | '1080p' | '720p' | '480p' | '360p' | '240p';

export type VideoFps = 'original' | 60 | 30 | 24 | 15;

export type VideoAudioCodec = 'aac' | 'opus' | 'mp3' | 'copy' | 'mute';

export type EncoderSpeedPreset = 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';

export interface VideoCompressSettings {
  mode: VideoCompressMode;
  percentageReduction: number; // 10 – 95%
  targetSizeMB: number;        // e.g. 8 for Discord, 25 for Slack, 0.8 for 800KB
  targetSizeUnit: 'MB' | 'KB';
  crf: number;                 // 0 – 51 (default ~23 for h264, ~28 for hevc, ~32 for av1)
  videoBitrateKbps: number;    // 100 – 50000 kbps
  twoPass: boolean;            // 2-pass encoding for optimal distribution
  codec: VideoCodec;
  container: VideoContainer;
  resolution: VideoResolution;
  fps: VideoFps;
  audioCodec: VideoAudioCodec;
  audioBitrateKbps: number;    // 32 – 320 kbps
  audioChannels: 'original' | 'stereo' | 'mono';
  speedPreset: EncoderSpeedPreset;
  useHWAccel: boolean;         // GPU vs CPU
}

export interface VideoProbeInfo {
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  videoBitrate?: number;
  audioBitrate?: number;
  totalBitrate?: number;
  size: number;
  thumbnail?: string | null;
}

export interface VideoCompressFileEntry {
  id: string;
  name: string;
  path: string;
  size: number;
  probe?: VideoProbeInfo | null;
  settingsOverride?: Partial<VideoCompressSettings>;
  status: 'idle' | 'probing' | 'queued' | 'compressing' | 'completed' | 'failed' | 'cancelled';
  progress: number;            // 0 – 100
  fps?: number;
  timemark?: string;
  speed?: string;
  estimatedSize?: number;      // estimated output bytes
  compressedSize?: number;     // actual output bytes
  compressedPath?: string;
  error?: string;
}

export interface HWAccelInfo {
  nvenc: boolean;  // NVIDIA
  qsv: boolean;    // Intel QuickSync
  amf: boolean;    // AMD
  vaapi: boolean;  // Linux
  availableEncoders: string[];
}

export interface VideoCompressPreset {
  id: string;
  name: string;
  description: string;
  badge?: string;
  icon?: string;
  settings: Partial<VideoCompressSettings>;
}

export const VIDEO_COMPRESS_PRESETS: VideoCompressPreset[] = [
  {
    id: 'discord-free',
    name: 'Discord Free',
    description: 'Compress video to under 8 MB for free Discord accounts',
    badge: '8 MB',
    settings: {
      mode: 'targetSize',
      targetSizeMB: 7.8,
      targetSizeUnit: 'MB',
      codec: 'h264',
      container: 'mp4',
      resolution: '720p',
      twoPass: true,
      audioBitrateKbps: 96,
      audioChannels: 'stereo',
    },
  },
  {
    id: 'discord-nitro',
    name: 'Discord Nitro',
    description: 'Compress to under 25 MB for Discord Nitro & Slack',
    badge: '25 MB',
    settings: {
      mode: 'targetSize',
      targetSizeMB: 24.5,
      targetSizeUnit: 'MB',
      codec: 'h264',
      container: 'mp4',
      resolution: '1080p',
      twoPass: true,
      audioBitrateKbps: 128,
    },
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp / Mobile',
    description: 'Under 16 MB with 720p resolution for instant mobile sharing',
    badge: '16 MB',
    settings: {
      mode: 'targetSize',
      targetSizeMB: 15.5,
      targetSizeUnit: 'MB',
      codec: 'h264',
      container: 'mp4',
      resolution: '720p',
      audioBitrateKbps: 96,
    },
  },
  {
    id: 'email-attach',
    name: 'Email Attachment',
    description: 'Compact file size under 10 MB with crisp 720p/480p scaling',
    badge: '10 MB',
    settings: {
      mode: 'targetSize',
      targetSizeMB: 9.8,
      targetSizeUnit: 'MB',
      codec: 'h264',
      container: 'mp4',
      resolution: '720p',
      twoPass: true,
      audioBitrateKbps: 64,
    },
  },
  {
    id: 'micro-web',
    name: 'Ultra-Tiny Web Clip',
    description: 'Super compressed under 2 MB (or hundreds of KBs) for web embedding',
    badge: '< 2 MB',
    settings: {
      mode: 'targetSize',
      targetSizeMB: 1.8,
      targetSizeUnit: 'MB',
      codec: 'hevc',
      container: 'mp4',
      resolution: '480p',
      fps: 24,
      audioBitrateKbps: 48,
      audioChannels: 'mono',
    },
  },
  {
    id: 'high-quality-hevc',
    name: 'High Efficiency HEVC',
    description: '50% smaller file size with near-lossless visual quality (H.265)',
    badge: 'H.265',
    settings: {
      mode: 'crf',
      crf: 26,
      codec: 'hevc',
      container: 'mp4',
      resolution: 'original',
      audioCodec: 'aac',
      audioBitrateKbps: 128,
    },
  },
  {
    id: 'balanced-web',
    name: '1080p Web Stream',
    description: 'Optimal CRF 23 compression for YouTube, Vimeo, and web playback',
    badge: 'Balanced',
    settings: {
      mode: 'crf',
      crf: 23,
      codec: 'h264',
      container: 'mp4',
      resolution: '1080p',
      audioCodec: 'aac',
      audioBitrateKbps: 128,
    },
  },
  {
    id: '4k-to-1080p',
    name: '4K to 1080p Downscale',
    description: 'Shrink massive 4K footage down to compact 1080p while preserving sharpness',
    badge: 'Downscale',
    settings: {
      mode: 'percentage',
      percentageReduction: 70,
      codec: 'h264',
      container: 'mp4',
      resolution: '1080p',
      audioCodec: 'aac',
      audioBitrateKbps: 160,
    },
  },
];
