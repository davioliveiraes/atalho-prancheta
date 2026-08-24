import { useEffect, useState } from "react";
import { configApi, type SiteConfig } from "./api";

/**
 * A configuração pública da instalação, carregada uma vez por carga de página.
 *
 * Três telas perguntam a mesma coisa — o encurtador da home, o diálogo de novo
 * link e a edição —, e a resposta não muda enquanto a aba está aberta. A
 * promessa fica guardada no módulo para que as três dividam uma requisição só.
 */
let pending: Promise<SiteConfig> | null = null;

function load(): Promise<SiteConfig> {
  if (!pending) {
    // Falha de rede não pode derrubar o formulário: sem resposta, a tela se
    // comporta como se o subdomínio estivesse desligado, que é o padrão.
    pending = configApi.get().catch(() => ({ shortlink_base_domain: null }));
  }
  return pending;
}

/**
 * `null` enquanto carrega. Quem chama trata a ausência como "desligado" — é o
 * lado seguro do engano: oferecer o campo cedo demais deixaria alguém escolher
 * um subdomínio que ninguém atende.
 */
export function useSiteConfig(): SiteConfig | null {
  const [config, setConfig] = useState<SiteConfig | null>(null);

  useEffect(() => {
    let alive = true;
    void load().then((value) => {
      if (alive) setConfig(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return config;
}

/** O domínio-base, ou null enquanto carrega e quando a funcionalidade está desligada. */
export function useSubdomainBase(): string | null {
  return useSiteConfig()?.shortlink_base_domain ?? null;
}
