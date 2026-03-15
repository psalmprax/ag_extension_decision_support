import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Users } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useWebRTC } from '../hooks/useWebRTC';

interface VideoCallProps {
    roomId: string;
    userId: string;
    userName: string;
    isHost?: boolean;
    onEnd?: () => void;
}

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
            <div className="bg-error-50 border border-error-200 rounded-lg p-4 text-error-700">
                <p className="font-medium">{t('common_error')}: {error}</p>
                <button
                    onClick={isHost ? handleStartCall : handleJoinCall}
                    className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                    {t('video_try_again') || 'Try Again'}
                </button>
            </div>
        );
    }

    if (!isInCall) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('video_consultation_title') || 'Video Consultation'}</h2>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-gray-600">
                        <Users className="w-5 h-5" />
                        <span>{t('video_participants_count')?.replace('{count}', (participants.length + 1).toString()) || `${participants.length + 1} participant(s)`}</span>
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
                                {isJoining ? (t('video_starting') || 'Starting...') : (t('video_start_call') || 'Start Call')}
                            </button>
                        ) : (
                            <button
                                onClick={handleJoinCall}
                                disabled={isJoining}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                            >
                                <Video className="w-5 h-5" />
                                {isJoining ? (t('video_joining') || 'Joining...') : (t('video_join_call') || 'Join Call')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
            {/* Remote Video Grid */}
            <div className="grid grid-cols-2 gap-2 p-4" style={{ minHeight: '400px' }}>
                {/* Local Video */}
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

                {/* Remote Videos */}
                {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
                    <RemoteVideo key={peerId} stream={stream} peerId={peerId} />
                ))}

                {remoteStreams.size === 0 && (
                    <div className="col-span-2 flex items-center justify-center text-gray-400">
                        {t('video_waiting_others') || 'Waiting for others to join...'}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">
                        {t('video_in_call_count')?.replace('{count}', (participants.length + 1).toString()) || `${participants.length + 1} in call`}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Audio Toggle */}
                    <button
                        onClick={toggleAudio}
                        className={`p-3 rounded-full ${isAudioEnabled
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-error-600 hover:bg-error-700 text-white'
                            }`}
                        title={isAudioEnabled ? (t('video_mute') || 'Mute') : (t('video_unmute') || 'Unmute')}
                    >
                        {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    </button>

                    {/* Video Toggle */}
                    <button
                        onClick={toggleVideo}
                        className={`p-3 rounded-full ${isVideoEnabled
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-error-600 hover:bg-error-700 text-white'
                            }`}
                        title={isVideoEnabled ? (t('video_camera_off') || 'Turn off camera') : (t('video_camera_on') || 'Turn on camera')}
                    >
                        {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    </button>

                    {/* End Call */}
                    <button
                        onClick={handleEnd}
                        className="p-3 rounded-full bg-error-600 hover:bg-error-700 text-white"
                        title={t('video_end_call') || 'End call'}
                    >
                        <PhoneOff className="w-5 h-5" />
                    </button>

                    {/* Leave (for non-host) */}
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
        </div>
    );
}

// Remote Video Component
function RemoteVideo({ stream }: { stream: MediaStream; peerId: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                Participant
            </div>
        </div>
    );
}

export default VideoCall;
