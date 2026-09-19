import { useSyncExternalStore } from "react";

/**
 * Onde o tema mora.
 *
 * Dois temas, claro e escuro, e é só isso que a interface oferece — o botão da
 * barra alterna entre os dois. "Sistema" existe aqui dentro como um terceiro
 * estado da preferência, mas não é opção de ninguém: é o nome de "ainda não
 * escolheu", o estado de quem abre a página pela primeira vez. Enquanto durar,
 * a página segue o tema do sistema operacional e acompanha se ele mudar; o
 * primeiro toque no botão o encerra para sempre.
 *
 * A folha de estilo não conhece esse terceiro estado: `data-theme` no `<html>`
 * guarda sempre um tema resolvido. É o que permite escrever a paleta escura
 * uma vez só, em vez de repeti-la dentro de um
 * `@media (prefers-color-scheme: dark)`.
 *
 * Fica fora do React pelo mesmo motivo de `session.ts`: o atributo precisa ser
 * escrito no documento, não numa árvore. A árvore lê daqui pelo
 * `useSyncExternalStore`, como o roteador faz com a History API.
 *
 * O `index.html` repete a leitura da chave num script embutido, porque este
 * módulo só roda depois do bundle — e aí a primeira pintura já aconteceu.
 * Mexeu na chave ou na regra de resolução aqui, mexa lá.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Espelhada no script embutido do `index.html`. */
const KEY = "atalho.tema";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export const THEME_LABEL: Record<ResolvedTheme, string> = {
  light: "Claro",
  dark: "Escuro",
};

function read(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(KEY);
    // Qualquer outra coisa — chave ausente, editada à mão, de uma versão
    // antiga do formato — cai em "sistema", que é o padrão.
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // Armazenamento bloqueado (navegação privada de alguns navegadores).
  }
  return "system";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

export interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}

let current: ThemePreference = read();

/**
 * O retrato lido pela árvore.
 *
 * Guardado em vez de montado a cada leitura porque o `useSyncExternalStore`
 * compara por identidade: um objeto novo a cada chamada seria um estado novo a
 * cada render. E precisa carregar o tema resolvido junto da preferência — sem
 * isso, o sistema trocando de claro para escuro com a preferência em "sistema"
 * não mudaria o retrato, e o botão da barra ficaria com o ícone velho.
 */
let snapshot: ThemeState = { preference: current, resolved: resolveTheme(current) };

const listeners = new Set<() => void>();

function apply() {
  snapshot = { preference: current, resolved: resolveTheme(current) };
  document.documentElement.dataset.theme = snapshot.resolved;

  // A cor da barra do navegador no celular, tirada da própria folha: ler o
  // token depois de trocar o atributo evita uma segunda cópia dos dois valores
  // de fundo, que sairia de sincronia na primeira vez que a paleta mudasse.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();
    if (bg) meta.setAttribute("content", bg);
  }

  listeners.forEach((listener) => listener());
}

export function getThemeState(): ThemeState {
  return snapshot;
}

export function setTheme(preference: ThemePreference) {
  current = preference;
  try {
    window.localStorage.setItem(KEY, preference);
  } catch {
    // Sem onde gravar, a escolha vale só enquanto a aba estiver aberta.
  }
  apply();
}

/**
 * O que o botão da barra faz: troca para o oposto do tema em vigor.
 *
 * Parte do tema resolvido, e não da preferência guardada, porque é assim que a
 * troca faz sentido para quem nunca escolheu: quem está vendo escuro porque o
 * sistema é escuro espera que o toque leve ao claro, e não que o primeiro
 * toque não mude nada.
 */
export function toggleTheme() {
  setTheme(snapshot.resolved === "dark" ? "light" : "dark");
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);

  // Outra aba trocou o tema: `storage` só chega às outras abas, como na sessão.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      current = read();
      apply();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Acerta o documento assim que o módulo carrega e passa a seguir o sistema.
 *
 * O script embutido do `index.html` já escreveu o atributo antes da primeira
 * pintura; esta chamada existe para o resto — a meta `theme-color` e o retrato
 * inicial, que dependem da folha já carregada.
 *
 * O ouvinte é permanente e sem remoção: o tema do sistema pode mudar a
 * qualquer momento (anoitecer, num agendamento do sistema operacional) e a
 * página precisa acompanhar enquanto a preferência for "sistema".
 */
export function startTheme() {
  window.matchMedia(DARK_QUERY).addEventListener("change", () => {
    if (current === "system") apply();
  });
  apply();
}

export function useTheme(): ThemeState {
  return useSyncExternalStore(subscribeTheme, getThemeState, getThemeState);
}
