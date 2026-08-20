import { Grid, Menu, Search, X } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { useMobileBar } from "../lib/mobileBar";
import { Link, usePathname } from "../lib/router";
import { useIsMobile } from "../lib/useIsMobile";

/**
 * Barra de navegação. A marca fica à esquerda e os links vão agrupados à
 * direita — o `.nav` usa space-between, então nunca há item solto no meio.
 * O botão de menu só existe abaixo de 900px (regra da folha, não desta tela).
 */

/** Itens de chrome que ainda não têm funcionalidade no backend. */
function pending(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const bar = useMobileBar();

  // No painel, abaixo de 900px, a barra é título + busca + Novo.
  if (mobile && bar) {
    return (
      <nav className="nav" aria-label="Principal">
        <Link className="nav-brand" to="/">
          {bar.title}
        </Link>
        <div className="nav-panel">
          <button
            type="button"
            className="btn btn-icon btn-secondary"
            style={{ width: 44, height: 44 }}
            aria-label="Buscar"
            title="Buscar"
            onClick={bar.onSearch}
          >
            <Search size={18} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 44, paddingInline: 14 }}
            onClick={bar.onNew}
          >
            Novo
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="nav" aria-label="Principal">
      <Link className="nav-brand" to="/">
        <Grid size={18} strokeWidth={1.5} aria-hidden="true" />
        Atalho
      </Link>

      <button
        type="button"
        className="btn btn-icon btn-secondary nav-toggle"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
      </button>

      <div className="nav-links" data-open={open}>
        <Link
          className="nav-link"
          to="/"
          aria-current={pathname === "/" ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          Encurtar
        </Link>
        <Link
          className="nav-link"
          to="/painel"
          aria-current={pathname === "/painel" ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          Painel
        </Link>
        {/* Pendente: página de documentação da API. */}
        <a className="nav-link" href="#" onClick={pending}>
          API
        </a>
        {/* Pendente: autenticação — o backend ainda não expõe login/registro. */}
        <a className="nav-link" href="#" onClick={pending}>
          Entrar
        </a>
        {/* Secundário de propósito: assim o único primário de cada tela é a
            ação da própria tela (Encurtar, Novo link, Criar link…). */}
        <button type="button" className="btn btn-secondary" onClick={pending}>
          Criar conta
        </button>
      </div>
    </nav>
  );
}
