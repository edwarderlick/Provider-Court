export function Footer() {
  return (
    <footer className="w-full py-4 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-2 bg-surface-dim border-t border-outline">
      <div className="flex items-center gap-4">
        <span className="font-mono-label text-mono-label text-primary">PROVIDER COURT</span>
        <span className="font-mono-data text-mono-data text-on-surface-variant">
          ©2024 PROVIDER COURT // PROTOCOL_V1.0.4
        </span>
      </div>
      <div className="flex flex-wrap gap-4 md:gap-6 font-mono-data text-mono-data text-on-surface-variant">
        <a className="hover:text-primary transition-colors" href="#">
          [LEGAL]
        </a>
        <a className="hover:text-primary transition-colors text-secondary flex items-center gap-1" href="#">
          <span className="w-2 h-2 rounded-full bg-secondary inline-block" /> [STATUS: OK]
        </a>
        <a className="hover:text-primary transition-colors" href="#">
          [API_DOCS]
        </a>
        <a className="hover:text-primary transition-colors" href="#">
          [NETWORK_LATENCY: 24MS]
        </a>
      </div>
    </footer>
  );
}
