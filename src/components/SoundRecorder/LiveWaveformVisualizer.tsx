// ─── LiveWaveformVisualizer.tsx ──────────────────────────────────────────────
// High-fidelity 3D kinetic acoustic fins / waveform wafer ribbon visualizer
// with light & dark theme adaptive shading, 3x taller height, and tactile mass.

import React, { useRef, useEffect } from 'react';

interface LiveWaveformVisualizerProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
  isPaused: boolean;
  accentColor: string;
  isDarkMode?: boolean;
  className?: string;
}

export const LiveWaveformVisualizer: React.FC<LiveWaveformVisualizerProps> = ({
  analyser,
  isRecording,
  isPaused,
  accentColor,
  isDarkMode = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Thicker and fewer wafers for substantial tactile domino mass
      const numFins = 38;
      const finSpacing = width / (numFins + 1);
      const finWidth = Math.max(16, finSpacing * 0.82);
      const centerY = height / 2;

      if (analyser && isRecording && !isPaused) {
        analyser.getByteFrequencyData(dataArray);
      }

      const time = Date.now() * 0.0025;

      for (let i = 0; i < numFins; i++) {
        const x = finSpacing * (i + 0.6);
        const distFromCenter = Math.abs(i - numFins / 2) / (numFins / 2); // 0 at center, 1 at edges

        let audioVal = 0;
        if (analyser && isRecording && !isPaused) {
          const freqIndex = Math.floor((i / numFins) * (dataArray.length * 0.6));
          audioVal = (dataArray[freqIndex] || 0) / 255;
        }

        // Kinetic breathing sine oscillation
        const wave1 = Math.sin(time * 1.2 + i * 0.22) * 0.28;
        const wave2 = Math.cos(time * 0.8 + i * 0.15) * 0.22;
        const idleWave = wave1 + wave2;

        const totalIntensity = isRecording && !isPaused
          ? Math.max(0.25, audioVal * 1.1 + idleWave * 0.08)
          : isPaused
          ? 0.35 + Math.sin(time * 2.5 + i * 0.3) * 0.06
          : 0.42 + idleWave * 0.18;

        // 3X TALLER maximum fin height spanning vertical bounds
        const maxFinHeight = height * 0.92;
        const finHeight = Math.max(48, totalIntensity * maxFinHeight);

        // Perspective depth scale
        const depthScale = 1 - distFromCenter * 0.22;
        const curHeight = finHeight * depthScale;
        const curWidth = finWidth * depthScale;
        const y = centerY - curHeight / 2;
        const cornerRadius = Math.min(18, curWidth * 0.42);

        // ── 1. Deep 3D Cast Shadow (Behind) ──
        ctx.fillStyle = isDarkMode ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.roundRect(x + 8 * depthScale, y + 10 * depthScale, curWidth, curHeight, cornerRadius);
        ctx.fill();

        // ── 2. Extrusion Side Body (Thick 3D Slab Depth) ──
        const sideGrad = ctx.createLinearGradient(x, y, x + curWidth + 6, y + curHeight);
        if (isDarkMode) {
          sideGrad.addColorStop(0, '#18181b');
          sideGrad.addColorStop(0.5, '#09090b');
          sideGrad.addColorStop(1, '#000000');
        } else {
          sideGrad.addColorStop(0, '#e4e4e7');
          sideGrad.addColorStop(0.5, '#d4d4d8');
          sideGrad.addColorStop(1, '#a1a1aa');
        }
        ctx.fillStyle = sideGrad;
        ctx.beginPath();
        ctx.roundRect(x + 4 * depthScale, y + 4 * depthScale, curWidth, curHeight, cornerRadius);
        ctx.fill();

        // ── 3. Main Face (Volumetric Tactile Block with Gradient Illumination) ──
        const faceGrad = ctx.createLinearGradient(x, y, x + curWidth, y + curHeight);
        const alpha = Math.max(0.45, (1 - distFromCenter * 0.35));
        
        faceGrad.addColorStop(0, `${accentColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
        faceGrad.addColorStop(0.55, `${accentColor}${Math.floor(alpha * 0.85 * 255).toString(16).padStart(2, '0')}`);
        faceGrad.addColorStop(1, isDarkMode ? '#18181b' : '#f4f4f5');

        ctx.fillStyle = faceGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, curWidth, curHeight, cornerRadius);
        ctx.fill();

        // ── 4. Polished Bevel & Specular Highlight Rim ──
        ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, curWidth - 2, Math.max(3, 6 * depthScale), [cornerRadius, cornerRadius, 2, 2]);
        ctx.fill();

        // ── 5. Subtle Inner Rim Glow ──
        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, curWidth, curHeight, cornerRadius);
        ctx.stroke();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [analyser, isRecording, isPaused, accentColor, isDarkMode]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block select-none pointer-events-none ${className}`}
    />
  );
};
