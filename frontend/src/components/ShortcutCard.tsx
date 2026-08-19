import { Check, Copy, ExternalLink, Link2, Pause, Play, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Shortcut } from "../types";

interface ShortcutCardProps {
  shortcut: Shortcut;
  busy: boolean;
  onUpdate: (shortCode: string, destination: string) => Promise<void>;
  onToggle: (shortCode: string, active: boolean) => Promise<void>;
  onDelete: (shortCode: string) => Promise<void>;
}

export function ShortcutCard({ shortcut, busy, onUpdate, onToggle, onDelete }: ShortcutCardProps) {
  const [destination, setDestination] = useState(shortcut.original_url);
  const [copied, setCopied] = useState(false);
  const publicUrl = useMemo(
    () => `${window.location.origin}/api/r/${shortcut.short_code}/`,
    [shortcut.short_code],
  );
  const hasChanges = destination.trim() !== shortcut.original_url;

  async function copyShortcut() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className="shortcut-card">
      <div className="shortcut-card__topline">
        <span className={`status-pill ${shortcut.is_active ? "status-pill--active" : "status-pill--paused"}`}>
          <i /> {shortcut.is_active ? "Ativo" : "Pausado"}
        </span>
        <span className="shortcut-card__date">
          criado em {new Intl.DateTimeFormat("pt-BR").format(new Date(shortcut.created_at))}
        </span>
      </div>

      <div className="shortcut-card__identity">
        <span className="shortcut-card__icon"><Link2 size={20} /></span>
        <div>
          <span className="eyebrow">atalho permanente</span>
          <h3>{window.location.host}/api/r/{shortcut.short_code}</h3>
        </div>
      </div>

      <form
        className="destination-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void onUpdate(shortcut.short_code, destination);
        }}
      >
        <label htmlFor={`destination-${shortcut.id}`}>Destino atual</label>
        <div className="destination-editor__row">
          <input
            id={`destination-${shortcut.id}`}
            type="url"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            required
            aria-label={`Destino do atalho ${shortcut.short_code}`}
          />
          <button className="icon-action icon-action--save" type="submit" disabled={!hasChanges || busy}>
            <Save size={18} /> <span>Salvar destino</span>
          </button>
        </div>
      </form>

      <div className="shortcut-card__metrics">
        <div><strong>{shortcut.total_clicks}</strong><span>cliques</span></div>
        <div><strong>{shortcut.unique_clicks}</strong><span>pessoas</span></div>
        <div><strong>∞</strong><span>validade</span></div>
      </div>

      <div className="shortcut-card__actions">
        <button className="text-action" type="button" onClick={() => void copyShortcut()}>
          {copied ? <Check size={17} /> : <Copy size={17} />}
          {copied ? "Copiado" : "Copiar atalho"}
        </button>
        <a className="text-action" href={publicUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={17} /> Abrir
        </a>
        <button
          className="text-action"
          type="button"
          disabled={busy}
          onClick={() => void onToggle(shortcut.short_code, !shortcut.is_active)}
        >
          {shortcut.is_active ? <Pause size={17} /> : <Play size={17} />}
          {shortcut.is_active ? "Pausar" : "Ativar"}
        </button>
        <button
          className="text-action text-action--danger"
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Excluir o atalho “${shortcut.short_code}”?`)) {
              void onDelete(shortcut.short_code);
            }
          }}
        >
          <Trash2 size={17} /> Excluir
        </button>
      </div>
    </article>
  );
}
