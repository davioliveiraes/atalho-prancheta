import { type MouseEvent, type ReactNode, useCallback, useSyncExternalStore } from "react";

/**
 * Roteador mínimo sobre a History API — evita uma dependência inteira
 * para as seis rotas desta aplicação.
 */

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

function snapshot() {
  return window.location.pathname;
}

export function navigate(to: string, options?: { replace?: boolean }) {
  if (to === window.location.pathname) return;
  if (options?.replace) {
    window.history.replaceState(null, "", to);
  } else {
    window.history.pushState(null, "", to);
  }
  window.scrollTo(0, 0);
  emit();
}

export function usePathname() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function Link({
  to,
  children,
  ...rest
}: { to: string; children: ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      rest.onClick?.(event);
      navigate(to);
    },
    [to, rest],
  );

  return (
    <a {...rest} href={to} onClick={onClick}>
      {children}
    </a>
  );
}
