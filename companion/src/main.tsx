import { createRoot } from "react-dom/client";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/400-italic.css";
import "@fontsource/eb-garamond/500.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/400-italic.css";
import "@fontsource/source-sans-3/600.css";
import "katex/dist/katex.min.css";
import "./styles.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
