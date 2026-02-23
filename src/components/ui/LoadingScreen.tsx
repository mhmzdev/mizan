"use client";

import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-no-bg flex flex-col items-center justify-center gap-8"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Logo — scaled up from the header version */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-6"
      >
        <svg
          width="108"
          height="84"
          viewBox="0 0 36 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-no-blue"
          aria-hidden="true"
        >
          <defs>
            <filter id="splash-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2" result="blur" in="SourceGraphic" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Top lane */}
          <line x1="1" y1="4"  x2="35" y2="4"  stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
          <line x1="18" y1="2" x2="18" y2="6"  stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />

          {/* Main lane — bright + glow */}
          <line x1="1" y1="12" x2="35" y2="12" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
          <line x1="18" y1="7" x2="18" y2="17" stroke="currentColor" strokeOpacity="1"    strokeWidth="1.5" filter="url(#splash-glow)" />

          {/* Bottom lane */}
          <line x1="1" y1="20" x2="35" y2="20" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
          <line x1="18" y1="18" x2="18" y2="22" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />

          {/* "0" label */}
          <text x="18" y="27" textAnchor="middle" fontFamily="monospace" fontSize="5"
                fill="currentColor" fillOpacity="0.3">0</text>
        </svg>

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-no-text text-[28px] font-mono font-semibold tracking-[0.35em] uppercase">
            Mizan
          </span>
          <span className="text-no-muted/60 text-[12px] font-mono tracking-[0.18em] uppercase">
            The Balance of Time &amp; Thoughts
          </span>
        </div>
      </motion.div>

      {/* Loading bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="relative w-28 h-px bg-no-blue/15 rounded-full overflow-hidden"
      >
        <motion.div
          className="absolute inset-y-0 w-1/2 rounded-full"
          style={{
            background: "linear-gradient(to right, transparent, rgba(116,160,255,0.75), transparent)",
          }}
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
        />
      </motion.div>
    </motion.div>
  );
}
