import React from "react";
import {
  MinusOutlined,
  BorderOutlined,
  CloseOutlined,
  SunOutlined,
  MoonOutlined,
} from "@ant-design/icons";
import { useTheme } from "@/Provider/Theme";
import { useMediaContext } from "@/Provider/MediaContext";
import UpdateManager from "@/shared/UpdateManager";

export const Header: React.FC = () => {
  const { isDarkMode, toggleDarkMode, accentColor } = useTheme();
  const { handleMinimize, handleMaximize, handleClose } = useMediaContext();

  return (
    <header
      className="h-12 bg-white dark:bg-zinc-950 border-b border-zinc-200/80 dark:border-zinc-800/60
                 flex items-center justify-between px-4 select-none shrink-0 drag
                 transition-colors duration-200"
    >
      {/* Brand */}
      <div className="flex items-center space-x-2.5 no-drag">
        <img
          src="/icon.png"
          alt="AUVID"
          className="w-7 h-7 rounded-lg shadow-sm object-contain"
        />
        <div className="flex flex-col leading-none">
          <span className="font-extrabold tracking-wide text-[13px] text-zinc-900 dark:text-zinc-100">
            AUVID
          </span>
          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-semibold tracking-widest uppercase">
            Studio
          </span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center space-x-1 no-drag">
        <UpdateManager />

        {/* Theme toggle */}
        <button
          onClick={(e) => toggleDarkMode({ x: e.clientX, y: e.clientY })}
          className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white
                     hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDarkMode ? (
            <SunOutlined style={{ color: accentColor, fontSize: "13px" }} />
          ) : (
            <MoonOutlined style={{ color: accentColor, fontSize: "13px" }} />
          )}
        </button>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

        {/* Window controls */}
        <button
          onClick={handleMinimize}
          className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white
                     hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Minimize"
        >
          <MinusOutlined style={{ fontSize: "12px" }} />
        </button>
        <button
          onClick={handleMaximize}
          className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white
                     hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Maximize"
        >
          <BorderOutlined style={{ fontSize: "12px" }} />
        </button>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-white hover:bg-red-500
                     transition-colors cursor-pointer"
          title="Close"
        >
          <CloseOutlined style={{ fontSize: "12px" }} />
        </button>
      </div>
    </header>
  );
};
