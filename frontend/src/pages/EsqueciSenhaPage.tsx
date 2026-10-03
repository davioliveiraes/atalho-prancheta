import { type FormEvent, useState } from "react";
import { AuthScreen } from "../components/AuthScreen";
import { ErrorLine, NoticeLine } from "../components/elements";
import { ApiError, authApi } from "../lib/api";
import { Link } from "../lib/router";
import { useIsMobile } from "../lib/useIsMobile";

/**
 * Primeiro passo da redefinição: pedir o link por e-mail.
 *
 * A resposta é a mesma exista ou não a conta — a API não diz, e esta tela não
 * tenta adivinhar. Por isso o texto de confirmação vem da própria API: é ela
 * que sabe por quanto tempo o link vale.
 */
export function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const mobile = useIsMobile();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { detail } = await authApi.requestPasswordReset(email);
      setSent(detail);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
    } finally {
      setBusy(false);
    }
  }

  // Erro de formato chega em `email`; o teto de pedidos (429) chega em `detail`.
  const fieldError = error?.field("email");
  const looseError = error && !fieldError ? error.message : null;

  return (
    <AuthScreen
      kicker="01 · Recuperar acesso"
      title="Esqueceu a senha"
      lede="Informe o e-mail da conta. Mandamos um link para você escolher uma senha nova."
      plateTitle="Redefinição"
      footer={
        <>
          Lembrou a senha? <Link to="/entrar">Entrar</Link>
        </>
      }
    >
      {sent ? (
        <div className="stack" style={{ gap: 16 }}>
          <NoticeLine>{sent}</NoticeLine>
          <p className="small">
            Não chegou? Confira a caixa de spam. Pedir de novo logo em seguida não manda outra
            mensagem — o mesmo endereço só recebe um link a cada poucos minutos.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={{ minHeight: mobile ? 48 : 44 }}
            onClick={() => setSent(null)}
          >
            Usar outro e-mail
          </button>
        </div>
      ) : (
        <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
          {looseError && <ErrorLine>{looseError}</ErrorLine>}

          <div className="field">
            <label htmlFor="esqueci-email">E-mail</label>
            <input
              id="esqueci-email"
              className="input"
              type="email"
              required
              maxLength={150}
              autoComplete="email"
              placeholder="voce@exemplo.com"
              value={email}
              aria-invalid={fieldError ? true : undefined}
              style={{ minHeight: mobile ? 44 : undefined }}
              onChange={(event) => setEmail(event.target.value)}
            />
            {fieldError && <ErrorLine>{fieldError}</ErrorLine>}
          </div>

          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={busy || !email}
            style={{ minHeight: mobile ? 48 : 44 }}
          >
            {busy ? "Enviando…" : "Enviar link"}
          </button>
        </form>
      )}
    </AuthScreen>
  );
}
