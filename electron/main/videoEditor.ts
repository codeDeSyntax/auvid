// ─── Video Editor & Cutter — Electron Main Process ────────────────────────────
// Handles:
//   video:get-info       → ffprobe video/audio streams, resolution, fps, bitrate
//   video:get-thumbnails → generate filmstrip keyframe thumbnails across timeline
//   video:export         → lossless cut or filtered transcode (speed, volume, format)
//   video:extract-audio  → extract soundtrack directly to MP3, WAV, AAC, FLAC
//   video:cancel         → cancel active export job
//   dialog:open-video-file(s) → native video file pickers

import { app, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { resolveBinaryPath } from './binaries';

// ─── FFmpeg singleton ─────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpeg: any = null;
let ffmpegPath: string | null = null;
let ffprobePath: string | null = null;

async function loadFFmpeg() {
  if (ffmpeg) return;
  try {
    ffmpeg = require('fluent-ffmpeg');
    const staticPath = require('ffmpeg-static');
    ffmpegPath = resolveBinaryPath(staticPath);
    if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

    try {
      const probePkg = require('ffprobe-static');
      ffprobePath = resolveBinaryPath(probePkg?.path ?? probePkg);
      if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
    } catch {
      console.warn('[VideoEditor] ffprobe-static not found');
    }
  } catch (err) {
    console.error('[VideoEditor] Failed to load fluent-ffmpeg:', err);
  }
}

// ─── Supported video extensions ───────────────────────────────────────────────
const VIDEO_EXTS = new Set([
  'mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v', 'ts', '3gp', 'ogv',
]);

// ─── Active export jobs (for cancellation) ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activeExports = new Map<string, any>();

// ─── Default output directory ─────────────────────────────────────────────────
function getVideoOutputDir(): string {
  let videoDir = '';
  try {
    videoDir = path.join(app.getPath('videos'), 'AUVID');
  } catch {
    videoDir = path.join(os.homedir(), 'Videos', 'AUVID');
  }
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }
  return videoDir;
}

// ─── Video Information ────────────────────────────────────────────────────────
export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  videoBitrate: number; // kbps
  audioBitrate: number; // kbps
  audioChannels: number;
  size: number;
}

export function getVideoInfo(filePath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    if (!ffmpeg) return reject(new Error('FFmpeg not loaded'));

    ffmpeg.ffprobe(filePath, (err: Error | null, metadata: any) => {
      if (err) return reject(err);

      const vStream = metadata.streams?.find((s: any) => s.codec_type === 'video');
      const aStream = metadata.streams?.find((s: any) => s.codec_type === 'audio');
      const format = metadata.format || {};

      const duration = parseFloat(format.duration || vStream?.duration || aStream?.duration || '0');
      const width = parseInt(vStream?.width || '0', 10);
      const height = parseInt(vStream?.height || '0', 10);

      // FPS calculation
      let fps = 30;
      if (vStream?.r_frame_rate) {
        const parts = vStream.r_frame_rate.split('/');
        if (parts.length === 2 && parseFloat(parts[1]) > 0) {
          fps = Math.round((parseFloat(parts[0]) / parseFloat(parts[1])) * 10) / 10;
        } else {
          fps = parseFloat(vStream.r_frame_rate) || 30;
        }
      }

      // Bitrates
      const totalBitrate = parseInt(format.bit_rate || '0', 10) / 1000;
      const vBitrate = parseInt(vStream?.bit_rate || '0', 10) / 1000 || Math.max(0, totalBitrate - 192);
      const aBitrate = parseInt(aStream?.bit_rate || '0', 10) / 1000 || 192;

      // Aspect ratio
      let aspectRatio = '16:9';
      if (width > 0 && height > 0) {
        const ratio = width / height;
        if (Math.abs(ratio - 16 / 9) < 0.05) aspectRatio = '16:9';
        else if (Math.abs(ratio - 9 / 16) < 0.05) aspectRatio = '9:16';
        else if (Math.abs(ratio - 4 / 3) < 0.05) aspectRatio = '4:3';
        else if (Math.abs(ratio - 1) < 0.05) aspectRatio = '1:1';
        else aspectRatio = `${width}:${height}`;
      }

      resolve({
        duration,
        width,
        height,
        aspectRatio,
        fps,
        videoCodec: vStream?.codec_name || 'unknown',
        audioCodec: aStream?.codec_name || 'none',
        videoBitrate: Math.round(vBitrate),
        audioBitrate: Math.round(aBitrate),
        audioChannels: aStream?.channels || 0,
        size: parseInt(format.size || '0', 10),
      });
    });
  });
}

// ─── Generate Timeline Filmstrip Thumbnails ───────────────────────────────────
export async function generateVideoThumbnails(
  filePath: string,
  count = 10,
): Promise<string[]> {
  await loadFFmpeg();
  if (!ffmpeg || !ffmpegPath) throw new Error('FFmpeg not loaded');

  const info = await getVideoInfo(filePath);
  const dur = info.duration;
  if (dur <= 0) return [];

  const tmpDir = path.join(app.getPath('temp'), `auvid_thumbs_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const interval = dur / (count + 1);
  const timestamps: number[] = [];
  for (let i = 1; i <= count; i++) {
    timestamps.push(i * interval);
  }

  return new Promise((resolve) => {
    let completed = 0;
    const thumbnails: { index: number; dataUrl: string }[] = [];

    timestamps.forEach((time, index) => {
      const outName = `thumb_${index}.jpg`;
      const outPath = path.join(tmpDir, outName);

      const proc = spawn(ffmpegPath!, [
        '-ss', time.toFixed(3),
        '-i', filePath,
        '-vframes', '1',
        '-q:v', '4',
        '-vf', 'scale=160:-1',
        '-y',
        outPath,
      ]);

      proc.on('close', () => {
        try {
          if (fs.existsSync(outPath)) {
            const buf = fs.readFileSync(outPath);
            const b64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
            thumbnails.push({ index, dataUrl: b64 });
            try { fs.unlinkSync(outPath); } catch (_) {}
          }
        } catch (_) {}

        completed++;
        if (completed === timestamps.length) {
          try { fs.rmdirSync(tmpDir); } catch (_) {}
          thumbnails.sort((a, b) => a.index - b.index);
          resolve(thumbnails.map((t) => t.dataUrl));
        }
      });

      proc.on('error', () => {
        completed++;
        if (completed === timestamps.length) {
          try { fs.rmdirSync(tmpDir); } catch (_) {}
          thumbnails.sort((a, b) => a.index - b.index);
          resolve(thumbnails.map((t) => t.dataUrl));
        }
      });
    });
  });
}

// ─── Video Export & Trim Options ───────────────────────────────────────────────
export interface VideoExportOptions {
  inputPath: string;
  inPoint: number;
  outPoint: number;
  saveTarget?: 'new-file' | 'overwrite-original';
  cutMode?: 'keep-selection' | 'delete-selection';
  speed?: number; // 0.25 to 2.0
  gain?: number; // 0.0 to 3.0
  outputFormat?: string | null;
  resolution?: 'original' | '1080p' | '720p' | '480p';
}

export async function exportVideoTrim(
  options: VideoExportOptions,
  onProgress?: (percent: number) => void,
): Promise<{ outputPath: string; overwritten: boolean; newSize?: number; newDuration?: number }> {
  await loadFFmpeg();
  if (!ffmpeg) throw new Error('FFmpeg not loaded');

  const {
    inputPath,
    inPoint,
    outPoint,
    saveTarget = 'new-file',
    cutMode = 'keep-selection',
    speed = 1.0,
    gain = 1.0,
    outputFormat = null,
    resolution = 'original',
  } = options;

  const info = await getVideoInfo(inputPath);
  const totalDuration = info.duration;
  const isOverwrite = saveTarget === 'overwrite-original';

  const ext = outputFormat || path.extname(inputPath).replace('.', '').toLowerCase() || 'mp4';
  const baseName = path.basename(inputPath, path.extname(inputPath));

  let outputPath: string;
  let tempOutputPath: string | null = null;

  if (isOverwrite) {
    const tmpDir = (() => {
      try { return app.getPath('temp'); } catch { return os.tmpdir(); }
    })();
    tempOutputPath = path.join(tmpDir, `auvid_vid_${Date.now()}_${baseName}.${ext}`);
    outputPath = tempOutputPath;
  } else {
    const outputDir = getVideoOutputDir();
    const suffix = cutMode === 'delete-selection' ? '_cut' : '_trim';
    outputPath = path.join(outputDir, `${baseName}${suffix}.${ext}`);
  }

  const exportId = `${Date.now()}`;

  const isSameFormat = !outputFormat || outputFormat === path.extname(inputPath).replace('.', '').toLowerCase();
  const hasSpeed = Math.abs(speed - 1.0) > 0.02;
  const hasAudioGain = Math.abs(gain - 1.0) > 0.02;
  const hasResolutionChange = resolution !== 'original';

  const canLosslessCopy = isSameFormat && !hasSpeed && !hasAudioGain && !hasResolutionChange && cutMode === 'keep-selection';

  const targetLength = cutMode === 'delete-selection'
    ? Math.max(0.1, totalDuration - (outPoint - inPoint))
    : Math.max(0.1, outPoint - inPoint);

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath);

    if (cutMode === 'delete-selection') {
      const seg1End = Math.max(0, inPoint);
      const seg2Start = Math.min(totalDuration, outPoint);

      if (seg1End <= 0.05 && seg2Start >= totalDuration - 0.05) {
        return reject(new Error('Cannot cut entire video length'));
      }

      if (seg1End <= 0.05) {
        cmd = cmd.seekInput(seg2Start);
      } else if (seg2Start >= totalDuration - 0.05) {
        cmd = cmd.duration(seg1End);
      } else {
        const filterStr = `[0:v]trim=start=0:end=${seg1End.toFixed(3)},setpts=PTS-STARTPTS[v1];[0:a]atrim=start=0:end=${seg1End.toFixed(3)},asetpts=PTS-STARTPTS[a1];[0:v]trim=start=${seg2Start.toFixed(3)},setpts=PTS-STARTPTS[v2];[0:a]atrim=start=${seg2Start.toFixed(3)},asetpts=PTS-STARTPTS[a2];[v1][a1][v2][a2]concat=n=2:v=1:a=1[vout][aout]`;
        cmd = cmd.complexFilter(filterStr, ['vout', 'aout']);
      }
    } else {
      // Keep selection [inPoint, outPoint]
      const duration = outPoint - inPoint;
      if (duration <= 0) return reject(new Error('Invalid trim range'));

      cmd = cmd.seekInput(inPoint).duration(duration);

      if (canLosslessCopy) {
        // Instant lossless stream copy
        cmd = cmd.videoCodec('copy').audioCodec('copy');
      } else {
        // Video filters
        const vFilters: string[] = [];
        if (hasSpeed) {
          vFilters.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
        }
        if (resolution === '1080p') vFilters.push('scale=-2:1080');
        else if (resolution === '720p') vFilters.push('scale=-2:720');
        else if (resolution === '480p') vFilters.push('scale=-2:480');

        if (vFilters.length > 0) {
          cmd = cmd.videoFilters(vFilters.join(','));
        }

        // Audio filters
        const aFilters: string[] = [];
        if (hasSpeed) {
          aFilters.push(`atempo=${speed.toFixed(4)}`);
        }
        if (hasAudioGain) {
          aFilters.push(`volume=${gain.toFixed(4)}`);
        }
        if (aFilters.length > 0) {
          cmd = cmd.audioFilters(aFilters.join(','));
        }

        // Bitrate preservation
        if (info.videoBitrate > 0) {
          cmd = cmd.videoBitrate(`${info.videoBitrate}k`);
        }
        if (info.audioBitrate > 0) {
          cmd = cmd.audioBitrate(`${info.audioBitrate}k`);
        }
      }
    }

    cmd
      .output(outputPath)
      .on('start', (cmdLine: string) => {
        console.log('[VideoEditor] FFmpeg command:', cmdLine);
        activeExports.set(exportId, cmd);
        if (onProgress) onProgress(0);
      })
      .on('progress', (progress: { percent?: number; timemark?: string }) => {
        let pct = progress.percent;
        if (pct === undefined || isNaN(pct) || pct <= 0) {
          if (progress.timemark) {
            const parts = progress.timemark.split(':');
            if (parts.length >= 3) {
              const secs = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
              pct = Math.round((secs / targetLength) * 100);
            }
          }
        }
        if (pct !== undefined && !isNaN(pct)) {
          const clamped = Math.min(99, Math.max(1, Math.round(pct)));
          if (onProgress) onProgress(clamped);
        }
      })
      .on('end', async () => {
        activeExports.delete(exportId);
        if (onProgress) onProgress(100);
        try {
          if (isOverwrite && tempOutputPath && fs.existsSync(tempOutputPath)) {
            fs.copyFileSync(tempOutputPath, inputPath);
            try { fs.unlinkSync(tempOutputPath); } catch (_) {}

            const updatedStats = fs.statSync(inputPath);
            let updatedDuration = 0;
            try {
              const updatedInfo = await getVideoInfo(inputPath);
              updatedDuration = updatedInfo.duration;
            } catch (_) {}

            resolve({
              outputPath: inputPath,
              overwritten: true,
              newSize: updatedStats.size,
              newDuration: updatedDuration,
            });
          } else {
            const stats = fs.existsSync(outputPath) ? fs.statSync(outputPath) : undefined;
            resolve({
              outputPath,
              overwritten: false,
              newSize: stats?.size,
            });
          }
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err: Error) => {
        activeExports.delete(exportId);
        if (tempOutputPath && fs.existsSync(tempOutputPath)) {
          try { fs.unlinkSync(tempOutputPath); } catch (_) {}
        }
        reject(err);
      })
      .run();
  });
}

// ─── Extract Audio from Video ─────────────────────────────────────────────────
export interface ExtractAudioOptions {
  inputPath: string;
  format?: 'mp3' | 'wav' | 'aac' | 'flac';
  inPoint?: number;
  outPoint?: number;
}

export async function extractAudioFromVideo(
  options: ExtractAudioOptions,
  onProgress?: (percent: number) => void,
): Promise<{ outputPath: string; size?: number }> {
  await loadFFmpeg();
  if (!ffmpeg) throw new Error('FFmpeg not loaded');

  const {
    inputPath,
    format = 'mp3',
    inPoint,
    outPoint,
  } = options;

  const info = await getVideoInfo(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputDir = path.join(app.getPath('music'), 'AUVID');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${baseName}_audio.${format}`);
  const exportId = `audio_extract_${Date.now()}`;

  const targetLength = (outPoint && inPoint && outPoint > inPoint)
    ? outPoint - inPoint
    : info.duration;

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath).noVideo();

    if (inPoint !== undefined && outPoint !== undefined && outPoint > inPoint) {
      cmd = cmd.seekInput(inPoint).duration(outPoint - inPoint);
    }

    if (format === 'mp3') cmd = cmd.audioCodec('libmp3lame').audioBitrate('320k');
    else if (format === 'aac') cmd = cmd.audioCodec('aac').audioBitrate('256k');
    else if (format === 'wav') cmd = cmd.audioCodec('pcm_s16le');
    else if (format === 'flac') cmd = cmd.audioCodec('flac');

    cmd
      .output(outputPath)
      .on('start', () => {
        activeExports.set(exportId, cmd);
        if (onProgress) onProgress(0);
      })
      .on('progress', (progress: { percent?: number; timemark?: string }) => {
        let pct = progress.percent;
        if (pct === undefined || isNaN(pct) || pct <= 0) {
          if (progress.timemark && targetLength > 0) {
            const parts = progress.timemark.split(':');
            if (parts.length >= 3) {
              const secs = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
              pct = Math.round((secs / targetLength) * 100);
            }
          }
        }
        if (pct !== undefined && !isNaN(pct)) {
          if (onProgress) onProgress(Math.min(99, Math.max(1, Math.round(pct))));
        }
      })
      .on('end', () => {
        activeExports.delete(exportId);
        if (onProgress) onProgress(100);
        const stats = fs.existsSync(outputPath) ? fs.statSync(outputPath) : undefined;
        resolve({ outputPath, size: stats?.size });
      })
      .on('error', (err: Error) => {
        activeExports.delete(exportId);
        reject(err);
      })
      .run();
  });
}

// ─── IPC Handler Registration ─────────────────────────────────────────────────
export async function registerVideoEditorHandlers() {
  await loadFFmpeg();

  // ── video:get-info ──────────────────────────────────────────────────────────
  ipcMain.handle('video:get-info', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      return await getVideoInfo(filePath);
    } catch (err) {
      console.error('[VideoEditor] video:get-info error:', err);
      throw err;
    }
  });

  // ── video:get-thumbnails ────────────────────────────────────────────────────
  ipcMain.handle('video:get-thumbnails', async (_event, filePath: string, count = 10) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return [];
      return await generateVideoThumbnails(filePath, count);
    } catch (err) {
      console.error('[VideoEditor] video:get-thumbnails error:', err);
      return [];
    }
  });

  // ── video:export ────────────────────────────────────────────────────────────
  ipcMain.handle('video:export', async (event, options: VideoExportOptions) => {
    try {
      if (!options.inputPath || !fs.existsSync(options.inputPath)) {
        throw new Error(`File not found: ${options.inputPath}`);
      }
      const result = await exportVideoTrim(options, (percent: number) => {
        try {
          event.sender.send('video:progress', { percent });
        } catch (_) {}
      });
      return result;
    } catch (err) {
      console.error('[VideoEditor] video:export error:', err);
      throw err;
    }
  });

  // ── video:extract-audio ────────────────────────────────────────────────────
  ipcMain.handle('video:extract-audio', async (event, options: ExtractAudioOptions) => {
    try {
      if (!options.inputPath || !fs.existsSync(options.inputPath)) {
        throw new Error(`File not found: ${options.inputPath}`);
      }
      const result = await extractAudioFromVideo(options, (percent: number) => {
        try {
          event.sender.send('video:progress', { percent });
        } catch (_) {}
      });
      return result;
    } catch (err) {
      console.error('[VideoEditor] video:extract-audio error:', err);
      throw err;
    }
  });

  // ── video:cancel ────────────────────────────────────────────────────────────
  ipcMain.handle('video:cancel', async (_event, exportId?: string) => {
    if (exportId && activeExports.has(exportId)) {
      try { activeExports.get(exportId).kill('SIGKILL'); } catch (_) {}
      activeExports.delete(exportId);
    } else {
      for (const [id, job] of activeExports.entries()) {
        try { job.kill('SIGKILL'); } catch (_) {}
        activeExports.delete(id);
      }
    }
  });

  // ── dialog:open-video-file ─────────────────────────────────────────────────
  if (!ipcMain.listeners('dialog:open-video-file').length) {
    ipcMain.handle('dialog:open-video-file', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Select Video File',
        properties: ['openFile'],
        filters: [
          { name: 'Video Files', extensions: [...VIDEO_EXTS] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      return result.canceled ? null : result.filePaths;
    });
  }

  if (!ipcMain.listeners('dialog:open-video-files').length) {
    ipcMain.handle('dialog:open-video-files', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Select Video Files',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Video Files', extensions: [...VIDEO_EXTS] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      return result.canceled ? null : result.filePaths;
    });
  }
}

export function cleanupVideoEditor() {
  for (const [id, job] of activeExports.entries()) {
    try { job.kill('SIGKILL'); } catch (_) {}
    activeExports.delete(id);
  }
  for (const ch of [
    'video:get-info',
    'video:get-thumbnails',
    'video:export',
    'video:extract-audio',
    'video:cancel',
    'dialog:open-video-file',
    'dialog:open-video-files',
  ]) {
    try { ipcMain.removeHandler(ch); } catch (_) {}
  }
}
