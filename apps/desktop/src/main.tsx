import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

declare global {
  interface Window {
    __STORY_PILOT_BOOT_ERROR?: string;
    __STORY_PILOT_BOOT_STAGE?: string;
  }
}

window.__STORY_PILOT_BOOT_STAGE = "module-start";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

window.__STORY_PILOT_BOOT_STAGE = "before-react-render";

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

window.__STORY_PILOT_BOOT_STAGE = "after-react-render";
