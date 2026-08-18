import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { DownloadCloud, RefreshCw } from "lucide-react";
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

export default function UpdateManager({ isAccentDark = true, iconColor }: UpdateManagerProps = {}) {
  const btnRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [update, setUpdate] = useState<UpdatePayload>({ status: "idle" });
  const { accentColor } = useTheme();

  const resolvedIconColor = iconColor ?? (isAccentDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.60)");

  // Subscribe to update events on mount
  useEffect(() => {
    const handler = (_e: unknown, payload: UpdatePayload) => setUpdate(payload);

    window.ipcRenderer.on("update-status", handler);
    return () => {
      window.ipcRenderer.off("update-status", handler);
    };
  }, []);

  // Click-outside closes the panel
  useEffect(() => {
    if (!show) return;
    const onDoc = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [show]);

  useEffect(() => {
    if (update.status === "available") {
      setShow(true);
    }
  }, [update.status]);

  const checkUpdate = useCallback(() => {
    window.ipcRenderer.invoke("check-update").catch(() => {});
  }, []);

  const downloadUpdate = useCallback(() => {
    window.ipcRenderer.invoke("download-update").catch(() => {});
  }, []);

  const installNow = useCallback(() => {
    window.ipcRenderer.invoke("quit-and-install").catch(() => {});
  }, []);

  // Panel anchored to button
  const getPanelStyle = (): React.CSSProperties => {
    if (!btnRef.current) return {};
    const rect = btnRef.current.getBoundingClientRect();
    return {
      position: "fixed",
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
      zIndex: 9999,
    };
  };

  const hasDot =
    update.status === "available" ||
    update.status === "downloading" ||
    update.status === "ready";

  const appVersion =
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "—";

  const panel = show
    ? ReactDOM.createPortal(
        <div
          ref={panelRef}
          style={getPanelStyle()}
          className="w-72 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 text-zinc-900 dark:text-zinc-100 text-sm select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-base">Updates</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              v{appVersion}
            </span>
          </div>

          {/* Status area */}
          <div className="mb-3 min-h-[28px] flex items-center gap-2">
            {update.status === "idle" && (
              <span className="text-zinc-400 dark:text-zinc-500">
                Press check to look for updates.
              </span>
            )}
            {update.status === "checking" && (
              <>
                <DownloadCloud
                  className="w-3.5 h-3.5 animate-spin"
                  style={{ color: accentColor }}
                />
                <span>Checking for updates…</span>
              </>
            )}
            {update.status === "up-to-date" && (
              <span className="text-green-600 dark:text-green-400">
                You're up to date!
              </span>
            )}
            {update.status === "available" && (
              <span style={{ color: accentColor }}>
                v
                {
                  (update as Extract<UpdatePayload, { status: "available" }>)
                    .version
                }{" "}
                available
              </span>
            )}
            {update.status === "downloading" && (
              <div className="w-full">
                <div className="flex justify-between text-xs mb-1">
                  <span>Downloading…</span>
                  <span>
                    {(
                      update as Extract<
                        UpdatePayload,
                        { status: "downloading" }
                      >
                    ).percent ?? 0}
                    %
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(update as Extract<UpdatePayload, { status: "downloading" }>).percent ?? 0}%`,
                      backgroundColor: accentColor,
                    }}
                  />
                </div>
              </div>
            )}
            {update.status === "ready" && (
              <span style={{ color: accentColor }}>
                v
                {
                  (update as Extract<UpdatePayload, { status: "ready" }>)
                    .version
                }{" "}
                ready to install
              </span>
            )}
            {update.status === "error" && (
              <span className="text-red-500 text-xs truncate">
                {
                  (update as Extract<UpdatePayload, { status: "error" }>)
                    .message
                }
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {(update.status === "idle" ||
              update.status === "up-to-date" ||
              update.status === "error") && (
              <button
                onClick={checkUpdate}
                className="w-full py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors text-xs font-medium"
              >
                Check for Updates
              </button>
            )}
            {update.status === "available" && (
              <button
                onClick={downloadUpdate}
                className="w-full py-1.5 rounded-lg text-white transition-colors text-xs font-medium"
                style={{ backgroundColor: accentColor }}
              >
                Download Update
              </button>
            )}
            {update.status === "ready" && (
              <button
                onClick={installNow}
                className="w-full py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors text-xs font-medium"
              >
                Install &amp; Restart
              </button>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        ref={btnRef}
        onClick={() => setShow((s) => !s)}
        className="relative  rounded-md flex items-center justify-center cursor-pointer transition-all duration-150"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isAccentDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.09)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        title="App updates"
      >
        <DownloadCloud
          className="w-5 h-5 transition-colors text-black dark:text-white"
         
        />
        {hasDot && (
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        )}
      </div>
      {panel}
    </>
  );
}
