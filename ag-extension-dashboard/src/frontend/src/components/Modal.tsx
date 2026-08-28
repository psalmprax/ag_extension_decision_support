import React from 'react';
import { motion } from 'framer-motion';

interface ModalProps {
  title: string;
  onClose: () => void;
  /** Width of the modal card. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'max-w-2xl',
  md: 'max-w-3xl',
  lg: 'max-w-4xl',
};

export function Modal({ title, onClose, size = 'md', children }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-slate-900 border border-white/10 text-white rounded-xl w-full ${SIZE_CLASS[size]} max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] overflow-y-auto shadow-2xl`}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white text-xl p-1 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
