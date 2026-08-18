const https = require('https');
const fs = require('fs');
const path = require('path');

const fonts = [
  // Lora (Variable fonts)
  { url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora%5Bwght%5D.ttf', file: 'Lora-Variable.ttf' },
  { url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora-Italic%5Bwght%5D.ttf', file: 'Lora-Italic-Variable.ttf' }
];

const destDir = path.join(__dirname, '../public/fonts');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} -> ${dest}...`);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Handle redirect
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download, status code: ${res.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Finished ${dest}`);
        resolve();
      });
      fileStream.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

(async () => {
  for (const font of fonts) {
    const destPath = path.join(destDir, font.file);
    try {
      await download(font.url, destPath);
    } catch (err) {
      console.error(`Error downloading ${font.file}:`, err.message);
    }
  }
  console.log('All done!');
})();
