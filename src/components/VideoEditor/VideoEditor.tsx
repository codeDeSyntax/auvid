// ─── VideoEditor.tsx ─────────────────────────────────────────────────────────
// Clipchamp-Grade Non-Linear Video Editor & Studio
// Replicating Microsoft Clipchamp's layout, flow, and visual feel
// styled natively with AUVID's signature var(--accent) cyan theme:
//   - Top bar with Undo/Redo, center Canvas aspect ratio pill, and prominent Export button
//   - Cinema viewport with interactive bounding box corners & rotate handle
//   - Center transport bar with 5s skip, playhead pill, duration badge & full-screen
//   - Upgraded multi-clip timeline with razor split mode & filmstrip
//   - Right vertical icon rail + slide-out inspector drawer

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Play, Pause, SkipBack, Scissors, RotateCcw,
  Maximize2, Undo2, Redo2, ArrowUpRight,
  ChevronDown, RotateCw, Sparkles, FolderOpen, Upload,
} from 'lucide-react';
import { useTheme } from '@/Provider/Theme';
import { useVideoFiles } from './hooks/useVideoFiles';
import { useVideoPlayback } from './hooks/useVideoPlayback';
import { useVideoExport } from './hooks/useVideoExport';
import { useEditorSettings } from './hooks/useEditorSettings';
import { useClipSequence } from './hooks/useClipSequence';

import { VideoFilesSidebar } from './panels/VideoFilesSidebar';
import { VideoInspectorPanel } from './panels/VideoInspectorPanel';
import { VideoTimeline, formatTime } from './VideoTimeline';
import { VideoTrimConfirmModal } from './VideoTrimConfirmModal';
import { ExportProgressHUD } from './overlays/ExportProgressHUD';
import { VideoEmptyState } from './overlays/VideoEmptyState';
import type { VideoRegion } from './types';

function filePathToMediaUrl(filePath: string): string {
  return `media://local/?path=${encodeURIComponent(filePath)}`;
}

export const VideoEditor: React.FC = () => {
  const { isDarkMode, accentColor } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 1. Media Files Management ─────────────────────────────────────────────
  const {
    files,
    selectedId,
    selectedFile,
    browseVideoFiles,
    removeFile,
    setSelectedId,
    addFiles,
    handleFileInputChange,
  } = useVideoFiles();

  // Drag and drop handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files;
    if (!dropped || dropped.length === 0) return;

    const paths: string[] = [];
    for (let i = 0; i < dropped.length; i++) {
      const f = dropped[i];
      const p =
        (window as unknown as { api?: { getPathForFile: (file: File) => string } }).api?.getPathForFile(f) ||
        (f as unknown as { path?: string }).path;
      if (p) paths.push(p);
    }

    if (paths.length > 0) {
      addFiles(paths);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── 2. Sequence Management ────────────────────────────────────────────────
  const {
    clips,
    activeClipId,
    activeClip,
    initFromFile,
    razorSplit,
    setActiveClipId,
  } = useClipSequence();

  // Sync loaded file into sequence when selectedFile changes
  useEffect(() => {
    if (selectedFile) {
      initFromFile(selectedFile);
    }
  }, [selectedFile, initFromFile]);

  // ── 3. Selection Region ───────────────────────────────────────────────────
  const [region, setRegion] = useState<VideoRegion>({ inPoint: 0, outPoint: 0 });
  const [isLooping, setIsLooping] = useState(false);
  const [razorMode, setRazorMode] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Initialize or update region when file or clip changes
  useEffect(() => {
    if (activeClip) {
      setRegion({ inPoint: activeClip.inPoint, outPoint: activeClip.outPoint });
    } else if (selectedFile) {
      setRegion({ inPoint: 0, outPoint: selectedFile.duration });
    }
  }, [activeClip, selectedFile]);

  // ── 4. Playback Engine ────────────────────────────────────────────────────
  const {
    videoRef,
    isPlaying,
    playhead,
    isMuted,
    togglePlay,
    stopPlayback,
    stepFrame,
    handleSeek,
    toggleMute,
    setVolume,
  } = useVideoPlayback({
    duration: selectedFile?.duration ?? 0,
    region,
    isLooping,
  });

  // ── 5. Editor Settings (Cut, Color, Audio, Canvas) ─────────────────────────
  const {
    speed,
    setSpeed,
    gain,
    setGain,
    saveMode,
    setSaveMode,
    cutAction,
    setCutAction,
    outputFormat,
    setOutputFormat,
    targetResolution,
    setTargetResolution,

    colorAdj,
    applyColorPreset,
    updateColor,
    resetColor,
    hasColorAdjustments,
    colorCssFilter,

    audioLayer,
    updateAudio,
    browseBGMFile,
    removeBGM,

    canvasRatio,
    setCanvasRatio,
    canvasFillMode,
    setCanvasFillMode,
    rotateDeg,
    rotateCW,
    flipH,
    toggleFlipH,
    flipV,
    toggleFlipV,
    transformCss,
  } = useEditorSettings();

  // Sync audio gain to playback volume
  useEffect(() => {
    setVolume(gain);
  }, [gain, setVolume]);

  // ── 6. Export Pipeline ────────────────────────────────────────────────────
  const {
    exportStatus,
    exportProgress,
    exportPath,
    isOverwritten,
    isExporting,
    handleExecuteExport,
    handleExportSequence,
    handleExtractAudio,
    handleCancelExport,
    resetExportStatus,
  } = useVideoExport();

  // ── Execute Trim Confirmation ─────────────────────────────────────────────
  const onConfirmExecuteTrim = useCallback(async () => {
    if (!selectedFile) return;
    setIsConfirmModalOpen(false);

    // If multiple clips in sequence, perform multi-clip sequence export
    if (clips.length > 1) {
      await handleExportSequence({
        clips: clips.map((c) => ({
          filePath: c.filePath,
          inPoint: c.inPoint,
          outPoint: c.outPoint,
          speed,
          gain,
        })),
        outputFormat: outputFormat === 'same' ? undefined : outputFormat,
        resolution: targetResolution,
        canvasRatio,
      });
      return;
    }

    // Otherwise single-clip enhanced export
    await handleExecuteExport(
      {
        inputPath: selectedFile.path,
        inPoint: region.inPoint,
        outPoint: region.outPoint > 0 ? region.outPoint : selectedFile.duration,
        saveTarget: saveMode === 'in-place' ? 'overwrite-original' : 'new-file',
        cutMode: cutAction === 'delete' ? 'delete-selection' : 'keep-selection',
        speed,
        gain,
        outputFormat: outputFormat === 'same' ? null : outputFormat,
        resolution: targetResolution,
        colorAdjustments: hasColorAdjustments ? colorAdj : undefined,
        bgmPath: audioLayer.bgmPath,
        bgmVolume: audioLayer.bgmVolume,
        audioFadeIn: audioLayer.audioFadeIn,
        audioFadeOut: audioLayer.audioFadeOut,
        canvasRatio,
        canvasFillMode,
        flipH,
        flipV,
        rotateDeg,
      },
      saveMode,
    );
  }, [
    selectedFile,
    clips,
    region,
    saveMode,
    cutAction,
    speed,
    gain,
    outputFormat,
    targetResolution,
    hasColorAdjustments,
    colorAdj,
    audioLayer,
    canvasRatio,
    canvasFillMode,
    flipH,
    flipV,
    rotateDeg,
    handleExportSequence,
    handleExecuteExport,
  ]);

  // Fullscreen video toggle
  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const toggleFullscreen = useCallback(() => {
    if (!viewportContainerRef.current) return;
    if (!document.fullscreenElement) {
      viewportContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Cycle aspect ratios on top bar pill click
  const cycleAspectRatio = useCallback(() => {
    const ratios: typeof canvasRatio[] = ['16:9', '9:16', '1:1', '4:5', '4:3', '21:9'];
    const idx = ratios.indexOf(canvasRatio);
    const next = ratios[(idx + 1) % ratios.length];
    setCanvasRatio(next);
  }, [canvasRatio, setCanvasRatio]);

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        setRazorMode((prev) => !prev);
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        razorSplit(playhead);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        setIsLooping((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepFrame(e.shiftKey ? -5 : -0.1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepFrame(e.shiftKey ? 5 : 0.1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, razorSplit, playhead, toggleMute, stepFrame]);

  // ── Aspect Ratio Container Styling ────────────────────────────────────────
  const canvasAspectRatioStyle = useMemo(() => {
    // Landscape/wide formats: fill available width, cap height so timeline stays visible
    // Portrait/square formats: cap height first so they don't overflow vertically
    switch (canvasRatio) {
      case '9:16': return 'aspect-[9/16] h-full max-h-[72%] w-auto';
      case '1:1':  return 'aspect-square h-full max-h-[68%] w-auto';
      case '4:5':  return 'aspect-[4/5] h-full max-h-[70%] w-auto';
      case '4:3':  return 'aspect-[4/3] w-full max-w-full max-h-[75%]';
      case '21:9': return 'aspect-[21/9] w-full max-w-full max-h-[55%]';
      case '16:9':
      default:
        return 'aspect-video w-full max-w-full max-h-[78%]';
    }
  }, [canvasRatio]);

  // ── 0. Empty State Page: Matches VideoCompressor & AudioCompressor (No Sidebar) ──
  if (files.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col h-full overflow-hidden bg-transparent select-none"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* Hidden Native File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,.mp4,.mkv,.mov,.avi,.webm,.wmv,.flv,.m4v,.ts,.3gp,.ogv"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* AUVID Unified Header */}
        <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border border-zinc-200/80 dark:border-zinc-800/80 bg-transparent backdrop-blur-md shadow-xs">
              <span style={{ color: accentColor }}>Video Studio</span>
              <span className="text-[10px] text-zinc-400 font-mono">· Multi-Track</span>
            </div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 leading-tight tracking-tight">
              Video Editor
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Cut, trim, arrange, color grade, and mix multi-track video and audio
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={browseVideoFiles}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-200 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse Videos</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Add Videos</span>
            </button>
          </div>
        </div>

        {/* 100% Full Width Centered Empty Hero State */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <VideoEmptyState onBrowse={browseVideoFiles} accentColor={accentColor} />
        </div>
      </div>
    );
  }

  const effectiveDuration = selectedFile?.duration ?? 0;
  const selectionDuration = region.outPoint > region.inPoint ? region.outPoint - region.inPoint : effectiveDuration;

  return (
    <div
      className="flex h-full w-full bg-transparent overflow-hidden select-none rounded-tr-3xl"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,.mp4,.mkv,.mov,.avi,.webm,.wmv,.flv,.m4v,.ts,.3gp,.ogv"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* 1. Left Sidebar: Clipchamp-styled "My media" */}
      <VideoFilesSidebar
        files={files}
        selectedId={selectedId}
        onSelectFile={setSelectedId}
        onRemoveFile={removeFile}
        onBrowseFiles={browseVideoFiles}
        isDarkMode={isDarkMode}
        accentColor={accentColor}
      />

      {/* 2. Center Studio Viewport, Transport Bar & Timeline */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-transparent">
        {!selectedFile ? (
          <VideoEmptyState onBrowse={browseVideoFiles} accentColor={accentColor} />
        ) : (
          <>
            {/* ── Top Bar (Matching Clipchamp: Undo/Redo | Aspect Ratio Pill | Export Button) ── */}
            <header className="h-11 shrink-0 px-4 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/60 bg-zinc-50/70 dark:bg-zinc-800/40 backdrop-blur-sm z-10">
              {/* Left: Undo / Redo */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                  title="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                  title="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>

              {/* Center: Clipchamp Aspect Ratio Floating Pill */}
              <button
                type="button"
                onClick={cycleAspectRatio}
                className="flex items-center gap-2 px-3 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700/70 bg-zinc-100/70 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-sm transition-all cursor-pointer"
                title="Click to cycle aspect ratios"
              >
                <Maximize2 className="w-3.5 h-3.5 opacity-70" />
                <span className="font-mono">{canvasRatio}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {/* Right: Prominent Export Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="px-4 py-1.5 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer bg-zinc-900 hover:bg-black text-white dark:bg-cyan-500 dark:text-black dark:hover:brightness-105"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Export</span>
                </button>
              </div>
            </header>

            {/* ── Cinema Video Preview Viewport (Pure white backing like Clipchamp) ── */}
            <div
              ref={viewportContainerRef}
              className="flex-1 min-h-0 relative flex flex-col items-center justify-center pt-3 pb-1 px-4 bg-white dark:bg-zinc-950 overflow-hidden"
            >
              {/* Framed Canvas with Clipchamp Bounding Box Handles */}
              <div
                className={`relative max-w-full flex items-center justify-center bg-black transition-all duration-300 group ${canvasAspectRatioStyle}`}
              >
                {/* Interactive Clipchamp-style selection outline */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-sm border transition-opacity"
                  style={{
                    borderColor: 'var(--accent)',
                    boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)',
                  }}
                >
                  {/* White Corner Handle Dots */}
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-full border border-black shadow pointer-events-auto cursor-nwse-resize" />
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-full border border-black shadow pointer-events-auto cursor-nesw-resize" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white rounded-full border border-black shadow pointer-events-auto cursor-nesw-resize" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-full border border-black shadow pointer-events-auto cursor-nwse-resize" />

                  {/* Center Bottom Rotate Handle Knob */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      rotateCW();
                    }}
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center shadow-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer pointer-events-auto hover:scale-110 transition-transform"
                    title="Rotate 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </div>
                </div>

                <video
                  ref={videoRef}
                  src={filePathToMediaUrl(selectedFile.path)}
                  className="w-full h-full object-contain pointer-events-auto transition-transform duration-150 cursor-pointer"
                  style={{
                    filter: colorCssFilter,
                    transform: transformCss,
                  }}
                  onClick={togglePlay}
                />
              </div>
            </div>

            {/* ── Clipchamp Play & Timestamps Bar (Directly Above Timeline) ── */}
            <div className="h-11 px-6 flex items-center justify-between border-t border-b border-zinc-200/80 dark:border-zinc-800/60 bg-zinc-50/70 dark:bg-zinc-800/40 backdrop-blur-sm select-none z-10 shrink-0">
              {/* Left: AI Magic & Scissor / Razor Tool */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
                  title="AI Magic & Effects"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRazorMode((prev) => !prev)}
                  className={`transition-all cursor-pointer ${
                    razorMode
                      ? 'text-red-500 scale-110'
                      : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
                  }`}
                  title="Split / Razor Tool (C)"
                >
                  <Scissors className="w-4 h-4" />
                </button>
              </div>

              {/* Center: |< , (5 , Circular Play Button , 5) , 00:00 / 16:14 */}
              <div className="flex items-center gap-4">
                {/* Jump to start */}
                <button
                  type="button"
                  onClick={() => stopPlayback(true)}
                  className="text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
                  title="Jump to Start"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                {/* Skip back 5s */}
                <button
                  type="button"
                  onClick={() => stepFrame(-5)}
                  className="relative flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer w-7 h-7"
                  title="Skip Back 5s"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="absolute text-[8px] font-mono font-black">5</span>
                </button>

                {/* Circular Play / Pause Button (Clipchamp: Dark circle in light mode, white in dark mode) */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-9 h-9 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                  title="Play / Pause (Space)"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-white text-white dark:fill-black dark:text-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-white text-white dark:fill-black dark:text-black translate-x-0.5" />
                  )}
                </button>

                {/* Skip forward 5s */}
                <button
                  type="button"
                  onClick={() => stepFrame(5)}
                  className="relative flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer w-7 h-7"
                  title="Skip Forward 5s"
                >
                  <RotateCw className="w-4 h-4" />
                  <span className="absolute text-[8px] font-mono font-black">5</span>
                </button>

                {/* Play Timestamps Display: 00:33 / 16:14 */}
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold tracking-tight text-zinc-800 dark:text-zinc-100 ml-2">
                  <span>{formatTime(playhead, false)}</span>
                  <span className="text-zinc-400 dark:text-zinc-500 font-normal">/</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {formatTime(effectiveDuration, false)}
                  </span>
                </div>
              </div>

              {/* Right: Fullscreen Corner Toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
                  title="Full Screen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Bottom: Multi-Track Timeline & Scrubber (Clipchamp light gray backing) ── */}
            <div className="h-64 shrink-0 bg-[#f4f5f7] dark:bg-[#111115] pb-8 flex flex-col border-t border-zinc-200 dark:border-zinc-800">
              <VideoTimeline
                duration={effectiveDuration}
                region={region}
                playhead={playhead}
                thumbnails={selectedFile.thumbnails}
                accentColor={accentColor}
                isDarkMode={isDarkMode}
                onRegionChange={setRegion}
                onSeek={handleSeek}
                clips={clips}
                activeClipId={activeClipId ?? undefined}
                onSelectClip={setActiveClipId}
                razorMode={razorMode}
                onRazorSplit={(splitTime) => razorSplit(splitTime)}
                bgmTrackName={audioLayer.bgmPath ? audioLayer.bgmPath.split(/[/\\]/).pop() : null}
                onAddAudio={browseBGMFile}
              />
            </div>
          </>
        )}
      </main>

      {/* 3. Right Side: Clipchamp Vertical Icon Rail + Slide-Out Drawer */}
      {selectedFile && (
        <VideoInspectorPanel
          speed={speed}
          onSpeedChange={setSpeed}
          gain={gain}
          onGainChange={setGain}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          saveMode={saveMode}
          onSaveModeChange={setSaveMode}
          cutAction={cutAction}
          onCutActionChange={setCutAction}
          outputFormat={outputFormat}
          onOutputFormatChange={setOutputFormat}
          targetResolution={targetResolution}
          onTargetResolutionChange={setTargetResolution}

          colorAdj={colorAdj}
          onUpdateColor={updateColor}
          onApplyPreset={applyColorPreset}
          onResetColor={resetColor}
          hasColorAdjustments={hasColorAdjustments}

          audioLayer={audioLayer}
          onUpdateAudio={updateAudio}
          onBrowseBGM={browseBGMFile}
          onRemoveBGM={removeBGM}

          canvasRatio={canvasRatio}
          onCanvasRatioChange={setCanvasRatio}
          canvasFillMode={canvasFillMode}
          onCanvasFillModeChange={setCanvasFillMode}
          rotateDeg={rotateDeg}
          onRotateCW={rotateCW}
          flipH={flipH}
          onToggleFlipH={toggleFlipH}
          flipV={flipV}
          onToggleFlipV={toggleFlipV}

          onTriggerExport={() => setIsConfirmModalOpen(true)}
          onExtractAudio={(format) => handleExtractAudio(selectedFile.path, format, region.inPoint, region.outPoint)}
          isExporting={isExporting}
          isDarkMode={isDarkMode}
          accentColor={accentColor}
        />
      )}

      {/* 4. Overlays & Modals */}
      {selectedFile && (
        <VideoTrimConfirmModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={onConfirmExecuteTrim}
          fileName={selectedFile.name}
          filePath={selectedFile.path}
          sourceSize={selectedFile.size}
          sourceDuration={selectedFile.duration}
          width={selectedFile.width}
          height={selectedFile.height}
          fps={selectedFile.fps}
          videoCodec={selectedFile.videoCodec}
          audioCodec={selectedFile.audioCodec}
          inPoint={region.inPoint}
          outPoint={region.outPoint > 0 ? region.outPoint : selectedFile.duration}
          saveMode={saveMode}
          cutAction={cutAction}
          speed={speed}
          gain={gain}
          isMuted={isMuted}
          outputFormat={outputFormat}
          targetResolution={targetResolution}
          accentColor={accentColor}
        />
      )}

      {/* Floating Glass HUD for Export Progress */}
      <ExportProgressHUD
        status={exportStatus}
        progress={exportProgress}
        outputPath={exportPath}
        isOverwritten={isOverwritten}
        onCancel={handleCancelExport}
        onDismiss={resetExportStatus}
        accentColor={accentColor}
      />
    </div>
  );
};

export default VideoEditor;
