"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const [colorMode, setColorMode] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = document.documentElement;
    setColorMode((root.getAttribute("data-theme") as "dark" | "light") ?? "dark");

    const observer = new MutationObserver(() => {
      setColorMode((root.getAttribute("data-theme") as "dark" | "light") ?? "dark");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="md-editor-wrapper flex-1 flex flex-col min-h-0" data-color-mode={colorMode}>
      <MDEditor
        value={value}
        onChange={(val) => onChange(val ?? "")}
        preview="edit"
        hideToolbar={false}
        visibleDragbar={false}
        height="100%"
        style={{ flex: 1, minHeight: 0 }}
        textareaProps={{
          placeholder: "Write your notes in markdown…",
        }}
      />
    </div>
  );
}
