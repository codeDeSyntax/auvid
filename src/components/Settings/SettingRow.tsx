import React from "react";

const SettingRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  control: React.ReactNode;
  active?: boolean;
  accentColor?: string;
}> = ({ icon, title, description, control, active, accentColor }) => (
  <div
    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-colors ${
      active
        ? "border-transparent"
        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
    }`}
    style={
      active
        ? {
            backgroundColor: accentColor ? `${accentColor}18` : undefined,
            borderColor: accentColor ? `${accentColor}40` : undefined,
          }
        : undefined
    }
  >
    <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[13.5px] font-medium text-zinc-900 dark:text-white leading-tight">
        {title}
      </div>
      <div className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">
        {description}
      </div>
    </div>
    <div className="flex-shrink-0">{control}</div>
  </div>
);

export default SettingRow;
