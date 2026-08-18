import React from "react";
import { useTheme } from "@/Provider/Theme";

interface PlayingEqualizerProps {
  isPlaying?: boolean;
  barCount?: number;
  className?: string;
}

export const PlayingEqualizer: React.FC<PlayingEqualizerProps> = ({
  isPlaying = false,
  barCount = 4,
  className = "",
}) => {
  const { accentColor } = useTheme();

  // Preset bar heights for smooth rhythmic pulsation
  const heights = [
    { min: "3px", max: "12px", duration: "0.6s", delay: "0s" },
    { min: "4px", max: "14px", duration: "0.8s", delay: "0.2s" },
    { min: "2px", max: "10px", duration: "0.5s", delay: "0.4s" },
    { min: "4px", max: "13px", duration: "0.7s", delay: "0.1s" },
    { min: "3px", max: "11px", duration: "0.65s", delay: "0.3s" },
  ];

  return (
    <div
      className={`inline-flex items-end justify-center space-x-0.5 h-3.5 px-0.5 ${className}`}
      title={isPlaying ? "Playing audio" : "Audio paused"}
    >
      {Array.from({ length: Math.min(barCount, heights.length) }).map((_, i) => {
        const h = heights[i];
        return (
          <span
            key={i}
            className={`w-0.5 rounded-full transition-all ${
              isPlaying ? "animate-pulse" : "opacity-40"
            }`}
            style={{
              backgroundColor: accentColor,
              height: isPlaying ? h.max : h.min,
              animationDuration: h.duration,
              animationDelay: h.delay,
            }}
          />
        );
      })}
    </div>
  );
};

export default PlayingEqualizer;
