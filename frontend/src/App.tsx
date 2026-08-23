import { Nav } from "./components/Nav";
import { Guarded, GuestOnly, useSessionCheck } from "./lib/auth";
import { MobileBarProvider } from "./lib/mobileBar";
import { Link, usePathname } from "./lib/router";
import { ApiPage } from "./pages/ApiPage";
import { CardsPanelPage } from "./pages/CardsPanelPage";
import { ComoUsarPage } from "./pages/ComoUsarPage";
import { CriarContaPage } from "./pages/CriarContaPage";
import { DetailPage } from "./pages/DetailPage";
import { EntrarPage } from "./pages/EntrarPage";
import { LandingPage } from "./pages/LandingPage";
import { PanelPage } from "./pages/PanelPage";

function resolve(pathname: string) {
  const segments = pathname.replace(/\/+$/, "").split("/").filter(Boolean);

  if (segments.length === 0) return <LandingPage />;

  if (segments.length === 1) {
    // Como usar: aberta, e é a primeira coisa que alguém procura.
    if (segments[0] === "como-usar") return <ComoUsarPage />;

    // A referência da API, aberta como a própria API. Não mora em `/api`: esse
    // caminho é do backend, e o nginx de produção redireciona `/api` para
    // `/api/`, que é a raiz da API de máquina.
    if (segments[0] === "referencia") return <ApiPage />;

    // O painel lista por dono: sem sessão não há o que listar.
    if (segments[0] === "painel") {
      return (
        <Guarded>
          <PanelPage />
        </Guarded>
      );
    }
    if (segments[0] === "entrar") {
      return (
        <GuestOnly>
          <EntrarPage />
        </GuestOnly>
      );
    }
    if (segments[0] === "criar-conta") {
      return (
        <GuestOnly>
          <CriarContaPage />
        </GuestOnly>
      );
    }
  }

  if (segments.length === 2 && segments[0] === "painel" && segments[1] === "fichas") {
    return (
      <Guarded>
        <CardsPanelPage />
      </Guarded>
    );
  }

  // O detalhe fica aberto: quem encurtou sem conta precisa reabrir o próprio
  // link. Quem não é dono recebe o 403 da API, com a mensagem de lá.
  if (segments[0] === "links" && segments[1]) {
    if (segments.length === 2) return <DetailPage key={segments[1]} shortCode={segments[1]} />;
  }

  return <NotFound />;
}

function NotFound() {
  return (
    <main className="shell page stack" style={{ gap: 24 }}>
      <p className="kicker">HTTP 404</p>
      <h1 className="title-screen">Página não encontrada</h1>
      <div className="row">
        <Link className="btn btn-primary" to="/">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  const pathname = usePathname();
  useSessionCheck();

  return (
    <MobileBarProvider>
      <Nav />
      {resolve(pathname)}
    </MobileBarProvider>
  );
}
