import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  CheckCircle,
  UserCheck,
  MapPin,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { createVisit } from '@/api/visitService';
import toast from 'react-hot-toast';

interface InlineVisitBookingCardProps {
  farmerName: string;
  farmerPhone: string;
  issue: string;
  region?: string;
  /** Live farmer UUID — required to persist the visit; omit only in demo mode. */
  farmerId?: string;
  onBooked?: (slot: string) => void;
}

const SLOTS = [
  { label: 'Tomorrow 09:00 AM', dayOffset: 1, hour: 9, minute: 0 },
  { label: 'Tomorrow 02:30 PM', dayOffset: 1, hour: 14, minute: 30 },
  { label: 'Friday 10:00 AM', weekday: 5, hour: 10, minute: 0 },
  { label: 'Saturday 08:30 AM', weekday: 6, hour: 8, minute: 30 },
] as const;

function slotToScheduledAt(slot: (typeof SLOTS)[number]): string {
  const base = new Date();
  if ('dayOffset' in slot) {
    base.setDate(base.getDate() + slot.dayOffset);
  } else {
    const daysAhead = (slot.weekday - base.getDay() + 7) % 7 || 7;
    base.setDate(base.getDate() + daysAhead);
  }
  base.setHours(slot.hour, slot.minute, 0, 0);
  return base.toISOString();
}

export const InlineVisitBookingCard: React.FC<InlineVisitBookingCardProps> = ({
  farmerName,
  farmerPhone,
  issue,
  region = 'Nakuru County',
  farmerId,
  onBooked,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<string>(SLOTS[0].label);
  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [isBooked, setIsBooked] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const handleConfirm = async () => {
    const slot = SLOTS.find(s => s.label === selectedSlot) || SLOTS[0];
    setBookingError(null);

    if (!farmerId) {
      // Demo mode: no live farmer id exists, so there is nothing to persist.
      setIsBooked(true);
      onBooked?.(selectedSlot);
      return;
    }

    setIsBooking(true);
    try {
      const result = await createVisit({
        farmerId,
        visitType: 'follow-up',
        scheduledAt: slotToScheduledAt(slot),
        notes: `Auto-booked from triage stream — severity issue: ${issue}`,
      });
      if (!result.success) {
        throw new Error('Visit booking was rejected by the server');
      }
      setIsBooked(true);
      toast.success(`Visit scheduled for ${farmerName} — ${selectedSlot}`);
      onBooked?.(selectedSlot);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule visit';
      setBookingError(message);
      toast.error(message);
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 shadow-md backdrop-blur-md space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span>Priority Field Visit Recommendation</span>
        </div>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
          URGENT TRIAGE
        </span>
      </div>

      <p className="text-[11px] text-slate-300">
        High severity detected for <strong className="text-white">{farmerName}</strong> ({issue}). Auto-schedule an on-site extension inspection:
      </p>

      {!isBooked ? (
        <div className="space-y-2.5">
          {/* Time Slot Selector Pills */}
          <div className="grid grid-cols-2 gap-1.5">
            {SLOTS.map(slot => (
              <button
                key={slot.label}
                type="button"
                onClick={() => setSelectedSlot(slot.label)}
                disabled={isBooking}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium transition-all text-left flex items-center gap-1.5 disabled:opacity-50 ${
                  selectedSlot === slot.label
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">{slot.label}</span>
              </button>
            ))}
          </div>

          {bookingError && (
            <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2.5 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{bookingError}</span>
            </div>
          )}

          {/* Location details & Action Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate">{region}</span>
            </span>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isBooking}
              className="w-full sm:w-auto justify-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-950 flex items-center gap-1.5"
            >
              {isBooking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Scheduling…
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  Book &amp; Dispatch Itinerary
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold">Visit Scheduled for {selectedSlot}</span>
              <p className="text-[10px] text-slate-400">
                {farmerId
                  ? `Saved to the visit calendar — SMS notification sent to ${farmerPhone}`
                  : `Demo mode — booking not saved. Sign in with a live account to schedule for ${farmerPhone}`}
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
            CONFIRMED
          </span>
        </motion.div>
      )}
    </div>
  );
};
