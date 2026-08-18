// ─── Sound Recorder — Electron Main Process Engine ───────────────────────────
// Handles saving recorded audio blobs, converting to target format, listing recordings,
// and revealing files in OS shell.

import { app, ipcMain, BrowserWindow, shell } from 'electron';
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
    console.error('[SoundRecorder] Failed to load fluent-ffmpeg:', err);
  }
}

// ─── Default Output Directory (Music/AUVID/Recordings) ───────────────────────
function getRecordingsDir(): string {
  let recDir = '';
  try {
    recDir = path.join(app.getPath('music'), 'AUVID', 'Recordings');
  } catch {
    recDir = path.join(os.homedir(), 'Music', 'AUVID', 'Recordings');
  }
  try {
    fs.mkdirSync(recDir, { recursive: true });
  } catch (_) {}
  return recDir;
}

function getTempRecDir(): string {
  let tempDir = '';
  try {
    tempDir = path.join(app.getPath('temp'), 'AUVID_RawRecordings');
  } catch {
    tempDir = path.join(os.tmpdir(), 'AUVID_RawRecordings');
  }
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (_) {}
  return tempDir;
}

// ─── Save & Transcode Recording ──────────────────────────────────────────────
export async function saveRecordingFile(payload: {
  buffer: ArrayBuffer;
  format: 'opus' | 'm4a' | 'mp3' | 'wav' | 'flac';
  bitrateKbps?: number;
  sampleRate?: number;
  channels?: number;
  customName?: string;
}): Promise<{ path: string; name: string; size: number; duration: number }> {
  await loadFFmpeg();

  const { buffer, format, bitrateKbps = 32, sampleRate = 48000, channels = 1, customName } = payload;
  const recDir = getRecordingsDir();
  const tempDir = getTempRecDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = customName && customName.trim() ? customName.trim() : `Recording_${timestamp}`;

  const extMap: Record<string, string> = {
    opus: 'ogg',
    m4a: 'm4a',
    mp3: 'mp3',
    wav: 'wav',
    flac: 'flac',
  };

  const finalExt = extMap[format] || format;
  const finalFilename = `${baseName}.${finalExt}`;
  const finalPath = path.join(recDir, finalFilename);

  // Write temporary raw input buffer (webm/ogg/wav recorded from MediaRecorder)
  const tempRawPath = path.join(tempDir, `raw_${Date.now()}.webm`);
  fs.writeFileSync(tempRawPath, Buffer.from(buffer));

  return new Promise((resolve, reject) => {
    let command = ffmpeg(tempRawPath);

    switch (format) {
      case 'opus':
        // WhatsApp-Grade Opus compression
        command
          .audioCodec('libopus')
          .audioBitrate(`${bitrateKbps}k`)
          .audioFrequency(sampleRate)
          .audioChannels(channels)
          .outputOptions(['-application voip', '-vbr on']);
        break;

      case 'm4a':
        command
          .audioCodec('aac')
          .audioBitrate(`${bitrateKbps || 128}k`)
          .audioFrequency(sampleRate)
          .audioChannels(channels);
        break;

      case 'mp3':
        command
          .audioCodec('libmp3lame')
          .audioBitrate(`${bitrateKbps || 192}k`)
          .audioFrequency(sampleRate)
          .audioChannels(channels);
        break;

      case 'wav':
        command
          .audioCodec('pcm_s16le')
          .audioFrequency(sampleRate)
          .audioChannels(channels);
        break;

      case 'flac':
        command
          .audioCodec('flac')
          .audioFrequency(sampleRate)
          .audioChannels(channels);
        break;

      default:
        command.audioBitrate(`${bitrateKbps}k`);
        break;
    }

    command.on('end', () => {
      try {
        if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath);
      } catch (_) {}

      let size = 0;
      let duration = 0;
      try {
        if (fs.existsSync(finalPath)) {
          size = fs.statSync(finalPath).size;
        }
      } catch (_) {}

      ffmpeg.ffprobe(finalPath, (err: any, metadata: any) => {
        if (!err && metadata?.format?.duration) {
          duration = parseFloat(metadata.format.duration);
        }
        resolve({ path: finalPath, name: finalFilename, size, duration });
      });
    });

    command.on('error', (err: any) => {
      try {
        if (fs.existsSync(tempRawPath)) fs.unlinkSync(tempRawPath);
      } catch (_) {}
      reject(new Error(`Failed to save recording: ${err.message}`));
    });

    command.save(finalPath);
  });
}

// ─── List Recordings ─────────────────────────────────────────────────────────
export async function listRecordings(): Promise<any[]> {
  await loadFFmpeg();
  const recDir = getRecordingsDir();
  if (!fs.existsSync(recDir)) return [];

  const files = fs.readdirSync(recDir);
  const items: any[] = [];

  for (const f of files) {
    const fullPath = path.join(recDir, f);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        items.push({
          id: f,
          name: f,
          path: fullPath,
          size: stat.size,
          recordedAt: stat.mtimeMs,
          format: path.extname(f).replace('.', '').toLowerCase(),
        });
      }
    } catch (_) {}
  }

  // Sort newest first
  items.sort((a, b) => b.recordedAt - a.recordedAt);
  return items;
}

// ─── Register IPC Handlers ───────────────────────────────────────────────────
export function registerSoundRecorderHandlers() {
  ipcMain.handle('recorder:save', async (_event, payload) => {
    return await saveRecordingFile(payload);
  });

  ipcMain.handle('recorder:list', async () => {
    return await listRecordings();
  });

  ipcMain.handle('recorder:delete', async (_event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'File not found' };
  });
}

export function cleanupSoundRecorder() {
  const tempDir = getTempRecDir();
  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(tempDir, f));
        } catch (_) {}
      }
    }
  } catch (_) {}
}
