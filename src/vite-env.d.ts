/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

// Generic IPC listener type — accepts any function signature so typed handlers work
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcListener = (event: unknown, ...args: any[]) => void;

interface Window {
  // expose in electron/preload/index.ts
  ipcRenderer: {
    on(channel: string, listener: IpcListener): void;
    off(channel: string, listener: IpcListener): void;
    send(channel: string, ...args: unknown[]): void;
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  };
  api: {
    minimizeApp: () => void;
    maximizeApp: () => void;
    minimizeProjection?: () => void;
    closeApp: () => void;
    getPathForFile?: (file: File) => string;
  };
}
