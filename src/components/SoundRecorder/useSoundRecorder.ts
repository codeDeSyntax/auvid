// ─── useSoundRecorder.ts ───────────────────────────────────────────────────
// React hook managing microphone capture, Web Audio AnalyserNode, MediaRecorder,
// live timers, instant preview playback, and saving recordings to disk.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AudioInputDevice,
  RecordingPreset,
  RECORDING_PRESETS,
  RecordedItem,
  SaveRecordingResult,
} from '@/types/soundRecorder';

export function useSoundRecorder() {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [activePreset, setActivePreset] = useState<RecordingPreset>(RECORDING_PRESETS[0]); // WhatsApp by default

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

  // Audio Context & Analyser
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── 1. Enumerate Microphones ──
  const refreshDevices = useCallback(async () => {
    try {
      // Prompt permission first
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

  // ── 3. Start Recording ──
  const startRecording = useCallback(async () => {
    try {
      // Release previous preview URL if any
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

      // Web Audio setup for live visualizer
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

      // Determine best MIME type (WhatsApp Opus)
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

        // Cleanup stream & audio context
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

      recorder.start(100); // 100ms chunk interval for live responsiveness
      setIsRecording(true);
      setIsPaused(false);
      setDurationSec(0);
      setEstimatedBytes(0);

      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDurationSec(elapsed);

        // Live estimated bytes based on preset bitrate
        const bytes = Math.round((elapsed * activePreset.bitrateKbps * 1000) / 8);
        setEstimatedBytes(bytes);
      }, 50);
    } catch (err) {
      console.error('[SoundRecorder] Start recording error:', err);
    }
  }, [selectedDeviceId, activePreset, previewUrl]);

  // ── 4. Pause / Resume Recording ──
  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

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
    }
  }, [durationSec, activePreset]);

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
  }, []);

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
  }, [previewUrl]);

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
    try {
      const buffer = await recordedBlob.arrayBuffer();
      const result = (await window.ipcRenderer?.invoke('recorder:save', {
        buffer,
        format: activePreset.format,
        bitrateKbps: activePreset.bitrateKbps,
        sampleRate: activePreset.sampleRate,
        channels: activePreset.channels,
        customName,
      })) as SaveRecordingResult;

      await refreshRecordings();
      discardRecording();
      return result;
    } catch (err) {
      console.error('[SoundRecorder] Save error:', err);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [recordedBlob, activePreset, refreshRecordings, discardRecording]);

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

  return {
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
  };
}
