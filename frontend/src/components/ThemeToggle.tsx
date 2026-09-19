import { Moon, Sun } from "lucide-react";
import { THEME_LABEL, toggleTheme, useTheme } from "../lib/theme";

/**
 * O botão de tema da barra.
 *
 * Dois estados e um toque entre eles: o sol quando a tela está clara, a lua
 * quando está escura. Não há terceira opção a oferecer — quem nunca escolheu
 * já está vendo o tema do sistema, e o botão serve justamente a quem quer sair
 * dele.
 *
 * Fica dentro de `.nav-links`, e não solto na barra, para herdar o
 * comportamento dos outros itens — some junto no menu do mobile e reaparece
 * como uma linha da lista, ali com o rótulo visível, que é onde há largura
 * para ele.
 *
 * O ícone mostra o tema em vigor, e não o que o toque traria: é o mesmo que
 * fazem os outros itens da barra, que dizem onde se está. Quem enxerga tem o
 * ícone; o `aria-label` diz o estado e o que o toque faz, porque um ícone
 * sozinho não conta nem uma coisa nem outra.
 */

export function ThemeToggle() {
  const { resolved } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  const Icon = resolved === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      className="nav-link nav-theme"
      aria-label={`Tema: ${THEME_LABEL[resolved].toLowerCase()}. Mudar para ${THEME_LABEL[next].toLowerCase()}.`}
      title={`Tema: ${THEME_LABEL[resolved].toLowerCase()}`}
      onClick={toggleTheme}
    >
      <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
      <span>{THEME_LABEL[resolved]}</span>
    </button>
  );
}
