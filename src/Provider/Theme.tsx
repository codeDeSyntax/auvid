// contexts/ThemeContext.tsx

import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useCallback,
  useState,
  useEffect,
  ReactNode,
} from "react";

type ThemeContextType = {
  isDarkMode: boolean;
  toggleDarkMode: (origin?: { x: number; y: number }) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
};

// ── Swatch-Book SVG design matching user image ────────────────────────────────
const SwatchBook: React.FC<{ mode: "light" | "dark" }> = ({ mode }) => {
  const isLight = mode === "light";

  const primaryBg = isLight ? "#fafafa" : "#171717";
  const strokeColor = isLight ? "#e5e5e5" : "#262626";
  const innerCardColor = isLight ? "#f5f5f5" : "#1f1f1f";
  const pinColor = isLight ? "#737373" : "#a3a3a3";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 120,
        height: 120,
        animation: "theme-palette-shimmer 2.2s ease-in-out infinite alternate",
      }}
    >
      <svg
        width="104"
        height="104"
        viewBox="0 0 64 64"
        fill="none"
        style={{ overflow: "visible" }}
      >
        <g style={{ transformOrigin: "20px 48px" }}>
          {/* Card 1 (Horizontal - Right/Bottom layer) */}
          <path
            d="M 20 48 L 52 48 C 58 48 58 32 52 32 L 20 32 Z"
            fill={primaryBg}
            stroke={strokeColor}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Card 2 (45 Degree - Middle layer) */}
          <path
            d="M 20 48 L 43 25 C 47 21 57 31 53 35 L 20 48"
            fill={primaryBg}
            stroke={strokeColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Card 3 (Vertical - Left/Top layer) */}
          <rect
            x="8"
            y="8"
            width="24"
            height="44"
            rx="12"
            fill={primaryBg}
            stroke={strokeColor}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Inner cutout style to match the swatch design detail */}
          <rect
            x="14"
            y="14"
            width="12"
            height="22"
            rx="6"
            fill={innerCardColor}
            stroke={strokeColor}
            strokeWidth="1.5"
          />

          {/* Grommet / Hinge Pivot Dot */}
          <circle cx="20" cy="42" r="3.5" fill={pinColor} />
        </g>
      </svg>
    </div>
  );
};

// ── Frosted overlay shown during theme transition ────────────────────────────
const ThemeSwitchOverlay: React.FC<{ visible: boolean; toDark: boolean }> = ({
  visible,
  toDark,
}) => {
  const [mounted, setMounted] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setFading(false);
    } else if (mounted) {
      setFading(true);
      const t = setTimeout(() => {
        setMounted(false);
        setFading(false);
      }, 220);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        backgroundColor: "rgba(0, 0, 0, 0.28)",
        opacity: fading ? 0 : 1,
        transition: "opacity 200ms ease",
        pointerEvents: "all",
      }}
    >
      {/* Elements float directly on the frosted glass overlay */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 48,
          pointerEvents: "none",
        }}
      >
        {/* Left Side: Start Swatch Book */}
        <SwatchBook mode={toDark ? "light" : "dark"} />

        {/* Shimmering, Sliding Flow Arrow */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg
            width="56"
            height="32"
            viewBox="0 0 56 32"
            fill="none"
            style={{
              animation: "theme-arrow-slide 1.1s ease-in-out infinite",
              filter: "drop-shadow(0 4px 12px rgba(255, 255, 255, 0.25))",
            }}
          >
            {/* Curvy, thick, 2-dimensional filled arrow shape */}
            <path
              d="M 6 10 C 18 2 26 22 38 14 L 38 8 L 52 16 L 38 24 L 38 18 C 28 25 20 6 6 14 Z"
              fill="#ffffff"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Right Side: Target Swatch Book */}
        <SwatchBook mode={toDark ? "dark" : "light"} />
      </div>
    </div>
  );
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("darkMode");
      if (stored !== null) return stored === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    try {
      const isDark =
        localStorage.getItem("darkMode") === "true" ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        return localStorage.getItem("accentColorDark") ?? "#06B6D4";
      } else {
        return localStorage.getItem("accentColorLight") ?? "#06B6D4";
      }
    } catch {
      return "#06B6D4";
    }
  });

  const [isSwitching, setIsSwitching] = useState(false);
  const [transitionToDark, setTransitionToDark] = useState(false);

  useLayoutEffect(() => {
    const root = document.documentElement;

    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    root.style.colorScheme = isDarkMode ? "dark" : "light";

    const accentColorForMode = isDarkMode
      ? localStorage.getItem("accentColorDark") ?? "#06B6D4"
      : localStorage.getItem("accentColorLight") ?? "#06B6D4";
    setAccentColorState(accentColorForMode);
    root.style.setProperty("--accent", accentColorForMode);

    localStorage.setItem("darkMode", String(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = useCallback((_origin?: { x: number; y: number }) => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setIsDarkMode((prev) => !prev);
      return;
    }

    setTransitionToDark(!isDarkMode);
    setIsSwitching(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsDarkMode((prev) => !prev);
        setTimeout(() => setIsSwitching(false), 240);
      });
    });
  }, [isDarkMode]);

  const setAccentColor = useCallback(
    (color: string) => {
      setAccentColorState(color);
      document.documentElement.style.setProperty("--accent", color);
      const key = isDarkMode ? "accentColorDark" : "accentColorLight";
      localStorage.setItem(key, color);
    },
    [isDarkMode]
  );

  const contextValue = useMemo(
    () => ({ isDarkMode, toggleDarkMode, accentColor, setAccentColor }),
    [isDarkMode, toggleDarkMode, accentColor, setAccentColor]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
      <ThemeSwitchOverlay visible={isSwitching} toDark={transitionToDark} />
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
