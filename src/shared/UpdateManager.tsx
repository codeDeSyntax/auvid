import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  CloudDownload,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  HardDriveDownload,
} from "lucide-react";
import { useTheme } from "@/Provider/Theme";

type UpdatePayload =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version: string }
  | { status: "downloading"; version?: string; percent: number }
  | { status: "ready"; version: string }
  | { status: "up-to-date" }
  | { status: "error"; message: string };

interface UpdateManagerProps {
  isAccentDark?: boolean;
  iconColor?: string;
}

export default function UpdateManager({}: UpdateManagerProps = {}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [update, setUpdate] = useState<UpdatePayload>({ status: "idle" });
  const { accentColor, isDarkMode } = useTheme();

  // Listen to update status from main process
  useEffect(() => {
    const handler = (_e: unknown, payload: UpdatePayload) => setUpdate(payload);

    window.ipcRenderer.on("update-status", handler);
    return () => {
      window.ipcRenderer.off("update-status", handler);
    };
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!show) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [show]);

  // Open automatically when update is ready or available
  useEffect(() => {
    if (update.status === "available" || update.status === "ready") {
      setShow(true);
    }
  }, [update.status]);

  const checkUpdate = useCallback(() => {
    setUpdate({ status: "checking" });
    window.ipcRenderer.invoke("check-update").catch((err) => {
      setUpdate({ status: "error", message: err?.message || "Failed to check update" });
    });
  }, []);

  const downloadUpdate = useCallback(() => {
    window.ipcRenderer.invoke("download-update").catch((err) => {
      setUpdate({ status: "error", message: err?.message || "Download failed" });
    });
  }, []);

  const installNow = useCallback(() => {
    window.ipcRenderer.invoke("quit-and-install").catch(() => {});
  }, []);

  const getPanelPosition = (): React.CSSProperties => {
    if (!btnRef.current) return {};
    const rect = btnRef.current.getBoundingClientRect();
    return {
      position: "fixed",
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right - 10),
      zIndex: 99999,
    };
  };

  const appVersion = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0";
  const hasUpdate = update.status === "available" || update.status === "ready";
  const isDownloading = update.status === "downloading";
  const isChecking = update.status === "checking";

  const flyout = show
    ? ReactDOM.createPortal(
        <div
          ref={panelRef}
          style={getPanelPosition()}
          className="w-80 rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80 
                     bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-4 text-zinc-900 dark:text-zinc-100 
                     select-none animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
              >
                <CloudDownload className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-xs tracking-wide">Software Updates</span>
            </div>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
              Current: v{appVersion}
            </span>
          </div>

          {/* Dynamic Content Body */}
          <div className="mb-4">
            {update.status === "idle" && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/40 text-center">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  AUVID checks for new releases automatically on startup.
                </p>
              </div>
            )}

            {isChecking && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/40 flex items-center gap-2.5">
                <RotateCw className="w-4 h-4 animate-spin shrink-0" style={{ color: accentColor }} />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Checking GitHub...</span>
                  <span className="text-[10px] text-zinc-400">Querying latest studio releases</span>
                </div>
              </div>
            )}

            {update.status === "up-to-date" && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">AUVID is up to date</span>
                  <span className="text-[10px] text-zinc-400">You are on the latest build (v{appVersion})</span>
                </div>
              </div>
            )}

            {update.status === "available" && (
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accentColor }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    New Update Available: v{(update as Extract<UpdatePayload, { status: "available" }>).version}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Ready to download and upgrade AUVID.
                  </span>
                </div>
              </div>
            )}

            {isDownloading && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/40 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
                    <HardDriveDownload className="w-3.5 h-3.5 animate-bounce" style={{ color: accentColor }} />
                    Downloading Update...
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: accentColor }}>
                    {(update as Extract<UpdatePayload, { status: "downloading" }>).percent ?? 0}%
                  </span>
                </div>
                <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(update as Extract<UpdatePayload, { status: "downloading" }>).percent ?? 0}%`,
                      backgroundColor: accentColor,
                    }}
                  />
                </div>
              </div>
            )}

            {update.status === "ready" && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    v{(update as Extract<UpdatePayload, { status: "ready" }>).version} Ready to Install
                  </span>
                  <span className="text-[10px] text-zinc-400">Restart AUVID to apply update</span>
                </div>
              </div>
            )}

            {update.status === "error" && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">Update Check Failed</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[210px]">
                    {(update as Extract<UpdatePayload, { status: "error" }>).message}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {(update.status === "idle" || update.status === "up-to-date" || update.status === "error") && (
              <button
                onClick={checkUpdate}
                disabled={isChecking}
                className="w-full py-2 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 
                           transition-all text-xs font-medium text-zinc-700 dark:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
                <span>Check for Updates</span>
              </button>
            )}

            {update.status === "available" && (
              <button
                onClick={downloadUpdate}
                className="w-full py-2 px-3 rounded-xl text-white font-medium text-xs shadow-md 
                           hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: accentColor }}
              >
                <HardDriveDownload className="w-3.5 h-3.5" />
                <span>Download Update</span>
              </button>
            )}

            {update.status === "ready" && (
              <button
                onClick={installNow}
                className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs 
                           shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Restart &amp; Install</span>
              </button>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setShow((s) => !s)}
        className="relative h-7 px-2 rounded-lg flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 
                   hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 
                   transition-all duration-150 cursor-pointer no-drag group"
        title="Check for Software Updates"
      >
        <CloudDownload
          className={`w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110 ${
            isChecking ? "animate-spin text-cyan-500" : ""
          }`}
          style={hasUpdate ? { color: accentColor } : undefined}
        />

        {/* Dynamic State Indicators */}
        {hasUpdate && (
          <span
            className="flex h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: update.status === "ready" ? "#10b981" : accentColor }}
          />
        )}

        {isDownloading && (
          <span className="text-[10px] font-mono font-semibold" style={{ color: accentColor }}>
            {(update as Extract<UpdatePayload, { status: "downloading" }>).percent ?? 0}%
          </span>
        )}
      </button>

      {flyout}
    </>
  );
}
