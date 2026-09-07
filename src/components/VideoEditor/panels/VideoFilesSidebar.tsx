// ─── VideoFilesSidebar.tsx ──────────────────────────────────────────────────
// Clipchamp-styled "My media" left sidebar:
//   - Header: "My media"
//   - "Import media" accent button with dropdown icon
//   - Selection count row: "[✓] X selected" with trash & add to timeline triggers
//   - Media cards with numbered badges, duration pills, and active accent outlines
//   - Themed with AUVID var(--accent)

import React from 'react';
import {
  Plus, Trash2, ChevronDown, Check, Video,
  FolderOpen, Film,
} from 'lucide-react';
import type { VideoFile } from '../types';
import { formatTime } from '../VideoTimeline';

interface VideoFilesSidebarProps {
  files: VideoFile[];
  selectedId: string | null;
  onSelectFile: (id: string) => void;
  onRemoveFile: (id: string) => void;
  onBrowseFiles: () => void;
  isDarkMode: boolean;
  accentColor?: string;
}

export const VideoFilesSidebar: React.FC<VideoFilesSidebarProps> = ({
  files,
  selectedId,
  onSelectFile,
  onRemoveFile,
  onBrowseFiles,
}) => {
  const selectedCount = selectedId ? 1 : 0;

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r border-zinc-200/80 dark:border-zinc-800/60 bg-zinc-50/70 dark:bg-zinc-800/40 backdrop-blur-sm select-none h-full overflow-hidden">
      {/* 1. Header: My media */}
      <div className="p-3.5 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
          My media
        </h2>
        <span className="text-[11px] font-mono text-zinc-400">
          {files.length} {files.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* 2. Import Media Button */}
      <div className="p-3 pb-2 space-y-2.5">
        <button
          type="button"
          onClick={onBrowseFiles}
          className="w-full py-2.5 px-3 rounded-xl text-xs font-bold shadow-md flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Import media</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>

        {/* Selection / Action Row (Clipchamp style) */}
        {files.length > 0 && (
          <div className="flex items-center justify-between text-xs px-1 text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded flex items-center justify-center text-white text-[9px]"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
              <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                {selectedCount} selected
              </span>
            </div>

            <div className="flex items-center gap-1">
              {selectedId && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(selectedId)}
                  className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Remove selected file"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onBrowseFiles}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Add more media"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Media Assets List */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2.5 no-scrollbar">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-zinc-400 dark:text-zinc-500">
            <Video className="w-8 h-8 mb-2 stroke-[1.5] opacity-50" />
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Your media library is empty</p>
            <p className="text-[10px] mt-1 opacity-75">Click "Import media" or drop video files here</p>
            <button
              type="button"
              onClick={onBrowseFiles}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow cursor-pointer bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105"
            >
              Browse Files
            </button>
          </div>
        ) : (
          files.map((file, idx) => {
            const isSelected = file.id === selectedId;
            const thumb = file.thumbnails?.[0];

            return (
              <div
                key={file.id}
                onClick={() => onSelectFile(file.id)}
                className={`group relative rounded-2xl p-2 cursor-pointer transition-all border ${
                  isSelected
                    ? 'shadow-md ring-2'
                    : 'bg-zinc-100/60 dark:bg-zinc-900/40 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-800/80'
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                        borderColor: 'var(--accent)',
                        boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent)',
                      }
                    : undefined
                }
              >
                {/* Thumbnail Container */}
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-950 flex items-center justify-center border border-black/10 dark:border-white/5">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film className="w-6 h-6 text-zinc-600" />
                  )}

                  {/* Top-Left Clipchamp Number Tag */}
                  <span
                    className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-black text-white shadow"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {idx + 1}
                  </span>

                  {/* Bottom-Left Duration Pill */}
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-mono font-bold text-white">
                    {formatTime(file.duration, false)}
                  </span>

                  {/* Bottom-Right Selected Checkmark Badge */}
                  {isSelected && (
                    <span
                      className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white shadow"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* File Title */}
                <div className="mt-2 px-0.5">
                  <p
                    className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
