"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type AnimatedModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
  backdropBlur?: boolean;
  zIndex?: number;
};

export function AnimatedModal({
  open,
  onClose,
  children,
  panelClassName = "relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-zinc-950",
  backdropClassName = "absolute inset-0 bg-zinc-900/60",
  backdropBlur = false,
  zIndex = 50,
}: AnimatedModalProps) {
  const reduceMotion = useReducedMotion();

  const panelMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.96, y: 14 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, y: 14 },
        transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
      };

  const backdropMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.18 },
      };

  return (
    <AnimatePresence>
      {open ? (
        <div
          className={`fixed inset-0 flex items-center justify-center p-4 ${backdropBlur ? "backdrop-blur-sm" : ""}`}
          style={{ zIndex }}
          role="dialog"
          aria-modal="true"
        >
          <motion.button
            type="button"
            aria-label="Close"
            className={backdropClassName}
            onClick={onClose}
            {...backdropMotion}
          />
          <motion.div
            className={panelClassName}
            onClick={(e) => e.stopPropagation()}
            {...panelMotion}
          >
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
