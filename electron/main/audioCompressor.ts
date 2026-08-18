// ─── Audio Compressor — Electron Main Process Engine ─────────────────────────
// All CPU-intensive FFmpeg operations run here, never in the renderer.
// Progress is streamed to renderer via webContents.send().

import { app, ipcMain, BrowserWindow, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Default Output Directories (Music/AUVID and Videos/AUVID) ────────────────
export function getDefaultOutputDirs(customBase?: string): { baseDir: string; audioDir: string; videoDir: string } {
  let audioDir = '';
  let videoDir = '';
  let baseDir = '';

  if (customBase && customBase.trim()) {
    baseDir = customBase;
    audioDir = path.join(baseDir, 'Audio');
    videoDir = path.join(baseDir, 'Video');
  } else {
    try {
      audioDir = path.join(app.getPath('music'), 'AUVID');
    } catch {
      audioDir = path.join(os.homedir(), 'Music', 'AUVID');
    }

    try {
      videoDir = path.join(app.getPath('videos'), 'AUVID');
    } catch {
      videoDir = path.join(os.homedir(), 'Videos', 'AUVID');
    }

    baseDir = path.dirname(audioDir);
  }

  try {
    fs.mkdirSync(audioDir, { recursive: true });
    fs.mkdirSync(videoDir, { recursive: true });
  } catch (err) {
    console.error('[AudioCompressor] Failed to initialize default output directories:', err);
  }

  return { baseDir, audioDir, videoDir };
}

// ─── Staging Directory (Temporary output before user explicitly saves) ────────
export function getStagingDir(): string {
  let staging = '';
  try {
    staging = path.join(app.getPath('temp'), 'AUVID_Staging');
  } catch {
    staging = path.join(os.tmpdir(), 'AUVID_Staging');
  }
  try {
    fs.mkdirSync(staging, { recursive: true });
  } catch (_) { /* ignore */ }
  return staging;
}

import { resolveBinaryPath } from './binaries';

// Dynamic imports to handle ESM/CJS compat in Electron context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpeg: any = null;
let ffmpegPath: string | null = null;
let ffprobePath: string | null = null;

async function loadFFmpeg() {
  if (ffmpeg) return;
  try {
    // fluent-ffmpeg is CJS, require() it
    ffmpeg = require('fluent-ffmpeg');
    // ffmpeg-static returns the path to the bundled binary
    const staticPath = require('ffmpeg-static');
    ffmpegPath = resolveBinaryPath(staticPath);
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
      console.log('[AudioCompressor] FFmpeg binary:', ffmpegPath);
    } else {
      console.warn('[AudioCompressor] ffmpeg-static returned no path — falling back to system ffmpeg');
    }

    try {
      const probePkg = require('ffprobe-static');
      ffprobePath = resolveBinaryPath(probePkg?.path ?? probePkg);
      if (ffprobePath) {
        ffmpeg.setFfprobePath(ffprobePath);
        console.log('[AudioCompressor] FFprobe binary:', ffprobePath);
      }
    } catch {
      console.warn('[AudioCompressor] ffprobe-static not found');
    }
  } catch (err) {
    console.error('[AudioCompressor] Failed to load fluent-ffmpeg:', err);
  }
}

// ─── Active job registry (for cancellation) ──────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activeJobs = new Map<string, any>();

// ─── Codec quality-to-parameter mappers ──────────────────────────────────────
function getQualityFlags(format: string, quality: number, bitrateMode: string): string[] {
  // quality is 1 (lowest) → 10 (highest)
  switch (format) {
    case 'mp3': {
      if (bitrateMode === 'vbr') {
        // ffmpeg VBR: 0 (best) → 9 (worst), we invert
        const vbr = Math.round(9 - ((quality - 1) / 9) * 9);
        return ['-q:a', String(vbr)];
      }
      // CBR handled via bitrate param
      return [];
    }
    case 'ogg':
    case 'opus': {
      const q = ((quality - 1) / 9).toFixed(2);
      return ['-q:a', String(q)];
    }
    case 'aac':
    case 'm4a': {
      const vbr = Math.round(1 + ((quality - 1) / 9) * 4); // 1–5
      return bitrateMode === 'vbr' ? ['-vbr', String(vbr)] : [];
    }
    case 'flac': {
      // compression_level: 0 (fast) → 12 (best), invert quality 1→12 and 10→0
      const lvl = Math.round(12 - ((quality - 1) / 9) * 12);
      return ['-compression_level', String(lvl)];
    }
    default:
      return [];
  }
}

function getCodecForFormat(format: string): string {
  const map: Record<string, string> = {
    mp3: 'libmp3lame',
    aac: 'aac',
    m4a: 'aac',
    ogg: 'libvorbis',
    opus: 'libopus',
    flac: 'flac',
    wav: 'pcm_s16le',
    wma: 'wmav2',
    ac3: 'ac3',
    aiff: 'pcm_s16be',
    alac: 'alac',
    amr: 'libopencore_amrnb',
  };
  return map[format] ?? 'copy';
}

// ─── Back-calculate bitrate from target size ──────────────────────────────────
function bitrateFromTargetSize(targetMB: number, durationSec: number): number {
  if (durationSec <= 0) return 128;
  // targetMB * 8 * 1024 = total kilobits  →  / duration = kbps
  const kbps = Math.floor((targetMB * 8 * 1024) / durationSec);
  return Math.max(8, Math.min(kbps, 320));
}

// ─── Probe a file with ffprobe ────────────────────────────────────────────────
function probeFile(filePath: string): Promise<{
  duration: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  codec: string;
  format: string;
}> {
  return new Promise((resolve, reject) => {
    if (!ffmpeg) {
      reject(new Error('FFmpeg not loaded'));
      return;
    }
    ffmpeg.ffprobe(filePath, (err: Error | null, metadata: any) => {
      if (err) {
        reject(err);
        return;
      }
      const audioStream = metadata.streams?.find((s: any) => s.codec_type === 'audio');
      resolve({
        duration: parseFloat(metadata.format?.duration ?? '0'),
        bitrate: Math.round((parseFloat(metadata.format?.bit_rate ?? '0')) / 1000),
        sampleRate: parseInt(audioStream?.sample_rate ?? '44100', 10),
        channels: audioStream?.channels ?? 2,
        codec: audioStream?.codec_name ?? 'unknown',
        format: metadata.format?.format_name ?? 'unknown',
      });
    });
  });
}

// ─── Core compress function ───────────────────────────────────────────────────
interface CompressOptions {
  fileId: string;
  inputPath: string;
  outputDir: string;
  outputFormat: string;
  mode: string;
  qualityLevel: number;
  bitrate: number;
  bitrateMode: string;
  targetSizeMB: number;
  percentageReduction: number;
  sampleRate: number | null;
  channels: string | null;
  useHWAccel: boolean;
  probedDuration?: number;
  probedBitrate?: number;
}

async function compressFile(
  options: CompressOptions,
  win: BrowserWindow,
): Promise<{ outputPath: string; compressedSize: number }> {
  const {
    fileId,
    inputPath,
    outputDir,
    outputFormat,
    mode,
    qualityLevel,
    bitrate,
    bitrateMode,
    targetSizeMB,
    percentageReduction,
    sampleRate,
    channels,
    useHWAccel,
    probedDuration = 0,
    probedBitrate = 128,
  } = options;

  // Build output path — outputs to staging directory so user can preview & compare before manually saving
  const stagingDir = getStagingDir();
  const resolvedOutputDir = outputDir && outputDir.trim() && outputDir !== 'staging'
    ? outputDir
    : stagingDir;
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(resolvedOutputDir, `${baseName}_preview_${fileId.slice(0, 6)}.${outputFormat}`);

  // Ensure output dir exists
  fs.mkdirSync(resolvedOutputDir, { recursive: true });

  // Determine effective bitrate
  let effectiveBitrate = bitrate;
  if (mode === 'targetSize') {
    effectiveBitrate = bitrateFromTargetSize(targetSizeMB, probedDuration);
  } else if (mode === 'percentage') {
    const origBytes = fs.existsSync(inputPath) ? fs.statSync(inputPath).size : 0;
    const origMB = origBytes > 0 ? origBytes / (1024 * 1024) : 10;
    // Percentage represents the target output size as a % of the original (e.g. 20% on 100MB targets 20MB)
    const targetSizeFromPercentMB = Math.max(0.05, origMB * (percentageReduction / 100));
    effectiveBitrate = bitrateFromTargetSize(targetSizeFromPercentMB, probedDuration);
  }

  const codec = getCodecForFormat(outputFormat);
  const qualityFlags = (mode === 'quality') ? getQualityFlags(outputFormat, qualityLevel, bitrateMode) : [];

  return new Promise((resolve, reject) => {
    if (!ffmpeg) {
      reject(new Error('FFmpeg not loaded'));
      return;
    }

    const startTime = Date.now();
    const totalDurationSec = probedDuration || 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cmd = ffmpeg(inputPath);

    if (useHWAccel) {
      cmd = cmd.inputOptions(['-hwaccel', 'auto']);
    }

    cmd = cmd.audioCodec(codec);

    // Apply bitrate when not in quality mode (or when CBR in mp3)
    if (mode !== 'quality' || (mode === 'quality' && bitrateMode === 'cbr' && outputFormat === 'mp3')) {
      if (!['flac', 'wav', 'aiff', 'alac'].includes(outputFormat)) {
        cmd = cmd.audioBitrate(`${effectiveBitrate}k`);
      }
    }

    // Apply quality flags
    if (qualityFlags.length > 0) {
      cmd = cmd.outputOptions(qualityFlags);
    }

    // Apply sample rate
    if (sampleRate) {
      cmd = cmd.audioFrequency(sampleRate);
    }

    // Apply channel mode
    if (channels === 'mono') {
      cmd = cmd.audioChannels(1);
    } else if (channels === 'stereo') {
      cmd = cmd.audioChannels(2);
    }

    /** Convert HH:MM:SS.mmm timemark to seconds */
    function timemarkToSec(mark: string): number {
      const parts = mark.split(':').map(parseFloat);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parseFloat(mark) || 0;
    }

    let lastSentPercent = -1;

    // Heartbeat to show activity even before first progress event
    const heartbeatTimer = setInterval(() => {
      if (lastSentPercent < 1) {
        win.webContents.send('audio:compress-progress', {
          fileId,
          percent: 1,
          timeRemaining: undefined,
        });
        lastSentPercent = 1;
      }
    }, 800);

    cmd
      .output(outputPath)
      .on('start', (commandLine: string) => {
        console.log('[AudioCompressor] FFmpeg command:', commandLine);
      })
      .on('progress', (progress: { percent?: number; timemark?: string }) => {
        // Prefer timemark-derived progress (works for m4a and all containers)
        let percent = 0;
        if (progress.timemark && totalDurationSec > 0) {
          const elapsed = timemarkToSec(progress.timemark);
          percent = Math.min(Math.round((elapsed / totalDurationSec) * 100), 99);
        } else if (progress.percent != null && !isNaN(progress.percent)) {
          percent = Math.min(Math.round(progress.percent), 99);
        } else {
          percent = Math.max(lastSentPercent, 1);
        }

        if (percent !== lastSentPercent) {
          lastSentPercent = percent;
          const elapsed = (Date.now() - startTime) / 1000;
          const timeRemaining = percent > 1
            ? Math.round((elapsed / percent) * (100 - percent))
            : undefined;

          win.webContents.send('audio:compress-progress', {
            fileId,
            percent,
            timeRemaining,
          });
        }
      })
      .on('end', () => {
        clearInterval(heartbeatTimer);
        activeJobs.delete(fileId);
        const compressedSize = fs.existsSync(outputPath)
          ? fs.statSync(outputPath).size
          : 0;
        resolve({ outputPath, compressedSize });
      })
      .on('error', (err: Error, stdout: string, stderr: string) => {
        clearInterval(heartbeatTimer);
        activeJobs.delete(fileId);
        console.error('[AudioCompressor] FFmpeg error:', err.message);
        if (stderr) console.error('[AudioCompressor] FFmpeg stderr:', stderr);
        reject(new Error(stderr || err.message));
      })
      .run();

    activeJobs.set(fileId, cmd);
  });
}

// ─── IPC Handler Registration ─────────────────────────────────────────────────
export function registerAudioCompressorHandlers(getWindow: () => BrowserWindow | null) {
  // Probe a file
  ipcMain.handle('audio:probe', async (_event, filePath: string, fileId: string) => {
    await loadFFmpeg();
    try {
      const info = await probeFile(filePath);
      return { fileId, ...info };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { fileId, error: msg, duration: 0, bitrate: 128, sampleRate: 44100, channels: 2, codec: 'unknown', format: 'unknown' };
    }
  });

  // Start compression for one file
  ipcMain.handle('audio:compress', async (_event, options: CompressOptions) => {
    await loadFFmpeg();
    const win = getWindow();
    if (!win || win.isDestroyed()) return { error: 'Window closed' };

    console.log(`[AudioCompressor] Starting compression: ${options.inputPath} → ${options.outputFormat} (mode: ${options.mode})`);

    const originalSize = fs.existsSync(options.inputPath)
      ? fs.statSync(options.inputPath).size
      : 0;

    try {
      const startTime = Date.now();
      const { outputPath, compressedSize } = await compressFile(options, win);
      const savedPercent = originalSize > 0
        ? parseFloat(((1 - compressedSize / originalSize) * 100).toFixed(1))
        : 0;

      const result = {
        fileId: options.fileId,
        outputPath,
        originalSize,
        compressedSize,
        savedPercent,
        duration: Date.now() - startTime,
      };

      console.log(`[AudioCompressor] Done: ${outputPath} | saved ${savedPercent}% | ${(compressedSize / 1024).toFixed(0)} KB`);
      win.webContents.send('audio:compress-done', result);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[AudioCompressor] Error compressing ${options.inputPath}:`, msg);
      win.webContents.send('audio:compress-error', { fileId: options.fileId, message: msg });
      return { error: msg };
    }
  });

  // Cancel a running job
  ipcMain.handle('audio:cancel', async (_event, fileId: string) => {
    const job = activeJobs.get(fileId);
    if (job) {
      try {
        job.kill('SIGKILL');
      } catch (_) { /* ignore */ }
      activeJobs.delete(fileId);
      return { cancelled: true };
    }
    return { cancelled: false };
  });

  // Open output folder in OS file explorer
  const openFolderHandler = async (_event: unknown, folderPath: string) => {
    if (folderPath) shell.openPath(folderPath);
  };
  ipcMain.handle('audio:open-output-folder', openFolderHandler);
  ipcMain.handle('shell:open-folder', openFolderHandler);
  ipcMain.handle('shell:open-path', openFolderHandler);

  // Reveal a specific file in OS file explorer
  const revealFileHandler = async (_event: unknown, filePath: string) => {
    if (filePath) shell.showItemInFolder(filePath);
  };
  ipcMain.handle('audio:reveal-file', revealFileHandler);
  ipcMain.handle('shell:reveal-file', revealFileHandler);

  // Get default output directories (AUVID/Audio, AUVID/Video)
  const defaultDirHandler = async (_event: unknown, customBase?: string) => {
    return getDefaultOutputDirs(customBase);
  };
  ipcMain.handle('audio:get-default-output-dir', defaultDirHandler);
  ipcMain.handle('app:get-default-output-dirs', defaultDirHandler);

  // Select base output folder
  ipcMain.handle('app:select-output-base-dir', async (_event) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return null;
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Default AUVID Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Show native folder picker
  ipcMain.handle('audio:select-output-dir', async (_event) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return null;
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Output Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Manual save a single staged file
  ipcMain.handle('audio:save-file', async (_event, params: { fileId: string; stagedPath: string; outputDir?: string; format: string; originalName: string }) => {
    try {
      const { stagedPath, outputDir, format, originalName } = params;
      if (!fs.existsSync(stagedPath)) return { error: 'Staged compressed file not found on disk' };

      const targetDir = outputDir && outputDir.trim() ? outputDir : getDefaultOutputDirs().audioDir;
      fs.mkdirSync(targetDir, { recursive: true });

      const baseName = path.basename(originalName, path.extname(originalName));
      let finalPath = path.join(targetDir, `${baseName}_compressed.${format}`);

      // Avoid collision if file exists
      if (fs.existsSync(finalPath)) {
        finalPath = path.join(targetDir, `${baseName}_compressed_${Date.now().toString().slice(-4)}.${format}`);
      }

      fs.copyFileSync(stagedPath, finalPath);
      return { success: true, savedPath: finalPath };
    } catch (err) {
      return { error: String(err) };
    }
  });

  // Manual save with native Save Dialog
  ipcMain.handle('audio:save-file-dialog', async (_event, params: { fileId: string; stagedPath: string; format: string; originalName: string }) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return { error: 'Window closed' };
    const { stagedPath, format, originalName } = params;
    if (!fs.existsSync(stagedPath)) return { error: 'Staged compressed file not found' };

    const baseName = path.basename(originalName, path.extname(originalName));
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Compressed Audio File',
      defaultPath: `${baseName}_compressed.${format}`,
      filters: [{ name: `${format.toUpperCase()} Audio`, extensions: [format] }],
    });

    if (result.canceled || !result.filePath) return { cancelled: true };

    try {
      fs.copyFileSync(stagedPath, result.filePath);
      return { success: true, savedPath: result.filePath };
    } catch (err) {
      return { error: String(err) };
    }
  });

  // Open audio files dialog
  ipcMain.handle('dialog:open-audio-compress', async () => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return [];
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Audio Files to Compress',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Audio Files',
          extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'ac3', 'aiff', 'alac', 'amr', 'ape'],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePaths.length) return [];
    return result.filePaths;
  });

  // Batch save all compressed files
  ipcMain.handle('audio:save-all', async (_event, params: { items: Array<{ fileId: string; stagedPath: string; format: string; originalName: string }>; outputDir?: string }) => {
    const { items, outputDir } = params;
    const targetDir = outputDir && outputDir.trim() ? outputDir : getDefaultOutputDirs().audioDir;
    fs.mkdirSync(targetDir, { recursive: true });

    const results: Array<{ fileId: string; savedPath: string }> = [];
    for (const item of items) {
      if (fs.existsSync(item.stagedPath)) {
        const baseName = path.basename(item.originalName, path.extname(item.originalName));
        let finalPath = path.join(targetDir, `${baseName}_compressed.${item.format}`);
        if (fs.existsSync(finalPath)) {
          finalPath = path.join(targetDir, `${baseName}_compressed_${Date.now().toString().slice(-4)}.${item.format}`);
        }
        fs.copyFileSync(item.stagedPath, finalPath);
        results.push({ fileId: item.fileId, savedPath: finalPath });
      }
    }
    return { success: true, count: results.length, results, targetDir };
  });

  console.log('[AudioCompressor] IPC handlers registered');
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
export function cleanupAudioCompressor() {
  for (const [, job] of activeJobs) {
    try { job.kill('SIGKILL'); } catch (_) { /* ignore */ }
  }
  activeJobs.clear();

  ipcMain.removeHandler('audio:probe');
  ipcMain.removeHandler('audio:compress');
  ipcMain.removeHandler('audio:cancel');
  ipcMain.removeHandler('audio:open-output-folder');
  ipcMain.removeHandler('shell:open-folder');
  ipcMain.removeHandler('shell:open-path');
  ipcMain.removeHandler('audio:reveal-file');
  ipcMain.removeHandler('shell:reveal-file');
  ipcMain.removeHandler('audio:select-output-dir');
  ipcMain.removeHandler('audio:get-default-output-dir');
  ipcMain.removeHandler('app:get-default-output-dirs');
  ipcMain.removeHandler('app:select-output-base-dir');
  ipcMain.removeHandler('audio:save-file');
  ipcMain.removeHandler('audio:save-file-dialog');
  ipcMain.removeHandler('audio:save-all');
}
