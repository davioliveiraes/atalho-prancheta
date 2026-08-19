import { ArrowDown, ArrowRight, CheckCircle2, Link2, LoaderCircle, Route, Sparkles } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ShortcutCard } from "../components/ShortcutCard";
import { ApiError, shortcutApi } from "../lib/api";
import type { Shortcut } from "../types";

function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "Algo saiu da rota. Tente novamente.";
}

export function HomePage() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [shortCode, setShortCode] = useState("");

  const loadShortcuts = useCallback(async () => {
    try {
      setError(null);
      setShortcuts(await shortcutApi.list());
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShortcuts();
  }, [loadShortcuts]);

  async function createShortcut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const created = await shortcutApi.create({
        original_url: destination.trim(),
        short_code: shortCode.trim(),
      });
      setShortcuts((current) => [created, ...current]);
      setDestination("");
      setShortCode("");
      setNotice(`Atalho “${created.short_code}” pronto para circular.`);
      window.setTimeout(() => document.querySelector("#atalhos")?.scrollIntoView({ behavior: "smooth" }), 120);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateDestination(code: string, nextDestination: string) {
    setBusyCode(code);
    setError(null);
    try {
      const updated = await shortcutApi.updateDestination(code, nextDestination.trim());
      setShortcuts((current) => current.map((item) => (item.short_code === code ? updated : item)));
      setNotice(`Destino de “${code}” atualizado sem trocar o atalho.`);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusyCode(null);
    }
  }

  async function toggleShortcut(code: string, active: boolean) {
    setBusyCode(code);
    try {
      const response = await shortcutApi.setActive(code, active);
      setShortcuts((current) => current.map((item) => (item.short_code === code ? response.data : item)));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusyCode(null);
    }
  }

  async function deleteShortcut(code: string) {
    setBusyCode(code);
    try {
      await shortcutApi.remove(code);
      setShortcuts((current) => current.filter((item) => item.short_code !== code));
      setNotice(`Atalho “${code}” removido.`);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <>
      <section className="hero">
        <div className="hero__texture" aria-hidden="true" />
        <div className="container hero__grid">
          <div className="hero__copy reveal reveal--1">
            <span className="kicker"><Sparkles size={15} /> links que acompanham a mudança</span>
            <h1>O endereço fica.<br /><em>O destino evolui.</em></h1>
            <p>
              Publique um atalho uma única vez. Quando o destino mudar, atualize por aqui — sem
              reimprimir, reenviar ou perder pessoas pelo caminho.
            </p>
            <a className="button button--dark" href="#criar">
              Criar meu atalho <ArrowDown size={18} />
            </a>
          </div>

          <div className="route-board reveal reveal--2" aria-label="Exemplo de um atalho mudando de destino">
            <div className="route-board__header">
              <span>ROTA / 001</span>
              <span className="live-indicator"><i /> AO VIVO</span>
            </div>
            <div className="route-board__fixed">
              <span className="route-board__label">endereço publicado</span>
              <strong>atalho.link/iloc</strong>
              <span className="route-board__tag">não muda</span>
            </div>
            <div className="route-board__track" aria-hidden="true">
              <span className="route-board__node"><Link2 size={18} /></span>
              <span className="route-board__line"><i /></span>
              <span className="route-board__node route-board__node--accent"><Route size={18} /></span>
            </div>
            <div className="route-board__destinations">
              <div className="destination destination--past">
                <span>antes</span><strong>Convite antigo</strong><small>encerrado</small>
              </div>
              <ArrowRight className="destination-arrow" size={24} />
              <div className="destination destination--current">
                <span>agora</span><strong>Novo WhatsApp</strong><small><CheckCircle2 size={13} /> recebendo visitas</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="create-section" id="criar">
        <div className="container create-section__grid">
          <div className="section-intro">
            <span className="section-index">01 / CRIAR</span>
            <h2>Escolha um nome.<br />Aponte o destino.</h2>
            <p>O código é a parte memorável. O destino pode ser atualizado quantas vezes precisar.</p>
          </div>

          <form className="create-form" onSubmit={createShortcut}>
            <div className="field field--full">
              <label htmlFor="destination">Para onde as pessoas vão agora?</label>
              <div className="input-wrap">
                <Link2 size={19} aria-hidden="true" />
                <input
                  id="destination"
                  type="url"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="https://chat.whatsapp.com/seu-convite"
                  required
                />
              </div>
              <small>Cole a URL completa, incluindo https://</small>
            </div>

            <div className="field field--full">
              <label htmlFor="short-code">Como será chamado o atalho?</label>
              <div className="slug-field">
                <span>{window.location.host}/api/r/</span>
                <input
                  id="short-code"
                  value={shortCode}
                  onChange={(event) => setShortCode(event.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                  placeholder="iloc"
                  minLength={3}
                  maxLength={10}
                  pattern="[A-Za-z0-9]+"
                  required
                />
              </div>
              <small>De 3 a 10 letras ou números. Sem espaços.</small>
            </div>

            <button className="button button--accent button--wide" type="submit" disabled={submitting}>
              {submitting ? <LoaderCircle className="spin" size={19} /> : <ArrowRight size={19} />}
              {submitting ? "Criando rota..." : "Criar atalho permanente"}
            </button>
          </form>
        </div>
      </section>

      <section className="shortcuts-section" id="atalhos">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-index">02 / GERENCIAR</span>
              <h2>Atalhos em circulação</h2>
            </div>
            <span className="counter">{shortcuts.length.toString().padStart(2, "0")} rotas</span>
          </div>

          {(notice || error) && (
            <div className={`notice ${error ? "notice--error" : "notice--success"}`} role="status">
              {error || notice}
              <button type="button" onClick={() => { setError(null); setNotice(null); }}>fechar</button>
            </div>
          )}

          {loading ? (
            <div className="loading-state"><LoaderCircle className="spin" /> buscando suas rotas</div>
          ) : shortcuts.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__number">00</span>
              <div><h3>Nenhum atalho na rua ainda.</h3><p>Crie o primeiro acima e ele aparecerá aqui, pronto para ser atualizado.</p></div>
              <a href="#criar" className="button button--outline">Criar o primeiro</a>
            </div>
          ) : (
            <div className="shortcut-list">
              {shortcuts.map((shortcut) => (
                <ShortcutCard
                  key={shortcut.id}
                  shortcut={shortcut}
                  busy={busyCode === shortcut.short_code}
                  onUpdate={updateDestination}
                  onToggle={toggleShortcut}
                  onDelete={deleteShortcut}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
