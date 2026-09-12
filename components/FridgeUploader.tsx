"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";

export function FridgeUploader({
  onImage,
  disabled,
  compact,
}: {
  onImage: (dataUrl: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      onChange={handleChange}
      disabled={disabled}
      className="hidden"
    />
  );

  if (compact) {
    return (
      <>
        {input}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors disabled:opacity-40"
        >
          <Camera size={16} strokeWidth={2.2} />
          Scan another shelf
        </button>
      </>
    );
  }

  return (
    <div className="text-center">
      {input}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="group relative inline-flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card px-12 py-14 transition-colors hover:border-terracotta disabled:opacity-50 disabled:pointer-events-none w-full"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-cream transition-transform group-hover:scale-105">
          <Camera size={24} strokeWidth={2} />
        </span>
        <span className="font-display text-lg font-medium">Photograph your fridge</span>
        <span className="text-sm text-charcoal-soft">or choose a photo from your library</span>
      </button>
    </div>
  );
}
