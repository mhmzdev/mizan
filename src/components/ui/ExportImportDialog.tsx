"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Download, Upload, HardDrive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotesStore, ExportPayload } from "@/stores/notesStore";
import { useDialogStore } from "@/stores/dialogStore";

function isValidPayload(data: unknown): data is ExportPayload {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.version !== 1) return false;
  if (!Array.isArray(d.timelines)) return false;
  if (!Array.isArray(d.notes)) return false;
  return true;
}

interface ExportImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportImportDialog({ open, onClose }: ExportImportDialogProps) {
  const importData    = useNotesStore((s) => s.importData);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [error,       setError]       = useState("");
  const [importing,   setImporting]   = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setError("");
      setImporting(false);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleExport() {
    const { notes, timelines } = useNotesStore.getState();
    const payload: ExportPayload = { version: 1, exportedAt: Date.now(), timelines, notes };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `mizan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = "";

    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setError("Could not read the file. Make sure it is a valid JSON file.");
      return;
    }

    if (!isValidPayload(data)) {
      setError("Invalid file format. Please use a file exported from Mizan.");
      return;
    }

    const noteCount     = data.notes.length;
    const timelineCount = data.timelines.length;
    const confirmed     = await useDialogStore.getState().confirm({
      title:        "Replace all data?",
      message:      `This will permanently delete all current notes and timelines, then restore ${noteCount} note${noteCount !== 1 ? "s" : ""} across ${timelineCount} timeline${timelineCount !== 1 ? "s" : ""} from the backup. This cannot be undone.`,
      confirmLabel: "Import",
      variant:      "danger",
    });
    if (!confirmed) return;

    setError("");
    setImporting(true);
    try {
      await importData(data);
      onClose();
    } catch {
      setError("Import failed. The file may be corrupted.");
      setImporting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed left-1/2 top-1/2 z-[101] w-full max-w-sm px-4"
            style={{ translateX: "-50%", translateY: "-50%" }}
            initial={{ scale: 0.96, opacity: 0, y: "-47%" }}
            animate={{ scale: 1,    opacity: 1, y: "-50%" }}
            exit={{   scale: 0.96, opacity: 0, y: "-47%" }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-no-panel border border-no-border rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.4)] overflow-hidden">
              {/* Blue top strip */}
              <div className="h-0.5 w-full bg-no-blue" />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-no-blue/10 flex items-center justify-center">
                    <HardDrive size={14} className="text-no-blue" />
                  </div>
                  <h3 className="text-no-text font-semibold text-base flex-1">Export / Import</h3>
                  <button
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-no-muted hover:text-no-text hover:bg-no-card transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Description */}
                <p className="text-no-muted text-sm leading-relaxed mb-5">
                  Back up your notes to a JSON file, or restore from a previous backup.
                </p>

                {/* Buttons */}
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={handleExport}
                    disabled={importing}
                    className="flex items-center gap-2.5 w-full px-4 py-3 bg-no-blue hover:bg-no-blue-dim disabled:opacity-40 disabled:cursor-not-allowed text-no-blue-fg font-semibold text-sm rounded-xl transition-colors"
                  >
                    <Download size={15} />
                    <span>Export Notes (.json)</span>
                  </button>

                  <button
                    onClick={() => { setError(""); fileInputRef.current?.click(); }}
                    disabled={importing}
                    className="flex items-center gap-2.5 w-full px-4 py-3 bg-no-card hover:bg-no-border disabled:opacity-40 disabled:cursor-not-allowed text-no-text font-semibold text-sm rounded-xl border border-no-border transition-colors"
                  >
                    <Upload size={15} />
                    <span>{importing ? "Importing…" : "Import Notes (.json)"}</span>
                  </button>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-red-400 text-[12px] mt-3 leading-snug">{error}</p>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
