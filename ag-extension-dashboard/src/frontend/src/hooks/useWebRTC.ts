import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface Participant {
    id: string;
    socketId: string;
    name: string;
}

interface UseWebRTCReturn {
    localStream: MediaStream | null;
    remoteStreams: Map<string, MediaStream>;
    isInCall: boolean;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    participants: Participant[];
    startCall: (roomId: string, userId: string, userName: string) => Promise<void>;
    joinCall: (roomId: string, userId: string, userName: string) => Promise<void>;
    leaveCall: () => void;
    toggleAudio: () => void;
    toggleVideo: () => void;
    endCall: () => void;
    error: string | null;
}

export function useWebRTC(): UseWebRTCReturn {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [isInCall, setIsInCall] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [error, setError] = useState<string | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const currentRoomRef = useRef<string | null>(null);
    const currentUserRef = useRef<{ id: string; name: string } | null>(null);

    const ICE_SERVERS = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    useEffect(() => {
        let isMounted = true;
        
        const socket = io(window.location.origin, {
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            if (isMounted) {
                // Socket connected — ready for WebRTC signaling
            }
        });

        socket.on('connect_error', () => {
            // Connection errors are expected when backend is unavailable
        });

        socket.on('user-joined', async (data: { userId: string; userName: string }) => {
            await createPeerConnection(data.userId, true);
        });

        socket.on('user-left', (data: { userId: string }) => {
            const pc = peerConnectionsRef.current.get(data.userId);
            if (pc) {
                pc.close();
                peerConnectionsRef.current.delete(data.userId);
            }
            setRemoteStreams((prev) => {
                const newMap = new Map(prev);
                newMap.delete(data.userId);
                return newMap;
            });
        });

        socket.on('offer', async (data: { offer: RTCSessionDescriptionInit; from: string }) => {
            const pc = await createPeerConnection(data.from, false);
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { roomId: currentRoomRef.current, answer, from: currentUserRef.current?.id });
        });

        socket.on('answer', async (data: { answer: RTCSessionDescriptionInit; from: string }) => {
            const pc = peerConnectionsRef.current.get(data.from);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
        });

        socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit; from: string }) => {
            const pc = peerConnectionsRef.current.get(data.from);
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });

        socket.on('audio-toggled', (_data: { userId: string; enabled: boolean }) => {
            // Remote peer audio state updated
        });

        socket.on('video-toggled', (_data: { userId: string; enabled: boolean }) => {
            // Remote peer video state updated
        });

        socket.on('call-ended', () => {
            leaveCall();
        });

        socketRef.current = socket;

        return () => {
            isMounted = false;
            // Only close if socket is fully connected to avoid "closed before established" errors
            if (socket.connected) {
                socket.close();
            }
            // If not connected, let it fail silently - don't call close/disconnect
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createPeerConnection = async (peerId: string, createOffer: boolean): Promise<RTCPeerConnection> => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('ice-candidate', {
                    roomId: currentRoomRef.current,
                    candidate: event.candidate.toJSON(),
                    from: currentUserRef.current?.id,
                });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStreams((prev) => {
                const newMap = new Map(prev);
                newMap.set(peerId, event.streams[0]);
                return newMap;
            });
        };

        if (localStream) {
            localStream.getTracks().forEach((track) => {
                pc.addTrack(track, localStream);
            });
        }

        peerConnectionsRef.current.set(peerId, pc);

        if (createOffer) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('offer', {
                roomId: currentRoomRef.current,
                offer: pc.localDescription,
                from: currentUserRef.current?.id,
            });
        }

        return pc;
    };

    const startCall = useCallback(async (roomId: string, userId: string, userName: string) => {
        try {
            setError(null);
            currentRoomRef.current = roomId;
            currentUserRef.current = { id: userId, name: userName };

            if (!navigator.mediaDevices?.getUserMedia) {
                setError('Video calls require HTTPS. Please access the dashboard via https:// or use localhost for testing.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            setLocalStream(stream);

            socketRef.current?.emit('register', userId);

            socketRef.current?.emit('create-room', { userId, userName }, (response: { roomId: string; success: boolean }) => {
                if (response.success) {
                    setIsInCall(true);
                }
            });
        } catch (err: unknown) {
            setError((err as Error).message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localStream]);

    const joinCall = useCallback(async (roomId: string, userId: string, userName: string) => {
        try {
            setError(null);
            currentRoomRef.current = roomId;
            currentUserRef.current = { id: userId, name: userName };

            if (!navigator.mediaDevices?.getUserMedia) {
                setError('Video calls require HTTPS. Please access the dashboard via https:// or use localhost for testing.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            setLocalStream(stream);

            socketRef.current?.emit('register', userId);

            socketRef.current?.emit('join-room', { roomId, userId, userName }, (response: { success: boolean; participants: Participant[] }) => {
                if (response.success) {
                    setParticipants(response.participants);
                    setIsInCall(true);
                }
            });
        } catch (err: unknown) {
            setError((err as Error).message);
        }
    }, []);

    const leaveCall = useCallback(() => {
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            setLocalStream(null);
        }

        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();

        if (socketRef.current && currentRoomRef.current && currentUserRef.current) {
            socketRef.current.emit('leave-room', {
                roomId: currentRoomRef.current,
                userId: currentUserRef.current.id,
            });
        }

        setRemoteStreams(new Map());
        setParticipants([]);
        setIsInCall(false);
        currentRoomRef.current = null;
    }, [localStream]);

    const toggleAudio = useCallback(() => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
                socketRef.current?.emit('toggle-audio', {
                    roomId: currentRoomRef.current,
                    userId: currentUserRef.current?.id,
                    enabled: audioTrack.enabled,
                });
            }
        }
    }, [localStream]);

    const toggleVideo = useCallback(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
                socketRef.current?.emit('toggle-video', {
                    roomId: currentRoomRef.current,
                    userId: currentUserRef.current?.id,
                    enabled: videoTrack.enabled,
                });
            }
        }
    }, [localStream]);

    const endCall = useCallback(() => {
        if (socketRef.current && currentRoomRef.current && currentUserRef.current) {
            socketRef.current.emit('end-call', {
                roomId: currentRoomRef.current,
                userId: currentUserRef.current.id,
            });
        }
        leaveCall();
    }, [leaveCall]);

    return {
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
    };
}
