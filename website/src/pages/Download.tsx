import { PRODUCT } from "../data/facts";
import { usePageMeta } from "../lib/meta";

export function Download() {
  usePageMeta("Build GROOT", "Build the GROOT desktop app from source for macOS, Windows, or Linux.");

  return (
    <section className="download-page">
      <section className="download-primary" aria-labelledby="primary-download-title">
        <div className="download-primary-copy">
          <span>Desktop application</span>
          <h2 id="primary-download-title">Build GROOT from source</h2>
          <p>GROOT installers have not been published under this name yet. The source is available in this repository.</p>
        </div>
      </section>
      <section className="download-install" aria-labelledby="installation-title">
        <h2 id="installation-title">Build locally</h2>
        <p>Use Node.js 22 or newer. Clone the repository, then run:</p>
        <pre><code>{`npm ci\nnpm run build`}</code></pre>
        <p>Platform packages can be built with <code>npm run package:linux</code>, <code>npm run package:win</code>, or <code>npm run package:mac</code>.</p>
      </section>
      <section className="download-ownership" aria-label="Your files stay yours">
        <span>YOUR FILES STAY YOURS</span>
        <p>GROOT keeps your vault as ordinary Markdown files on your disk.</p>
      </section>
      <section className="download-source" aria-labelledby="source-title">
        <h2 id="source-title">Source</h2>
        <div className="download-trust-list">
          <div><span>Repository</span><p>Current source checkout</p><a href={PRODUCT.repo} target="_blank" rel="noreferrer">View source ↗</a></div>
          <div><span>License</span><p>{PRODUCT.license}</p><a href={`${PRODUCT.repo}/blob/main/LICENSE`} target="_blank" rel="noreferrer">View license ↗</a></div>
        </div>
      </section>
    </section>
  );
}
