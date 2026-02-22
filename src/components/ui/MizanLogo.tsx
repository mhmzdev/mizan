export function MizanLogo() {
  return (
    <div className="flex items-center gap-3">
      <svg
        width="36"
        height="28"
        viewBox="0 0 36 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-no-blue"
        aria-hidden="true"
      >
        <defs>
          <filter id="axis-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" in="SourceGraphic" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Top lane — dim */}
        <line x1="1" y1="4" x2="35" y2="4" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
        <line x1="18" y1="2" x2="18" y2="6" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />

        {/* Main lane — bright + glow */}
        <line x1="1" y1="12" x2="35" y2="12" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
        <line x1="18" y1="7" x2="18" y2="17" stroke="currentColor" strokeOpacity="1" strokeWidth="1.5" filter="url(#axis-glow)" />

        {/* Bottom lane — dim */}
        <line x1="1" y1="20" x2="35" y2="20" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
        <line x1="18" y1="18" x2="18" y2="22" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />

        {/* "0" anchor label */}
        <text
          x="18"
          y="27"
          textAnchor="middle"
          fontFamily="monospace"
          fontSize="5"
          fill="currentColor"
          fillOpacity="0.35"
        >
          0
        </text>
      </svg>

      <span className="text-no-text/70 text-[13px] font-mono tracking-[0.25em] uppercase">
        Mizan — The Balance of Time & Thoughts
      </span>
    </div>
  );
}
