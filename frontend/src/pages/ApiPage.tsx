import { ArrowLeft, ArrowRight, Braces, Check, Copy } from "lucide-react";
import { useState } from "react";

const createExample = `curl -X POST http://localhost:8000/api/urls/ \\
  -H "Content-Type: application/json" \\
  -d '{
    "original_url": "https://chat.whatsapp.com/CONVITE",
    "short_code": "iloc"
  }'`;

const updateExample = `curl -X PATCH http://localhost:8000/api/urls/iloc/ \\
  -H "Content-Type: application/json" \\
  -d '{
    "original_url": "https://chat.whatsapp.com/NOVO-CONVITE"
  }'`;

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="code-block">
      <div className="code-block__bar"><span>bash</span><button type="button" onClick={() => void copy()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "copiado" : "copiar"}</button></div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

const endpoints = [
  ["GET", "/api/urls/", "Lista os atalhos"],
  ["POST", "/api/urls/", "Cria um atalho"],
  ["PATCH", "/api/urls/{code}/", "Troca o destino"],
  ["DELETE", "/api/urls/{code}/", "Remove um atalho"],
  ["GET", "/api/urls/{code}/statistics/", "Consulta os cliques"],
  ["GET", "/api/r/{code}/", "Redireciona ao destino"],
];

export function ApiPage() {
  return (
    <div className="api-page">
      <section className="api-hero">
        <div className="container api-hero__grid">
          <div>
            <a className="back-link" href="/"><ArrowLeft size={16} /> voltar ao produto</a>
            <span className="kicker"><Braces size={15} /> API REST</span>
            <h1>Construa em cima<br />de rotas <em>estáveis.</em></h1>
          </div>
          <div className="api-hero__meta">
            <span>BASE URL</span>
            <code>http://localhost:8000/api</code>
            <p>JSON em todas as respostas. Sem autenticação nesta versão de desenvolvimento.</p>
          </div>
        </div>
      </section>

      <section className="api-content">
        <div className="container api-content__grid">
          <aside className="api-sidebar">
            <span>NESTA PÁGINA</span>
            <a href="#inicio">Começar</a>
            <a href="#trocar">Trocar destino</a>
            <a href="#referencia">Referência</a>
          </aside>

          <div className="api-docs">
            <section id="inicio" className="api-doc-section">
              <span className="section-index">01 / COMEÇAR</span>
              <h2>Crie uma rota permanente</h2>
              <p>Envie o destino atual e um código curto. O código será a parte pública e estável do seu atalho.</p>
              <CodeBlock code={createExample} />
            </section>

            <section id="trocar" className="api-doc-section">
              <span className="section-index">02 / ATUALIZAR</span>
              <h2>Troque apenas o que mudou</h2>
              <p>Um PATCH em <code>original_url</code> atualiza o destino imediatamente e mantém o mesmo código divulgado.</p>
              <CodeBlock code={updateExample} />
              <div className="api-callout"><ArrowRight size={20} /><p><strong>O resultado:</strong> <code>/api/r/iloc/</code> continua igual, agora apontando para o convite novo.</p></div>
            </section>

            <section id="referencia" className="api-doc-section">
              <span className="section-index">03 / REFERÊNCIA</span>
              <h2>Mapa de endpoints</h2>
              <div className="endpoint-list">
                {endpoints.map(([method, path, description]) => (
                  <div className="endpoint-row" key={`${method}-${path}`}>
                    <span className={`method method--${method.toLowerCase()}`}>{method}</span>
                    <code>{path}</code>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
