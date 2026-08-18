// ─── Metadata Editor — Electron Main Process IPC Handlers ──────────────────────
// Handles: directory listing, folder picker, metadata read (ffprobe) and write (ffmpeg).

import { app, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { resolveBinaryPath } from './binaries';

// ─── FFmpeg / FFprobe lazy loading (reuses same pattern as audioCompressor) ──
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
    } catch { /* ignore */ }
  } catch (err) {
    console.error('[MetadataEditor] Failed to load fluent-ffmpeg:', err);
  }
}

// ─── Media file extensions ───────────────────────────────────────────────────
const AUDIO_EXTS = new Set([
  'mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'aif', 'alac',
]);

const VIDEO_EXTS = new Set([
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v',
]);

const MEDIA_EXTS = new Set([...AUDIO_EXTS, ...VIDEO_EXTS]);

// ─── Helper: read metadata via ffprobe ───────────────────────────────────────
async function readMetadataViaProbe(filePath: string): Promise<Record<string, string>> {
  await loadFFmpeg();
  return new Promise((resolve, reject) => {
    if (!ffprobePath) {
      return reject(new Error('ffprobe not available'));
    }
    // Use ffprobe directly for reliability
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];
    let stdout = '';
    let stderr = '';
    const proc = spawn(ffprobePath!, args, { windowsHide: true });
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exited ${code}: ${stderr}`));
      try {
        const data = JSON.parse(stdout);
        const tags: Record<string, string> = {};
        // Collect from format tags (primary for audio)
        const fmtTags = data?.format?.tags ?? {};
        for (const [k, v] of Object.entries(fmtTags)) {
          tags[k.toLowerCase()] = String(v);
        }
        // Also collect from first video/audio stream tags
        const streams: Array<{ tags?: Record<string, string> }> = data?.streams ?? [];
        for (const stream of streams) {
          for (const [k, v] of Object.entries(stream.tags ?? {})) {
            if (!tags[k.toLowerCase()]) tags[k.toLowerCase()] = String(v);
          }
        }
        resolve(tags);
      } catch (e) {
        reject(new Error('Failed to parse ffprobe output: ' + String(e)));
      }
    });
    proc.on('error', reject);
  });
}

// ─── Map raw ffprobe tags → our metadata shape ───────────────────────────────
function normalizeTags(raw: Record<string, string>) {
  return {
    title:       raw['title']        ?? raw['TITLE']        ?? '',
    artist:      raw['artist']       ?? raw['ARTIST']       ?? '',
    album:       raw['album']        ?? raw['ALBUM']        ?? '',
    albumArtist: raw['album_artist'] ?? raw['ALBUM_ARTIST'] ?? raw['TPE2'] ?? '',
    composer:    raw['composer']     ?? raw['COMPOSER']     ?? '',
    year:        raw['date']         ?? raw['YEAR']         ?? raw['year'] ?? '',
    genre:       raw['genre']        ?? raw['GENRE']        ?? '',
    track:       raw['track']        ?? raw['TRACK']        ?? raw['TRCK'] ?? '',
    diskNumber:  raw['disc']         ?? raw['DISC']         ?? raw['disk'] ?? '',
    comment:     raw['comment']      ?? raw['COMMENT']      ?? raw['DESCRIPTION'] ?? '',
    coverArt:    null as string | null,
  };
}

// ─── Extract embedded cover art via ffmpeg ────────────────────────────────────
async function extractCoverArt(filePath: string): Promise<string | null> {
  await loadFFmpeg();
  if (!ffmpegPath) return null;

  const tmpDir = (() => {
    try { return app.getPath('temp'); } catch { return os.tmpdir(); }
  })();
  const tmpCover = path.join(tmpDir, `auvid_cover_${Date.now()}.jpg`);

  return new Promise((resolve) => {
    const args = [
      '-y',
      '-i', filePath,
      '-an',              // no audio
      '-vf', 'scale=500:500:force_original_aspect_ratio=decrease',
      '-frames:v', '1',
      tmpCover,
    ];
    const proc = spawn(ffmpegPath!, args, { windowsHide: true });
    proc.on('close', (code) => {
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

// ─── Write metadata via ffmpeg ────────────────────────────────────────────────
async function writeMetadataViaFfmpeg(
  filePath: string,
  tags: Record<string, string>,
  coverArtDataUrl?: string | null,
): Promise<void> {
  await loadFFmpeg();
  if (!ffmpegPath) throw new Error('ffmpeg not available');

  // Write temp output to system temp dir first so no extra file appears in the source directory
  const tmpDir = (() => {
    try { return app.getPath('temp'); } catch { return os.tmpdir(); }
  })();
  const tmpOutput = path.join(tmpDir, `auvid_meta_${Date.now()}_${path.basename(filePath)}`);

  // If cover art provided, save it to a temp file
  let tmpCoverPath: string | null = null;
  if (coverArtDataUrl && coverArtDataUrl.startsWith('data:image')) {
    const base64 = coverArtDataUrl.split(',')[1];
    if (base64) {
      tmpCoverPath = path.join(tmpDir, `auvid_newcover_${Date.now()}.jpg`);
      fs.writeFileSync(tmpCoverPath, Buffer.from(base64, 'base64'));
    }
  }

  const ext = path.extname(filePath).toLowerCase().slice(1);
  const isVideo = VIDEO_EXTS.has(ext);

  // Build ffmpeg args
  const args: string[] = ['-y', '-i', filePath];
  if (tmpCoverPath) {
    args.push('-i', tmpCoverPath);
  }

  // Stream mapping and codec copy
  if (tmpCoverPath && !isVideo) {
    args.push('-map', '0:a');
    args.push('-map', '1:v');
    args.push('-c:a', 'copy');
    args.push('-c:v', 'mjpeg');
    args.push('-metadata:s:v', 'title=Album cover');
    args.push('-metadata:s:v', 'comment=Cover (front)');
    args.push('-disposition:v:1', 'attached_pic');
  } else {
    args.push('-map', '0');
    args.push('-c', 'copy');
  }

  // Tag fields
  const tagMap: Record<string, string> = {
    title:        'title',
    artist:       'artist',
    album:        'album',
    albumArtist:  'album_artist',
    composer:     'composer',
    year:         'date',
    genre:        'genre',
    track:        'track',
    diskNumber:   'disc',
    comment:      'comment',
  };

  for (const [field, ffField] of Object.entries(tagMap)) {
    const val = tags[field];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      args.push('-metadata', `${ffField}=${val}`);
    }
  }

  // Format-specific ID3 output options for MP3
  if (ext === 'mp3') {
    args.push('-id3v2_version', '3');
  }

  args.push(tmpOutput);

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath!, args, { windowsHide: true });
      let stderr = '';
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg metadata write failed (${code}): ${stderr.slice(-500)}`));
      });
      proc.on('error', reject);
    });

    // Replace original file with the modified temp file in place
    try {
      fs.copyFileSync(tmpOutput, filePath);
    } catch {
      // Fallback to unlink + rename if copy fails
      fs.unlinkSync(filePath);
      fs.renameSync(tmpOutput, filePath);
    }
  } finally {
    // Cleanup temporary files in temp folder
    if (tmpCoverPath) {
      try { fs.unlinkSync(tmpCoverPath); } catch { /* ignore */ }
    }
    if (fs.existsSync(tmpOutput)) {
      try { fs.unlinkSync(tmpOutput); } catch { /* ignore */ }
    }
  }
}

// ─── Register all IPC handlers ────────────────────────────────────────────────
export function registerMetadataEditorHandlers() {
  // ── List directory contents ──
  ipcMain.handle('fs:list-directory', async (_event, dirPath: string) => {
    try {
      if (!dirPath || !fs.existsSync(dirPath)) return [];
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter(e => e.isFile() || e.isDirectory())
        .map(e => {
          const fullPath = path.join(dirPath, e.name);
          let size = 0;
          if (e.isFile()) {
            try { size = fs.statSync(fullPath).size; } catch { /* ignore */ }
          }
          return { name: e.name, path: fullPath, size, isFile: e.isFile() };
        })
        .filter(e => {
          if (!e.isFile) return false;
          const ext = e.name.split('.').pop()?.toLowerCase() ?? '';
          return MEDIA_EXTS.has(ext);
        });
    } catch (err) {
      console.error('[MetadataEditor] fs:list-directory error:', err);
      return [];
    }
  });

  // ── Open folder picker dialog ──
  ipcMain.handle('dialog:open-folder', async (_event) => {
    const result = await dialog.showOpenDialog({
      title: 'Select folder to scan for media files',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── Read metadata for a file ──
  ipcMain.handle('metadata:read', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) throw new Error('File not found: ' + filePath);
      const raw = await readMetadataViaProbe(filePath);
      const meta = normalizeTags(raw);

      // Try to extract embedded cover art
      meta.coverArt = await extractCoverArt(filePath);

      return meta;
    } catch (err) {
      console.error('[MetadataEditor] metadata:read error:', err);
      throw err;
    }
  });

  // ── Write metadata for a file ──
  ipcMain.handle('metadata:write', async (
    _event,
    { path: filePath, metadata }: { path: string; metadata: Record<string, string | null> }
  ) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) throw new Error('File not found: ' + filePath);

      const { coverArt, ...tags } = metadata as { coverArt?: string | null; [k: string]: string | null | undefined };
      const flatTags: Record<string, string> = {};
      for (const [k, v] of Object.entries(tags)) {
        if (v != null) flatTags[k] = v;
      }

      await writeMetadataViaFfmpeg(filePath, flatTags, coverArt ?? null);
      return { success: true };
    } catch (err) {
      console.error('[MetadataEditor] metadata:write error:', err);
      throw err;
    }
  });
}

export function cleanupMetadataEditor() {
  ipcMain.removeHandler('fs:list-directory');
  ipcMain.removeHandler('dialog:open-folder');
  ipcMain.removeHandler('metadata:read');
  ipcMain.removeHandler('metadata:write');
}
