import type { AuthSession, AuthUser } from "../types";

/**
 * Onde a sessão mora.
 *
 * Fica fora do React de propósito: o `api.ts` precisa do token em toda
 * requisição e não é um componente. A árvore lê daqui pelo mesmo
 * `useSyncExternalStore` que o roteador usa, então tela e cliente HTTP nunca
 * discordam sobre quem está logado.
 *
 * localStorage, e não cookie httpOnly, é consequência de a API ser JWT: o
 * cabeçalho `Authorization` precisa ser montado pelo próprio JavaScript. Em
 * troca, o access dura 30 minutos e o refresh é rotacionado a cada uso.
 */

const KEY = "atalho.sessao";

let current: AuthSession | null = read();

const listeners = new Set<() => void>();

function read(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AuthSession;
    // Sessão pela metade é sessão inválida: sem os dois tokens não dá para
    // autenticar nem renovar.
    if (!parsed?.access || !parsed?.refresh) return null;
    return parsed;
  } catch {
    // Chave corrompida por edição manual ou versão antiga do formato.
    return null;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  // Outra aba fez login ou saiu: o evento `storage` só chega às outras abas.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      current = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSession() {
  return current;
}

export function setSession(session: AuthSession) {
  current = session;
  window.localStorage.setItem(KEY, JSON.stringify(session));
  emit();
}

/** Troca só os tokens, preservando a conta — é o que a renovação devolve. */
export function setTokens(access: string, refresh: string) {
  if (!current) return;
  setSession({ ...current, access, refresh });
}

/** Atualiza a conta guardada sem mexer nos tokens. */
export function setUser(user: AuthUser) {
  if (!current) return;
  setSession({ ...current, user });
}

export function clearSession() {
  current = null;
  window.localStorage.removeItem(KEY);
  emit();
}
