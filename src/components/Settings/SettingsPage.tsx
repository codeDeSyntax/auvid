import React, { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { useTheme } from "@/Provider/Theme";
import { NAV_SECTIONS, SectionId } from "./data";
import AppearanceSection from "./AppearanceSection";
import AboutSection from "./AboutSection";

type UpdatePrefs = {
  autoCheck: boolean;
  autoDownload: boolean;
};

export const SettingsPage: React.FC = () => {
  const { isDarkMode, toggleDarkMode, accentColor } = useTheme();

  const [activeSection, setActiveSection] = useState<SectionId>("appearance");
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(true);
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useState(false);

  useEffect(() => {
    if (window.ipcRenderer?.invoke) {
      window.ipcRenderer
        .invoke("get-update-preference")
        .then((prefs: Partial<UpdatePrefs> | unknown) => {
          if (prefs && typeof prefs === "object") {
            const p = prefs as Partial<UpdatePrefs>;
            setAutoCheckUpdates(p.autoCheck ?? true);
            setAutoDownloadUpdates(p.autoDownload ?? false);
          }
        })
        .catch(() => {});
    }
  }, []);

  const saveUpdatePrefs = async (next: Partial<UpdatePrefs>) => {
    if (window.ipcRenderer?.invoke) {
      await window.ipcRenderer
        .invoke("set-update-preference", next)
        .catch(() => {});
    }
  };

  const toggleAutoCheckUpdates = async () => {
    const next = !autoCheckUpdates;
    setAutoCheckUpdates(next);
    await saveUpdatePrefs({ autoCheck: next });
    flashSaved();
  };

  const toggleAutoDownloadUpdates = async () => {
    const next = !autoDownloadUpdates;
    setAutoDownloadUpdates(next);
    await saveUpdatePrefs({ autoDownload: next });
    flashSaved();
  };

  const flashSaved = () => {
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 1600);
  };

  return (
    <div className="flex-1 flex flex-col bg-transparent text-zinc-900 dark:text-zinc-100 overflow-hidden font-outfit">
      {/* Save toast */}
      {showSaveNotification && (
        <div className="fixed top-16 right-6 z-50 bg-white dark:bg-zinc-800 rounded-xl px-3.5 py-2 flex items-center gap-2 shadow-xl border border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4" style={{ color: accentColor }} />
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            Saved
          </span>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex-shrink-0 border-b border-zinc-200/80 dark:border-zinc-800/70 px-6 pt-5 pb-0 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-md">
        <div className="flex gap-2 max-w-2xl mx-auto">
          {NAV_SECTIONS.map((s) => {
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`relative whitespace-nowrap px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer ${
                  active
                    ? "text-zinc-950 dark:text-white"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                }`}
                style={active ? { color: accentColor } : undefined}
              >
                {s.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        <div className="max-w-2xl mx-auto py-2">
          {activeSection === "appearance" && (
            <AppearanceSection
              isDarkMode={isDarkMode}
              toggleDarkMode={() => {
                toggleDarkMode();
                flashSaved();
              }}
              accentColor={accentColor}
              autoCheckUpdates={autoCheckUpdates}
              autoDownloadUpdates={autoDownloadUpdates}
              toggleAutoCheckUpdates={toggleAutoCheckUpdates}
              toggleAutoDownloadUpdates={toggleAutoDownloadUpdates}
            />
          )}
          {activeSection === "about" && (
            <AboutSection accentColor={accentColor} />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
