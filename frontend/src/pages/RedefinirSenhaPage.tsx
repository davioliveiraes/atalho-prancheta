import { type FormEvent, useEffect, useState } from "react";
import { AuthScreen } from "../components/AuthScreen";
import { ErrorLine, PasswordInput } from "../components/elements";
import { ApiError, authApi } from "../lib/api";
import { Link, navigate } from "../lib/router";
import { clearSession } from "../lib/session";
import { useIsMobile } from "../lib/useIsMobile";

/**
 * Segundo passo da redefinição: a tela que o link do e-mail abre.
 *
 * O link traz `uid` e `token` depois do `#` — o fragmento não sai do
 * navegador, então não fica no log do nginx nem vai no Referer (ver
 * `accounts/password_reset.py`). A tela lê os dois uma vez e tira o fragmento
 * da barra de endereço: num computador compartilhado, o histórico não guarda
 * um link que ainda abre a conta.
 *
 * Aberta a quem tem sessão também. Quem redefine pode estar logado em outro
 * lugar — é justamente o caso de quem desconfia que alguém entrou na conta.
 */

interface ResetLink {
  uid: string;
  token: string;
}

function readLink(): ResetLink | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const uid = params.get("uid");
  const token = params.get("token");
  return uid && token ? { uid, token } : null;
}

/** Campos do formulário — o que sobrar do erro da API é sobre o link. */
const FIELDS = ["password", "password_confirm"];

export function RedefinirSenhaPage() {
  // Inicializador, e não efeito: o valor precisa existir antes de o efeito
  // abaixo apagar o fragmento de onde ele sai.
  const [link] = useState(readLink);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const mobile = useIsMobile();

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!link) return;

    setBusy(true);
    setError(null);
    try {
      await authApi.confirmPasswordReset({
        ...link,
        password,
        password_confirm: confirm,
      });
      // O backend já derrubou as sessões da conta; esta aba larga a dela na
      // hora, em vez de descobrir no próximo 401. As outras abas acompanham
      // pelo evento `storage`.
      clearSession();
      navigate("/entrar?senha=redefinida", { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
      setBusy(false);
    }
  }

  // Erro que não é de nenhum campo é o link: vencido, já usado ou adulterado.
  // Não adianta corrigir a senha — o formulário sai e fica o caminho de volta.
  const deadLink =
    !link ||
    (error && error.status === 400 && !Object.keys(error.fields).some((k) => FIELDS.includes(k)));

  const inputStyle = { minHeight: mobile ? 44 : undefined };

  return (
    <AuthScreen
      kicker="02 · Nova senha"
      title="Escolher nova senha"
      lede="Ao salvar, todas as sessões abertas da conta são encerradas — inclusive em outros aparelhos."
      plateTitle="Redefinição"
      footer={
        <>
          Lembrou a senha? <Link to="/entrar">Entrar</Link>
        </>
      }
    >
      {deadLink ? (
        <div className="stack" style={{ gap: 16 }}>
          <ErrorLine>
            {error?.message ??
              "Este endereço não traz o link inteiro. Abra de novo o link do e-mail, ou peça um novo."}
          </ErrorLine>
          <Link
            className="btn btn-primary btn-block"
            to="/esqueci-a-senha"
            style={{ minHeight: mobile ? 48 : 44 }}
          >
            Pedir um novo link
          </Link>
        </div>
      ) : (
        <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
          {/* Falha de rede, teto de tentativas: não é do link nem de um campo. */}
          {error && error.status !== 400 && <ErrorLine>{error.message}</ErrorLine>}

          <div className="field">
            <label htmlFor="redefinir-senha">Nova senha</label>
            <PasswordInput
              id="redefinir-senha"
              autoComplete="new-password"
              value={password}
              invalid={!!error?.field("password")}
              style={inputStyle}
              onChange={setPassword}
            />
            {error?.list("password").map((text) => (
              <ErrorLine key={text}>{text}</ErrorLine>
            ))}
            <span className="field-hint">
              Mínimo de 8 caracteres. Nada de senha comum, só de números ou parecida com o e-mail.
            </span>
          </div>

          <div className="field">
            <label htmlFor="redefinir-confirma">Repetir a nova senha</label>
            <PasswordInput
              id="redefinir-confirma"
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
            disabled={busy || !password || !confirm}
            style={{ minHeight: mobile ? 48 : 44 }}
          >
            {busy ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      )}
    </AuthScreen>
  );
}
