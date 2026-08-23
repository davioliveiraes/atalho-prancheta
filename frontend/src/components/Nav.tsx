import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Marca } from "./Marca";
import { useMobileBar } from "../lib/mobileBar";
import { Link, navigate, usePathname } from "../lib/router";
import { useIsMobile } from "../lib/useIsMobile";

/**
 * Barra de navegação. A marca fica à esquerda e os links vão agrupados à
 * direita — o `.nav` usa space-between, então nunca há item solto no meio.
 * O botão de menu só existe abaixo de 900px (regra da folha, não desta tela).
 */

/** Nome curto da conta: o primeiro nome, ou o e-mail antes do arroba. */
function accountLabel(name: string, email: string) {
  return name.trim().split(/\s+/)[0] || email.split("@")[0];
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const bar = useMobileBar();
  const { user, signOut } = useAuth();

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
        <Marca size={20} />
        Atalho Prancheta
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
          to="/como-usar"
          aria-current={pathname === "/como-usar" ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          Como usar
        </Link>
        <Link
          className="nav-link"
          to="/painel"
          aria-current={pathname === "/painel" ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          Painel
        </Link>
        <Link
          className="nav-link"
          to="/referencia"
          aria-current={pathname === "/referencia" ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          API
        </Link>

        {user ? (
          <>
            {/* Quem entrou: a conta identificada e a saída. O nome nao e link
                porque nao ha tela de perfil para onde ir. */}
            <span className="nav-link" style={{ color: "var(--ink-body)" }}>
              {accountLabel(user.name, user.email)}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              Sair
            </button>
          </>
        ) : (
          <>
            <Link
              className="nav-link"
              to="/entrar"
              aria-current={pathname === "/entrar" ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              Entrar
            </Link>
            {/* Secundário de propósito: assim o único primário de cada tela é a
                ação da própria tela (Encurtar, Novo link, Criar link…). */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOpen(false);
                navigate("/criar-conta");
              }}
            >
              Criar conta
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
