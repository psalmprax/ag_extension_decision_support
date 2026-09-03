import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Users, Circle, Square, Download } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useWebRTC } from '../hooks/useWebRTC';

interface VideoCallProps {
  roomId: string;
  userId: string;
  userName: string;
  isHost?: boolean;
  onEnd?: () => void;
}

const ErrorState = ({
  error,
  t,
  isHost,
  handleStartCall,
  handleJoinCall,
}: {
  error: string;
  t: (k: string) => string;
  isHost: boolean;
  handleStartCall: () => void;
  handleJoinCall: () => void;
}) => (
  <div className="bg-error-50 border border-error-200 rounded-lg p-4 text-error-700">
    <p className="font-medium">
      {t('common_error')}: {error}
    </p>
    <button
      onClick={isHost ? handleStartCall : handleJoinCall}
      className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
    >
      {t('video_try_again') || 'Try Again'}
    </button>
  </div>
);

const PreCallView = ({
  t,
  participants,
  localStream,
  localVideoRef,
  isHost,
  isJoining,
  handleStartCall,
  handleJoinCall,
}: {
  t: (k: string) => string;
  participants: Record<string, unknown>[];
  localStream: MediaStream | null;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isHost: boolean;
  isJoining: boolean;
  handleStartCall: () => void;
  handleJoinCall: () => void;
}) => (
  <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">
      {t('video_consultation_title') || 'Video Consultation'}
    </h2>

    <div className="space-y-4">
      <div className="flex items-center gap-3 text-gray-600">
        <Users className="w-5 h-5" />
        <span>
          {t('video_participants_count')?.replace(
            '{count}',
            (participants.length + 1).toString()
          ) || `${participants.length + 1} participant(s)`}
        </span>
      </div>

      {!localStream ? (
        <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <Video className="w-12 h-12 mx-auto mb-2" />
            <p>{t('video_camera_preview_hint') || 'Camera will be enabled when you join'}</p>
          </div>
        </div>
      ) : (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="aspect-video bg-gray-100 rounded-lg object-cover"
        />
      )}

      <div className="flex gap-3">
        {isHost ? (
          <button
            onClick={handleStartCall}
            disabled={isJoining}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Phone className="w-5 h-5" />
            {isJoining
              ? t('video_starting') || 'Starting...'
              : t('video_start_call') || 'Start Call'}
          </button>
        ) : (
          <button
            onClick={handleJoinCall}
            disabled={isJoining}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Video className="w-5 h-5" />
            {isJoining ? t('video_joining') || 'Joining...' : t('video_join_call') || 'Join Call'}
          </button>
        )}
      </div>
    </div>
  </div>
);

const LocalVideo = ({
  localStream,
  isVideoEnabled,
  localVideoRef,
  userName,
  t,
  isHost,
}: {
  localStream: MediaStream | null;
  isVideoEnabled: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  userName: string;
  t: (k: string) => string;
  isHost: boolean;
}) => (
  <div className="relative bg-gray-800 rounded-lg overflow-hidden">
    {localStream && isVideoEnabled ? (
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>
    )}
    <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
      {t('video_you') || 'You'} {isHost && `(${t('video_host') || 'Host'})`}
    </div>
  </div>
);

const CallControlButton: React.FC<{
  onClick: () => void;
  title: string;
  active: boolean;
  danger?: boolean;
  pulsing?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, active, danger = false, pulsing = false, children }) => (
  <button
    onClick={onClick}
    title={title}
    className={`p-3 rounded-full ${
      danger || pulsing
        ? 'bg-error-600 hover:bg-error-700 text-white'
        : active
          ? 'bg-gray-700 hover:bg-gray-600 text-white'
          : 'bg-error-600 hover:bg-error-700 text-white'
    } ${pulsing ? 'animate-pulse' : ''}`}
  >
    {children}
  </button>
);

const RecordingBar: React.FC<{ recordedUrl: string; roomId: string; t: (k: string) => string }> = ({
  recordedUrl,
  roomId,
  t,
}) => (
  <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-t border-gray-700">
    <span className="text-gray-400 text-xs">{t('video_recording_ready') || 'Recording ready'}</span>
    <a
      href={recordedUrl}
      download={`consultation-${roomId}-${Date.now()}.webm`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
    >
      <Download className="w-3.5 h-3.5" /> {t('video_download_recording') || 'Download'}
    </a>
  </div>
);

export function VideoCall({ roomId, userId, userName, isHost = false, onEnd }: VideoCallProps) {
  const {
    localStream,
    remoteStreams,
    isInCall,
    isAudioEnabled,
    isVideoEnabled,
    participants,
    startCall,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    endCall,
    error,
    isRecording,
    recordedUrl,
    startRecording,
    stopRecording,
  } = useWebRTC();
  const { t } = useLanguage();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleStartCall = async () => {
    setIsJoining(true);
    await startCall(roomId, userId, userName);
    setIsJoining(false);
  };

  const handleJoinCall = async () => {
    setIsJoining(true);
    await joinCall(roomId, userId, userName);
    setIsJoining(false);
  };

  const handleLeave = () => {
    leaveCall();
    onEnd?.();
  };

  const handleEnd = () => {
    endCall();
    onEnd?.();
  };

  if (error) {
    return (
      <ErrorState
        error={error}
        t={t}
        isHost={isHost}
        handleStartCall={handleStartCall}
        handleJoinCall={handleJoinCall}
      />
    );
  }

  if (!isInCall) {
    return (
      <PreCallView
        t={t}
        participants={participants as unknown as Record<string, unknown>[]}
        localStream={localStream}
        localVideoRef={localVideoRef}
        isHost={isHost}
        isJoining={isJoining}
        handleStartCall={handleStartCall}
        handleJoinCall={handleJoinCall}
      />
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="grid grid-cols-2 gap-2 p-4" style={{ minHeight: '400px' }}>
        <LocalVideo
          localStream={localStream}
          isVideoEnabled={isVideoEnabled}
          localVideoRef={localVideoRef}
          userName={userName}
          t={t}
          isHost={isHost}
        />
        {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
          <RemoteVideo key={peerId} stream={stream} peerId={peerId} />
        ))}
        {remoteStreams.size === 0 && (
          <div className="col-span-2 flex items-center justify-center text-gray-400">
            {t('video_waiting_others') || 'Waiting for others to join...'}
          </div>
        )}
      </div>

      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">
            {t('video_in_call_count')?.replace('{count}', (participants.length + 1).toString()) ||
              `${participants.length + 1} in call`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <CallControlButton
            onClick={toggleAudio}
            title={isAudioEnabled ? t('video_mute') || 'Mute' : t('video_unmute') || 'Unmute'}
            active={isAudioEnabled}
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </CallControlButton>
          <CallControlButton
            onClick={toggleVideo}
            title={
              isVideoEnabled
                ? t('video_camera_off') || 'Turn off camera'
                : t('video_camera_on') || 'Turn on camera'
            }
            active={isVideoEnabled}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </CallControlButton>
          <CallControlButton
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? t('video_stop_recording') || 'Stop recording' : t('video_start_recording') || 'Start recording'}
            active={!isRecording}
            pulsing={isRecording}
          >
            {isRecording ? <Square className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </CallControlButton>
          <CallControlButton onClick={handleEnd} title={t('video_end_call') || 'End call'} active={false} danger>
            <PhoneOff className="w-5 h-5" />
          </CallControlButton>
          {!isHost && (
            <button
              onClick={handleLeave}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              {t('video_leave') || 'Leave'}
            </button>
          )}
        </div>
      </div>
      {recordedUrl && <RecordingBar recordedUrl={recordedUrl} roomId={roomId} t={t} />}
    </div>
  );
}

// Remote Video Component
function RemoteVideo({ stream, peerId }: { stream: MediaStream; peerId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {peerId.slice(0, 8)}
      </div>
    </div>
  );
}

export default VideoCall;
