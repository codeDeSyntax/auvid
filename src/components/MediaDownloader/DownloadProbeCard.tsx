// ─── DownloadProbeCard.tsx ──────────────────────────────────────────────────
// Rich Sea Blue / Cyan themed SaveFrom.net-style download card matching AUVID's vibrant sea blue palette.

import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  Download,
  ChevronDown,
  ExternalLink,
  Check,
  X,
} from 'lucide-react';
import { DownloadProbeResult, StreamFormatOption } from '@/types/mediaDownloader';

interface DownloadProbeCardProps {
  probe: DownloadProbeResult;
  selectedFormat: StreamFormatOption | null;
  onSelectFormat: (format: StreamFormatOption) => void;
  onStartDownload: (overrideFormat?: StreamFormatOption) => void;
  onDismiss: () => void;
  accentColor: string;
}

function formatDuration(secs?: number): string {
  if (!secs || isNaN(secs) || secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const DownloadProbeCard: React.FC<DownloadProbeCardProps> = ({
  probe,
  selectedFormat,
  onSelectFormat,
  onStartDownload,
  onDismiss,
  accentColor,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allFormats = probe.formats || [];

  // Group into primary display and extended ("More") display
  const primaryVideoHeights = [720, 480, 360];

  const primaryFormats = allFormats.filter((f) => {
    if (f.type === 'video' && f.height && primaryVideoHeights.includes(f.height)) return true;
    if (f.type === 'audio' && (f.formatId === 'bestaudio_opus' || f.formatId === 'bestaudio_m4a')) return true;
    return false;
  });

  const moreFormats = allFormats.filter((f) => !primaryFormats.some((pf) => pf.formatId === f.formatId));

  // Fallbacks
  const displayList = primaryFormats.length > 0 ? primaryFormats : allFormats.slice(0, 5);
  const extendedList = primaryFormats.length > 0 ? moreFormats : allFormats.slice(5);

  const activeFormat = selectedFormat || allFormats[0];

  // Helper to get SaveFrom display labels
  const getFormatLabel = (fmt: StreamFormatOption) => {
    if (fmt.type === 'video') {
      return {
        name: 'MP4',
        quality: fmt.height ? `${fmt.height}` : fmt.qualityLabel.replace(/MP4\s*/i, ''),
      };
    }
    if (fmt.formatId === 'bestaudio_opus') {
      return { name: 'Audio OPUS', quality: '155' };
    }
    if (fmt.formatId === 'bestaudio_m4a') {
      return { name: 'Audio M4A', quality: '131' };
    }
    if (fmt.formatId === 'bestaudio_mp3') {
      return { name: 'Audio MP3', quality: '320' };
    }
    if (fmt.formatId === 'bestaudio_flac') {
      return { name: 'Audio FLAC', quality: 'Lossless' };
    }
    if (fmt.formatId === 'bestaudio_wav') {
      return { name: 'Audio WAV', quality: 'Studio' };
    }
    return { name: fmt.ext.toUpperCase(), quality: fmt.qualityLabel };
  };

  const currentLabel = activeFormat ? getFormatLabel(activeFormat) : { name: 'MP4', quality: '720' };

  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl bg-white/80 dark:bg-[#0a2335]/95 border-2 border-cyan-300 dark:border-cyan-500/30  backdrop-blur-2xl transition-all duration-300 overflow-visible relative p-5 sm:p-7">
      {/* Dismiss Button */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 transition-colors z-20 cursor-pointer"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* ── Left Column: Natural Video Thumbnail Frame ── */}
        <div className="w-full md:w-72 shrink-0 flex flex-col space-y-2">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/90 shadow-xl group border-2 border-cyan-200/80 dark:border-cyan-500/30 flex items-center justify-center">
            {probe.thumbnail ? (
              <>
                {/* Ambient Blurred Background (Matches thumbnail color tone without harsh letterbox bars) */}
                <img
                  src={probe.thumbnail}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-40 dark:opacity-50 pointer-events-none select-none"
                />

                {/* Natural Foreground Thumbnail (Never cropped or distorted) */}
                <img
                  src={probe.thumbnail}
                  alt={probe.title}
                  className="w-full h-full object-contain relative z-10 group-hover:scale-[1.02] transition-transform duration-300 drop-shadow-md"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center relative z-10">
                <Film className="w-12 h-12 text-cyan-400" />
              </div>
            )}

            {/* Gradient Shade for text visibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none z-15" />

            {/* Site Badge */}
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-[10px] font-bold text-white flex items-center space-x-1.5 shadow-md z-20">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>{probe.siteName}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
            </div>

            {/* Duration pill */}
            {probe.duration ? (
              <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-black/85 backdrop-blur-md text-[10px] font-mono font-bold text-white shadow-md z-20">
                {formatDuration(probe.duration)}
              </span>
            ) : null}
          </div>
        </div>

        {/* ── Right Column: Title + Rich Sea Blue Action Bar ── */}
        <div className="w-full flex-1 flex flex-col space-y-4 pt-1">
          {/* Title & Duration */}
          <div className="space-y-1">
            <h3
              className="text-sm sm:text-base font-black text-cyan-950 dark:text-cyan-50 line-clamp-2 leading-snug tracking-tight"
              title={probe.title}
            >
              {probe.title}
            </h3>
            {probe.duration ? (
              <p className="text-xs text-cyan-700 dark:text-cyan-400 font-mono font-semibold">
                {formatDuration(probe.duration)}
              </p>
            ) : null}
          </div>

          {/* ── Sea Blue Theme Action Bar (Opens Upwards) ── */}
          <div className="relative inline-flex items-center" ref={dropdownRef}>
            <div className="flex items-center shadow-xl rounded-2xl overflow-hidden border-2 border-cyan-400/60 dark:border-cyan-400/40 bg-white dark:bg-[#071926]">
              {/* Primary Sea Blue Download Button */}
              <button
                type="button"
                onClick={() => onStartDownload(activeFormat)}
                className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white px-6 py-2.5 text-sm font-black transition-all cursor-pointer flex items-center space-x-2 active:scale-98 shadow-md"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download</span>
              </button>

              {/* Dropdown Toggle Trigger Button */}
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="bg-cyan-50 hover:bg-cyan-100 dark:bg-[#0a2538] dark:hover:bg-[#0e314a] text-cyan-950 dark:text-cyan-100 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 border-l-2 border-cyan-400/40"
              >
                <span className="font-black text-cyan-950 dark:text-cyan-100">{currentLabel.name}</span>
                <span className="text-cyan-700 dark:text-cyan-300 font-mono text-[11px] font-bold">{currentLabel.quality}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-cyan-700 dark:text-cyan-300 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* ── Compact SaveFrom.net Dropdown Menu (Sea Blue Themed & Upward) ── */}
            {isDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 z-50 w-52 bg-white dark:bg-[#081f2f] border-2 border-cyan-400 dark:border-cyan-500 rounded-2xl shadow-2xl overflow-hidden divide-y divide-cyan-100 dark:divide-cyan-900/60 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-2xl">
                {/* Primary Formats List */}
                <div className="py-1">
                  {displayList.map((fmt) => {
                    const label = getFormatLabel(fmt);
                    const isSelected = activeFormat?.formatId === fmt.formatId;
                    return (
                      <button
                        key={fmt.formatId}
                        type="button"
                        onClick={() => {
                          onSelectFormat(fmt);
                          setIsDropdownOpen(false);
                          onStartDownload(fmt);
                        }}
                        className="w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-cyan-100/70 dark:hover:bg-cyan-900/50 transition-colors cursor-pointer group"
                      >
                        <span className="text-xs font-black text-cyan-950 dark:text-cyan-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-300">
                          {label.name}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400 font-bold">
                            {label.quality}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Extended "More" Formats List (1080p, 4K, MP3, FLAC, WAV) */}
                {showMore && extendedList.length > 0 && (
                  <div className="py-1 bg-cyan-50/70 dark:bg-cyan-950/50">
                    {extendedList.map((fmt) => {
                      const label = getFormatLabel(fmt);
                      const isSelected = activeFormat?.formatId === fmt.formatId;
                      return (
                        <button
                          key={fmt.formatId}
                          type="button"
                          onClick={() => {
                            onSelectFormat(fmt);
                            setIsDropdownOpen(false);
                            onStartDownload(fmt);
                          }}
                          className="w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-cyan-100/70 dark:hover:bg-cyan-900/50 transition-colors cursor-pointer group"
                        >
                          <span className="text-xs font-black text-cyan-950 dark:text-cyan-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-300">
                            {label.name}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400 font-bold">
                              {label.quality}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* "More" Expand Toggle Button */}
                {extendedList.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMore((prev) => !prev);
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center justify-between bg-cyan-100/50 dark:bg-cyan-950/70 hover:bg-cyan-100 dark:hover:bg-cyan-900/70 transition-colors cursor-pointer text-xs font-black text-cyan-950 dark:text-cyan-200"
                  >
                    <span>More</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-cyan-700 dark:text-cyan-300 transition-transform duration-200 ${
                        showMore ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
