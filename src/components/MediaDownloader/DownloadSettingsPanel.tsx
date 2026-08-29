// ─── DownloadSettingsPanel.tsx ──────────────────────────────────────────────
// Spacious, sleek floating dropdown menu for Downloader Settings with ample breathing room.

import React, { useRef, useEffect } from 'react';
import {
  Sliders,
  RefreshCw,
  Shield,
  Subtitles,
  Image as ImageIcon,
  ClipboardCheck,
  Globe,
  X,
  CheckCircle2,
} from 'lucide-react';
import { DownloadSettings } from '@/types/mediaDownloader';

interface DownloadSettingsPanelProps {
  settings: DownloadSettings;
  onChange: (newSettings: Partial<DownloadSettings>) => void;
  engineStatus: { installed: boolean; version: string | null } | null;
  isUpdatingEngine: boolean;
  onUpdateEngine: () => Promise<any>;
  onClose: () => void;
  accentColor: string;
}

export const DownloadSettingsPanel: React.FC<DownloadSettingsPanelProps> = ({
  settings,
  onChange,
  engineStatus,
  isUpdatingEngine,
  onUpdateEngine,
  onClose,
  accentColor,
}) => {
  const [updateMsg, setUpdateMsg] = React.useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleUpdate = async () => {
    setUpdateMsg(null);
    try {
      const res = await onUpdateEngine();
      setUpdateMsg(res?.message || 'Updated successfully.');
    } catch (err: any) {
      setUpdateMsg(err.message || 'Update failed.');
    }
  };

  return (
    <div
      ref={menuRef}
      className="absolute top-full right-0 mt-3 z-50 w-[380px] sm:w-[420px] max-w-[92vw] rounded-3xl bg-white dark:bg-[#071f2e] border-2 border-cyan-300 dark:border-cyan-500/40 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
    >
      {/* Header with Title & Close */}
      <div className="flex items-center justify-between pb-3 border-b border-cyan-200/70 dark:border-cyan-500/20">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shadow-xs">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-cyan-950 dark:text-cyan-50 uppercase tracking-wider">
              Downloader Settings
            </h3>
            <p className="text-[11px] text-cyan-900/60 dark:text-cyan-300/60 font-medium">
              Configure scraping engine & preferences
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 transition-colors cursor-pointer"
          title="Close Settings"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Engine Status & Scraper Updater Box */}
      <div className="p-4 rounded-2xl bg-cyan-50/80 dark:bg-cyan-950/50 border border-cyan-200/80 dark:border-cyan-500/25 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-cyan-950 dark:text-cyan-100 flex items-center space-x-2">
            <Shield className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Extraction Engine</span>
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              engineStatus?.installed
                ? 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-300'
                : 'bg-amber-500/20 text-amber-600'
            }`}
          >
            {engineStatus?.installed ? 'Engine Active' : 'Installing...'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-cyan-900/80 dark:text-cyan-300/80 font-mono font-medium">
          <span>Engine Version:</span>
          <span className="text-cyan-950 dark:text-cyan-50 font-bold px-2 py-0.5 rounded-md bg-white/70 dark:bg-cyan-900/40 border border-cyan-200/60 dark:border-cyan-500/20">
            {engineStatus?.version || 'Detecting...'}
          </span>
        </div>

        <button
          onClick={handleUpdate}
          disabled={isUpdatingEngine || !engineStatus?.installed}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 shadow-md shadow-cyan-600/25 hover:scale-[1.01] active:scale-98"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingEngine ? 'animate-spin' : ''}`} />
          <span>{isUpdatingEngine ? 'Checking Scraper Updates...' : 'Update Extraction Scrapers'}</span>
        </button>

        {updateMsg && (
          <p className="text-[11px] text-cyan-950 dark:text-cyan-100 font-mono leading-relaxed bg-white/90 dark:bg-cyan-900/60 p-2.5 rounded-xl border border-cyan-300 dark:border-cyan-500/30 shadow-xs">
            {updateMsg}
          </p>
        )}
      </div>

      {/* Preferences Section */}
      <div className="space-y-2.5">
        <label className="text-[10px] font-black uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
          Preferences
        </label>

        {/* Auto-paste clipboard */}
        <div className="flex items-center justify-between p-3 px-3.5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-200/70 dark:border-cyan-500/20 hover:border-cyan-300 dark:hover:border-cyan-500/40 transition-colors">
          <div className="space-y-0.5 max-w-[260px]">
            <span className="text-xs font-black text-cyan-950 dark:text-cyan-100 flex items-center space-x-1.5">
              <ClipboardCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Clipboard Auto-Detect</span>
            </span>
            <p className="text-[11px] text-cyan-900/70 dark:text-cyan-300/70 font-medium">
              Auto-fill video link when copying a URL
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoPasteClipboard}
            onChange={(e) => onChange({ autoPasteClipboard: e.target.checked })}
            className="w-4 h-4 rounded cursor-pointer accent-cyan-600"
          />
        </div>

        {/* Embed Thumbnail */}
        <div className="flex items-center justify-between p-3 px-3.5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-200/70 dark:border-cyan-500/20 hover:border-cyan-300 dark:hover:border-cyan-500/40 transition-colors">
          <div className="space-y-0.5 max-w-[260px]">
            <span className="text-xs font-black text-cyan-950 dark:text-cyan-100 flex items-center space-x-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Embed Cover Artwork</span>
            </span>
            <p className="text-[11px] text-cyan-900/70 dark:text-cyan-300/70 font-medium">
              Save original thumbnail inside MP4 / MP3
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.embedThumbnail}
            onChange={(e) => onChange({ embedThumbnail: e.target.checked })}
            className="w-4 h-4 rounded cursor-pointer accent-cyan-600"
          />
        </div>

        {/* Embed Subtitles */}
        <div className="flex items-center justify-between p-3 px-3.5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-200/70 dark:border-cyan-500/20 hover:border-cyan-300 dark:hover:border-cyan-500/40 transition-colors">
          <div className="space-y-0.5 max-w-[260px]">
            <span className="text-xs font-black text-cyan-950 dark:text-cyan-100 flex items-center space-x-1.5">
              <Subtitles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Embed Captions & Subtitles</span>
            </span>
            <p className="text-[11px] text-cyan-900/70 dark:text-cyan-300/70 font-medium">
              Include multi-language subtitles when available
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.embedSubtitles}
            onChange={(e) => onChange({ embedSubtitles: e.target.checked })}
            className="w-4 h-4 rounded cursor-pointer accent-cyan-600"
          />
        </div>
      </div>

      {/* Supported Platforms Overview */}
      <div className="space-y-2 pt-3 border-t border-cyan-200/70 dark:border-cyan-500/20">
        <label className="text-[10px] font-black uppercase tracking-wider text-cyan-800 dark:text-cyan-300 flex items-center space-x-1.5">
          <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>Supported Platforms (1,000+)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {['YouTube', 'TikTok', 'Instagram', 'Twitter/X', 'Facebook', 'SoundCloud', 'Vimeo', 'Reddit', 'Twitch'].map(
            (site) => (
              <span
                key={site}
                className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-cyan-100/80 dark:bg-cyan-950/70 text-cyan-950 dark:text-cyan-200 border border-cyan-300/60 dark:border-cyan-500/30 shadow-2xs"
              >
                {site}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
};
