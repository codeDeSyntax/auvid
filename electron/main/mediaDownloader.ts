// ─── Universal Media Downloader — Electron Main Process Engine ───────────────
// Handles probing video/audio streams from 1,000+ websites via yt-dlp,
// downloading selected formats, merging video+audio with local ffmpeg,
// and reporting real-time download progress to the renderer.

import { app, ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn, ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolveBinaryPath } from './binaries.js';

const require = createRequire(import.meta.url);

// ─── Resolve yt-dlp & ffmpeg binary locations ────────────────────────────────
export function getYtDlpPath(): string | null {
  const isWin = process.platform === 'win32';
  const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp';

  // Candidate paths
  const candidates: string[] = [
    // 1. Unpacked resources in production
    path.join(process.resourcesPath || '', 'binaries', binaryName),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'resources', 'binaries', binaryName),
    // 2. Dev resources folder
    path.join(app.getAppPath(), 'resources', 'binaries', binaryName),
    path.join(process.cwd(), 'resources', 'binaries', binaryName),
    // 3. User data or temp directory (if self-updated)
    path.join(app.getPath('userData'), 'binaries', binaryName),
  ];

  for (const candidate of candidates) {
    const resolved = resolveBinaryPath(candidate);
    if (resolved && fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
}

export function getFfmpegDir(): string | null {
  try {
    const staticFfmpeg = require('ffmpeg-static');
    const ffmpegPath = resolveBinaryPath(staticFfmpeg);
    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      return path.dirname(ffmpegPath);
    }
  } catch (_) {}
  return null;
}

// ─── Default Output Directories (aligned with other suites) ───────────────────
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

// Map of active download child processes
const activeDownloadJobs = new Map<string, ChildProcess>();

// ─── Security: URL Validator ──────────────────────────────────────────────────
function validateAndSanitizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Invalid URL provided.');
  }

  const trimmed = rawUrl.trim();
  // Ensure it starts with standard web protocols only
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('URL must start with http:// or https://');
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Unsupported URL protocol.');
    }
    return parsed.href;
  } catch (err: any) {
    throw new Error(`Malformed URL: ${err.message}`);
  }
}

// Detect site name from URL
function detectSiteName(url: string, extractor?: string): string {
  if (extractor && typeof extractor === 'string' && extractor.trim()) {
    const clean = extractor.replace(/:.*/, '');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'YouTube';
    if (hostname.includes('tiktok')) return 'TikTok';
    if (hostname.includes('instagram')) return 'Instagram';
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'Twitter / X';
    if (hostname.includes('facebook') || hostname.includes('fb.watch')) return 'Facebook';
    if (hostname.includes('soundcloud')) return 'SoundCloud';
    if (hostname.includes('vimeo')) return 'Vimeo';
    if (hostname.includes('reddit')) return 'Reddit';
    if (hostname.includes('dailymotion')) return 'Dailymotion';
    if (hostname.includes('twitch')) return 'Twitch';
    return hostname.split('.')[0].toUpperCase();
  } catch {
    return 'Web Media';
  }
}

// ─── Probe URL for Metadata & Available Formats ──────────────────────────────
export async function probeUrl(rawUrl: string): Promise<any> {
  const validUrl = validateAndSanitizeUrl(rawUrl);
  const ytdlpPath = getYtDlpPath();

  if (!ytdlpPath) {
    throw new Error('yt-dlp engine binary is missing or not installed yet.');
  }

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--no-playlist',
      '--skip-download',
      validUrl,
    ];

    const proc = spawn(ytdlpPath, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Failed to probe URL: ${stderr.slice(-500) || 'Extractor exited with error code ' + code}`));
      }

      try {
        const info = JSON.parse(stdout);
        const title = info.title || 'Untitled Media';
        const siteName = detectSiteName(validUrl, info.extractor_key || info.extractor);
        const duration = info.duration || 0;
        const thumbnail = info.thumbnail || (info.thumbnails && info.thumbnails.length > 0 ? info.thumbnails[info.thumbnails.length - 1].url : undefined);
        const uploader = info.uploader || info.channel || info.creator;
        const description = info.description ? info.description.slice(0, 300) : undefined;
        const viewCount = info.view_count;
        const uploadDate = info.upload_date;
        const isLive = Boolean(info.is_live);

        // Parse and categorize formats
        const rawFormats: any[] = info.formats || [];
        const formatOptions: any[] = [];
        const seenResolutions = new Set<string>();

        // 1. Audio-only options (matching SaveFrom / Loader.to style)
        const approxMp3Size = duration > 0 ? Math.round((duration * 320 * 1024) / 8) : undefined;
        const approxM4aSize = duration > 0 ? Math.round((duration * 131 * 1024) / 8) : undefined;
        const approxOpusSize = duration > 0 ? Math.round((duration * 128 * 1024) / 8) : undefined;
        const approxFlacSize = duration > 0 ? Math.round((duration * 800 * 1024) / 8) : undefined;
        const approxWavSize = duration > 0 ? Math.round((duration * 1411 * 1024) / 8) : undefined;

        formatOptions.push({
          formatId: 'bestaudio_mp3',
          type: 'audio',
          qualityLabel: 'Audio MP3 (320k)',
          ext: 'mp3',
          acodec: 'mp3',
          filesize: approxMp3Size,
          isRecommended: true,
        });

        formatOptions.push({
          formatId: 'bestaudio_m4a',
          type: 'audio',
          qualityLabel: 'Audio M4A (131k)',
          ext: 'm4a',
          acodec: 'aac',
          filesize: approxM4aSize,
        });

        formatOptions.push({
          formatId: 'bestaudio_opus',
          type: 'audio',
          qualityLabel: 'Audio OPUS (128k)',
          ext: 'opus',
          acodec: 'opus',
          filesize: approxOpusSize,
        });

        formatOptions.push({
          formatId: 'bestaudio_flac',
          type: 'audio',
          qualityLabel: 'Audio FLAC (Lossless)',
          ext: 'flac',
          acodec: 'flac',
          filesize: approxFlacSize,
        });

        formatOptions.push({
          formatId: 'bestaudio_wav',
          type: 'audio',
          qualityLabel: 'Audio WAV (Studio PCM)',
          ext: 'wav',
          acodec: 'pcm_s16le',
          filesize: approxWavSize,
        });

        // 2. Video formats sorted by height descending
        const videoFormats = rawFormats
          .filter((f) => f.vcodec && f.vcodec !== 'none')
          .sort((a, b) => (b.height || 0) - (a.height || 0));

        // Group resolutions (e.g. 2160p/4K, 1440p/2K, 1080p, 720p, 480p, 360p)
        const standardHeights = [2160, 1440, 1080, 720, 480, 360];

        for (const height of standardHeights) {
          const match = videoFormats.find((f) => f.height && f.height === height) ||
                        videoFormats.find((f) => f.height && Math.abs(f.height - height) <= 20);

          if (match && !seenResolutions.has(`${height}p`)) {
            seenResolutions.add(`${height}p`);
            let label = `MP4 ${height}p`;
            if (height === 2160) label = 'MP4 4K (2160p)';
            else if (height === 1440) label = 'MP4 2K (1440p)';
            else if (height === 1080) label = 'MP4 1080p';
            else if (height === 720) label = 'MP4 720p';
            else if (height === 480) label = 'MP4 480p';
            else if (height === 360) label = 'MP4 360p';

            // Bitrate approximation if filesize is missing
            const approxVideoBitrate = height >= 2160 ? 15000 : height >= 1440 ? 8000 : height >= 1080 ? 4000 : height >= 720 ? 2000 : 1000;
            const approxSize = match.filesize || match.filesize_approx || (duration > 0 ? Math.round((duration * approxVideoBitrate * 1024) / 8) : undefined);

            formatOptions.push({
              formatId: `video_${height}p`,
              type: 'video',
              qualityLabel: label,
              resolution: `${match.width || ''}x${match.height || height}`,
              height: match.height || height,
              fps: match.fps || 30,
              ext: 'mp4',
              filesize: approxSize,
              vcodec: match.vcodec,
              acodec: match.acodec,
              isRecommended: height === 1080 || (height === 720 && !seenResolutions.has('1080p')),
            });
          }
        }

        // If no standard heights matched, provide generic "Best Video"
        if (!formatOptions.some((f) => f.type === 'video')) {
          const approxBestSize = duration > 0 ? Math.round((duration * 3000 * 1024) / 8) : undefined;
          formatOptions.push({
            formatId: 'bestvideo+bestaudio/best',
            type: 'video',
            qualityLabel: 'MP4 Best Video Available',
            ext: 'mp4',
            filesize: approxBestSize,
            isRecommended: true,
          });
        }

        resolve({
          url: validUrl,
          title,
          siteName,
          uploader,
          duration,
          thumbnail,
          description,
          viewCount,
          uploadDate,
          formats: formatOptions,
          isLive,
        });
      } catch (err: any) {
        reject(new Error(`Failed to parse metadata from URL: ${err.message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to execute yt-dlp probe: ${err.message}`));
    });
  });
}

// ─── Start Download Job with Live Progress ────────────────────────────────────
export async function startDownload(
  jobId: string,
  params: {
    url: string;
    formatId: string;
    targetType: 'video' | 'audio';
    customTitle?: string;
    embedThumbnail?: boolean;
    embedSubtitles?: boolean;
  },
  onProgress: (prog: { percent: number; speed?: string; eta?: string; downloaded?: string; total?: string }) => void
): Promise<{ outputPath: string; outputSize: number; title: string }> {
  const validUrl = validateAndSanitizeUrl(params.url);
  const ytdlpPath = getYtDlpPath();

  if (!ytdlpPath) {
    throw new Error('yt-dlp binary is missing.');
  }

  const isAudio = params.targetType === 'audio';
  const outDir = isAudio ? getAudioOutputDir() : getVideoOutputDir();
  const ffmpegDir = getFfmpegDir();

  // Template for unique safe output file
  const outTemplate = path.join(outDir, '%(title).100B [%(id)s].%(ext)s');

  const args: string[] = [
    '--no-warnings',
    '--no-playlist',
    '--newline',
    // High-speed multi-part downloader (up to 4 concurrent fragments)
    '--concurrent-fragments', '4',
    // Output path template
    '-o', outTemplate,
  ];

  if (ffmpegDir) {
    args.push('--ffmpeg-location', ffmpegDir);
  }

  // Configure format arguments
  if (isAudio) {
    args.push('-x'); // Extract audio
    let audioFmt = 'mp3';
    if (params.formatId === 'bestaudio_m4a') audioFmt = 'm4a';
    else if (params.formatId === 'bestaudio_opus') audioFmt = 'opus';
    else if (params.formatId === 'bestaudio_flac') audioFmt = 'flac';
    else if (params.formatId === 'bestaudio_wav') audioFmt = 'wav';
    args.push('--audio-format', audioFmt);
    args.push('--audio-quality', '0'); // Highest quality VBR/CBR
  } else {
    // Video: Merge best video of selected height with best audio into MP4
    if (params.formatId.startsWith('video_')) {
      const height = params.formatId.replace('video_', '').replace('p', '');
      args.push('-f', `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`);
    } else {
      args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best');
    }
    args.push('--merge-output-format', 'mp4');
  }

  if (params.embedThumbnail !== false) {
    args.push('--embed-thumbnail');
  }

  if (params.embedSubtitles) {
    args.push('--embed-subs', '--sub-langs', 'all');
  }

  // Progress output template format for bulletproof parsing
  args.push('--progress-template', 'DOWNLOAD_PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._downloaded_bytes_str)s|%(progress._total_bytes_str)s');

  args.push(validUrl);

  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlpPath, args, { windowsHide: true });
    activeDownloadJobs.set(jobId, proc);

    let stderr = '';
    let finalOutputPath = '';
    let finalTitle = params.customTitle || '';

    proc.stdout.on('data', (d: Buffer) => {
      const text = d.toString();

      // Check for file destination report
      const destMatch = text.match(/\[(?:download|Merger|ExtractAudio)\] Destination:\s*(.+)/i) ||
                        text.match(/\[download\]\s+(.+?)\s+has already been downloaded/i) ||
                        text.match(/\[Merger\] Merging formats into "(.+?)"/i);
      if (destMatch && destMatch[1]) {
        finalOutputPath = destMatch[1].trim();
      }

      // Check progress template output
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.includes('DOWNLOAD_PROGRESS:')) {
          const raw = line.split('DOWNLOAD_PROGRESS:')[1] || '';
          const [pctStr, speedStr, etaStr, downloadedStr, totalStr] = raw.split('|');

          let percent = 0;
          if (pctStr) {
            const cleanPct = pctStr.replace('%', '').trim();
            percent = parseFloat(cleanPct) || 0;
          }

          onProgress({
            percent: Math.min(100, Math.max(0, percent)),
            speed: speedStr?.trim() || undefined,
            eta: etaStr?.trim() || undefined,
            downloaded: downloadedStr?.trim() || undefined,
            total: totalStr?.trim() || undefined,
          });
        }
      }
    });

    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      activeDownloadJobs.delete(jobId);

      if (code !== 0) {
        return reject(new Error(`Download failed (${code}): ${stderr.slice(-500) || 'Process interrupted'}`));
      }

      // Find output file if not captured in stdout
      if (!finalOutputPath || !fs.existsSync(finalOutputPath)) {
        try {
          const files = fs.readdirSync(outDir);
          const newest = files
            .map((f) => ({ name: f, path: path.join(outDir, f), time: fs.statSync(path.join(outDir, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time)[0];
          if (newest) {
            finalOutputPath = newest.path;
          }
        } catch (_) {}
      }

      let outputSize = 0;
      if (finalOutputPath && fs.existsSync(finalOutputPath)) {
        try {
          outputSize = fs.statSync(finalOutputPath).size;
        } catch (_) {}
      }

      if (!finalTitle && finalOutputPath) {
        finalTitle = path.basename(finalOutputPath);
      }

      resolve({
        outputPath: finalOutputPath,
        outputSize,
        title: finalTitle || 'Downloaded Media',
      });
    });

    proc.on('error', (err) => {
      activeDownloadJobs.delete(jobId);
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

// ─── Register IPC Handlers ───────────────────────────────────────────────────
export function registerMediaDownloaderHandlers() {
  // Check if binary is installed & get version
  ipcMain.handle('downloader:check-status', async () => {
    const ytdlpPath = getYtDlpPath();
    if (!ytdlpPath) {
      return { installed: false, version: null, path: null };
    }

    try {
      const ver = await new Promise<string>((resolve) => {
        const proc = spawn(ytdlpPath, ['--version'], { windowsHide: true });
        let out = '';
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.on('close', () => resolve(out.trim()));
        proc.on('error', () => resolve(''));
      });
      return { installed: true, version: ver, path: ytdlpPath };
    } catch {
      return { installed: true, version: 'Available', path: ytdlpPath };
    }
  });

  // Probe media info
  ipcMain.handle('downloader:probe', async (_event, url: string) => {
    try {
      return await probeUrl(url);
    } catch (err: any) {
      console.error('[MediaDownloader] Probe error:', err);
      throw err;
    }
  });

  // Start download
  ipcMain.handle('downloader:start', async (event, payload: { jobId: string; params: any }) => {
    const { jobId, params } = payload;
    const win = BrowserWindow.fromWebContents(event.sender);

    return await startDownload(jobId, params, (prog) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('downloader:progress', { jobId, ...prog });
      }
    });
  });

  // Cancel download
  ipcMain.handle('downloader:cancel', async (_event, jobId: string) => {
    const proc = activeDownloadJobs.get(jobId);
    if (proc) {
      try {
        proc.kill('SIGKILL');
      } catch (_) {}
      activeDownloadJobs.delete(jobId);
      return { success: true };
    }
    return { success: false, error: 'Job not found or already completed.' };
  });

  // User-triggered update for scrapers
  ipcMain.handle('downloader:update-binary', async () => {
    const ytdlpPath = getYtDlpPath();
    if (!ytdlpPath) {
      throw new Error('yt-dlp binary is not installed.');
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(ytdlpPath, ['-U'], { windowsHide: true });
      let output = '';
      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', (d) => { output += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve({ success: true, message: output.trim() || 'yt-dlp is up to date.' });
        else reject(new Error(`Update failed: ${output.slice(-300)}`));
      });
      proc.on('error', reject);
    });
  });
}

export function cleanupMediaDownloader() {
  for (const [id, proc] of activeDownloadJobs.entries()) {
    try {
      proc.kill('SIGKILL');
    } catch (_) {}
  }
  activeDownloadJobs.clear();
}
