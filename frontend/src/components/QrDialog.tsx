import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { linkApi, redirectUrl } from "../lib/api";
import { Dialog } from "./Dialog";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; url: string; width: number; height: number }
  | { kind: "failed" };

/**
 * 1f — ver e baixar o PNG. A imagem vem sempre da API
 * (`GET /api/urls/{code}/qrcode/`); nada de gerar QR no cliente.
 */
export function QrDialog({
  open,
  shortCode,
  onClose,
}: {
  open: boolean;
  shortCode: string | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // Guarda o último código: ao fechar, o chamador zera `shortCode` e sem isto o
  // diálogo desmontaria antes de devolver o foco ao gatilho.
  const [current, setCurrent] = useState<string | null>(shortCode);

  useEffect(() => {
    if (shortCode) setCurrent(shortCode);
  }, [shortCode]);

  useEffect(() => {
    if (!open || !shortCode) return;
    let active = true;
    setState({ kind: "loading" });

    linkApi.qrcode(shortCode).then(
      ({ qr_code_url }) => {
        // Pré-carrega para conhecer o tamanho real do PNG antes de exibir.
        const image = new Image();
        image.onload = () => {
          if (!active) return;
          setState({
            kind: "ready",
            url: qr_code_url,
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        };
        image.onerror = () => active && setState({ kind: "failed" });
        image.src = qr_code_url;
      },
      () => active && setState({ kind: "failed" }),
    );

    return () => {
      active = false;
    };
  }, [open, shortCode, attempt]);

  if (!current) return null;
  const shortUrl = redirectUrl(current);

  return (
    <Dialog
      open={open}
      width={440}
      title={`QR Code · ${current}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: 38 }}
            onClick={() => void navigator.clipboard?.writeText(shortUrl)}
          >
            Copiar link
          </button>
          <a
            className="btn btn-primary"
            style={{ height: 38 }}
            href={state.kind === "ready" ? state.url : undefined}
            download={`${current}.png`}
            aria-disabled={state.kind === "ready" ? undefined : true}
          >
            <Download size={15} strokeWidth={1.5} />
            Baixar PNG
          </a>
        </>
      }
    >
      <div className="dialog-body" style={{ gap: 18 }}>
        {/* A placa é o suporte da imagem: sem cabeçalho, sem preenchimento. */}
        <div className="blueprint" style={{ padding: 20, display: "grid", placeItems: "center" }}>
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />

          {state.kind === "ready" ? (
            <img
              src={state.url}
              alt={`QR Code do link ${current}`}
              width={240}
              height={240}
              style={{ width: 240, height: 240, aspectRatio: "1" }}
            />
          ) : (
            <div
              style={{
                width: 240,
                height: 240,
                aspectRatio: "1",
                border: "1px solid var(--color-divider)",
                display: "grid",
                placeItems: "center",
                gap: 10,
                textAlign: "center",
                padding: 16,
              }}
            >
              {state.kind === "failed" && (
                <div className="stack" style={{ gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--ink-small)" }}>
                    Não foi possível carregar o QR Code
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Tentar de novo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--ink-small)",
            }}
          >
            Aponta para
          </span>
          <span
            className="break"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 20,
              lineHeight: "24px",
              letterSpacing: ".02em",
            }}
          >
            {shortUrl}
          </span>
        </div>

        <p style={{ fontSize: 13, lineHeight: "20px", color: "var(--ink-small)" }}>
          {state.kind === "ready" ? (
            <>
              PNG {state.width} × {state.height} px, borda 4 módulos, correção de erro L — como a
              API gera.
            </>
          ) : (
            <>Borda 4 módulos, correção de erro L — como a API gera.</>
          )}
        </p>
      </div>
    </Dialog>
  );
}
