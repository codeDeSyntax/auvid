// ─── Universal Format Converter — Electron Main Process Engine ───────────────
// Handles:
//   converter:probe   → Probe media streams (Audio or Video), duration, codecs, thumbnail
//   converter:process → Transcode Audio-to-Audio, Video-to-Video, Video-to-Audio, or Video-to-GIF
//   converter:cancel  → Terminate active conversion job
//   dialog:open-converter-files → Native multi-file picker for any audio or video

import { app, ipcMain, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { resolveBinaryPath } from './binaries';

let ffmpeg: any = null;
let ffmpegPath: string | null = null;
let ffprobePath: string | null = null;

async function loadFFmpeg() {
  if (ffmpeg) return;
  try {
    ffmpeg = require('fluent-ffmpeg');
    const staticPath = require('ffmpeg-static');
    ffmpegPath = resolveBinaryPath(staticPath);
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
    try {
      const probePkg = require('ffprobe-static');
      ffprobePath = resolveBinaryPath(probePkg?.path ?? probePkg);
      if (ffprobePath) {
        ffmpeg.setFfprobePath(ffprobePath);
      }
    } catch (_) {}
  } catch (err) {
    console.error('[FormatConverter] Failed to load fluent-ffmpeg:', err);
  }
}

// ─── Default Output Directories ──────────────────────────────────────────────
function getAudioOutputDir(): string {
  let audioDir = '';
  try {
    audioDir = path.join(app.getPath('music'), 'AUVID');
  } catch {
    audioDir = path.join(os.homedir(), 'Music', 'AUVID');
  }
  try {
    fs.mkdirSync(audioDir, { recursive: true });
  } catch (_) {}
  return audioDir;
}

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
    tempDir = path.join(app.getPath('temp'), 'AUVID_ConverterThumbs');
  } catch {
    tempDir = path.join(os.tmpdir(), 'AUVID_ConverterThumbs');
  }
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (_) {}
  return tempDir;
}

const activeJobs = new Map<string, any>();

// ─── Probe Media File ────────────────────────────────────────────────────────
export async function probeMedia(filePath: string): Promise<any> {
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

      const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video' && s.codec_name !== 'png' && s.codec_name !== 'mjpeg');
      const audioStream = metadata.streams?.find((s: any) => s.codec_type === 'audio');

      const isVideo = Boolean(videoStream);
      const type = isVideo ? 'video' : 'audio';

      const duration = parseFloat(metadata.format?.duration || videoStream?.duration || audioStream?.duration || '0');
      const format = path.extname(filePath).replace('.', '').toLowerCase();

      let width = videoStream?.width;
      let height = videoStream?.height;
      let fps = 30;
      if (videoStream?.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        if (parts.length === 2 && parseFloat(parts[1]) > 0) {
          fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
        }
      }

      const audioSampleRate = audioStream?.sample_rate ? parseInt(audioStream.sample_rate, 10) : undefined;
      const audioChannels = audioStream?.channels;
      const videoCodec = videoStream?.codec_name;
      const audioCodec = audioStream?.codec_name;
      const videoBitrate = videoStream?.bit_rate ? parseInt(videoStream.bit_rate, 10) : undefined;
      const audioBitrate = audioStream?.bit_rate ? parseInt(audioStream.bit_rate, 10) : undefined;

      // Extract fast thumbnail if video
      let thumbnail: string | null = null;
      if (isVideo && duration > 0) {
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
      }

      resolve({
        type,
        format,
        duration,
        size: stat.size,
        width,
        height,
        fps,
        videoCodec,
        audioCodec,
        audioSampleRate,
        audioChannels,
        videoBitrate,
        audioBitrate,
        thumbnail,
      });
    });
  });
}

// ─── Process Media Conversion ────────────────────────────────────────────────
export async function processConversion(
  jobId: string,
  params: {
    inputPath: string;
    targetFormat: string;
    settings?: any;
  },
  onProgress: (prog: { percent: number; timemark?: string; fps?: number; speed?: string }) => void
): Promise<{ outputPath: string; outputSize: number }> {
  await loadFFmpeg();

  const { inputPath, targetFormat, settings = {} } = params;
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const probe = await probeMedia(inputPath);
  const duration = probe.duration || 1;
  const isTargetAudio = [
    'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'alac', 'ac3'
  ].includes(targetFormat.toLowerCase());

  const parsed = path.parse(inputPath);
  const outDir = isTargetAudio ? getAudioOutputDir() : getVideoOutputDir();
  const outFilename = `${parsed.name}_converted_${Date.now()}.${targetFormat.toLowerCase()}`;
  const finalOutputPath = path.join(outDir, outFilename);

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);
    activeJobs.set(jobId, command);

    // ── 1. Animated GIF Conversion ──
    if (targetFormat.toLowerCase() === 'gif') {
      const gifFps = settings.gifFps || 15;
      const gifWidth = settings.gifWidth || 480;
      command
        .noAudio()
        .complexFilter([
          `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:reserve_transparent=0[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`
        ]);
    }
    // ── 2. Audio-to-Audio or Video-to-Audio Extraction ──
    else if (isTargetAudio) {
      // Determine effective audio bitrate to match source and prevent size inflation
      let targetBitrateK = 128; // fallback
      if (settings.audioBitrate && settings.audioBitrate > 0) {
        targetBitrateK = settings.audioBitrate;
      } else if (probe.audioBitrate && probe.audioBitrate > 0) {
        targetBitrateK = Math.round(probe.audioBitrate / 1000);
      } else if (probe.size > 0 && duration > 0) {
        // Calculate bitrate from file size and duration: (bytes * 8) / seconds / 1000
        targetBitrateK = Math.min(320, Math.max(32, Math.round((probe.size * 8) / duration / 1000)));
      }

      // Audio codec mapping
      switch (targetFormat.toLowerCase()) {
        case 'mp3':
          command.audioCodec('libmp3lame').audioBitrate(`${targetBitrateK}k`);
          break;
        case 'wav':
          command.audioCodec('pcm_s16le');
          break;
        case 'flac':
          command.audioCodec('flac');
          break;
        case 'aac':
        case 'm4a':
          command.audioCodec('aac').audioBitrate(`${targetBitrateK}k`);
          break;
        case 'opus':
          command.audioCodec('libopus').audioBitrate(`${Math.min(targetBitrateK, 160)}k`);
          break;
        case 'ogg':
          command.audioCodec('libvorbis').audioBitrate(`${targetBitrateK}k`);
          break;
        case 'aiff':
          command.audioCodec('pcm_s16be');
          break;
        case 'alac':
          command.audioCodec('alac');
          break;
        case 'ac3':
          command.audioCodec('ac3').audioBitrate(`${targetBitrateK}k`);
          break;
        default:
          command.audioBitrate(`${targetBitrateK}k`);
          break;
      }

      if (settings.audioSampleRate && settings.audioSampleRate > 0) {
        command.audioFrequency(settings.audioSampleRate);
      }
      if (settings.audioChannels === 'mono') {
        command.audioChannels(1);
      } else if (settings.audioChannels === 'stereo') {
        command.audioChannels(2);
      }

      // If converting from video to audio, strip video track completely
      command.noVideo();
    }
    // ── 3. Video-to-Video Conversion ──
    else {
      // Video Codec
      let vCodec = 'libx264';
      if (targetFormat.toLowerCase() === 'webm') {
        vCodec = 'libvpx-vp9';
      } else if (settings.videoCodec === 'hevc') {
        vCodec = 'libx265';
      } else if (settings.videoCodec === 'av1') {
        vCodec = 'libsvtav1';
      } else if (settings.videoCodec === 'h264') {
        vCodec = 'libx264';
      }

      command.videoCodec(vCodec);

      // CRF Quality
      const crf = settings.videoCrf || (vCodec === 'libx265' ? 26 : 22);
      command.outputOptions([`-crf ${crf}`]);

      // Resolution & FPS filters
      const vFilters: string[] = [];
      if (settings.videoResolution && settings.videoResolution !== 'original') {
        const resMap: Record<string, string> = {
          '4k': 'scale=min(3840\\,iw):-2',
          '2k': 'scale=min(2560\\,iw):-2',
          '1080p': 'scale=min(1920\\,iw):-2',
          '720p': 'scale=min(1280\\,iw):-2',
          '480p': 'scale=min(854\\,iw):-2',
          '360p': 'scale=min(640\\,iw):-2',
        };
        if (resMap[settings.videoResolution]) vFilters.push(resMap[settings.videoResolution]);
      }
      if (typeof settings.videoFps === 'number' && settings.videoFps > 0) {
        vFilters.push(`fps=${settings.videoFps}`);
      }
      if (vFilters.length > 0) {
        command.videoFilters(vFilters);
      }

      // Audio Codec inside video
      if (targetFormat.toLowerCase() === 'webm') {
        command.audioCodec('libopus').audioBitrate(`${settings.audioBitrate || 128}k`);
      } else {
        command.audioCodec('aac').audioBitrate(`${settings.audioBitrate || 192}k`);
      }

      if (targetFormat.toLowerCase() === 'mp4' || targetFormat.toLowerCase() === 'mov') {
        command.outputOptions(['-movflags +faststart']);
      }
    }

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
      reject(new Error(`Format conversion failed: ${err.message}`));
    });

    command.save(finalOutputPath);
  });
}

// ─── Register IPC Handlers ───────────────────────────────────────────────────
export function registerFormatConverterHandlers() {
  ipcMain.handle('converter:probe', async (_event, filePath: string) => {
    try {
      return await probeMedia(filePath);
    } catch (err: any) {
      console.error('[FormatConverter] Probe error:', err);
      throw err;
    }
  });

  ipcMain.handle('dialog:open-converter-files', async () => {
    const focused = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(focused ?? undefined as any, {
      title: 'Select Media Files to Convert',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'All Media Files',
          extensions: [
            'mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v', 'ts', '3gp', '3g2',
            'mpg', 'mpeg', 'm2ts', 'vob', 'ogv', 'asf', 'rm', 'rmvb', 'divx',
            'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'aif', 'alac',
            'ac3', 'amr', 'ape', 'dts', 'mp2', 'mp1', 'm4b', 'm4p', 'aifc', 'caf', 'pcm'
          ],
        },
        {
          name: 'Audio Files',
          extensions: [
            'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'aif', 'alac',
            'ac3', 'amr', 'ape', 'dts', 'mp2', 'mp1', 'm4b', 'm4p', 'aifc', 'caf', 'pcm'
          ]
        },
        {
          name: 'Video Files',
          extensions: [
            'mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v', 'ts', '3gp', '3g2',
            'mpg', 'mpeg', 'm2ts', 'vob', 'ogv', 'asf', 'rm', 'rmvb', 'divx'
          ]
        },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePaths;
  });

  ipcMain.handle('converter:process', async (event, payload: { jobId: string; params: any }) => {
    const { jobId, params } = payload;
    const win = BrowserWindow.fromWebContents(event.sender);

    return await processConversion(
      jobId,
      params,
      (prog) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('converter:progress', { jobId, ...prog });
        }
      }
    );
  });

  ipcMain.handle('converter:cancel', async (_event, jobId: string) => {
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

export function cleanupFormatConverter() {
  for (const [id, job] of activeJobs.entries()) {
    try {
      job.kill('SIGKILL');
    } catch (_) {}
  }
  activeJobs.clear();
}
