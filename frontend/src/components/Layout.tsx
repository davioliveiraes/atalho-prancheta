import { Menu, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Logo } from "./Logo";

export function Layout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPath = window.location.pathname;

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container site-header__inner">
          <Logo />
          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <nav className={`main-nav ${menuOpen ? "main-nav--open" : ""}`} aria-label="Principal">
            <a className={currentPath === "/" ? "active" : ""} href="/" onClick={() => setMenuOpen(false)}>
              Início
            </a>
            <a href="/#atalhos" onClick={() => setMenuOpen(false)}>
              Meus atalhos
            </a>
            <a className="main-nav__api" href="/developers" onClick={() => setMenuOpen(false)}>
              API <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <Logo />
          <p>Um endereço permanente para destinos que mudam.</p>
          <span className="site-footer__status"><i /> sistema operacional</span>
        </div>
      </footer>
    </div>
  );
}
