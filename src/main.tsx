import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import './styles/craft-overrides.css';

if (
  "serviceWorker" in navigator &&
  (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")
) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
