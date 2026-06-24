import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Mount React app
const root = createRoot(document.getElementById("root")!);
root.render(<App />);