import { useEffect, useState } from 'react';
import { createShare, type ShareResponse } from '@/api/shareService';
import { copyWithToast } from '@/lib/copyText';
import { getApiErrorMessage } from '@/lib/apiError';

export interface ShareSettings {
  /** public, restricted or organization */
  accessType: string;
  /** Days until the link stops working. */
  expiresIn: string;
  allowExport: boolean;
}

/** Creating and copying a share link for one record; it starts over each time the dialog opens. */
export function useShareLink(isOpen: boolean, entityType: string, entityId: string) {
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState<ShareResponse['data'] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<ShareSettings>({ accessType: 'restricted', expiresIn: '7', allowExport: true });

  useEffect(() => {
    if (isOpen) {
      setShareData(null);
      setErrorMessage(null);
      setCopied(false);
    }
  }, [isOpen]);

  const handleCreateShare = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await createShare({
        entityType,
        entityId,
        accessType: settings.accessType,
        expiresInDays: parseInt(settings.expiresIn),
        permissions: { canView: true, canExport: settings.allowExport },
      });
      if (result.success && result.data) {
        setShareData(result.data);
      } else {
        const message = result.error || 'Failed to create share link';
        setErrorMessage(message);
        console.warn('Failed to create share:', message);
      }
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Share request failed');
      setErrorMessage(message);
      console.warn('Share error:', message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareData?.shareUrl || !(await copyWithToast(shareData.shareUrl, 'Link copied.'))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /** Back to the settings, to make a different link. */
  const startOver = () => setShareData(null);

  return { loading, shareData, errorMessage, copied, settings, setSettings, handleCreateShare, copyToClipboard, startOver };
}
