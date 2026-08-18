import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Resolves binary paths from inside app.asar to app.asar.unpacked
 * so Windows/Electron can execute ffmpeg.exe and ffprobe.exe in production.
 */
export function resolveBinaryPath(rawPath: string | null | undefined): string | null {
  if (!rawPath) return null;
  let p = typeof rawPath === 'string' ? rawPath : (rawPath as any)?.default ?? (rawPath as any)?.path;
  if (typeof p !== 'string') return null;

  if (p.includes('app.asar')) {
    const unpacked = p.replace('app.asar', 'app.asar.unpacked');
    return unpacked;
  }

  return p;
}

/**
 * Helper to get fluent-ffmpeg instance with configured ffmpeg and ffprobe paths.
 */
export function setupFFmpeg() {
  const ffmpeg = require('fluent-ffmpeg');

  try {
    const staticFfmpeg = require('ffmpeg-static');
    const ffmpegPath = resolveBinaryPath(staticFfmpeg);
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
  } catch (err) {
    console.warn('[FFmpeg] Failed to load ffmpeg-static:', err);
  }

  try {
    const staticFfprobe = require('ffprobe-static');
    const ffprobePath = resolveBinaryPath(staticFfprobe?.path ?? staticFfprobe);
    if (ffprobePath) {
      ffmpeg.setFfprobePath(ffprobePath);
    }
  } catch (err) {
    console.warn('[FFmpeg] Failed to load ffprobe-static:', err);
  }

  return ffmpeg;
}
