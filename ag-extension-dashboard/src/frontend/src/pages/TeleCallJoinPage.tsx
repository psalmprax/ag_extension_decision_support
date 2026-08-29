import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { Video, AlertCircle } from 'lucide-react';
import { VideoCall } from '@/components/VideoCall';
import { useAppStore } from '@/store/useAppStore';

const ROOM_ID_PATTERN = /^[a-zA-Z0-9-]{6,64}$/;

/**
 * Farmer-facing entry point for tele-agronomy calls. The extension officer
 * shares an invite link of the form /tele-call/<roomId>; the farmer opens it,
 * signs in if needed, and joins the live WebRTC room as a guest.
 */
export function TeleCallJoinPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const user = useAppStore(s => s.user);

  if (!roomId || !ROOM_ID_PATTERN.test(roomId)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-base font-bold text-white">Invalid call link</h1>
          <p className="text-xs text-slate-400">
            This tele-agronomy link is malformed. Please ask your extension officer to share the
            invite link again.
          </p>
        </div>
      </div>
    );
  }

  // Socket signaling requires an authenticated session; farmers sign in with
  // their own account, then return straight back to this join screen.
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-emerald-500/40 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white">Tele-Agronomy Consultation</h1>
            <p className="text-xs text-slate-400">
              Joining as {user.firstName} {user.lastName} · Room {roomId}
            </p>
          </div>
        </div>
        <div className="p-4">
          <VideoCall
            roomId={roomId}
            userId={user.id}
            userName={`${user.firstName} ${user.lastName}`.trim() || 'Farmer'}
            isHost={false}
          />
        </div>
      </div>
    </div>
  );
}

export default TeleCallJoinPage;
