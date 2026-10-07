import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { creerDepotLocal } from "./donnees/depotLocal";
import { App } from "./ui/App";
import "./styles.css";

registerSW({ immediate: true });

createRoot(document.getElementById("racine")!).render(
  <StrictMode>
    <App depot={creerDepotLocal()} />
  </StrictMode>,
);
