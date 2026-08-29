import { app, BrowserWindow, shell, ipcMain, screen, Display, protocol, net } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { getSystemFonts } from "./fonts.js";
import { update } from "./update.js";
import { registerAudioCompressorHandlers, cleanupAudioCompressor } from "./audioCompressor.js";
import { registerMetadataEditorHandlers, cleanupMetadataEditor } from "./metadataEditor.js";
import { registerAudioTrimmerHandlers, cleanupAudioTrimmer } from "./audioTrimmer.js";
import { registerVideoEditorHandlers, cleanupVideoEditor } from "./videoEditor.js";
import { registerVideoCompressorHandlers, cleanupVideoCompressor } from "./videoCompressor.js";
import { registerFormatConverterHandlers, cleanupFormatConverter } from "./formatConverter.js";
import { registerSoundRecorderHandlers, cleanupSoundRecorder } from "./soundRecorder.js";
import { registerMediaDownloaderHandlers, cleanupMediaDownloader } from "./mediaDownloader.js";

// Register media:// scheme as privileged for streaming local audio/video files in audio player
protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);


const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, "../..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let mainWin: BrowserWindow | null = null;
let splashWin: BrowserWindow | null = null;
let projectionWin: BrowserWindow | null = null;
const preload = path.join(__dirname, "../preload/index.mjs");
const indexHtml = path.join(RENDERER_DIST, "index.html");

function getControlDisplay(): Display {
  const displays = screen.getAllDisplays();
  const internalDisplay = displays.find((display) => display.internal);
  return internalDisplay ?? screen.getPrimaryDisplay();
}

function placeWindowOnDisplay(
  win: BrowserWindow,
  targetDisplay: Display,
): void {
  const area = targetDisplay.workArea;
  win.setBounds({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
  });
  win.maximize();
}

// function createSplashWindow() {
//   splashWin = new BrowserWindow({
//     width: 500,
//     height: 360,
//     frame: false,
//     resizable: false,
//     transparent: false,
//     center: true,
//     show: true,
//     skipTaskbar: true,
//     backgroundColor: "#1a1614",
//     icon: path.join(process.env.VITE_PUBLIC!, "hisv.png"),
//     webPreferences: { nodeIntegration: false, contextIsolation: true },
//   });
//   splashWin.loadFile(path.join(process.env.VITE_PUBLIC!, "splash.html"));
//   splashWin.on("closed", () => {
//     splashWin = null;
//   });
// }

async function createMainWindow() {
  // Prevent creating multiple windows
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.focus();
    return mainWin;
  }

  mainWin = new BrowserWindow({
    title: "Main window",
    frame: false,
    show: true,
    backgroundColor: "#212121",
    minWidth: 1000,
    minHeight: 800,
    icon: path.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload,
      // devTools: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWin.loadURL(VITE_DEV_SERVER_URL);
    mainWin.setMenuBarVisibility(false);
    mainWin.webContents.openDevTools();
  } else {
    mainWin.setMenuBarVisibility(false);
    mainWin.loadFile(indexHtml);
  }

  // Always place the control window on the internal display when available
  placeWindowOnDisplay(mainWin, getControlDisplay());

  // ── Splash window logic (commented out — re-enable if needed) ──────────────
  // let mainShown = false;
  // const showMain = () => {
  //   if (mainShown) return;
  //   mainShown = true;
  //   if (splashWin && !splashWin.isDestroyed()) splashWin.close();
  //   mainWin!.maximize();
  //   mainWin!.show();
  //   mainWin!.focus();
  // };
  // ipcMain.once("app-ready", showMain);
  // mainWin.webContents.once("dom-ready", () => { showMain(); });
  // setTimeout(showMain, 2000);

  // Handle keyboard shortcuts
  mainWin.webContents.on("before-input-event", (event, input) => {
    // In dev mode, allow F12 to toggle DevTools and Ctrl+R to reload
    if (VITE_DEV_SERVER_URL) {
      if (input.key === "F12") {
        event.preventDefault();
        if (mainWin && !mainWin.isDestroyed()) {
          if (mainWin.webContents.isDevToolsOpened()) {
            mainWin.webContents.closeDevTools();
          } else {
            mainWin.webContents.openDevTools();
          }
        }
        return;
      }

      // Allow Ctrl+R or Cmd+R for reload in dev mode
      if (
        (input.key === "R" || input.key === "r") &&
        (input.control || input.meta)
      ) {
        event.preventDefault();
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.reload();
        }
        return;
      }
    }

    // Disable certain shortcuts in production
    if (
      (!VITE_DEV_SERVER_URL && input.key === "F12") || // Disable F12 in production
      (input.key === "I" && input.control && input.shift) || // Disable Ctrl+Shift+I or Cmd+Opt+I
      (!VITE_DEV_SERVER_URL &&
        (input.key === "R" || input.key === "r") &&
        input.control) || // Disable Ctrl+R in production
      (!VITE_DEV_SERVER_URL &&
        (input.key === "R" || input.key === "r") &&
        input.meta) // Disable Cmd+R in production on macOS
    ) {
      event.preventDefault();
    }
  });

  // Handle window control IPC events
  ipcMain.removeAllListeners("minimizeApp");
  ipcMain.removeAllListeners("maximizeApp");
  ipcMain.removeAllListeners("closeApp");
  ipcMain.removeAllListeners("minimizeProjection");

  ipcMain.on("minimizeApp", () => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.minimize();
    }
  });

  ipcMain.on("maximizeApp", () => {
    if (mainWin && !mainWin.isDestroyed()) {
      if (mainWin.isMaximized()) {
        mainWin.unmaximize();
      } else {
        mainWin.maximize();
      }
    }
  });

  ipcMain.on("closeApp", () => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.close();
    }
  });

  ipcMain.on("minimizeProjection", () => {
    if (projectionWin && !projectionWin.isDestroyed()) {
      projectionWin.minimize();
    }
  });

  // Clean up when window is closed
  mainWin.on("closed", () => {
    mainWin = null;
    // Clean up IPC listeners when window is closed
    ipcMain.removeAllListeners("minimizeApp");
    ipcMain.removeAllListeners("maximizeApp");
    ipcMain.removeAllListeners("closeApp");
    ipcMain.removeAllListeners("minimizeProjection");
    ipcMain.removeAllListeners("get-system-fonts");
    cleanupAudioCompressor();
    cleanupMetadataEditor();
    cleanupAudioTrimmer();
    cleanupMediaDownloader();
  });

  // IPC handler for getting system fonts
  ipcMain.handle("get-system-fonts", async () => {
    try {
      const fonts = await getSystemFonts();
      return fonts;
    } catch (error) {
      console.error("Error in get-system-fonts handler:", error);
      return [];
    }
  });

  // Register audio compressor IPC handlers
  registerAudioCompressorHandlers(() => mainWin);

  // Register metadata editor IPC handlers
  registerMetadataEditorHandlers();

  // Register audio trimmer IPC handlers
  registerAudioTrimmerHandlers();

  // Register video editor IPC handlers
  registerVideoEditorHandlers();

  // Register video compressor IPC handlers
  registerVideoCompressorHandlers();

  // Register format converter IPC handlers
  registerFormatConverterHandlers();

  // Register sound recorder IPC handlers
  registerSoundRecorderHandlers();

  // Register universal media downloader IPC handlers
  registerMediaDownloaderHandlers();

  // Handle external links
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return mainWin;
}

// MIME type resolver for media streaming
function getMediaMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/opus',
    '.wma': 'audio/x-ms-wma',
    '.aiff': 'audio/aiff',
    '.alac': 'audio/mp4',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

// App event handlers
app.whenReady().then(async () => {
  // Handle local media streaming protocol with full HTTP 206 byte-range seeking support
  protocol.handle("media", (request) => {
    try {
      let targetPath = "";
      try {
        const parsed = new URL(request.url);
        targetPath = parsed.searchParams.get("path") || "";
        if (!targetPath) {
          const rawPath = parsed.pathname.replace(/^\/+/, "");
          targetPath = decodeURIComponent(rawPath);
        }
      } catch {
        const rawUrl = request.url.replace(/^media:\/\/+/i, "");
        targetPath = decodeURIComponent(rawUrl);
      }

      if (!targetPath || !fs.existsSync(targetPath)) {
        console.warn("[MediaProtocol] File not found on disk:", targetPath);
        return new Response("Media not found", { status: 404 });
      }

      const stat = fs.statSync(targetPath);
      const fileSize = stat.size;
      const rangeHeader = request.headers.get("range");
      const mimeType = getMediaMimeType(targetPath);

      if (rangeHeader) {
        // Parse Range: bytes=start-end
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
          const chunkSize = end - start + 1;
          const stream = fs.createReadStream(targetPath, { start, end });

          const webStream = new ReadableStream({
            start(controller) {
              stream.on("data", (chunk) => controller.enqueue(chunk));
              stream.on("end", () => controller.close());
              stream.on("error", (err) => controller.error(err));
            },
            cancel() {
              stream.destroy();
            },
          });

          return new Response(webStream, {
            status: 206,
            statusText: "Partial Content",
            headers: {
              "Content-Range": `bytes ${start}-${end}/${fileSize}`,
              "Accept-Ranges": "bytes",
              "Content-Length": String(chunkSize),
              "Content-Type": mimeType,
            },
          });
        }
      }

      // Full file stream with Accept-Ranges enabled
      const stream = fs.createReadStream(targetPath);
      const webStream = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) => controller.enqueue(chunk));
          stream.on("end", () => controller.close());
          stream.on("error", (err) => controller.error(err));
        },
        cancel() {
          stream.destroy();
        },
      });

      return new Response(webStream, {
        status: 200,
        headers: {
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
          "Content-Type": mimeType,
        },
      });
    } catch (err) {
      console.error("[MediaProtocol] Failed to stream media:", err);
      return new Response("Media streaming error", { status: 500 });
    }
  });

  // createSplashWindow();
  await createMainWindow();
  if (mainWin) update(mainWin);

  const ensureControlWindowPlacement = () => {
    if (mainWin && !mainWin.isDestroyed()) {
      placeWindowOnDisplay(mainWin, getControlDisplay());
    }
  };

  screen.on("display-added", ensureControlWindowPlacement);
  screen.on("display-removed", ensureControlWindowPlacement);
  screen.on("display-metrics-changed", ensureControlWindowPlacement);

  // Handle app activation (macOS specific)
  app.on("activate", () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWin && !mainWin.isDestroyed()) {
      // Focus existing window if it exists
      mainWin.focus();
    }
  });
});

// Handle second instance attempt
app.on("second-instance", () => {
  // Someone tried to run a second instance, focus our window instead
  if (mainWin && !mainWin.isDestroyed()) {
    if (mainWin.isMinimized()) {
      mainWin.restore();
    }
    mainWin.focus();
  } else {
    // If window was closed, create a new one
    createMainWindow();
  }
});

// Ensure app quits when all windows are closed
app.on("window-all-closed", () => {
  // On macOS, apps typically stay running even when all windows are closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle app before quit
app.on("before-quit", () => {
  screen.removeAllListeners("display-added");
  screen.removeAllListeners("display-removed");
  screen.removeAllListeners("display-metrics-changed");
  // Clean up any resources before quitting
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.removeAllListeners();
  }
});


// Security: Prevent new window creation from renderer
// app.on("web-contents-created", (event, contents) => {
//   contents.setWindowOpenHandler(({ url }) => {
//     // Prevent new window creation
//     shell.openExternal(url);
//     return { action: "deny" };
//   });

//   contents.on("will-navigate", (event, navigationUrl) => {
//     const parsedUrl = new URL(navigationUrl);

//     // Allow navigation to same origin or dev server
//     if (
//       parsedUrl.origin !== VITE_DEV_SERVER_URL &&
//       parsedUrl.origin !== "file://"
//     ) {
//       event.preventDefault();
//       shell.openExternal(navigationUrl);
//     }
//   });
// });

// Export for testing or external access
export { createMainWindow, mainWin };
