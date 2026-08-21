import { type FormEvent, useState } from "react";
import { AuthScreen } from "../components/AuthScreen";
import { ErrorLine } from "../components/elements";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Link, navigate } from "../lib/router";
import { useIsMobile } from "../lib/useIsMobile";

export function EntrarPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const mobile = useIsMobile();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn({ email, password });
      navigate("/painel");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
      setBusy(false);
    }
  }

  // A API responde a mesma frase para e-mail inexistente e senha errada, e ela
  // chega em `detail` — não em um campo. Por isso o erro fica acima do
  // formulário, e não colado num dos dois.
  const message = error ? error.message : null;

  return (
    <AuthScreen
      kicker="01 · Entrar"
      title="Entrar na conta"
      lede="O painel lista os links da sua conta. Encurtar continua aberto a quem não tem conta."
      plateTitle="Acesso"
      footer={
        <>
          Ainda não tem conta? <Link to="/criar-conta">Criar conta</Link>
        </>
      }
    >
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        {message && <ErrorLine>{message}</ErrorLine>}

        <div className="field">
          <label htmlFor="entrar-email">E-mail</label>
          <input
            id="entrar-email"
            className="input"
            type="email"
            required
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            aria-invalid={message ? true : undefined}
            style={{ minHeight: mobile ? 44 : undefined }}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="entrar-senha">Senha</label>
          <input
            id="entrar-senha"
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            aria-invalid={message ? true : undefined}
            style={{ minHeight: mobile ? 44 : undefined }}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={busy || !email || !password}
          style={{ minHeight: mobile ? 48 : 44 }}
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </AuthScreen>
  );
}
