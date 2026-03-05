"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  allowDecimal?: boolean;
}

const KEYS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  [".", "0", "C"],
] as const;

export function Numpad({ value, onChange, onConfirm, onClose, allowDecimal = true }: NumpadProps) {
  const handleKey = (key: string) => {
    if (key === "C") {
      onChange(value.length > 1 ? value.slice(0, -1) : "0");
      return;
    }
    if (key === "." && !allowDecimal) return;
    if (key === "." && value.includes(".")) return;
    if (value === "0" && key !== ".") {
      onChange(key);
      return;
    }
    // prevent more than 2 decimal places
    const dotIndex = value.indexOf(".");
    if (dotIndex !== -1 && value.length - dotIndex > 2) return;
    onChange(value + key);
  };

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl border-t border-border animate-in slide-in-from-bottom-4 duration-200">
        {/* current value display */}
        <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <span className="text-3xl font-mono font-semibold tabular-nums text-right flex-1 mr-4 overflow-hidden text-ellipsis">
            {value || "0"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground text-sm hover:text-foreground px-2 py-1"
          >
            閉じる
          </button>
        </div>

        {/* keys */}
        <div className="p-4 grid grid-cols-3 gap-3 pb-safe">
          {KEYS.flat().map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleKey(key)}
              className={cn(
                "h-16 min-h-[60px] rounded-xl text-xl font-semibold transition-all active:scale-95 select-none",
                key === "C"
                  ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200"
              )}
            >
              {key === "C" ? "⌫" : key}
            </button>
          ))}
          {/* confirm button spans full width */}
          <button
            type="button"
            onClick={onConfirm}
            className="col-span-3 h-16 min-h-[60px] rounded-xl text-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all select-none"
          >
            確定
          </button>
        </div>
      </div>
    </>
  );
}

// Hook: manages numpad state for a specific field
export function useNumpad() {
  const [activeField, setActiveField] = React.useState<string | null>(null);
  const [tempValue, setTempValue] = React.useState("0");
  const pendingRef = React.useRef<((v: string) => void) | null>(null);

  const open = React.useCallback(
    (fieldId: string, currentValue: string, onCommit: (v: string) => void) => {
      setActiveField(fieldId);
      setTempValue(currentValue === "0" || currentValue === "" ? "0" : currentValue);
      pendingRef.current = onCommit;
    },
    []
  );

  const close = React.useCallback(() => {
    setActiveField(null);
    setTempValue("0");
    pendingRef.current = null;
  }, []);

  const confirm = React.useCallback(() => {
    pendingRef.current?.(tempValue);
    close();
  }, [tempValue, close]);

  return { activeField, tempValue, setTempValue, open, close, confirm };
}
