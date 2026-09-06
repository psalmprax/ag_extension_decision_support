import React from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import { triggerHaptic } from '@/lib/haptics';

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
  const { designVariant } = useFeatureFlags();
  const isBase = designVariant === 'base' || designVariant === 'new';
  const dragControls = useDragControls();

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  const handleDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { y: number }; velocity: { y: number } }
  ) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      triggerHaptic('medium');
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 ${
        isBase
          ? 'flex items-end sm:items-center justify-center p-0 sm:p-4'
          : 'flex items-center justify-center p-3 sm:p-4'
      }`}
    >
      <motion.div
        drag={isBase ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.6 }}
        onDragEnd={isBase ? handleDragEnd : undefined}
        initial={
          isBase
            ? { opacity: 0, y: 50, scale: 0.98 }
            : { opacity: 0, scale: 0.95 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={
          isBase
            ? { opacity: 0, y: 50, scale: 0.98 }
            : { opacity: 0, scale: 0.95 }
        }
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className={`w-full ${SIZE_CLASS[size]} max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto shadow-2xl ${
          isBase
            ? 'bg-[#0a0d14]/95 border-t sm:border border-white/15 ring-1 ring-blue-500/20 text-white rounded-t-[28px] sm:rounded-2xl rounded-b-none sm:rounded-b-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-0'
            : 'bg-slate-900 border border-white/10 text-white rounded-xl'
        }`}
      >
        {isBase && (
          <div
            onPointerDown={e => dragControls.start(e)}
            className="pt-2.5 pb-1 flex justify-center sm:hidden cursor-grab active:cursor-grabbing touch-none select-none"
            aria-label="Drag down to close"
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full hover:bg-white/40 active:bg-blue-400 transition-colors" />
          </div>
        )}
        <div className="p-4 sm:p-6">
          <div
            onPointerDown={e => {
              if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
              dragControls.start(e);
            }}
            className="flex items-center justify-between mb-4 border-b border-white/10 pb-3 select-none cursor-default"
          >
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">{title}</h3>
            <button
              onClick={handleClose}
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
