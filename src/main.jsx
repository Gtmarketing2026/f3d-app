import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { instalarStorage } from "./lib/storage";
import { LicencaProvider } from "./lib/LicencaContext";

// Instala window.storage (localStorage) ANTES de montar os módulos,
// pois eles chamam window.storage.get/set logo no primeiro render.
instalarStorage();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LicencaProvider>
      <App />
    </LicencaProvider>
  </React.StrictMode>
);
