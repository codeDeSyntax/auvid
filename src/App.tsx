import React, { useEffect } from "react";
import { Header } from "./components/Workspace/Header";
import { Sidebar } from "./components/Workspace/Sidebar";
import { AuvidWorkspace } from "./components/Workspace/AuvidWorkspace";

const App: React.FC = () => {
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (window.ipcRenderer) {
          window.ipcRenderer.send("app-ready");
        }
      });
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-outfit select-none">
      {/* Title bar */}
      <Header />

      {/* Body: sidebar + main content */}
      <div className="flex flex-1 overflow-hidden bg-white dark:bg-zinc-950">
        <Sidebar />
        <AuvidWorkspace />
      </div>
    </div>
  );
};

export default App;
