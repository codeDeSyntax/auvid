// ─── Video Compressor — Electron Main Process Engine ─────────────────────────
// Handles:
//   video-compress:probe         → Probe video/audio streams & extract thumbnail
//   video-compress:check-hwaccel → Detect NVIDIA NVENC, Intel QSV, AMD AMF encoders
//   video-compress:process       → Compress single or batch video files
//   video-compress:cancel        → Cancel active encoding job
//   dialog:open-video-compress   → Open video files for compression

import { app, ipcMain, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let ffmpeg: any = null;
let ffmpegPath: string | null = null;
let ffprobePath: string | null = null;

async function loadFFmpeg() {
  if (ffmpeg) return;
  try {
    ffmpeg = require('fluent-ffmpeg');
    const staticPath = require('ffmpeg-static');
    ffmpegPath = typeof staticPath === 'string' ? staticPath : staticPath.default ?? staticPath;
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
    try {
      const probePkg = require('ffprobe-static');
      ffprobePath = probePkg.path ?? (typeof probePkg === 'string' ? probePkg : probePkg.default);
      if (ffprobePath) {
        ffmpeg.setFfprobePath(ffprobePath);
      }
    } catch (_) {}
  } catch (err) {
    console.error('[VideoCompressor] Failed to load fluent-ffmpeg:', err);
  }
}

// ─── Default Output Directory ────────────────────────────────────────────────
function getVideoOutputDir(): string {
  let videoDir = '';
  try {
    videoDir = path.join(app.getPath('videos'), 'AUVID');
  } catch {
    videoDir = path.join(os.homedir(), 'Videos', 'AUVID');
  }
  try {
    fs.mkdirSync(videoDir, { recursive: true });
  } catch (_) {}
  return videoDir;
}

function getTempThumbDir(): string {
  let tempDir = '';
  try {
    tempDir = path.join(app.getPath('temp'), 'AUVID_Thumbs');
  } catch {
    tempDir = path.join(os.tmpdir(), 'AUVID_Thumbs');
  }
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (_) {}
  return tempDir;
}

// ─── Active Job Tracking for Cancellations ───────────────────────────────────
const activeJobs = new Map<string, any>();

// ─── Probe Video Streams ─────────────────────────────────────────────────────
export async function probeVideoFile(filePath: string): Promise<any> {
  await loadFFmpeg();
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stat = fs.statSync(filePath);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, async (err: any, metadata: any) => {
      if (err) {
        return reject(new Error(`ffprobe failed: ${err.message}`));
      }

      const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video');
      const audioStream = metadata.streams?.find((s: any) => s.codec_type === 'audio');

      let duration = parseFloat(metadata.format?.duration || videoStream?.duration || audioStream?.duration || '0');
      const width = videoStream?.width || 0;
      const height = videoStream?.height || 0;
      const videoCodec = videoStream?.codec_name || 'unknown';
      const audioCodec = audioStream?.codec_name || 'none';

      // Parse FPS
      let fps = 30;
      if (videoStream?.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        if (parts.length === 2 && parseFloat(parts[1]) > 0) {
          fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
        } else {
          fps = Math.round(parseFloat(parts[0]) || 30);
        }
      }

      // Aspect Ratio
      let aspectRatio = '16:9';
      if (width > 0 && height > 0) {
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        const divisor = gcd(width, height);
        aspectRatio = `${width / divisor}:${height / divisor}`;
      }

      const totalBitrate = parseInt(metadata.format?.bit_rate || '0', 10);
      const videoBitrate = parseInt(videoStream?.bit_rate || '0', 10);
      const audioBitrate = parseInt(audioStream?.bit_rate || '0', 10);

      // Generate a fast thumbnail preview
      let thumbnail: string | null = null;
      try {
        const thumbDir = getTempThumbDir();
        const thumbFilename = `thumb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
        const thumbPath = path.join(thumbDir, thumbFilename);

        const seekSec = duration > 2 ? Math.min(2, duration / 2) : 0.1;

        await new Promise<void>((res) => {
          ffmpeg(filePath)
            .screenshots({
              timestamps: [seekSec],
              filename: thumbFilename,
              folder: thumbDir,
              size: '320x?',
            })
            .on('end', () => {
              try {
                if (fs.existsSync(thumbPath)) {
                  const buf = fs.readFileSync(thumbPath);
                  thumbnail = `data:image/jpeg;base64,${buf.toString('base64')}`;
                  fs.unlinkSync(thumbPath);
                }
              } catch (_) {}
              res();
            })
            .on('error', () => res());
        });
      } catch (_) {}

      resolve({
        duration,
        width,
        height,
        aspectRatio,
        fps,
        videoCodec,
        audioCodec,
        videoBitrate,
        audioBitrate,
        totalBitrate,
        size: stat.size,
        thumbnail,
      });
    });
  });
}

// ─── Hardware Acceleration Detection ─────────────────────────────────────────
export async function detectHWAccel(): Promise<any> {
  await loadFFmpeg();
  return new Promise((resolve) => {
    ffmpeg.getAvailableCodecs((err: any, codecs: any) => {
      if (err || !codecs) {
        return resolve({ nvenc: false, qsv: false, amf: false, vaapi: false, availableEncoders: [] });
      }

      const encoders: string[] = [];
      let nvenc = false;
      let qsv = false;
      let amf = false;
      let vaapi = false;

      Object.keys(codecs).forEach((name) => {
        if (codecs[name].canEncode) {
          encoders.push(name);
          if (name.includes('nvenc')) nvenc = true;
          if (name.includes('qsv')) qsv = true;
          if (name.includes('amf')) amf = true;
          if (name.includes('vaapi')) vaapi = true;
        }
      });

      resolve({ nvenc, qsv, amf, vaapi, availableEncoders: encoders });
    });
  });
}

// ─── Codec Resolver ──────────────────────────────────────────────────────────
function resolveVideoEncoder(codec: string, useHW: boolean, hwInfo: any): string {
  if (useHW) {
    if (hwInfo?.nvenc) {
      if (codec === 'h264') return 'h264_nvenc';
      if (codec === 'hevc') return 'hevc_nvenc';
      if (codec === 'av1') return 'av1_nvenc';
    }
    if (hwInfo?.qsv) {
      if (codec === 'h264') return 'h264_qsv';
      if (codec === 'hevc') return 'hevc_qsv';
      if (codec === 'av1') return 'av1_qsv';
    }
    if (hwInfo?.amf) {
      if (codec === 'h264') return 'h264_amf';
      if (codec === 'hevc') return 'hevc_amf';
    }
  }

  // High-Density Software CPU Encoders
  switch (codec) {
    case 'hevc': return 'libx265';
    case 'av1': return 'libsvtav1';
    case 'vp9': return 'libvpx-vp9';
    case 'h264':
    default:
      return 'libx264';
  }
}

// ─── Video Resolution Filter Generator ───────────────────────────────────────
function getResolutionFilter(res: string, targetFps: string | number): string[] {
  const filters: string[] = [];

  switch (res) {
    case '4k':
      filters.push('scale=min(3840\\,iw):-2');
      break;
    case '2k':
      filters.push('scale=min(2560\\,iw):-2');
      break;
    case '1080p':
      filters.push('scale=min(1920\\,iw):-2');
      break;
    case '720p':
      filters.push('scale=min(1280\\,iw):-2');
      break;
    case '480p':
      filters.push('scale=min(854\\,iw):-2');
      break;
    case '360p':
      filters.push('scale=min(640\\,iw):-2');
      break;
    case '240p':
      filters.push('scale=min(426\\,iw):-2');
      break;
    case 'original':
    default:
      break;
  }

  if (typeof targetFps === 'number' && targetFps > 0) {
    filters.push(`fps=${targetFps}`);
  }

  return filters;
}

// ─── Main Compression Worker ─────────────────────────────────────────────────
export async function processVideoCompression(
  jobId: string,
  params: {
    inputPath: string;
    outputPath?: string;
    mode: 'percentage' | 'targetSize' | 'crf' | 'bitrate';
    percentageReduction?: number;
    targetSizeBytes?: number;
    crf?: number;
    videoBitrateKbps?: number;
    twoPass?: boolean;
    codec: 'h264' | 'hevc' | 'av1' | 'vp9';
    container: 'mp4' | 'mkv' | 'mov' | 'webm';
    resolution: string;
    fps: string | number;
    audioCodec: 'aac' | 'opus' | 'mp3' | 'copy' | 'mute';
    audioBitrateKbps: number;
    audioChannels: 'original' | 'stereo' | 'mono';
    speedPreset: string;
    useHWAccel: boolean;
  },
  onProgress: (prog: { percent: number; timemark?: string; fps?: number; speed?: string }) => void
): Promise<{ outputPath: string; outputSize: number }> {
  await loadFFmpeg();

  const { inputPath } = params;
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  const probe = await probeVideoFile(inputPath);
  const duration = probe.duration || 1;

  // Determine output filename and path
  const parsed = path.parse(inputPath);
  const outDir = params.outputPath ? path.dirname(params.outputPath) : getVideoOutputDir();
  const ext = `.${params.container || 'mp4'}`;
  const outFilename = `${parsed.name}_compressed_${Date.now()}${ext}`;
  const finalOutputPath = params.outputPath || path.join(outDir, outFilename);

  const hwInfo = await detectHWAccel();
  const videoEncoder = resolveVideoEncoder(params.codec, params.useHWAccel, hwInfo);

  // Compute Bitrate when in targetSize or percentage mode
  let targetVideoBitrateKbps = params.videoBitrateKbps || 1200;

  if (params.mode === 'targetSize' && params.targetSizeBytes && params.targetSizeBytes > 0) {
    const totalTargetBytes = params.targetSizeBytes;
    // Reserve ~5% for container muxing overhead
    const usableBytes = totalTargetBytes * 0.95;
    const totalTargetBits = usableBytes * 8;
    const totalTargetBitrateKbps = totalTargetBits / duration / 1000;

    const audioKbps = params.audioCodec === 'mute' ? 0 : Math.min(params.audioBitrateKbps || 96, Math.max(32, totalTargetBitrateKbps * 0.15));
    targetVideoBitrateKbps = Math.max(50, Math.round(totalTargetBitrateKbps - audioKbps));
  } else if (params.mode === 'percentage' && params.percentageReduction) {
    const fraction = (100 - params.percentageReduction) / 100;
    const totalTargetBytes = stat.size * fraction;
    const usableBytes = totalTargetBytes * 0.95;
    const totalTargetBits = usableBytes * 8;
    const totalTargetBitrateKbps = totalTargetBits / duration / 1000;

    const audioKbps = params.audioCodec === 'mute' ? 0 : (params.audioBitrateKbps || 96);
    targetVideoBitrateKbps = Math.max(50, Math.round(totalTargetBitrateKbps - audioKbps));
  }

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);
    activeJobs.set(jobId, command);

    // Video Codec & Encoder settings
    command.videoCodec(videoEncoder);

    // Video Rate Control
    if (params.mode === 'crf') {
      const crfVal = typeof params.crf === 'number' ? params.crf : (params.codec === 'hevc' ? 28 : 23);
      if (videoEncoder.includes('nvenc')) {
        command.outputOptions([`-cq ${crfVal}`, '-preset p4']);
      } else {
        command.outputOptions([`-crf ${crfVal}`]);
      }
    } else {
      command.videoBitrate(`${targetVideoBitrateKbps}k`);
      command.outputOptions([
        `-maxrate ${Math.round(targetVideoBitrateKbps * 1.3)}k`,
        `-bufsize ${Math.round(targetVideoBitrateKbps * 2)}k`,
      ]);
    }

    // Speed Preset
    if (!videoEncoder.includes('nvenc') && !videoEncoder.includes('qsv')) {
      command.outputOptions([`-preset ${params.speedPreset || 'medium'}`]);
    }

    // Scaling & FPS Video Filters
    const vFilters = getResolutionFilter(params.resolution, params.fps);
    if (vFilters.length > 0) {
      command.videoFilters(vFilters);
    }

    // Audio Configuration
    if (params.audioCodec === 'mute') {
      command.noAudio();
    } else if (params.audioCodec === 'copy') {
      command.audioCodec('copy');
    } else {
      const aCodec = params.audioCodec === 'opus' ? 'libopus' : (params.audioCodec === 'mp3' ? 'libmp3lame' : 'aac');
      command.audioCodec(aCodec);
      command.audioBitrate(`${params.audioBitrateKbps || 128}k`);

      if (params.audioChannels === 'mono') {
        command.audioChannels(1);
      } else if (params.audioChannels === 'stereo') {
        command.audioChannels(2);
      }
    }

    // Faststart flag for MP4/MOV streaming compatibility
    if (params.container === 'mp4' || params.container === 'mov') {
      command.outputOptions(['-movflags +faststart']);
    }

    // Progress reporting
    command.on('progress', (p: any) => {
      let percent = p.percent || 0;
      if (duration > 0 && p.timemark) {
        const parts = p.timemark.split(':');
        if (parts.length === 3) {
          const curSec = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
          percent = Math.min(99, Math.round((curSec / duration) * 100));
        }
      }
      onProgress({
        percent: Math.min(100, Math.max(0, percent)),
        timemark: p.timemark,
        fps: p.currentFps,
        speed: p.currentKbps ? `${Math.round(p.currentKbps)} kbps` : undefined,
      });
    });

    command.on('end', () => {
      activeJobs.delete(jobId);
      let outputSize = 0;
      try {
        if (fs.existsSync(finalOutputPath)) {
          outputSize = fs.statSync(finalOutputPath).size;
        }
      } catch (_) {}
      resolve({ outputPath: finalOutputPath, outputSize });
    });

    command.on('error', (err: any) => {
      activeJobs.delete(jobId);
      reject(new Error(`Video compression failed: ${err.message}`));
    });

    command.save(finalOutputPath);
  });
}

// ─── Register IPC Handlers ───────────────────────────────────────────────────
export function registerVideoCompressorHandlers() {
  // Probe video
  ipcMain.handle('video-compress:probe', async (_event, filePath: string) => {
    try {
      return await probeVideoFile(filePath);
    } catch (err: any) {
      console.error('[VideoCompressor] Probe error:', err);
      throw err;
    }
  });

  // Check hardware acceleration
  ipcMain.handle('video-compress:check-hwaccel', async () => {
    return await detectHWAccel();
  });

  // Pick video file(s)
  ipcMain.handle('dialog:open-video-compress', async () => {
    const focused = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(focused ?? undefined as any, {
      title: 'Select Video Files to Compress',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v', 'ts', '3gp'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePaths;
  });

  // Process compression job
  ipcMain.handle('video-compress:process', async (event, payload: { jobId: string; params: any }) => {
    const { jobId, params } = payload;
    const win = BrowserWindow.fromWebContents(event.sender);

    return await processVideoCompression(
      jobId,
      params,
      (prog) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('video-compress:progress', { jobId, ...prog });
        }
      }
    );
  });

  // Cancel job
  ipcMain.handle('video-compress:cancel', async (_event, jobId: string) => {
    const job = activeJobs.get(jobId);
    if (job) {
      try {
        job.kill('SIGKILL');
      } catch (_) {}
      activeJobs.delete(jobId);
      return { success: true };
    }
    return { success: false, error: 'Job not found' };
  });
}

export function cleanupVideoCompressor() {
  for (const [id, job] of activeJobs.entries()) {
    try {
      job.kill('SIGKILL');
    } catch (_) {}
  }
  activeJobs.clear();
}
