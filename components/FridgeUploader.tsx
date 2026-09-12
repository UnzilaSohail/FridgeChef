"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Images, ScanLine } from "lucide-react";
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
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

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    readFile(e.dataTransfer.files?.[0]).catch((err) => console.error("Could not read photo:", err));
  }

  // Two separate inputs: only the camera one forces a direct capture
  // (capture="environment"), which on some Android/iOS combinations opens
  // straight into the camera. Offering it as an explicit, separate choice
  // (rather than relying on the OS's combined file/camera chooser, which
  // varies a lot across devices) keeps the "take a live photo" path
  // predictable while still letting people pick an existing photo.
  const inputs = (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
    </>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {inputs}
        <motion.button
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Take another photo"
          title="Take another photo"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors disabled:opacity-40"
        >
          <Camera size={16} strokeWidth={2.2} />
        </motion.button>
        <motion.button
          onClick={() => galleryInputRef.current?.click()}
          disabled={disabled}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Choose from library"
          title="Choose from library"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors disabled:opacity-40"
        >
          <Images size={16} strokeWidth={2.2} />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="text-center">
      {inputs}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`group relative isolate flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-8 sm:px-12 py-14 transition-all duration-300 w-full overflow-hidden ${
          dragging
            ? "border-terracotta bg-terracotta/5 scale-[1.01]"
            : "border-border bg-card hover:border-terracotta/60"
        } ${disabled ? "opacity-70 pointer-events-none" : ""}`}
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
            disabled ? "" : "group-hover:scale-110"
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
          <>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
              <motion.button
                onClick={() => cameraInputRef.current?.click()}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-xl bg-terracotta text-cream px-5 py-2.5 font-medium text-sm hover:bg-terracotta-dark transition-colors"
              >
                <Camera size={16} strokeWidth={2.2} />
                Take Photo
              </motion.button>
              <motion.button
                onClick={() => galleryInputRef.current?.click()}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 font-medium text-sm text-charcoal hover:border-terracotta/50 transition-colors"
              >
                <Images size={16} strokeWidth={2.2} />
                Choose from Library
              </motion.button>
            </div>
            <span className="text-xs text-charcoal-soft/70">or drag a photo in</span>
          </>
        )}
      </div>
    </div>
  );
}
