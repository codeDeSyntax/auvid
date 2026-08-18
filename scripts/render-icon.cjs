const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      offscreen: true,
    },
  });

  const svgPath = path.resolve(__dirname, '../public/icon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html { width: 512px; height: 512px; overflow: hidden; background: transparent; }
          svg { width: 512px; height: 512px; display: block; }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
    </html>
  `)}`);

  // Wait for rendering
  await new Promise(r => setTimeout(r, 600));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const pngBuffer = image.toPNG();

  const iconPngPath = path.resolve(__dirname, '../public/icon.png');
  const hisvPngPath = path.resolve(__dirname, '../public/hisv.png');

  fs.writeFileSync(iconPngPath, pngBuffer);
  fs.writeFileSync(hisvPngPath, pngBuffer);

  console.log('SUCCESS: Rendered icon.png and hisv.png (512x512) using Electron');
  app.quit();
});
