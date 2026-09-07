// ─── VideoEmptyState.tsx ──────────────────────────────────────────────────
// Empty state design strictly aligned with AUVID standards (AudioCompressor, VideoCompressor, FormatConverter):
//   - Glowing ambient radial backdrop with dynamic accentColor
//   - Official empty-trimmer.png asset with smooth hover animation
//   - Consistent typography, subtitle, and primary call-to-action button

import React from 'react';
import { Upload } from 'lucide-react';
import { getAssetPath } from '@/utils/assets';

interface VideoEmptyStateProps {
  onBrowse: () => void;
  accentColor: string;
}

export const VideoEmptyState: React.FC<VideoEmptyStateProps> = ({ onBrowse, accentColor }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
      {/* Glowing Ambient Asset Frame */}
      <div className="relative mb-4 group">
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-25 dark:opacity-30 transition-all group-hover:opacity-45"
          style={{ backgroundColor: accentColor }}
        />
        <img
          src={getAssetPath('empty-trimmer.png')}
          alt="Video Editor"
          className="relative w-44 h-44 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-xl"
        />
      </div>

      {/* Headings */}
      <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
        No Video Files Added
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md leading-relaxed">
        Drag &amp; drop video files anywhere on this window or click below to trim, split, arrange, color grade, and mix multi-track video and audio.
      </p>

      {/* Primary Action Button */}
      <div className="mt-6 flex items-center space-x-3">
        <button
          type="button"
          onClick={onBrowse}
          className="flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Select Videos to Edit</span>
        </button>
      </div>
    </div>
  );
};
