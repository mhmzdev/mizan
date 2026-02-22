"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useDialogStore } from "@/stores/dialogStore";

export function ConfirmDialog() {
  const open    = useDialogStore((s) => s.open);
  const options = useDialogStore((s) => s.options);
  const respond = useDialogStore((s) => s._respond);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") respond(false);
      if (e.key === "Enter")  respond(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, respond]);

  const isDanger = options?.variant === "danger";

  return (
    <AnimatePresence>
      {open && options && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-[#0F1117]/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => respond(false)}
          />

          {/* Panel */}
          <motion.div
            className="fixed left-1/2 top-1/2 z-[101] w-full max-w-sm px-4"
            style={{ translateX: "-50%", translateY: "-50%" }}
            initial={{ scale: 0.96, opacity: 0, y: "-47%" }}
            animate={{ scale: 1,    opacity: 1, y: "-50%" }}
            exit={{   scale: 0.96, opacity: 0, y: "-47%" }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="bg-[#1F2226] border border-[#2F3337] rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden">
              {/* Coloured top strip */}
              <div className={`h-0.5 w-full ${isDanger ? "bg-red-500" : "bg-no-blue"}`} />

              <div className="p-6">
                {/* Icon + title */}
                <div className="flex items-start gap-3 mb-3">
                  {isDanger && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center mt-0.5">
                      <AlertTriangle size={15} className="text-red-400" />
                    </div>
                  )}
                  <h3 className="text-[#E1E2E5] font-semibold text-base leading-snug pt-1">
                    {options.title}
                  </h3>
                </div>

                <p className="text-[#6C7380] text-sm leading-relaxed mb-6 ml-11">
                  {options.message}
                </p>

                {/* Buttons */}
                <div className="flex gap-2.5 justify-end">
                  <button
                    onClick={() => respond(false)}
                    className="px-4 py-2 text-sm font-medium text-[#E1E2E5]/60 hover:text-[#E1E2E5] bg-[#252A30] hover:bg-[#2F3337] rounded-xl border border-[#2F3337] transition-colors"
                  >
                    {options.cancelLabel ?? "Cancel"}
                  </button>
                  <button
                    onClick={() => respond(true)}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                      isDanger
                        ? "bg-red-500 hover:bg-red-400 text-white"
                        : "bg-no-blue hover:bg-[#5B8FFF] text-[#1A1C1E]"
                    }`}
                  >
                    {options.confirmLabel ?? "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
