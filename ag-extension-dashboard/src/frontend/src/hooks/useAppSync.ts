import { useState, useEffect } from 'react';
import { syncQueue } from '@/api/syncQueueService';
import { uploadMultipleFiles } from '@/api/uploadService';

export const useAppSync = (
  addNotification: (notif: { type: 'success' | 'warning' | 'error'; message: string }) => void
) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Offline sync queue
  useEffect(() => {
    const unsubscribe = syncQueue.onCountChange(setPendingSyncCount);
    setPendingSyncCount(syncQueue.getPendingCount());
    return unsubscribe;
  }, []);

  // Online/offline detection with sync queue
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const count = syncQueue.getPendingCount();
      if (count > 0) {
        addNotification({
          type: 'success',
          message: `Back online - syncing ${count} queued action(s)...`,
        });
        const result = await syncQueue.processQueue();
        const stuck = syncQueue.getStuckItems().length;
        if (result.failed > 0 || result.conflicts > 0 || stuck > 0) {
          addNotification({
            type: 'warning',
            message: `${result.success} synced · ${stuck} need attention (${result.conflicts} conflict${result.conflicts === 1 ? '' : 's'}, ${result.failed} exhausted retries). Open System Health → Offline Sync Queue to retry or discard.`,
          });
        } else if (result.success > 0) {
          addNotification({
            type: 'success',
            message: `All ${result.success} queued action(s) synced successfully`,
          });
        }
      } else {
        addNotification({
          type: 'success',
          message: 'Back online',
        });
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      addNotification({
        type: 'warning',
        message: 'You are offline — field visits and offline diagnoses are queued for sync; other edits need a connection',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addNotification]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      try {
        await uploadMultipleFiles(files);
        addNotification({
          type: 'success',
          message: `${files.length} file(s) uploaded and processed successfully.`,
        });
      } catch (error) {
        console.error('Upload error:', error);
        addNotification({
          type: 'error',
          message: 'An error occurred during file upload.',
        });
      }
    }
  };

  return {
    isOnline,
    pendingSyncCount,
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
