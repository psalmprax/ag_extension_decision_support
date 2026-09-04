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
  isHost,
  isJoining,
  handleStartCall,
  handleJoinCall,
}: {
  t: (k: string) => string;
  participants: Record<string, unknown>[];
  localStream: MediaStream | null;
  isHost: boolean;
  isJoining: boolean;
  handleStartCall: () => void;
  handleJoinCall: () => void;
}) => {
  const previewRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (previewRef.current && localStream) {
      if (previewRef.current.srcObject !== localStream) {
        previewRef.current.srcObject = localStream;
      }
      previewRef.current.play().catch(() => {});
    }
  }, [localStream]);

  return (
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
            ref={el => {
              previewRef.current = el;
              if (el && localStream && el.srcObject !== localStream) {
                el.srcObject = localStream;
                el.play().catch(() => {});
              }
            }}
            autoPlay
            muted
            playsInline
            className="aspect-video bg-gray-100 rounded-lg object-cover w-full"
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
};

const LocalVideo = ({
  localStream,
  isVideoEnabled,
  userName,
  t,
  isHost,
}: {
  localStream: MediaStream | null;
  isVideoEnabled: boolean;
  userName: string;
  t: (k: string) => string;
  isHost: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && localStream) {
      if (videoRef.current.srcObject !== localStream) {
        videoRef.current.srcObject = localStream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoEnabled]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video w-full flex items-center justify-center border border-gray-700/50 shadow-md">
      {localStream && isVideoEnabled ? (
        <video
          ref={el => {
            videoRef.current = el;
            if (el && localStream && el.srcObject !== localStream) {
              el.srcObject = localStream;
              el.play().catch(() => {});
            }
          }}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
          <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md mb-2">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-gray-400">Camera is off</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 shadow">
        <span className={`w-2 h-2 rounded-full ${isVideoEnabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <span>{t('video_you') || 'You'}</span>
        {isHost && <span className="text-emerald-400 font-semibold">({t('video_host') || 'Host'})</span>}
      </div>
    </div>
  );
};

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

// eslint-disable-next-line sonarjs/cognitive-complexity
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

  const [isJoining, setIsJoining] = useState(false);

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
        isHost={isHost}
        isJoining={isJoining}
        handleStartCall={handleStartCall}
        handleJoinCall={handleJoinCall}
      />
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 min-h-[400px] items-center">
        <LocalVideo
          localStream={localStream}
          isVideoEnabled={isVideoEnabled}
          userName={userName}
          t={t}
          isHost={isHost}
        />
        {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
          <RemoteVideo key={peerId} stream={stream} peerId={peerId} />
        ))}
        {remoteStreams.size === 0 && (
          <div className="relative bg-gray-800/80 border border-dashed border-gray-700/80 rounded-lg overflow-hidden aspect-video w-full flex flex-col items-center justify-center p-6 text-center shadow-inner">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 animate-pulse">
              <Users className="w-7 h-7" />
            </div>
            <p className="text-white font-semibold text-sm sm:text-base">
              {t('video_waiting_others') || 'Waiting for others to join...'}
            </p>
            <p className="text-xs text-gray-400 mt-1.5 max-w-xs leading-relaxed">
              {isHost
                ? 'Your video feed is live. The participant will appear here as soon as they connect.'
                : 'Waiting for the host or other participants to join...'}
            </p>
            <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 bg-gray-900/80 rounded-md text-xxs font-mono text-gray-300 border border-gray-700/80 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Room: {roomId}
            </div>
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
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video w-full flex items-center justify-center border border-gray-700/50 shadow-md">
      <video
        ref={el => {
          videoRef.current = el;
          if (el && stream && el.srcObject !== stream) {
            el.srcObject = stream;
            el.play().catch(() => {});
          }
        }}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 shadow">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{peerId.slice(0, 8)}</span>
      </div>
    </div>
  );
}

export default VideoCall;
