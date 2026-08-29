import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BIN_DIR = path.resolve(__dirname, '../resources/binaries');
const TARGET_EXE = path.join(BIN_DIR, 'yt-dlp.exe');
const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';

if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

function downloadFile(url, destPath) {
  console.log(`[yt-dlp] Downloading binary from ${url}...`);
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirects (e.g. 302 from GitHub releases)
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          return reject(new Error('Redirect location header missing'));
        }
        console.log(`[yt-dlp] Redirecting to ${redirectUrl}...`);
        return resolve(downloadFile(redirectUrl, destPath));
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download binary, HTTP status ${response.statusCode}`));
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      let lastReport = 0;

      const fileStream = fs.createWriteStream(destPath);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const percent = Math.floor((downloadedBytes / totalBytes) * 100);
          if (percent >= lastReport + 10 || downloadedBytes === totalBytes) {
            lastReport = percent;
            process.stdout.write(`\r[yt-dlp] Download progress: ${percent}% (${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB)`);
          }
        }
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          console.log('\n[yt-dlp] Download completed successfully ->', destPath);
          resolve(destPath);
        });
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

downloadFile(DOWNLOAD_URL, TARGET_EXE)
  .then(() => {
    console.log('[yt-dlp] Binary is ready for AUVID Media Downloader.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[yt-dlp] Error downloading binary:', err.message);
    process.exit(1);
  });
