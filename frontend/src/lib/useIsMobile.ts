import { useSyncExternalStore } from "react";

/** Mesmo corte da folha: abaixo de 900px é o layout da 1h. */
const QUERY = "(max-width: 900px)";

function subscribe(listener: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
