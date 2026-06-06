"use client";

import { AnimatedModal } from "@/components/ui/AnimatedModal";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type ConfirmTone = "default" | "warning" | "danger";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
};

type ConfirmDialogProps = {
  open: boolean;
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
};

function toneButtonClass(tone: ConfirmTone): string {
  if (tone === "danger") {
    return "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400";
  }
  if (tone === "warning") {
    return "bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-400";
  }
  return "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-400";
}

function ConfirmDialog({ open, options, onCancel, onConfirm }: ConfirmDialogProps) {
  const tone = options.tone ?? "default";

  return (
    <AnimatedModal
      open={open}
      onClose={onCancel}
      zIndex={9998}
      backdropClassName="absolute inset-0 bg-black/60"
      panelClassName="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
    >
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{options.title}</h3>
            {options.description ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{options.description}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {options.cancelText ?? "Huy"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${toneButtonClass(tone)}`}
          >
            {options.confirmText ?? "Dong y"}
          </button>
        </div>
    </AnimatedModal>
  );
}

export function useConfirmDialog() {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "Xac nhan" });

  const closeDialog = useCallback((value: boolean) => {
    setOpen(false);
    const resolver = resolverRef.current;
    resolverRef.current = null;
    if (resolver) {
      resolver(value);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
    };
  }, []);

  const confirm = useCallback((nextOptions: ConfirmOptions) => {
    setOptions(nextOptions);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  return {
    confirm,
    confirmDialog: (
      <ConfirmDialog
        open={open}
        options={options}
        onCancel={() => closeDialog(false)}
        onConfirm={() => closeDialog(true)}
      />
    ),
  };
}
