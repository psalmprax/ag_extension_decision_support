import React, { useState, useEffect, useRef } from 'react';
import { Calendar, User, Clipboard, MapPin, Camera, Save, Loader2, CheckCircle2, X } from 'lucide-react';
import { apiQueue } from '../../../shared/apiQueue';
import CONFIG from '../../../shared/config';

interface Farmer {
  id: string;
  firstName: string;
  lastName: string;
}

export function VisitLogger({ farmerId: initialFarmerId }: { farmerId?: string }) {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedFarmerId, setSelectedFarmerId] = useState(initialFarmerId || '');
  const [observationType, setObservationType] = useState('Routine Inspection');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadFarmers() {
      try {
        const response = await apiQueue.makeRequest(`${CONFIG.API_BASE_URL}/farmers`);
        if (response.ok) {
          const data = await response.json();
          setFarmers(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load farmers:', err);
      }
    }
    loadFarmers();
  }, []);

  const handleAttachPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('Please select a supported image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Photo must be smaller than 10MB');
      return;
    }
    setAttachedFile(file);
    setAttachedPhoto(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmerId) {
      setError('Please select a farmer');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const attachmentIds: string[] = [];
      const attachmentRefs: string[] = [];
      const isOnline = await apiQueue.isCurrentlyOnline();
      if (attachedFile && !isOnline) {
        attachmentRefs.push(await apiQueue.storeOfflineAttachment(attachedFile, selectedFarmerId));
      } else if (attachedFile) {
        const formData = new FormData();
        formData.append('file', attachedFile);
        formData.append('farmerId', selectedFarmerId);
        const uploadResponse = await apiQueue.makeRequest(`${CONFIG.API_BASE_URL}/upload/upload`, {
          method: 'POST',
          body: formData,
        });
        const uploadResult = await uploadResponse.json() as { success?: boolean; data?: { id?: string }; error?: string };
        if (!uploadResponse.ok || !uploadResult.success || !uploadResult.data?.id) {
          throw new Error(uploadResult.error || 'Photo upload failed');
        }
        attachmentIds.push(uploadResult.data.id);
      }

      const payload: Record<string, unknown> = {
        farmerId: selectedFarmerId,
        visit_type: observationType,
        notes,
        scheduled_at: new Date().toISOString(),
        status: 'completed'
      };

      if (attachmentIds.length > 0) {
        payload.attachmentIds = attachmentIds;
      }
      if (attachmentRefs.length > 0) {
        payload.attachmentRefs = attachmentRefs;
      }

      const response = await apiQueue.makeRequest(`${CONFIG.API_BASE_URL}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsSuccess(true);
        setNotes('');
        if (attachedPhoto) URL.revokeObjectURL(attachedPhoto);
        setAttachedPhoto(null);
        setAttachedFile(null);
        setTimeout(() => setIsSuccess(false), 3000);
      } else {
        const result = await response.json();
        if (result.queued) {
          setIsSuccess(true);
          setError('Offline: Visit queued for sync.');
          setNotes('');
          if (attachedPhoto) URL.revokeObjectURL(attachedPhoto);
          setAttachedPhoto(null);
          setAttachedFile(null);
        } else {
          throw new Error('Failed to save visit');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log visit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
          <Clipboard className="w-4 h-4 text-emerald-400" />
        </div>
        <h3 className="text-xs font-black uppercase tracking-widest text-white">Log Farm Visit</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Farmer Selection */}
        <div className="space-y-1.5">
          <label htmlFor="visit-farmer" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Farmer</label>
          <div className="relative">
            <select
              id="visit-farmer"
              value={selectedFarmerId}
              onChange={(e) => setSelectedFarmerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm appearance-none outline-none focus:border-emerald-500 transition-all text-slate-200"
            >
              <option value="">Select Farmer...</option>
              {farmers.map(f => (
                <option key={f.id} value={f.id}>{f.firstName} {f.lastName}</option>
              ))}
            </select>
            <User className="absolute right-3 top-2.5 w-4 h-4 text-slate-600 pointer-events-none" />
          </div>
        </div>

        {/* Observation Type */}
        <div className="space-y-1.5">
          <span id="visit-type-label" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Type</span>
          <div className="grid grid-cols-2 gap-2">
            {['Routine Inspection', 'Pest Outbreak', 'Soil Analysis', 'Growth Check'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setObservationType(type)}
                aria-pressed={observationType === type}
                aria-labelledby="visit-type-label"
                className={`text-[10px] font-black uppercase tracking-tight py-2 rounded-lg border transition-all ${
                  observationType === type 
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label htmlFor="visit-notes" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Observations & Notes</label>
          <textarea
            id="visit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe crop health, pest presence, etc..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm min-h-[80px] outline-none focus:border-emerald-500 transition-all text-slate-200"
          />
        </div>

        {/* Photo Preview */}
        {attachedPhoto && (
          <div className="relative inline-block">
            <img src={attachedPhoto} alt="Attached" className="h-20 rounded-lg border border-slate-700" />
            <button
              type="button"
              onClick={() => setAttachedPhoto(null)}
              aria-label="Remove attached photo"
              className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}

        {/* Hidden file input for photo attachment */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAttachPhoto}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase transition-all"
          >
            <Camera className="w-4 h-4" />
            {attachedPhoto ? 'Change Photo' : 'Attach Photo'}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
              isSuccess ? 'bg-emerald-500 text-white' : 'bg-primary-600 hover:bg-primary-500 text-white'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSubmitting ? 'Saving...' : isSuccess ? 'Logged!' : 'Save Visit'}
          </button>
        </div>

        {error && (
          <p role="alert" className={`text-[10px] font-bold text-center ${error.includes('Offline') ? 'text-orange-400' : 'text-red-400'}`}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
