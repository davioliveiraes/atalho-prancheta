import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow-condensed/latin-600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { startTheme } from "./lib/theme";
import "./styles/styles.css";

// Depois do import da folha, e antes de montar: a meta `theme-color` sai de um
// token dela, e o atributo do `<html>` precisa estar certo na primeira pintura
// da árvore. O script embutido do `index.html` já cuidou da pintura do fundo.
startTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
