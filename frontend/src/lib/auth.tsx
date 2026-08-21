import { type ReactNode, useCallback, useEffect, useSyncExternalStore } from "react";
import type { AuthSession, LoginPayload, RegisterPayload } from "../types";
import { authApi } from "./api";
import { navigate } from "./router";
import { clearSession, getSession, setSession, setUser, subscribeSession } from "./session";

/**
 * A sessão vista pela árvore.
 *
 * Não há Provider guardando estado: a fonte é o `session.ts`, lido por
 * `useSyncExternalStore` como o roteador faz com a History API. Assim a nav
 * reage na hora quando o `api.ts` derruba a sessão por refresh vencido, sem
 * ninguém precisar avisar ninguém.
 */

export function useSession(): AuthSession | null {
  return useSyncExternalStore(subscribeSession, getSession, () => null);
}

export function useAuth() {
  const session = useSession();

  const signIn = useCallback(async (payload: LoginPayload) => {
    setSession(await authApi.login(payload));
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    setSession(await authApi.register(payload));
  }, []);

  const signOut = useCallback(async () => {
    const current = getSession();
    // Sai da interface de imediato; a blacklist do refresh é o efeito no
    // servidor e não pode segurar a tela — se a rede falhar, a sessão local
    // vai embora do mesmo jeito.
    clearSession();
    navigate("/");

    if (current) {
      await authApi.logout(current.refresh).catch(() => undefined);
    }
  }, []);

  return { session, user: session?.user ?? null, signIn, signUp, signOut };
}

/**
 * Confere com o servidor a sessão que veio do armazenamento.
 *
 * O token guardado pode ter sido invalidado noutro lugar (logout em outra aba,
 * conta apagada). Uma chamada a `me()` na abertura resolve: ou atualiza os
 * dados da conta, ou o 401 derruba a sessão pelo caminho normal do `api.ts`.
 */
export function useSessionCheck() {
  const session = useSession();
  const access = session?.access;

  useEffect(() => {
    if (!access) return;

    let alive = true;
    authApi
      .me()
      .then((user) => {
        if (alive) setUser(user);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
    // Só na abertura e a cada troca de token — não a cada render.
  }, [access]);
}

/** Rota que só existe para quem entrou. Sem sessão, manda para o login. */
export function Guarded({ children }: { children: ReactNode }) {
  const session = useSession();

  useEffect(() => {
    if (!session) navigate("/entrar", { replace: true });
  }, [session]);

  if (!session) return null;
  return <>{children}</>;
}

/** O inverso: entrar e criar conta não fazem sentido para quem já entrou. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const session = useSession();

  useEffect(() => {
    if (session) navigate("/painel", { replace: true });
  }, [session]);

  if (session) return null;
  return <>{children}</>;
}
