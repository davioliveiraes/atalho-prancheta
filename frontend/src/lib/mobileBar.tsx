import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * 1h — abaixo de 900px a barra do painel deixa de ser marca + hamburger e vira
 * `Painel` + busca + Novo. Quem sabe abrir a busca e o diálogo de criação é a
 * página, não a nav; ela registra os dois aqui e a nav só desenha.
 */
export interface MobileBar {
  title: string;
  onSearch: () => void;
  onNew: () => void;
}

const Context = createContext<{
  bar: MobileBar | null;
  setBar: (bar: MobileBar | null) => void;
}>({ bar: null, setBar: () => {} });

export function MobileBarProvider({ children }: { children: ReactNode }) {
  const [bar, setBar] = useState<MobileBar | null>(null);
  const value = useMemo(() => ({ bar, setBar }), [bar]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Lido pela nav. */
export function useMobileBar() {
  return useContext(Context).bar;
}

/** Registrado pela página enquanto ela estiver montada. */
export function useRegisterMobileBar(bar: MobileBar | null) {
  const { setBar } = useContext(Context);
  const { title, onSearch, onNew } = bar ?? {};

  useEffect(() => {
    if (!title || !onSearch || !onNew) return;
    setBar({ title, onSearch, onNew });
    return () => setBar(null);
  }, [setBar, title, onSearch, onNew]);
}
