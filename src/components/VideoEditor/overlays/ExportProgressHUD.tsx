// ─── ExportProgressHUD.tsx ────────────────────────────────────────────────
// Glassmorphic floating HUD modal for export and audio extraction progress:
//   - Circular progress or glowing progress bar with %
//   - Cancel export action
//   - Reveal in File Explorer when done
//   - Dismiss on success or error

import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, FolderOpen, X } from 'lucide-react';
import type { ExportStatus } from '../types';

interface ExportProgressHUDProps {
  status: ExportStatus;
  progress: number;
  outputPath: string | null;
  isOverwritten: boolean;
  onCancel: () => void;
  onDismiss: () => void;
  accentColor: string;
}

export const ExportProgressHUD: React.FC<ExportProgressHUDProps> = ({
  status,
  progress,
  outputPath,
  isOverwritten,
  onCancel,
  onDismiss,
  accentColor,
}) => {
  if (status === 'idle') return null;

  const isWorking = status === 'exporting' || status === 'extracting-audio';
  const isDone = status === 'done';
  const isError = status === 'error';

  const handleOpenFolder = () => {
    if (outputPath) {
      window.ipcRenderer?.invoke('dialog:show-item-in-folder', outputPath);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 flex flex-col items-center text-center">
        {/* State Icon */}
        <div className="mb-4">
          {isWorking && (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg animate-pulse"
              style={{ backgroundColor: accentColor }}
            >
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
          )}
          {isDone && (
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-in zoom-in-50 duration-200">
              <CheckCircle2 className="w-7 h-7" />
            </div>
          )}
          {isError && (
            <div className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20">
              <AlertTriangle className="w-7 h-7" />
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          {status === 'exporting' && 'Exporting Video'}
          {status === 'extracting-audio' && 'Extracting Soundtrack'}
          {status === 'done' && (isOverwritten ? 'Original Overwritten!' : 'Export Complete!')}
          {status === 'error' && 'Export Failed'}
        </h3>

        {/* Subtitle / Progress */}
        <p className="text-xs text-zinc-500 mt-1 mb-4">
          {isWorking && `${progress}% completed • Please do not close the app`}
          {status === 'done' && (outputPath ? outputPath.split(/[/\\]/).pop() : 'Saved successfully')}
          {status === 'error' && 'An error occurred during rendering. Check console for details.'}
        </p>

        {/* Progress bar */}
        {isWorking && (
          <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden mb-5">
            <div
              className="h-full rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: accentColor,
              }}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full pt-1">
          {isWorking && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          )}

          {isDone && (
            <>
              {outputPath && (
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  className="flex-1 py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Show File</span>
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className="flex-1 py-2 px-4 rounded-xl text-white text-xs font-bold shadow transition-colors"
                style={{ backgroundColor: accentColor }}
              >
                Done
              </button>
            </>
          )}

          {isError && (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-2 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
