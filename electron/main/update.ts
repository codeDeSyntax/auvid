import { app, ipcMain } from "electron";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import type {
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from "electron-updater";

// Always load via createRequire — never a static import so Vite never bundles it
const { autoUpdater } = createRequire(import.meta.url)("electron-updater");

// ── Preferences ───────────────────────────────────────────────────────────────
function prefsPath() {
  return path.join(app.getPath("userData"), "update-prefs.json");
}

type UpdatePrefs = {
  autoCheck: boolean;
  autoDownload: boolean;
};

function readPrefs(): UpdatePrefs {
  try {
    const raw = JSON.parse(fs.readFileSync(prefsPath(), "utf8"));

    if (
      typeof raw?.autoCheck === "boolean" &&
      typeof raw?.autoDownload === "boolean"
    ) {
      return {
        autoCheck: raw.autoCheck,
        autoDownload: raw.autoDownload,
      };
    }

    if (typeof raw?.autoUpdate === "boolean") {
      return {
        autoCheck: true,
        autoDownload: raw.autoUpdate,
      };
    }
  } catch {
    // Defaults: always check on startup, don't auto-download
  }

  return { autoCheck: true, autoDownload: false };
}

function writePrefs(prefs: UpdatePrefs) {
  fs.writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2), "utf8");
}

// ── Main export ───────────────────────────────────────────────────────────────
export function update(win: Electron.BrowserWindow) {
  const prefs = readPrefs();
  autoUpdater.autoDownload = prefs.autoDownload;
  autoUpdater.disableWebInstaller = false;
  autoUpdater.allowDowngrade = false;

  const send = (status: string, extra?: object) => {
    if (!win.isDestroyed())
      win.webContents.send("update-status", { status, ...extra });
  };

  autoUpdater.on("checking-for-update", () => send("checking"));

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    if (autoUpdater.autoDownload) {
      send("downloading", { version: info.version, percent: 0 });
    } else {
      send("available", { version: info.version });
    }
  });

  autoUpdater.on("update-not-available", () => send("up-to-date"));

  autoUpdater.on("download-progress", (info: ProgressInfo) =>
    send("downloading", { percent: Math.floor(info.percent) }),
  );

  autoUpdater.on("update-downloaded", (info: UpdateDownloadedEvent) =>
    send("ready", { version: info.version }),
  );

  autoUpdater.on("error", (err: Error) =>
    send("error", { message: err.message }),
  );

  // ── IPC handlers ────────────────────────────────────────────────────────────
  ipcMain.handle("check-update", async () => {
    try {
      send("checking");
      return await autoUpdater.checkForUpdates();
    } catch (err: any) {
      send("error", { message: err.message });
    }
  });

  ipcMain.handle("download-update", async () => {
    try {
      send("downloading", { percent: 0 });
      await autoUpdater.downloadUpdate();
    } catch (err: any) {
      send("error", { message: err.message });
    }
  });

  ipcMain.handle("get-update-preference", () => readPrefs());

  ipcMain.handle(
    "set-update-preference",
    (_e, p: Partial<UpdatePrefs> | undefined) => {
      const current = readPrefs();
      const next: UpdatePrefs = {
        autoCheck:
          typeof p?.autoCheck === "boolean" ? p.autoCheck : current.autoCheck,
        autoDownload:
          typeof p?.autoDownload === "boolean"
            ? p.autoDownload
            : current.autoDownload,
      };

      writePrefs(next);
      autoUpdater.autoDownload = next.autoDownload;
      return next;
    },
  );

  ipcMain.handle("quit-and-install", () =>
    autoUpdater.quitAndInstall(false, true),
  );

  // Auto-check 3 seconds after renderer loads (gives React time to mount)
  win.webContents.once("did-finish-load", () => {
    const startupPrefs = readPrefs();
    if (startupPrefs.autoCheck) {
      setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000);
    }
  });
}
