// ─── VideoEditor — Shared Types ────────────────────────────────────────────────
// Single source of truth for all TypeScript interfaces used across the
// VideoEditor module (hooks, panels, canvas, backend IPC contracts).

// ─── File & Clip Models ────────────────────────────────────────────────────────

export interface VideoFile {
  id: string;
  name: string;
  path: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  thumbnails: string[];
}

/** A single segment within the multi-clip sequence timeline. */
export interface ClipSegment {
  id: string;
  fileId: string;     // References VideoFile.id
  filePath: string;
  fileName: string;
  inPoint: number;    // Start time within the source file (seconds)
  outPoint: number;   // End time within the source file (seconds)
  duration: number;   // outPoint - inPoint (computed)
  thumbnails: string[];
  // Clip-level overrides (applied on top of global settings on export)
  speed?: number;
  gain?: number;
}

// ─── Timeline / Region ────────────────────────────────────────────────────────

export interface VideoRegion {
  inPoint: number;
  outPoint: number;
}

// ─── Export / Processing ──────────────────────────────────────────────────────

export type ExportStatus = 'idle' | 'exporting' | 'extracting-audio' | 'done' | 'error';

export type SaveMode = 'new-file' | 'in-place';
export type CutAction = 'keep' | 'delete';
export type TargetResolution = 'original' | '1080p' | '720p' | '480p';
export type OutputFormat = 'same' | 'mp4' | 'mkv' | 'mov' | 'webm';
export type AudioExtractFormat = 'mp3' | 'wav' | 'aac' | 'flac';

// ─── Canvas / Aspect Ratio ────────────────────────────────────────────────────

export type CanvasAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9' | '4:5';
export type CanvasFillMode = 'letterbox' | 'blur-fill' | 'crop';
export type RotateDeg = 0 | 90 | 180 | 270;

// ─── Color Grading ────────────────────────────────────────────────────────────

export type ColorPreset = 'none' | 'cinematic' | 'noir' | 'warm' | 'vintage' | 'cold-teal';

export interface ColorAdjustments {
  brightness: number;   // -100 to +100 (0 = neutral)
  contrast: number;     // -100 to +100 (0 = neutral)
  saturation: number;   // -100 to +100 (0 = neutral)
  vibrance: number;     // 0 to 200 (100 = neutral)
  temperature: number;  // -50 to +50 (0 = neutral)
  preset: ColorPreset;
}

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 100,
  temperature: 0,
  preset: 'none',
};

// ─── Audio ────────────────────────────────────────────────────────────────────

export interface AudioLayer {
  /** Background music file path (null = no BGM) */
  bgmPath: string | null;
  bgmVolume: number;    // 0.0 to 1.0
  /** Duration in seconds for fade-in (0 = no fade) */
  audioFadeIn: number;
  /** Duration in seconds for fade-out (0 = no fade) */
  audioFadeOut: number;
  /** Auto-duck primary audio when BGM is active */
  audioDucking: boolean;
}

export const DEFAULT_AUDIO_LAYER: AudioLayer = {
  bgmPath: null,
  bgmVolume: 0.4,
  audioFadeIn: 0,
  audioFadeOut: 0,
  audioDucking: false,
};

// ─── Enhanced Export Options (IPC contract) ───────────────────────────────────

export interface EnhancedExportOptions {
  inputPath: string;
  inPoint: number;
  outPoint: number;
  saveTarget?: 'new-file' | 'overwrite-original';
  cutMode?: 'keep-selection' | 'delete-selection';
  speed?: number;
  gain?: number;
  outputFormat?: string | null;
  resolution?: TargetResolution;
  // New in Clipchamp upgrade
  colorAdjustments?: ColorAdjustments;
  bgmPath?: string | null;
  bgmVolume?: number;
  audioFadeIn?: number;
  audioFadeOut?: number;
  canvasRatio?: CanvasAspectRatio;
  canvasFillMode?: CanvasFillMode;
  flipH?: boolean;
  flipV?: boolean;
  rotateDeg?: RotateDeg;
}

/** A segment in a multi-clip sequence export */
export interface SequenceClipExport {
  filePath: string;
  inPoint: number;
  outPoint: number;
  speed?: number;
  gain?: number;
  colorAdjustments?: ColorAdjustments;
}

export interface SequenceExportOptions {
  clips: SequenceClipExport[];
  outputFormat?: string;
  resolution?: TargetResolution;
  canvasRatio?: CanvasAspectRatio;
  canvasFillMode?: CanvasFillMode;
  bgmPath?: string | null;
  bgmVolume?: number;
  audioFadeIn?: number;
  audioFadeOut?: number;
}

// ─── Inspector Panel Tabs ─────────────────────────────────────────────────────

export type InspectorTab = 'cut' | 'color' | 'audio' | 'canvas' | 'export';

// ─── Supported extensions ─────────────────────────────────────────────────────

export const VIDEO_EXTS = new Set([
  'mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v', 'ts', '3gp', 'ogv',
]);
