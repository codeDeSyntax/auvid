import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./Provider/Theme";
import { MediaProvider } from "./Provider/MediaContext";
import { JobStoreProvider } from "./Provider/JobStore";
import { SoundRecorderProvider } from "./Provider/SoundRecorderContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <MediaProvider>
        <JobStoreProvider>
          <SoundRecorderProvider>
            <App />
          </SoundRecorderProvider>
        </JobStoreProvider>
      </MediaProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
