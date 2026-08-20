import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

/**
 * Diálogo modal do produto (padrão definido em 1e).
 *
 * Objeto sólido: fundo, borda e sombra — não é `.blueprint` e não leva marcas
 * de canto. Usa `<dialog>` nativo pelo `showModal()`, que já entrega inércia do
 * fundo, Esc e backdrop; o foco inicial e o retorno ao gatilho são explícitos.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  width,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Largura máxima em px. Padrão 600 (1e); a 1f usa 440. */
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (open && !node.open) {
      trigger.current = document.activeElement;
      node.showModal();
      // Foco no primeiro campo; sem campos (1f), na primeira ação do rodapé.
      const first = node.querySelector<HTMLElement>(
        "input:not([type=hidden]), select, textarea, .dialog-foot button",
      );
      first?.focus();
    }

    if (!open && node.open) {
      node.close();
      (trigger.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      style={width ? ({ "--dialog-w": `${width}px` } as React.CSSProperties) : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clique no backdrop: o alvo é o próprio <dialog>, não o conteúdo.
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          <header className="dialog-head">
            <span className="dialog-title" id={titleId}>
              {title}
            </span>
            <button
              type="button"
              className="btn btn-icon btn-ghost"
              aria-label="Fechar"
              title="Fechar"
              style={{ marginRight: 8 }}
              onClick={onClose}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </header>

          {children}

          {footer && <div className="dialog-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
