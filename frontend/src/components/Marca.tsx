/**
 * A marca: dois elos de corrente.
 *
 * O mesmo desenho do favicon (`public/icone.svg`), aqui como componente para
 * acompanhar o tamanho do texto ao lado. O contorno usa `currentColor` — herda
 * a tinta de quem o contém, como qualquer ícone da barra — e o corpo mantém o
 * ciano da marca.
 */

const ELO_A =
  "M13,22 H26 A10,10 0 0 1 36,32 A10,10 0 0 1 26,42 H13 A10,10 0 0 1 3,32 " +
  "A10,10 0 0 1 13,22 Z M13,28.5 H26 A3.5,3.5 0 0 1 29.5,32 A3.5,3.5 0 0 1 " +
  "26,35.5 H13 A3.5,3.5 0 0 1 9.5,32 A3.5,3.5 0 0 1 13,28.5 Z";

const ELO_B =
  "M38,22 H51 A10,10 0 0 1 61,32 A10,10 0 0 1 51,42 H38 A10,10 0 0 1 28,32 " +
  "A10,10 0 0 1 38,22 Z M38,28.5 H51 A3.5,3.5 0 0 1 54.5,32 A3.5,3.5 0 0 1 " +
  "51,35.5 H38 A3.5,3.5 0 0 1 34.5,32 A3.5,3.5 0 0 1 38,28.5 Z";

export function Marca({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <g
        transform="rotate(-45 32 32)"
        fill="#a9efef"
        fillRule="evenodd"
        stroke="currentColor"
        strokeWidth={4.2}
        strokeLinejoin="round"
      >
        <path d={ELO_A} />
        <path d={ELO_B} />
      </g>
    </svg>
  );
}
