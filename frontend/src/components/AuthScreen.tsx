import type { ReactNode } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { Plate } from "./Plate";

/**
 * Moldura das duas telas de conta.
 *
 * Uma coluna estreita centrada na tela cheia: o formulário é curto e uma placa
 * larga deixaria os campos flutuando no meio do papel. O cabeçalho segue o
 * mesmo desenho das outras telas — kicker, régua e título.
 */
export function AuthScreen({
  kicker,
  title,
  lede,
  plateTitle,
  children,
  footer,
}: {
  kicker: string;
  title: string;
  lede: string;
  plateTitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const mobile = useIsMobile();

  return (
    <main className="screen">
      <section
        className="shell screen-body"
        style={{ paddingTop: mobile ? 24 : 48, paddingBottom: mobile ? 40 : 48 }}
      >
        <div className="stack" style={{ width: "100%", maxWidth: 460, margin: "0 auto", gap: 24 }}>
          <div className="stack" style={{ gap: 12 }}>
            <p className="kicker">{kicker}</p>
            <hr className="rule" />
            <h1 className="title-screen">{title}</h1>
            <p style={{ fontSize: 15, lineHeight: "24px", color: "var(--ink-secondary)" }}>
              {lede}
            </p>
          </div>

          <Plate title={plateTitle}>
            <div className="stack" style={{ padding: 20, gap: 16 }}>
              {children}
            </div>
          </Plate>

          <p style={{ fontSize: 14, lineHeight: "22px", color: "var(--ink-meta)" }}>{footer}</p>
        </div>
      </section>
    </main>
  );
}
