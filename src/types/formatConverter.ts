// ─── Format Converter Types ──────────────────────────────────────────────────

export type AudioFormat = 'mp3' | 'wav' | 'flac' | 'aac' | 'm4a' | 'ogg' | 'opus' | 'wma' | 'aiff' | 'alac' | 'ac3';

export type VideoFormat = 'mp4' | 'mkv' | 'mov' | 'avi' | 'webm' | 'wmv' | 'flv' | 'ts' | '3gp' | 'gif';

export type TargetFormat = AudioFormat | VideoFormat;

export type ConversionType = 'audio-to-audio' | 'video-to-video' | 'video-to-audio' | 'video-to-gif';

export interface ConverterProbeInfo {
  type: 'audio' | 'video';
  format: string;
  duration: number;
  size: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioSampleRate?: number;
  audioChannels?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  thumbnail?: string | null;
}

export interface ConverterSettings {
  // Audio parameters
  audioBitrate: number;         // 32 – 320 kbps
  audioSampleRate: number;      // 8000, 16000, 22050, 44100, 48000, 96000
  audioChannels: 'original' | 'stereo' | 'mono';

  // Video parameters
  videoCodec: 'h264' | 'hevc' | 'av1' | 'vp9' | 'auto';
  videoCrf: number;             // 16 – 40
  videoResolution: 'original' | '4k' | '2k' | '1080p' | '720p' | '480p' | '360p';
  videoFps: 'original' | 60 | 30 | 24 | 15;
  useHWAccel: boolean;

  // GIF parameters
  gifFps: number;               // 10 – 30 fps
  gifWidth: number;             // 240 – 720 px
  gifQuality: 'high' | 'standard';
}

export interface ConverterFileEntry {
  id: string;
  name: string;
  path: string;
  size: number;
  probe?: ConverterProbeInfo | null;
  targetFormat: TargetFormat;
  customSettings?: Partial<ConverterSettings>;
  status: 'idle' | 'probing' | 'queued' | 'converting' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  fps?: number;
  timemark?: string;
  speed?: string;
  convertedPath?: string;
  convertedSize?: number;
  error?: string;
}

export const AUDIO_FORMATS: { id: AudioFormat; label: string; desc: string; lossy: boolean }[] = [
  { id: 'mp3', label: 'MP3', desc: 'Universal audio compatibility', lossy: true },
  { id: 'wav', label: 'WAV', desc: 'Uncompressed studio PCM audio', lossy: false },
  { id: 'flac', label: 'FLAC', desc: 'Lossless compression (Highest quality)', lossy: false },
  { id: 'aac', label: 'AAC', desc: 'Advanced Audio Coding for Apple & Web', lossy: true },
  { id: 'm4a', label: 'M4A', desc: 'Apple MPEG-4 audio container', lossy: true },
  { id: 'opus', label: 'OPUS', desc: 'Ultra-low latency & speech density', lossy: true },
  { id: 'ogg', label: 'OGG', desc: 'Open Vorbis audio container', lossy: true },
  { id: 'aiff', label: 'AIFF', desc: 'Apple uncompressed audio', lossy: false },
  { id: 'alac', label: 'ALAC', desc: 'Apple Lossless Audio Codec', lossy: false },
  { id: 'wma', label: 'WMA', desc: 'Windows Media Audio', lossy: true },
  { id: 'ac3', label: 'AC3', desc: 'Dolby Digital surround audio', lossy: true },
];

export const VIDEO_FORMATS: { id: VideoFormat; label: string; desc: string }[] = [
  { id: 'mp4', label: 'MP4', desc: 'Universal MP4 (H.264 / AAC)' },
  { id: 'mkv', label: 'MKV', desc: 'Matroska container with all streams' },
  { id: 'mov', label: 'MOV', desc: 'Apple QuickTime Movie' },
  { id: 'webm', label: 'WEBM', desc: 'Open WebM for web streams (VP9)' },
  { id: 'avi', label: 'AVI', desc: 'Audio Video Interleave container' },
  { id: 'wmv', label: 'WMV', desc: 'Windows Media Video' },
  { id: 'flv', label: 'FLV', desc: 'Flash Video container' },
  { id: 'ts', label: 'TS', desc: 'MPEG Transport Stream' },
  { id: '3gp', label: '3GP', desc: 'Legacy mobile multimedia container' },
  { id: 'gif', label: 'GIF', desc: 'Animated 256-color GIF animation' },
];
