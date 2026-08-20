import { Nav } from "./components/Nav";
import { MobileBarProvider } from "./lib/mobileBar";
import { Link, usePathname } from "./lib/router";
import { CardsPanelPage } from "./pages/CardsPanelPage";
import { DetailPage } from "./pages/DetailPage";
import { LandingPage } from "./pages/LandingPage";
import { PanelPage } from "./pages/PanelPage";

function resolve(pathname: string) {
  const segments = pathname.replace(/\/+$/, "").split("/").filter(Boolean);

  if (segments.length === 0) return <LandingPage />;
  if (segments.length === 1 && segments[0] === "painel") return <PanelPage />;
  if (segments.length === 2 && segments[0] === "painel" && segments[1] === "fichas") {
    return <CardsPanelPage />;
  }

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

  return (
    <MobileBarProvider>
      <Nav />
      {resolve(pathname)}
    </MobileBarProvider>
  );
}
