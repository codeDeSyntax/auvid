// ─── Audio Trimmer — Electron Main Process ────────────────────────────────────
// Handles:
//   trim:get-info       → ffprobe to get duration, codec, sampleRate, channels
//   trim:export         → ffmpeg trim + fade + gain → output file
//   trim:cancel         → kill active export job
//   dialog:open-audio-files → native file picker for audio files

import { app, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── FFmpeg singleton ─────────────────────────────────────────────────────────
import { resolveBinaryPath } from './binaries';

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
      console.warn('[AudioTrimmer] ffprobe-static not found');
    }
  } catch (err) {
    console.error('[AudioTrimmer] Failed to load fluent-ffmpeg:', err);
  }
}

// ─── Supported audio extensions ───────────────────────────────────────────────
const AUDIO_EXTS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'alac', 'ac3',
]);

// ─── Active export jobs (for cancellation) ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activeExports = new Map<string, any>();

// ─── Get default output directory ─────────────────────────────────────────────
function getTrimOutputDir(): string {
  let audioDir = '';
  try {
    audioDir = path.join(app.getPath('music'), 'AUVID');
  } catch {
    audioDir = path.join(os.homedir(), 'Music', 'AUVID');
  }
  try { fs.mkdirSync(audioDir, { recursive: true }); } catch (_) {}
  return audioDir;
}

// ─── Extract embedded cover art via ffmpeg ────────────────────────────────────
async function extractCoverArt(filePath: string): Promise<string | null> {
  if (!ffmpegPath) return null;

  const tmpDir = (() => {
    try { return app.getPath('temp'); } catch { return os.tmpdir(); }
  })();
  const tmpCover = path.join(tmpDir, `auvid_trim_cover_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);

  return new Promise((resolve) => {
    const args = [
      '-y',
      '-i', filePath,
      '-an',              // no audio
      '-vf', 'scale=200:200:force_original_aspect_ratio=decrease',
      '-frames:v', '1',
      tmpCover,
    ];
    const proc = spawn(ffmpegPath!, args, { windowsHide: true });
    proc.on('close', (code: number) => {
      if (code === 0 && fs.existsSync(tmpCover)) {
        try {
          const data = fs.readFileSync(tmpCover);
          const b64 = data.toString('base64');
          fs.unlinkSync(tmpCover);
          resolve(`data:image/jpeg;base64,${b64}`);
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
  });
}

// ─── ffprobe wrapper ──────────────────────────────────────────────────────────
interface AudioInfo {
  duration: number;
  sampleRate: number;
  channels: number;
  codec: string;
  bitrate: number;
  format: string;
  coverArt?: string | null;
}

function getAudioInfo(filePath: string): Promise<AudioInfo> {
  return new Promise((resolve, reject) => {
    if (!ffmpeg) { reject(new Error('FFmpeg not loaded')); return; }
    ffmpeg.ffprobe(filePath, async (err: Error | null, metadata: any) => {
      if (err) { reject(err); return; }
      const audio = metadata.streams?.find((s: any) => s.codec_type === 'audio');
      const coverArt = await extractCoverArt(filePath).catch(() => null);

      resolve({
        duration: parseFloat(metadata.format?.duration ?? '0'),
        bitrate: Math.round(parseFloat(metadata.format?.bit_rate ?? '0') / 1000),
        sampleRate: parseInt(audio?.sample_rate ?? '44100', 10),
        channels: audio?.channels ?? 2,
        codec: audio?.codec_name ?? 'unknown',
        format: metadata.format?.format_name?.split(',')[0] ?? 'unknown',
        coverArt,
      });
    });
  });
}
// ─── Export options ───────────────────────────────────────────────────────────
interface TrimExportOptions {
  inputPath: string;
  inPoint: number;
  outPoint: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  gain: number;
  outputFormat: string | null; // null = keep same format
  saveTarget?: 'new-file' | 'overwrite-original'; // 'new-file' or 'overwrite-original'
  cutMode?: 'keep-selection' | 'delete-selection'; // 'keep-selection' (crop) or 'delete-selection' (cut out)
}

async function exportTrim(
  options: TrimExportOptions,
  onProgress?: (percent: number) => void,
): Promise<{ outputPath: string; overwritten: boolean; newSize?: number; newDuration?: number }> {
  const {
    inputPath,
    inPoint,
    outPoint,
    fadeInDuration,
    fadeOutDuration,
    gain,
    outputFormat,
    saveTarget = 'new-file',
    cutMode = 'keep-selection',
  } = options;

  if (!ffmpeg) throw new Error('FFmpeg not loaded');

  const info = await getAudioInfo(inputPath);
  const totalDuration = info.duration;

  // Determine source bitrate accurately so output size is strictly proportional to duration
  let sourceBitrate = info.bitrate;
  if (sourceBitrate <= 0 && totalDuration > 0) {
    try {
      const stat = fs.statSync(inputPath);
      sourceBitrate = Math.round(((stat.size * 8) / totalDuration) / 1000);
    } catch (_) {}
  }
  if (sourceBitrate <= 0) sourceBitrate = 192; // fallback

  const ext = outputFormat ?? (path.extname(inputPath).replace('.', '').toLowerCase() || 'mp3');
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const isOverwrite = saveTarget === 'overwrite-original';

  // Output path determination
  let outputPath: string;
  let tempOutputPath: string | null = null;

  if (isOverwrite) {
    // Generate temp file first for atomic overwrite
    const tmpDir = (() => {
      try { return app.getPath('temp'); } catch { return os.tmpdir(); }
    })();
    tempOutputPath = path.join(tmpDir, `auvid_trim_${Date.now()}_${baseName}.${ext}`);
    outputPath = tempOutputPath;
  } else {
    const outputDir = getTrimOutputDir();
    const suffix = cutMode === 'delete-selection' ? '_cut' : '_trim';
    outputPath = path.join(outputDir, `${baseName}${suffix}.${ext}`);
  }

  const exportId = `${Date.now()}`;

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath);

    const isSameFormat = !outputFormat || outputFormat === path.extname(inputPath).replace('.', '').toLowerCase();
    const hasAudioFilters = (fadeInDuration > 0) || (fadeOutDuration > 0) || (Math.abs(gain - 1.0) > 0.01);
    const isLosslessTarget = ext === 'wav' || ext === 'flac' || ext === 'aiff' || ext === 'alac';

    if (cutMode === 'delete-selection') {
      // Cut out the selected region: keep [0, inPoint] + [outPoint, totalDuration]
      const seg1End = Math.max(0, inPoint);
      const seg2Start = Math.min(totalDuration, outPoint);

      if (seg1End <= 0.05 && seg2Start >= totalDuration - 0.05) {
        return reject(new Error('Cannot cut entire audio length'));
      }

      if (seg1End <= 0.05) {
        // Just trim from seg2Start to end
        cmd = cmd.seekInput(seg2Start);
        if (isSameFormat && !hasAudioFilters) {
          cmd = cmd.audioCodec('copy');
        }
      } else if (seg2Start >= totalDuration - 0.05) {
        // Just trim from 0 to seg1End
        cmd = cmd.duration(seg1End);
        if (isSameFormat && !hasAudioFilters) {
          cmd = cmd.audioCodec('copy');
        }
      } else {
        // Concat two parts together
        const filterStr = `[0:a]atrim=start=0:end=${seg1End.toFixed(3)},asetpts=PTS-STARTPTS[a1];[0:a]atrim=start=${seg2Start.toFixed(3)},asetpts=PTS-STARTPTS[a2];[a1][a2]concat=n=2:v=0:a=1[aout]`;
        cmd = cmd.complexFilter(filterStr, ['aout']);
      }

      // Apply gain if needed
      if (Math.abs(gain - 1.0) > 0.01) {
        cmd = cmd.audioFilters(`volume=${gain.toFixed(4)}`);
      }
    } else {
      // Keep selected region [inPoint, outPoint]
      const duration = outPoint - inPoint;
      if (duration <= 0) return reject(new Error('Invalid trim region: out must be after in'));

      cmd = cmd.seekInput(inPoint).duration(duration);

      const filters: string[] = [];
      if (fadeInDuration > 0) {
        filters.push(`afade=t=in:st=0:d=${fadeInDuration.toFixed(3)}`);
      }
      if (fadeOutDuration > 0) {
        const fadeOutStart = Math.max(0, duration - fadeOutDuration);
        filters.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOutDuration.toFixed(3)}`);
      }
      if (Math.abs(gain - 1.0) > 0.01) {
        filters.push(`volume=${gain.toFixed(4)}`);
      }

      if (filters.length > 0) {
        cmd = cmd.audioFilters(filters.join(','));
      } else if (isSameFormat) {
        // Use lossless fast copy when no filters are active
        cmd = cmd.audioCodec('copy');
      }
    }

    // Codec & Bitrate mapping for transcoding or filtered output
    if (!isSameFormat || hasAudioFilters || cutMode === 'delete-selection') {
      const codecMap: Record<string, string> = {
        mp3: 'libmp3lame',
        aac: 'aac',
        m4a: 'aac',
        ogg: 'libvorbis',
        opus: 'libopus',
        flac: 'flac',
        wav: 'pcm_s16le',
        wma: 'wmav2',
        aiff: 'pcm_s16be',
        alac: 'alac',
      };
      const codec = codecMap[ext];
      if (codec && !(isSameFormat && !hasAudioFilters && cutMode !== 'delete-selection')) {
        cmd = cmd.audioCodec(codec);
      }

      // Cap bitrate at the original source bitrate to keep output size strictly proportional
      if (!isLosslessTarget && sourceBitrate > 0) {
        cmd = cmd.audioBitrate(`${sourceBitrate}k`);
      }
    }

    // Strip video/artwork to prevent encoder errors on filter operations
    cmd = cmd.noVideo();

    const targetLength = cutMode === 'delete-selection'
      ? Math.max(0.1, totalDuration - (outPoint - inPoint))
      : Math.max(0.1, outPoint - inPoint);

    cmd
      .output(outputPath)
      .on('start', (cmdLine: string) => {
        console.log('[AudioTrimmer] FFmpeg command:', cmdLine);
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
            // Overwrite original file in-place
            fs.copyFileSync(tempOutputPath, inputPath);
            try { fs.unlinkSync(tempOutputPath); } catch (_) {}

            const updatedStats = fs.statSync(inputPath);
            let updatedDuration = 0;
            try {
              const updatedInfo = await getAudioInfo(inputPath);
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

// ─── IPC Handler Registration ─────────────────────────────────────────────────
export async function registerAudioTrimmerHandlers() {
  await loadFFmpeg();

  // ── trim:get-info ──────────────────────────────────────────────────────────
  ipcMain.handle('trim:get-info', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const ext = path.extname(filePath).replace('.', '').toLowerCase();
      if (!AUDIO_EXTS.has(ext)) {
        throw new Error(`Unsupported format: .${ext}`);
      }
      return await getAudioInfo(filePath);
    } catch (err) {
      console.error('[AudioTrimmer] trim:get-info error:', err);
      throw err;
    }
  });

  // ── trim:export ────────────────────────────────────────────────────────────
  ipcMain.handle('trim:export', async (event, options: TrimExportOptions) => {
    try {
      if (!options.inputPath || !fs.existsSync(options.inputPath)) {
        throw new Error(`File not found: ${options.inputPath}`);
      }
      const result = await exportTrim(options, (percent: number) => {
        try {
          event.sender.send('trim:progress', { percent });
        } catch (_) {}
      });
      console.log('[AudioTrimmer] Export done:', result.outputPath);
      return result;
    } catch (err) {
      console.error('[AudioTrimmer] trim:export error:', err);
      throw err;
    }
  });

  // ── trim:cancel ────────────────────────────────────────────────────────────
  ipcMain.handle('trim:cancel', async (_event, exportId?: string) => {
    if (exportId && activeExports.has(exportId)) {
      try { activeExports.get(exportId).kill('SIGKILL'); } catch (_) {}
      activeExports.delete(exportId);
    } else {
      // Cancel all
      for (const [id, job] of activeExports.entries()) {
        try { job.kill('SIGKILL'); } catch (_) {}
        activeExports.delete(id);
      }
    }
  });

  // ── trim:get-cover ────────────────────────────────────────────────────────
  ipcMain.handle('trim:get-cover', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      return await extractCoverArt(filePath);
    } catch {
      return null;
    }
  });

  // ── trim:read-file-buffer ──────────────────────────────────────────────────
  ipcMain.handle('trim:read-file-buffer', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const buf = await fs.promises.readFile(filePath);
      return buf;
    } catch (err) {
      console.error('[AudioTrimmer] trim:read-file-buffer error:', err);
      throw err;
    }
  });

  // ── dialog:open-audio-file(s) ──────────────────────────────────────────────
  if (!ipcMain.listeners('dialog:open-audio-file').length) {
    ipcMain.handle('dialog:open-audio-file', async (_event) => {
      const result = await dialog.showOpenDialog({
        title: 'Select Audio File',
        properties: ['openFile'],
        filters: [
          {
            name: 'Audio Files',
            extensions: [...AUDIO_EXTS],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      return result.canceled ? null : result.filePaths;
    });
  }

  if (!ipcMain.listeners('dialog:open-audio-files').length) {
    ipcMain.handle('dialog:open-audio-files', async (_event) => {
      const result = await dialog.showOpenDialog({
        title: 'Select Audio File',
        properties: ['openFile'],
        filters: [
          {
            name: 'Audio Files',
            extensions: [...AUDIO_EXTS],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      return result.canceled ? null : result.filePaths;
    });
  }
}

export function cleanupAudioTrimmer() {
  for (const [id, job] of activeExports.entries()) {
    try { job.kill('SIGKILL'); } catch (_) {}
    activeExports.delete(id);
  }
  // Remove all IPC handlers
  for (const ch of ['trim:get-info', 'trim:get-cover', 'trim:read-file-buffer', 'trim:export', 'trim:cancel', 'dialog:open-audio-file', 'dialog:open-audio-files']) {
    try { ipcMain.removeHandler(ch); } catch (_) {}
  }
}
