// ─── MediaDownloader.tsx ───────────────────────────────────────────────────
// Universal Media Downloader with rich, saturated Sea Blue / Cyan theme in Light & Dark modes,
// top view switcher (Downloader & Downloads tabs), and SaveFrom.net dropdown picker.

import React, { useState, useEffect, useRef } from 'react';
import {
  Link,
  Clipboard,
  Sparkles,
  Loader2,
  Trash2,
  AlertCircle,
  DownloadCloud,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import { useTheme } from '@/Provider/Theme';
import { useMediaDownloader } from './useMediaDownloader';
import { DownloadProbeCard } from './DownloadProbeCard';
import { DownloadQueueRow } from './DownloadQueueRow';
import { DownloadSettingsPanel } from './DownloadSettingsPanel';
import { StreamFormatOption } from '@/types/mediaDownloader';

type MainViewTab = 'downloader' | 'downloads';

export const MediaDownloader: React.FC = () => {
  const { accentColor } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  const [activeMainTab, setActiveMainTab] = useState<MainViewTab>('downloader');
  const [showSettings, setShowSettings] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'downloading' | 'completed'>('all');

  const {
    urlInput,
    setUrlInput,
    isProbing,
    probeResult,
    selectedFormat,
    setSelectedFormat,
    probeError,
    setProbeError,
    jobs,
    settings,
    engineStatus,
    isUpdatingEngine,
    probeUrl,
    startDownload,
    cancelJob,
    removeJob,
    clearCompleted,
    updateSettings,
    updateEngine,
  } = useMediaDownloader();

  // Clipboard auto-detect
  useEffect(() => {
    if (!settings.autoPasteClipboard) return;

    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (
          text &&
          /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|twitter\.com|x\.com|facebook\.com|fb\.watch|soundcloud\.com|vimeo\.com|reddit\.com|dailymotion\.com|twitch\.tv)/i.test(
            text.trim()
          )
        ) {
          if (!urlInput && !probeResult && !isProbing) {
            setUrlInput(text.trim());
          }
        }
      } catch (_) {}
    };

    const interval = setInterval(checkClipboard, 2000);
    return () => clearInterval(interval);
  }, [settings.autoPasteClipboard, urlInput, probeResult, isProbing, setUrlInput]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
        probeUrl(text.trim());
      }
    } catch (_) {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && urlInput.trim() && !isProbing) {
      probeUrl();
    }
  };

  const handleDownloadAndSwitch = (overrideFormat?: StreamFormatOption) => {
    startDownload(overrideFormat);
    // Switch to Downloads tab automatically so user can watch progress
    setActiveMainTab('downloads');
  };

  const activeJobs = jobs.filter((j) => j.status === 'downloading' || j.status === 'merging' || j.status === 'queued');
  const completedJobs = jobs.filter((j) => j.status === 'completed');

  const filteredJobs = jobs.filter((job) => {
    if (filterStatus === 'downloading') return job.status === 'downloading' || job.status === 'merging' || job.status === 'queued';
    if (filterStatus === 'completed') return job.status === 'completed';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-[#cffafe] via-[#a5f3fc] to-[#bae6fd] dark:from-[#03131d] dark:via-[#061d2b] dark:to-[#020d14] relative transition-colors duration-500">
      {/* ── Modern Vector Geometric SVG Art in Background ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0">
        {/* Central Sea Blue Ambient Glow Spotlight */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[480px] rounded-full blur-3xl opacity-40 dark:opacity-45 transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse at center, #06b6d4 0%, #0284c7 45%, transparent 75%)`,
          }}
        />

        {/* Scalable Precision Vector Art */}
        <svg
          className="absolute inset-0 w-full h-full opacity-65 dark:opacity-45"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="orbitGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="orbitGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
              <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="waveGrad" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.0" />
              <stop offset="30%" stopColor="#06b6d4" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Large Intersecting Orbital Ring Left */}
          <circle
            cx="280"
            cy="260"
            r="280"
            fill="none"
            stroke="url(#orbitGrad1)"
            strokeWidth="1.5"
          />
          <circle
            cx="280"
            cy="260"
            r="200"
            fill="none"
            stroke="url(#orbitGrad1)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />

          {/* Large Intersecting Orbital Ring Right */}
          <circle
            cx="920"
            cy="320"
            r="340"
            fill="none"
            stroke="url(#orbitGrad2)"
            strokeWidth="1.5"
          />
          <circle
            cx="920"
            cy="320"
            r="260"
            fill="none"
            stroke="url(#orbitGrad2)"
            strokeWidth="1"
            strokeDasharray="6 8"
          />

          {/* Center-Bottom Mega Orbital Circle */}
          <circle
            cx="600"
            cy="460"
            r="380"
            fill="none"
            stroke="url(#orbitGrad1)"
            strokeWidth="1.5"
          />

          {/* Top Subtle Concentric Ring */}
          <circle
            cx="600"
            cy="80"
            r="160"
            fill="none"
            stroke="url(#orbitGrad2)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />

          {/* Dynamic Sine Frequency Wave Contours */}
          <path
            d="M -100 420 C 200 320, 450 520, 750 380 C 1050 240, 1200 460, 1350 400"
            fill="none"
            stroke="url(#waveGrad)"
            strokeWidth="1.5"
          />
          <path
            d="M -100 480 C 250 580, 500 360, 800 500 C 1100 640, 1250 420, 1350 460"
            fill="none"
            stroke="url(#waveGrad)"
            strokeWidth="1"
            strokeDasharray="8 6"
          />

          {/* Subtle Geometry Intersection Nodes */}
          <circle cx="280" cy="540" r="3" fill="#06b6d4" opacity="0.7" />
          <circle cx="920" cy="660" r="3.5" fill="#38bdf8" opacity="0.7" />
          <circle cx="600" cy="840" r="4" fill="#0ea5e9" opacity="0.6" />
          <circle cx="480" cy="180" r="2.5" fill="#06b6d4" opacity="0.8" />
          <circle cx="720" cy="220" r="2.5" fill="#38bdf8" opacity="0.8" />
        </svg>
      </div>

      {/* ── Top Header Bar with Main View Tabs (Downloader vs Downloads) ── */}
      <div className="px-6 md:px-10 pt-5 pb-3 shrink-0 flex items-center justify-between gap-4 border-b border-cyan-300/70 dark:border-cyan-500/20 z-20 backdrop-blur-md bg-transparent dark:bg-transparent">
        {/* Left: View Tabs (Downloader vs Downloads) */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center p-1 rounded-2xl bg-white/90 dark:bg-[#071f2e]/90 border border-cyan-300/80 dark:border-cyan-500/30 shadow-md backdrop-blur-md">
            <button
              onClick={() => setActiveMainTab('downloader')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer flex items-center space-x-2 ${
                activeMainTab === 'downloader'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-cyan-950 hover:text-cyan-700 dark:text-cyan-200/80 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Downloader</span>
            </button>

            <button
              onClick={() => setActiveMainTab('downloads')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer flex items-center space-x-2 relative ${
                activeMainTab === 'downloads'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-cyan-950 hover:text-cyan-700 dark:text-cyan-200/80 dark:hover:text-white'
              }`}
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Downloads</span>

              {jobs.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    activeMainTab === 'downloads'
                      ? 'bg-white text-cyan-800'
                      : 'bg-cyan-600 text-white animate-pulse'
                  }`}
                >
                  {jobs.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right: Settings Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowSettings((prev) => !prev)}
            className={`p-2 px-3 rounded-xl border transition-all cursor-pointer flex items-center space-x-1.5 text-xs font-bold ${
              showSettings
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-600/20'
                : 'bg-white/90 dark:bg-[#071f2e]/80 border-cyan-300/80 dark:border-cyan-500/20 text-cyan-950 hover:text-cyan-700 dark:text-cyan-200 dark:hover:text-white shadow-xs'
            }`}
            title="Downloader Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Floating Soft Settings Menu */}
          {showSettings && (
            <DownloadSettingsPanel
              settings={settings}
              onChange={updateSettings}
              engineStatus={engineStatus}
              isUpdatingEngine={isUpdatingEngine}
              onUpdateEngine={updateEngine}
              onClose={() => setShowSettings(false)}
              accentColor="#06b6d4"
            />
          )}
        </div>
      </div>

      {/* ── Main Workspace Body ── */}
      <div className="flex-1 flex overflow-hidden z-10">
        {/* VIEW 1: DOWNLOADER SEARCH & FETCH */}
        {activeMainTab === 'downloader' && (
          <div className="flex-1 overflow-y-auto no-scrollbar py-8 px-6 md:px-12 space-y-8 flex flex-col items-center">
            {/* 1. Hero Title Section with Sea Blue Typography */}
            <div className="text-center space-y-2.5 max-w-2xl pt-2">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-cyan-950 dark:text-white">
                Universal Video{' '}
                <span className="bg-gradient-to-r from-cyan-600 via-sky-500 to-blue-600 dark:from-cyan-400 dark:via-sky-300 dark:to-blue-400 bg-clip-text text-transparent drop-shadow-xs">
                  Downloader
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-cyan-900 dark:text-cyan-200 leading-relaxed font-semibold">
                High-fidelity media extraction from YouTube, TikTok, Instagram, X, Facebook, and 1,000+ streaming platforms.
              </p>

            
            </div>

            {/* 2. Sea Blue Ringed Search Box */}
            <div className="w-full max-w-2xl space-y-2">
              <div className="flex items-center p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl bg-white/70 dark:bg-[#092233]/90 border-2 border-cyan-300 dark:border-cyan-500/30 ring-4 ring-cyan-400/30 dark:ring-cyan-500/25 hover:ring-cyan-400/50 dark:hover:ring-cyan-500/40 focus-within:ring-cyan-500 backdrop-blur-xl transition-all duration-200">
                <div className="pl-4 pr-1 text-cyan-600 dark:text-cyan-400">
                  <Link className="w-5 h-5" />
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Paste URL..."
                  className="flex-1 bg-transparent text-sm sm:text-base font-semibold text-cyan-950 dark:text-cyan-50 placeholder:text-cyan-900/50 dark:placeholder:text-cyan-300/40 border-0 outline-none ring-0 focus:ring-0 focus:outline-none px-3"
                />

                <div className="flex items-center space-x-2 pr-1">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="px-3.5 py-2.5 rounded-2xl bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900/40 dark:hover:bg-cyan-800/60 text-xs font-bold text-cyan-950 dark:text-cyan-200 border border-cyan-300/60 dark:border-transparent transition-all cursor-pointer flex items-center space-x-1.5"
                    title="Paste from clipboard"
                  >
                    <Clipboard className="w-4 h-4" />
                    <span className="hidden sm:inline">Paste</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => probeUrl()}
                    disabled={!urlInput.trim() || isProbing}
                    className="px-6 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white shadow-xl shadow-cyan-600/30 hover:scale-[1.02] active:scale-98 transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProbing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Fetch</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Probe Error Alert */}
              {probeError && (
                <div className="mt-3 p-3.5 rounded-2xl bg-red-500/10 border-2 border-red-500/30 text-red-700 dark:text-red-400 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200 backdrop-blur-md">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{probeError}</span>
                  </div>
                  <button
                    onClick={() => setProbeError(null)}
                    className="text-xs font-bold underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* 3. Fetched Resource Card (Upward SaveFrom.net Dropdown & Saturated Sea Blue Palette) */}
            {probeResult && (
              <DownloadProbeCard
                probe={probeResult}
                selectedFormat={selectedFormat}
                onSelectFormat={(fmt) => setSelectedFormat(fmt)}
                onStartDownload={handleDownloadAndSwitch}
                onDismiss={() => {
                  setUrlInput('');
                  setProbeError(null);
                }}
                accentColor="#06b6d4"
              />
            )}
          </div>
        )}

        {/* VIEW 2: DOWNLOADS QUEUE & HISTORY (Dedicated Tab View) */}
        {activeMainTab === 'downloads' && (
          <div className="flex-1 overflow-y-auto no-scrollbar py-6 px-6 md:px-12 space-y-6 max-w-4xl mx-auto w-full">
            {/* Header with Filter Chips & Clear */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-cyan-300/70 dark:border-cyan-500/20">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    filterStatus === 'all'
                      ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                      : 'text-cyan-950 hover:text-cyan-700 dark:text-cyan-200 dark:hover:text-white'
                  }`}
                >
                  All ({jobs.length})
                </button>

                <button
                  onClick={() => setFilterStatus('downloading')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    filterStatus === 'downloading'
                      ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                      : 'text-cyan-950 hover:text-cyan-700 dark:text-cyan-200 dark:hover:text-white'
                  }`}
                >
                  Active ({activeJobs.length})
                </button>

                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    filterStatus === 'completed'
                      ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                      : 'text-cyan-950 hover:text-cyan-700 dark:text-cyan-200 dark:hover:text-white'
                  }`}
                >
                  Completed ({completedJobs.length})
                </button>
              </div>

              {jobs.some((j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') && (
                <button
                  onClick={clearCompleted}
                  className="px-3 py-1.5 rounded-xl text-xs font-black text-cyan-900 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Completed</span>
                </button>
              )}
            </div>

            {/* List of Downloads */}
            {filteredJobs.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-4 rounded-3xl border-2 border-dashed border-cyan-400/60 dark:border-cyan-500/30 bg-white/80 dark:bg-[#071f2e]/60 backdrop-blur-md shadow-lg">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-600/20 bg-gradient-to-br from-cyan-600 to-sky-600 text-white"
                >
                  <DownloadCloud className="w-7 h-7 stroke-[1.75]" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-sm font-black text-cyan-950 dark:text-cyan-100">
                    No downloads in this list
                  </p>
                  <p className="text-xs text-cyan-900/80 dark:text-cyan-300/60 font-medium">
                    Switch to the Downloader tab to paste a link and start downloading media files.
                  </p>
                </div>
                <button
                  onClick={() => setActiveMainTab('downloader')}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white shadow-lg shadow-cyan-600/30 hover:scale-105 transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Go to Downloader</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => (
                  <DownloadQueueRow
                    key={job.id}
                    job={job}
                    onCancel={cancelJob}
                    onRemove={removeJob}
                    accentColor="#06b6d4"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
