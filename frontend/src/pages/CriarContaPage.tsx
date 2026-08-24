import { type FormEvent, useState } from "react";
import { AuthScreen } from "../components/AuthScreen";
import { ErrorLine, PasswordInput } from "../components/elements";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Link, navigate } from "../lib/router";
import { useIsMobile } from "../lib/useIsMobile";

/** Campos do formulário — o que sobrar do erro da API não pertence a nenhum. */
const FIELDS = ["name", "email", "password", "password_confirm"];

export function CriarContaPage() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const mobile = useIsMobile();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signUp({
        name: name.trim() || undefined,
        email,
        password,
        password_confirm: confirm,
      });
      navigate("/painel");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
      setBusy(false);
    }
  }

  const looseError =
    error && !Object.keys(error.fields).some((key) => FIELDS.includes(key)) ? error.message : null;

  const inputStyle = { minHeight: mobile ? 44 : undefined };

  return (
    <AuthScreen
      kicker="01 · Criar conta"
      title="Criar uma conta"
      lede="Com conta, o link que você encurta passa a aparecer no painel — com cliques, expiração e limite no mesmo lugar."
      plateTitle="Cadastro"
      footer={
        <>
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </>
      }
    >
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        {looseError && <ErrorLine>{looseError}</ErrorLine>}

        <div className="field">
          <label htmlFor="conta-nome">
            Nome <span style={{ color: "var(--ink-disabled)" }}>— opcional</span>
          </label>
          <input
            id="conta-nome"
            className="input"
            type="text"
            maxLength={150}
            autoComplete="name"
            value={name}
            style={inputStyle}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="conta-email">E-mail</label>
          <input
            id="conta-email"
            className="input"
            type="email"
            required
            maxLength={150}
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            aria-invalid={error?.field("email") ? true : undefined}
            style={inputStyle}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error?.field("email") && <ErrorLine>{error.field("email")}</ErrorLine>}
        </div>

        <div className="field">
          <label htmlFor="conta-senha">Senha</label>
          <PasswordInput
            id="conta-senha"
            autoComplete="new-password"
            value={password}
            invalid={!!error?.field("password")}
            style={inputStyle}
            onChange={setPassword}
          />
          {/* O Django devolve todos os motivos de uma vez; cada um vira linha. */}
          {error?.list("password").map((text) => (
            <ErrorLine key={text}>{text}</ErrorLine>
          ))}
          <span className="field-hint">
            Mínimo de 8 caracteres. Nada de senha comum ou só de números.
          </span>
        </div>

        <div className="field">
          <label htmlFor="conta-confirma">Repetir a senha</label>
          <PasswordInput
            id="conta-confirma"
            autoComplete="new-password"
            value={confirm}
            invalid={!!error?.field("password_confirm")}
            style={inputStyle}
            onChange={setConfirm}
          />
          {error?.field("password_confirm") && (
            <ErrorLine>{error.field("password_confirm")}</ErrorLine>
          )}
        </div>

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={busy || !email || !password || !confirm}
          style={{ minHeight: mobile ? 48 : 44 }}
        >
          {busy ? "Criando…" : "Criar conta"}
        </button>
      </form>
    </AuthScreen>
  );
}
