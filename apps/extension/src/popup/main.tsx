import { createRoot } from "react-dom/client";
import { App } from "./App";

// StrictMode causa React error #418 com crxjs/vite-plugin beta (double-invoke
// no contexto de extensão). Removido — manter sem StrictMode em produção.
createRoot(document.getElementById("root")!).render(<App />);
