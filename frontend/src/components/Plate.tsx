import type { ReactNode } from "react";

/**
 * A placa: contêiner de conteúdo desta aplicação.
 * Bloco emoldurado com as quatro marcas de registro e o title block —
 * título à esquerda, células de registro à direita divididas por hairline.
 */
export function Plate({
  title,
  cells,
  children,
  footer,
  as: Tag = "section",
  className,
  style,
}: {
  title?: ReactNode;
  cells?: ReactNode[];
  children?: ReactNode;
  footer?: ReactNode;
  as?: "section" | "article" | "div";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Tag className={className ? `blueprint ${className}` : "blueprint"} style={style}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />

      {(title || cells?.length) && (
        <header className="plate-head">
          <span className="plate-title">{title}</span>
          {cells?.map((cell, index) => (
            // eslint-disable-next-line react/no-array-index-key -- células são posicionais
            <span className="plate-cell" key={index}>
              {cell}
            </span>
          ))}
        </header>
      )}

      {children}

      {footer && <div className="plate-foot">{footer}</div>}
    </Tag>
  );
}
