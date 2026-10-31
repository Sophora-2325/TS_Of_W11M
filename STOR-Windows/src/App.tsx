import { getCurrentWindow } from "@tauri-apps/api/window";
import { SelectionOverlay } from "./components/SelectionOverlay";
import { TranslationPopup } from "./components/TranslationPopup";
import { SettingsPanel } from "./components/SettingsPanel";
import "./App.css";

function App() {
  const windowLabel = getCurrentWindow().label;

  if (windowLabel === "overlay") {
    return <SelectionOverlay />;
  }

  if (windowLabel === "popup") {
    return <TranslationPopup />;
  }

  return <SettingsPanel />;
}

export default App;
