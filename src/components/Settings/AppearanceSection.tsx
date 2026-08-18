import React, { useState, useEffect } from "react";
import {
  Sun,
  Moon,
  RefreshCw,
  Download,
  Sparkles,
  Folder,
  FolderOpen,
  Music,
  Video,
  RotateCcw,
} from "lucide-react";
import SettingRow from "./SettingRow";
import Toggle from "./Toggle";

interface AppearanceSectionProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  accentColor: string;
  autoCheckUpdates: boolean;
  autoDownloadUpdates: boolean;
  toggleAutoCheckUpdates: () => void;
  toggleAutoDownloadUpdates: () => void;
}

interface DefaultDirs {
  baseDir: string;
  audioDir: string;
  videoDir: string;
}

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  isDarkMode,
  toggleDarkMode,
  accentColor,
  autoCheckUpdates,
  autoDownloadUpdates,
  toggleAutoCheckUpdates,
  toggleAutoDownloadUpdates,
}) => {
  const [outputDirs, setOutputDirs] = useState<DefaultDirs | null>(null);

  const fetchDirs = (customBase?: string) => {
    window.ipcRenderer
      ?.invoke("app:get-default-output-dirs", customBase)
      .then((res: unknown) => {
        if (res && typeof res === "object" && "baseDir" in res) {
          setOutputDirs(res as DefaultDirs);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    const savedBase = localStorage.getItem("auvid_custom_base_output_dir");
    fetchDirs(savedBase || undefined);
  }, []);

  const handleChangeBaseFolder = async () => {
    try {
      const selected = (await window.ipcRenderer?.invoke(
        "app:select-output-base-dir"
      )) as string | null;
      if (selected) {
        localStorage.setItem("auvid_custom_base_output_dir", selected);
        fetchDirs(selected);
      }
    } catch {
      /* ignore */
    }
  };

  const handleResetDefault = () => {
    localStorage.removeItem("auvid_custom_base_output_dir");
    localStorage.removeItem("auvid_custom_audio_output_dir");
    fetchDirs();
  };

  const handleOpenFolder = (folderPath?: string) => {
    if (folderPath) {
      window.ipcRenderer?.invoke("shell:open-folder", folderPath);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
          Preferences &amp; System
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Configure your studio theme appearance, default output directories, and application update preferences.
        </p>
      </div>

      {/* Theme Section */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">
          Theme Appearance
        </p>
        <SettingRow
          icon={
            isDarkMode ? (
              <Moon className="w-4 h-4" style={{ color: accentColor }} />
            ) : (
              <Sun className="w-4 h-4" style={{ color: accentColor }} />
            )
          }
          title="Dark mode"
          description={isDarkMode ? "Using dark studio theme" : "Using light studio theme"}
          active={isDarkMode}
          accentColor={accentColor}
          control={
            <Toggle
              on={isDarkMode}
              onChange={toggleDarkMode}
              accentColor={accentColor}
            />
          }
        />
      </div>

      {/* Default Output Storage Section */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1 pt-2">
          Default Output Storage
        </p>
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/60 p-4.5 backdrop-blur-sm shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs font-bold text-xs shrink-0"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                <Folder className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    AUVID Default Storage Location
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                    Active
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono break-all">
                  {outputDirs?.audioDir || "Music/AUVID"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                onClick={() => handleOpenFolder(outputDirs?.audioDir)}
                title="Open Music/AUVID folder in File Explorer"
                className="p-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer flex items-center space-x-1"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open</span>
              </button>
              <button
                onClick={handleChangeBaseFolder}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer text-black"
                style={{ backgroundColor: accentColor }}
              >
                Change Folder
              </button>
              <button
                onClick={handleResetDefault}
                title="Reset to system Music/AUVID & Videos/AUVID"
                className="p-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200 dark:border-zinc-700/60 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Subfolder routing breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Audio subfolder */}
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                >
                  <Music className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                    Audio Outputs
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate font-mono">
                    {outputDirs?.audioDir || "Music/AUVID"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleOpenFolder(outputDirs?.audioDir)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer"
                title="Open Music/AUVID folder"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Video subfolder */}
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-purple-500/10 text-purple-500">
                  <Video className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                    Video Outputs
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate font-mono">
                    {outputDirs?.videoDir || "Videos/AUVID"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleOpenFolder(outputDirs?.videoDir)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer"
                title="Open Videos/AUVID folder"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Studio Accent Branding */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1 pt-2">
          Studio Accent Color
        </p>
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/60 p-4.5 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs font-bold text-xs"
              style={{ backgroundColor: accentColor }}
            >
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Sea Blue
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded">
                  #06B6D4
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Standardized studio accent color across buttons, waveforms, tabs, and indicators.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className="w-5 h-5 rounded-full ring-2 ring-cyan-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 shadow-xs"
              style={{ backgroundColor: accentColor }}
            />
          </div>
        </div>
      </div>

      {/* Software Updates */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1 pt-2">
          Software Updates
        </p>
        <SettingRow
          icon={
            <RefreshCw className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
          }
          title="Auto-check updates"
          description="Automatically check for new versions on startup"
          active={autoCheckUpdates}
          accentColor={accentColor}
          control={
            <Toggle
              on={autoCheckUpdates}
              onChange={toggleAutoCheckUpdates}
              accentColor={accentColor}
            />
          }
        />
        <SettingRow
          icon={<Download className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />}
          title="Auto-download updates"
          description="Download available updates automatically in background"
          active={autoDownloadUpdates}
          accentColor={accentColor}
          control={
            <Toggle
              on={autoDownloadUpdates}
              onChange={toggleAutoDownloadUpdates}
              accentColor={accentColor}
            />
          }
        />
      </div>
    </div>
  );
};

export default AppearanceSection;
