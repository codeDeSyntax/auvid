import React from "react";
import { Info, Cpu, HardDrive, ShieldCheck } from "lucide-react";
import { getAssetPath } from "@/utils/assets";

export const AboutSection: React.FC<{ accentColor: string }> = ({ accentColor }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
        About AUVID
      </h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        High-Performance Audio &amp; Video Manipulation Workstation.
      </p>
    </div>

    {/* App Info Card */}
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/60 p-6 backdrop-blur-sm shadow-xs">
      <div className="flex items-center space-x-4 mb-6">
        <img
          src={getAssetPath("icon.png")}
          alt="AUVID"
          className="w-14 h-14 rounded-2xl shadow-md object-contain"
        />
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              AUVID Studio
            </h3>
            <span
              className="px-2 py-0.5 text-[10px] font-bold rounded-full text-black shadow-xs"
              style={{ backgroundColor: accentColor }}
            >
              v1.0.0
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Native desktop media processing powered by local FFmpeg engine.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/70">
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/50">
          <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold mb-1">
            <Cpu className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>Local Engine</span>
          </div>
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">FFmpeg Static</p>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/50">
          <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold mb-1">
            <HardDrive className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>Processing</span>
          </div>
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Zero Cloud / 100% Local</p>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/50">
          <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold mb-1">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>Privacy</span>
          </div>
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Private &amp; Offline</p>
        </div>
      </div>
    </div>
  </div>
);

export default AboutSection;
