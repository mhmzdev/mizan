"use client";

import React from "react";
import { ZoomMode } from "@/types";

interface ModeButtonProps {
  label: string;
  mode: ZoomMode;
  active: boolean;
  onClick: () => void;
}

export function ModeButton({ label, active, onClick }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 text-sm rounded-md transition-colors text-left ${
        active
          ? "bg-white/15 text-white font-medium"
          : "text-white/60 hover:bg-white/8 hover:text-white/90"
      }`}
    >
      {label}
    </button>
  );
}
