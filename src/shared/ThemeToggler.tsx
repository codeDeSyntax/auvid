// components/ThemeToggle.tsx

import React from "react";
import { SunDim, SunMoonIcon } from "lucide-react";
import { useTheme } from "@/Provider/Theme";
import { Tooltip } from "antd";
import { MoonFilled, MoonOutlined } from "@ant-design/icons";

interface ThemeToggleProps {
  /** Whether the titlebar accent background is dark. Controls icon colour. */
  isAccentDark?: boolean;
  /** The strong contrast icon colour to use. */
  iconColor?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  isAccentDark = true,
  iconColor,
}) => {
  const { isDarkMode, toggleDarkMode } = useTheme();

  const color =
    iconColor ?? (isAccentDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.88)");
  const dimColor = isAccentDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.60)";

  return (
    <Tooltip title={isDarkMode ? "Light mode" : "Dark mode"}>
      <button
        onClick={(e) => toggleDarkMode({ x: e.clientX, y: e.clientY })}
        className=" p-1 rounded-md flex items-center justify-center cursor-pointer transition-all duration-150 bg-neutral-100 dark:bg-neutral-900"
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = isAccentDark
            ? "rgba(255,255,255,0.13)"
            : "rgba(0,0,0,0.09)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        <SunMoonIcon />
      </button>
    </Tooltip>
  );
};
