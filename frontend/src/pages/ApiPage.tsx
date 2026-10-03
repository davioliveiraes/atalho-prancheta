import type { ReactNode } from "react";
import { Plate } from "../components/Plate";
import { useIsMobile } from "../lib/useIsMobile";

/**
 * Documentação da API dentro da própria aplicação.
 *
 * Sem tabela: abaixo de 900px a folha troca `.table` por fichas, e uma linha de
 * endpoint já é curta o bastante para virar bloco empilhado. Cada rota traz o
 * acesso que ela exige, porque é a pergunta que o leitor faz logo depois de
 * "qual é o caminho".
 */

type Access = "aberto" | "token" | "dono" | "publico";

interface Route {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  text: string;
  access: Access;
}

interface Group {
  title: string;
  cell: string;
  note?: string;
  routes: Route[];
}

const ACCESS_LABEL: Record<Access, string> = {
  aberto: "Sem conta",
  token: "Exige token",
  dono: "Dono do link",
  publico: "Público",
};

const GROUPS: Group[] = [
  {
    title: "Contas",
    cell: "7 rotas",
    note: "O access dura 30 minutos. O refresh vale 7 dias e é trocado a cada renovação — o anterior deixa de valer no mesmo instante.",
    routes: [
      {
        method: "POST",
        path: "/api/auth/register/",
        text: "Cria a conta e já devolve o par de tokens. Campos: email, password, password_confirm e name (opcional).",
        access: "aberto",
      },
      {
        method: "POST",
        path: "/api/auth/login/",
        text: "Troca e-mail e senha pelo par de tokens. E-mail inexistente e senha errada respondem a mesma coisa.",
        access: "aberto",
      },
      {
        method: "POST",
        path: "/api/auth/refresh/",
        text: "Renova o access a partir do refresh, e devolve um refresh novo junto.",
        access: "aberto",
      },
      {
        method: "POST",
        path: "/api/auth/logout/",
        text: "Invalida o refresh enviado. O access continua valendo até expirar — é a natureza de um token assinado.",
        access: "token",
      },
      {
        method: "GET",
        path: "/api/auth/me/",
        text: "A conta dona do token.",
        access: "token",
      },
      {
        method: "POST",
        path: "/api/auth/password-reset/",
        text: "Manda por e-mail o link de redefinição. Campo: email. A resposta é a mesma exista ou não a conta, e um endereço recebe no máximo um link a cada dois minutos.",
        access: "aberto",
      },
      {
        method: "POST",
        path: "/api/auth/password-reset/confirm/",
        text: "Troca a senha com o uid e o token do link, mais password e password_confirm. O link vale uma vez só, e a troca encerra todas as sessões da conta.",
        access: "aberto",
      },
    ],
  },
  {
    title: "Links",
    cell: "6 rotas",
    note: "Encurtar não exige conta. Com token, o link nasce com dono e aparece no painel; sem token, ele funciona e não pertence a ninguém.",
    routes: [
      {
        method: "GET",
        path: "/api/urls/",
        text: "Lista os links da conta, dez por página. Aceita ?search=, ?is_active= e ?page=.",
        access: "token",
      },
      {
        method: "GET",
        path: "/api/urls/summary/",
        text: "Somas da conta: links, cliques totais, únicos e fora do ar. Lê os mesmos filtros da lista.",
        access: "token",
      },
      {
        method: "POST",
        path: "/api/urls/",
        text: "Cria o link. Campos: original_url e, opcionais, short_code, subdomain, expires_at e max_clicks.",
        access: "aberto",
      },
      {
        method: "GET",
        path: "/api/urls/{codigo}/",
        text: "Detalhe com estatísticas, QR Code e os dez cliques mais recentes.",
        access: "dono",
      },
      {
        method: "PATCH",
        path: "/api/urls/{codigo}/",
        text: "Altera destino, subdomínio, estado, expiração e limite. Código curto e contadores de clique não se alteram por aqui.",
        access: "dono",
      },
      {
        method: "DELETE",
        path: "/api/urls/{codigo}/",
        text: "Apaga o link e o histórico de cliques dele.",
        access: "dono",
      },
    ],
  },
  {
    title: "Ações do link",
    cell: "4 rotas",
    routes: [
      {
        method: "POST",
        path: "/api/urls/{codigo}/activate/",
        text: "Volta o link ao ar.",
        access: "dono",
      },
      {
        method: "POST",
        path: "/api/urls/{codigo}/deactivate/",
        text: "Tira o link do ar sem apagar nada.",
        access: "dono",
      },
      {
        method: "GET",
        path: "/api/urls/{codigo}/statistics/",
        text: "Números do link e os vinte cliques mais recentes.",
        access: "dono",
      },
      {
        method: "GET",
        path: "/api/urls/{codigo}/qrcode/",
        text: "Endereço do PNG gerado no servidor no momento da criação.",
        access: "dono",
      },
    ],
  },
  {
    title: "Serviço",
    cell: "2 rotas",
    routes: [
      {
        method: "GET",
        path: "/api/health/",
        text: "Responde 200 com o banco no ar e 503 sem ele. É o que o orquestrador consulta.",
        access: "publico",
      },
      {
        method: "GET",
        path: "/api/config/",
        text: "shortlink_base_domain: o domínio dos links por subdomínio, ou null quando a instalação não serve subdomínio.",
        access: "publico",
      },
    ],
  },
  {
    title: "Redirecionamento",
    cell: "2 rotas",
    note: "É o endereço que se divulga, na raiz do domínio. Inativo, expirado ou no teto de cliques únicos, ele responde 403 e não revela o destino.",
    routes: [
      {
        method: "GET",
        path: "/{codigo}",
        text: "Conta o clique — total sempre, único uma vez por IP — e redireciona para o destino atual. O desvio é temporário e sem cache: trocar o destino vale já no próximo acesso.",
        access: "publico",
      },
      {
        method: "GET",
        path: "{subdominio}.{dominio}",
        text: "O mesmo link pelo subdomínio, quando ele tem um. Mesmo destino, mesma contagem de cliques.",
        access: "publico",
      },
    ],
  },
];

const ERRORS: [string, string][] = [
  ["400", "Validação. O corpo traz a lista de mensagens campo a campo, com o nome do campo como chave."],
  ["401", "Sem token, ou com token vencido. Renove pelo /api/auth/refresh/ e repita."],
  ["403", "Link de outra conta, ou tentativa de alterar link que não tem dono."],
  ["404", "Nenhum link cadastrado com esse código. Ele diferencia maiúsculas de minúsculas."],
  ["429", "Teto de criação de link alcançado. É por IP para quem não tem conta e por conta para quem tem."],
];

const CREATE_REQUEST = `POST /api/urls/
Content-Type: application/json

{
  "original_url": "https://exemplo.com/pagina",
  "short_code": "atalho",
  "max_clicks": 100
}`;

const CREATE_RESPONSE = `201 Created

{
  "short_code": "atalho",
  "short_url": "http://localhost:8000/atalho",
  "original_url": "https://exemplo.com/pagina",
  "qr_code": "http://localhost:8000/media/qrcodes/atalho.png",
  "is_active": true,
  "max_clicks": 100,
  "total_clicks": 0,
  "unique_clicks": 0,
  "status": { "can_access": true, "message": "OK" }
}`;

export function ApiPage() {
  const mobile = useIsMobile();

  return (
    <main className="shell page stack" style={{ gap: mobile ? 28 : 40 }}>
      <header className="stack" style={{ gap: 12, maxWidth: "72ch" }}>
        <p className="kicker">01 · Referência</p>
        <hr className="rule" />
        <h1 className="title-screen">API</h1>
        <p className="lede">
          REST sobre JSON, com autenticação por JWT. O token de acesso vai no cabeçalho{" "}
          <Mono>Authorization: Bearer &lt;access&gt;</Mono>. Todo caminho termina em barra.
        </p>
      </header>

      {GROUPS.map((group) => (
        <Plate key={group.title} title={group.title} cells={mobile ? undefined : [group.cell]}>
          <div className="stack" style={{ padding: mobile ? 16 : 20, gap: 0 }}>
            {group.note && (
              <p
                style={{
                  fontSize: 14,
                  lineHeight: "22px",
                  color: "var(--ink-secondary)",
                  paddingBottom: 16,
                  maxWidth: "68ch",
                }}
              >
                {group.note}
              </p>
            )}
            {group.routes.map((route) => (
              <RouteRow key={route.method + route.path} route={route} mobile={mobile} />
            ))}
          </div>
        </Plate>
      ))}

      <Plate title="Exemplo · criar um link" cells={mobile ? undefined : ["POST"]}>
        <div
          className={mobile ? "stack" : "grid grid-2"}
          style={{ padding: mobile ? 16 : 20, gap: 16 }}
        >
          <Block label="Requisição" text={CREATE_REQUEST} />
          <Block label="Resposta" text={CREATE_RESPONSE} />
        </div>
      </Plate>

      <Plate title="Erros" cells={mobile ? undefined : ["5 códigos"]}>
        <div className="stack" style={{ padding: mobile ? 16 : 20, gap: 0 }}>
          {ERRORS.map(([code, text]) => (
            <div
              key={code}
              style={{
                display: "grid",
                gridTemplateColumns: mobile ? "1fr" : "72px 1fr",
                gap: mobile ? 4 : 20,
                padding: "12px 0",
                borderBottom: "1px solid var(--color-divider)",
              }}
            >
              <span className="tnum" style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
                {code}
              </span>
              <span style={{ fontSize: 14, lineHeight: "22px", color: "var(--ink-secondary)" }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      </Plate>

      <p className="small" style={{ maxWidth: "68ch" }}>
        Exemplos completos de cada rota e a coleção do Postman ficam em{" "}
        <a
          href="https://github.com/davioliveiraes/atalho-prancheta/tree/master/docs"
          target="_blank"
          rel="noreferrer"
        >
          docs/
        </a>{" "}
        no repositório.
      </p>
    </main>
  );
}

function RouteRow({ route, mobile }: { route: Route; mobile: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: mobile ? "1fr" : "72px minmax(180px, 260px) 1fr auto",
        alignItems: "baseline",
        gap: mobile ? 6 : 16,
        padding: "14px 0",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <span
        className="tag tag-outline"
        style={{ justifySelf: "start", alignSelf: mobile ? "start" : "center" }}
      >
        {route.method}
      </span>
      <Mono>{route.path}</Mono>
      <span style={{ fontSize: 14, lineHeight: "22px", color: "var(--ink-secondary)" }}>
        {route.text}
      </span>
      <span className="label" style={{ whiteSpace: "nowrap" }}>
        {ACCESS_LABEL[route.access]}
      </span>
    </div>
  );
}

/** Caminho e cabeçalho: texto de máquina, e a folha não tem família monoespaçada. */
function Mono({ children }: { children: ReactNode }) {
  return (
    <span
      className="break"
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 13.5,
        lineHeight: "22px",
        color: "var(--color-text)",
      }}
    >
      {children}
    </span>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div className="stack" style={{ gap: 8, minWidth: 0 }}>
      <span className="label">{label}</span>
      <pre
        style={{
          margin: 0,
          padding: 14,
          border: "1px solid var(--color-divider)",
          overflowX: "auto",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 12.5,
          lineHeight: "20px",
          color: "var(--ink-secondary)",
        }}
      >
        {text}
      </pre>
    </div>
  );
}
