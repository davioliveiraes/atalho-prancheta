import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { Plate } from "../components/Plate";
import { useSession } from "../lib/auth";
import { Link } from "../lib/router";
import { useIsMobile } from "../lib/useIsMobile";

/**
 * Como usar, escrito para quem vai usar.
 *
 * Os passos são numerados porque são mesmo uma sequência: cada um só faz
 * sentido depois do anterior. A ordem é a que a pessoa encontra na prática —
 * encurta primeiro, cria conta quando quer acompanhar, e só então descobre que
 * o destino pode ser corrigido depois.
 */

interface Step {
  title: string;
  where: string;
  text: ReactNode;
  note?: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Cole o link e encurte",
    where: "Início",
    text: (
      <>
        Na primeira tela, cole o endereço comprido e clique em <strong>Encurtar</strong>.
        Você recebe na hora um endereço curto e um QR Code. Não precisa de conta para
        isso.
      </>
    ),
  },
  {
    title: "Divulgue o endereço curto",
    where: "Início",
    text: (
      <>
        Copie o link ou baixe o QR Code em PNG para imprimir. Os dois levam ao mesmo
        lugar, e é esse endereço curto que vai para o cartaz, para a embalagem ou para a
        mensagem — nunca o endereço comprido.
      </>
    ),
  },
  {
    title: "Crie uma conta para acompanhar",
    where: "Criar conta",
    text: (
      <>
        Com a conta aberta, todo link que você encurtar passa a aparecer no seu painel,
        com os números de cada um. Os links criados antes da conta continuam funcionando —
        eles só não aparecem em lugar nenhum.
      </>
    ),
  },
  {
    title: "Veja quem clicou",
    where: "Painel",
    text: (
      <>
        O painel soma os cliques de todos os seus links, e cada link tem uma tela própria
        com os acessos por dia. A contagem separa <strong>cliques totais</strong> de
        <strong> cliques únicos</strong>: a mesma pessoa abrindo cinco vezes conta cinco
        no total e um único.
      </>
    ),
  },
  {
    title: "Troque o destino quando precisar",
    where: "Painel · link",
    text: (
      <>
        Abra o link e clique em <strong>Editar link</strong>. Você muda para onde ele
        aponta, e quem clicar a partir dali vai para o endereço novo.
      </>
    ),
    note: (
      <>
        O código curto <strong>não muda nunca</strong>. É por isso que dá para imprimir o
        QR Code antes de a página de destino existir, ou corrigir um endereço errado
        depois que o material já foi distribuído.
      </>
    ),
  },
  {
    title: "Feche o link quando fizer sentido",
    where: "Painel · link",
    text: (
      <>
        Você pode <strong>desativar</strong> o link a qualquer momento, marcar uma
        <strong> data de expiração</strong> ou definir um <strong>limite de visitantes</strong>.
        Fechado por qualquer um dos três motivos, ele para de redirecionar e mostra um
        aviso — sem revelar para onde apontava.
      </>
    ),
  },
];

const QUESTIONS: [string, ReactNode][] = [
  [
    "Preciso de conta para encurtar?",
    "Não. Sem conta o link funciona igual e dura o mesmo tanto. A conta serve para você ter onde acompanhar e editar depois.",
  ],
  [
    "O código curto pode mudar?",
    "Não. É justamente o que garante que o material já divulgado continue valendo.",
  ],
  [
    "Se eu trocar o destino, preciso gerar outro QR Code?",
    "Não. O QR Code aponta para o link curto, e não para o destino — trocar o destino não mexe nele.",
  ],
  [
    "Quem mais vê os meus links?",
    "Ninguém. Cada painel mostra apenas os links da própria conta, e abrir o endereço de um link de outra conta não funciona.",
  ],
  [
    "Desativar apaga os números?",
    "Não. O histórico de cliques fica guardado, e o link volta ao ar do jeito que estava quando você reativar.",
  ],
];

export function ComoUsarPage() {
  const mobile = useIsMobile();
  const session = useSession();

  return (
    <main className="shell page">
      <div
        className="stack"
        style={{ maxWidth: 780, margin: "0 auto", gap: mobile ? 28 : 40 }}
      >
        <header className="stack" style={{ gap: 12 }}>
          <p className="kicker">Como usar</p>
          <hr className="rule" />
          <h1 className="title-screen">Um endereço curto que você conserta depois</h1>
          <p className="lede">
            O Atalho Prancheta encurta um link e conta quantas pessoas abriram. A
            diferença é que o endereço divulgado continua o mesmo enquanto o destino por
            trás dele pode mudar quando você quiser.
          </p>
        </header>

        {STEPS.map((step, index) => (
          <Plate
            key={step.title}
            title={`${String(index + 1).padStart(2, "0")} · ${step.title}`}
            cells={mobile ? undefined : [step.where]}
          >
            <div className="stack" style={{ padding: mobile ? 16 : 20, gap: 16 }}>
              <p style={{ fontSize: 15, lineHeight: "24px", color: "var(--ink-secondary)" }}>
                {step.text}
              </p>

              {step.note && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "12px 14px",
                    border: "1px solid var(--color-divider)",
                  }}
                >
                  <Pencil
                    size={16}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    style={{ flex: "none", marginTop: 3, color: "var(--color-accent-700)" }}
                  />
                  <span style={{ fontSize: 14, lineHeight: "22px", color: "var(--ink-secondary)" }}>
                    {step.note}
                  </span>
                </div>
              )}
            </div>
          </Plate>
        ))}

        <section className="stack" style={{ gap: 12 }}>
          <p className="kicker">Perguntas rápidas</p>
          <hr className="rule" />
          <dl style={{ margin: 0 }}>
            {QUESTIONS.map(([pergunta, resposta]) => (
              <div
                key={pergunta}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                <dt
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: 17,
                    letterSpacing: ".02em",
                    marginBottom: 4,
                  }}
                >
                  {pergunta}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 15,
                    lineHeight: "24px",
                    color: "var(--ink-secondary)",
                  }}
                >
                  {resposta}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div
          className={mobile ? "stack-mobile" : "row row-wrap"}
          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          {session ? (
            <>
              <Link
                className="btn btn-primary"
                to="/painel"
                style={{ minHeight: mobile ? 48 : 44, paddingInline: 22 }}
              >
                Ir para o painel
              </Link>
              <Link
                className="btn btn-secondary"
                to="/"
                style={{ minHeight: mobile ? 48 : 44, paddingInline: 22 }}
              >
                Encurtar um link
              </Link>
            </>
          ) : (
            <>
              <Link
                className="btn btn-primary"
                to="/"
                style={{ minHeight: mobile ? 48 : 44, paddingInline: 22 }}
              >
                Encurtar um link
              </Link>
              <Link
                className="btn btn-secondary"
                to="/criar-conta"
                style={{ minHeight: mobile ? 48 : 44, paddingInline: 22 }}
              >
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
