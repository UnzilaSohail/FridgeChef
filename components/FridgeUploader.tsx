"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ScanLine } from "lucide-react";
import { fileToUploadableDataUrl } from "@/lib/image";

export function FridgeUploader({
  onImage,
  disabled,
  compact,
  loadingLabel,
}: {
  onImage: (dataUrl: string) => void;
  disabled?: boolean;
  compact?: boolean;
  loadingLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function readFile(file: File | undefined | null) {
    if (!file) return;
    const dataUrl = await fileToUploadableDataUrl(file);
    onImage(dataUrl);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    readFile(e.target.files?.[0]).catch((err) => console.error("Could not read photo:", err));
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    readFile(e.dataTransfer.files?.[0]).catch((err) => console.error("Could not read photo:", err));
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      onChange={handleChange}
      disabled={disabled}
      className="hidden"
    />
  );

  if (compact) {
    return (
      <>
        {input}
        <motion.button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors disabled:opacity-40"
        >
          <Camera size={16} strokeWidth={2.2} />
          Scan another shelf
        </motion.button>
      </>
    );
  }

  return (
    <div className="text-center">
      {input}
      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        disabled={disabled}
        className={`group relative isolate inline-flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-12 py-14 transition-all duration-300 disabled:pointer-events-none w-full overflow-hidden ${
          dragging
            ? "border-terracotta bg-terracotta/5 scale-[1.01]"
            : "border-border bg-card hover:border-terracotta hover:shadow-[0_8px_30px_-8px_rgba(193,80,46,0.25)]"
        } ${disabled ? "opacity-70" : ""}`}
      >
        {/* Sweeping scan-line while analyzing */}
        <AnimatePresence>
          {disabled && loadingLabel && (
            <motion.span
              initial={{ y: "-10%" }}
              animate={{ y: "110%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
              className="pointer-events-none absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent via-terracotta/15 to-transparent"
            />
          )}
        </AnimatePresence>

        <span
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-cream transition-transform duration-300 ${
            disabled ? "" : "group-hover:scale-110 group-hover:rotate-3"
          }`}
        >
          {disabled && loadingLabel ? (
            <ScanLine size={24} strokeWidth={2} className="animate-pulse" />
          ) : (
            <Camera size={24} strokeWidth={2} />
          )}
        </span>

        <AnimatePresence mode="wait">
          {disabled && loadingLabel ? (
            <motion.span
              key={loadingLabel}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="font-display text-lg font-medium"
            >
              {loadingLabel}
            </motion.span>
          ) : (
            <motion.span key="idle" className="font-display text-lg font-medium">
              {dragging ? "Drop it here" : "Photograph your fridge"}
            </motion.span>
          )}
        </AnimatePresence>

        {!disabled && (
          <span className="text-sm text-charcoal-soft">or drag a photo in / choose from your library</span>
        )}
      </button>
    </div>
  );
}
