// ─── SoundRecorderContext.tsx ────────────────────────────────────────────────
// Global sound recording provider allowing recordings to persist across tab switches
// and driving the floating background recording widget.

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import {
  AudioInputDevice,
  RecordingPreset,
  RECORDING_PRESETS,
  RecordedItem,
  SaveRecordingResult,
} from '@/types/soundRecorder';
import { useJobStore } from '@/Provider/JobStore';

export interface SoundRecorderContextType {
  devices: AudioInputDevice[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  activePreset: RecordingPreset;
  setActivePreset: (preset: RecordingPreset) => void;
  analyser: AnalyserNode | null;
  isRecording: boolean;
  isPaused: boolean;
  durationSec: number;
  estimatedBytes: number;
  recordedBlob: Blob | null;
  previewUrl: string | null;
  isPlayingPreview: boolean;
  previewProgress: number;
  savedRecordings: RecordedItem[];
  isSaving: boolean;
  saveProgress: number;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  discardRecording: () => void;
  togglePreviewPlayback: () => void;
  saveRecording: (customName?: string) => Promise<SaveRecordingResult | null>;
  deleteRecording: (filePath: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
  openRecordingsFolder: () => Promise<void>;
}

const SoundRecorderContext = createContext<SoundRecorderContextType | undefined>(undefined);

export const SoundRecorderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { reportJob, clearJob } = useJobStore();

  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [activePreset, setActivePreset] = useState<RecordingPreset>(RECORDING_PRESETS[0]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [estimatedBytes, setEstimatedBytes] = useState(0);

  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  const [savedRecordings, setSavedRecordings] = useState<RecordedItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  // Audio Context & Analyser refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── 1. Enumerate Microphones ──
  const refreshDevices = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());

      const all = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = all
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
          groupId: d.groupId,
        }));

      setDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('[SoundRecorder] Microphone access error:', err);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  // ── 2. Refresh Saved Recordings List ──
  const refreshRecordings = useCallback(async () => {
    try {
      const list = (await window.ipcRenderer?.invoke('recorder:list')) as RecordedItem[];
      if (Array.isArray(list)) {
        setSavedRecordings(list);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    refreshRecordings();
  }, [refreshRecordings]);

  // ── Listen for Save/Transcode Progress ──
  useEffect(() => {
    const handler = (_event: unknown, data: { percent: number; timemark?: string }) => {
      if (typeof data?.percent === 'number') {
        const pct = Math.min(100, Math.max(0, data.percent));
        setSaveProgress(pct);
        reportJob('recorder', {
          status: 'processing',
          progress: pct,
          label: `Saving recording (${Math.round(pct)}%)`,
        });
      }
    };
    window.ipcRenderer?.on?.('recorder:save-progress', handler);
    return () => {
      window.ipcRenderer?.off?.('recorder:save-progress', handler);
    };
  }, [reportJob]);

  // ── 3. Start Recording ──
  const startRecording = useCallback(async () => {
    try {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setRecordedBlob(null);
      recordedChunksRef.current = [];

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: activePreset.echoCancellation,
          noiseSuppression: activePreset.noiseSuppression,
          autoGainControl: activePreset.autoGainControl,
          sampleRate: activePreset.sampleRate,
          channelCount: activePreset.channels,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: activePreset.sampleRate,
      });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        audioBitsPerSecond: activePreset.bitrateKbps * 1000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
          mediaStreamRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        analyserRef.current = null;
      };

      recorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setDurationSec(0);
      setEstimatedBytes(0);

      // Report active recording job to sidebar
      reportJob('recorder', { status: 'processing', progress: 100, label: 'Recording audio…' });

      startTimeRef.current = Date.now();

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDurationSec(elapsed);

        const bytes = Math.round((elapsed * activePreset.bitrateKbps * 1000) / 8);
        setEstimatedBytes(bytes);
      }, 50);
    } catch (err) {
      console.error('[SoundRecorder] Start recording error:', err);
    }
  }, [selectedDeviceId, activePreset, previewUrl, reportJob]);

  // ── 4. Pause / Resume Recording ──
  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
      reportJob('recorder', { status: 'processing', progress: 100, label: 'Recording paused' });
    }
  }, [reportJob]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'paused') {
      recorder.resume();
      setIsPaused(false);

      startTimeRef.current = Date.now() - durationSec * 1000;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDurationSec(elapsed);
        const bytes = Math.round((elapsed * activePreset.bitrateKbps * 1000) / 8);
        setEstimatedBytes(bytes);
      }, 50);
      reportJob('recorder', { status: 'processing', progress: 100, label: 'Recording audio…' });
    }
  }, [durationSec, activePreset, reportJob]);

  // ── 5. Stop Recording ──
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
      recorder.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
    clearJob('recorder');
  }, [clearJob]);

  // ── 6. Discard Recording ──
  const discardRecording = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordedBlob(null);
    setDurationSec(0);
    setEstimatedBytes(0);
    setIsPlayingPreview(false);
    clearJob('recorder');
  }, [previewUrl, clearJob]);

  // ── 7. Preview Audio Playback ──
  const togglePreviewPlayback = useCallback(() => {
    if (!previewUrl) return;

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(previewUrl);
    }
    const audio = previewAudioRef.current;

    if (!audio.paused) {
      audio.pause();
      setIsPlayingPreview(false);
    } else {
      audio.src = previewUrl;
      audio.play().then(() => {
        setIsPlayingPreview(true);
      }).catch(() => {});

      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          setPreviewProgress(audio.currentTime / audio.duration);
        }
      };

      audio.onended = () => {
        setIsPlayingPreview(false);
        setPreviewProgress(0);
      };
    }
  }, [previewUrl]);

  // ── 8. Save Recording to AUVID Library ──
  const saveRecording = useCallback(async (customName?: string): Promise<SaveRecordingResult | null> => {
    if (!recordedBlob) return null;

    setIsSaving(true);
    setSaveProgress(0);
    reportJob('recorder', { status: 'processing', progress: 0, label: 'Saving recording…' });
    try {
      const buffer = await recordedBlob.arrayBuffer();
      const result = (await window.ipcRenderer?.invoke('recorder:save', {
        buffer,
        format: activePreset.format,
        bitrateKbps: activePreset.bitrateKbps,
        sampleRate: activePreset.sampleRate,
        channels: activePreset.channels,
        customName,
        durationSec,
      })) as SaveRecordingResult;

      await refreshRecordings();
      discardRecording();
      return result;
    } catch (err) {
      console.error('[SoundRecorder] Save error:', err);
      return null;
    } finally {
      setIsSaving(false);
      setSaveProgress(0);
      clearJob('recorder');
    }
  }, [recordedBlob, activePreset, durationSec, refreshRecordings, discardRecording, reportJob, clearJob]);

  // ── 9. Delete Recording ──
  const deleteRecording = useCallback(async (filePath: string) => {
    try {
      await window.ipcRenderer?.invoke('recorder:delete', filePath);
      await refreshRecordings();
    } catch (_) {}
  }, [refreshRecordings]);

  // ── 10. Open Folder ──
  const openRecordingsFolder = useCallback(async () => {
    try {
      await window.ipcRenderer?.invoke('recorder:open-folder');
    } catch (_) {}
  }, []);

  return (
    <SoundRecorderContext.Provider
      value={{
        devices,
        selectedDeviceId,
        setSelectedDeviceId,
        activePreset,
        setActivePreset,
        analyser: analyserRef.current,
        isRecording,
        isPaused,
        durationSec,
        estimatedBytes,
        recordedBlob,
        previewUrl,
        isPlayingPreview,
        previewProgress,
        savedRecordings,
        isSaving,
        saveProgress,
        startRecording,
        pauseRecording,
        resumeRecording,
        stopRecording,
        discardRecording,
        togglePreviewPlayback,
        saveRecording,
        deleteRecording,
        refreshDevices,
        openRecordingsFolder,
      }}
    >
      {children}
    </SoundRecorderContext.Provider>
  );
};

export function useSoundRecorder(): SoundRecorderContextType {
  const ctx = useContext(SoundRecorderContext);
  if (!ctx) {
    throw new Error('useSoundRecorder must be used within a <SoundRecorderProvider>');
  }
  return ctx;
}
