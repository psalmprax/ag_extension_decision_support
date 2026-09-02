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
  isRecording: boolean;
  recordedUrl: string | null;
  startRecording: () => void;
  stopRecording: () => void;
}

export function useWebRTC(): UseWebRTCReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isInCall, setIsInCall] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const currentRoomRef = useRef<string | null>(null);
  const currentUserRef = useRef<{ id: string; name: string } | null>(null);

  const buildIceServers = () => {
    const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
    const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined;
    const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
    const allowPublicFallback = import.meta.env.VITE_ALLOW_PUBLIC_TURN === 'true';
    const servers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    if (turnUrl && turnUser && turnCred) {
      servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
    } else if (allowPublicFallback) {
      // Explicit opt-in only: public TURN for dev/preview NAT traversal
      servers.push({
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      });
    }
    return { iceServers: servers };
  };
  const ICE_SERVERS = buildIceServers();

  const removePeer = (peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(peerId);
      return newMap;
    });
  };

  const handleRemoteOffer = async (
    socket: Socket,
    data: { offer: RTCSessionDescriptionInit; from: string }
  ) => {
    try {
      const pc = await createPeerConnection(data.from, false);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', {
        roomId: currentRoomRef.current,
        answer,
        from: currentUserRef.current?.id,
      });
    } catch (e) {
      console.warn('Failed to handle offer:', e);
    }
  };

  const handleRemoteAnswer = async (data: { answer: RTCSessionDescriptionInit; from: string }) => {
    try {
      const pc = peerConnectionsRef.current.get(data.from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    } catch (e) {
      console.warn('Failed to handle answer:', e);
    }
  };

  const handleRemoteIce = async (data: { candidate: RTCIceCandidateInit; from: string }) => {
    try {
      const pc = peerConnectionsRef.current.get(data.from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (e) {
      console.warn('Failed to add ICE candidate:', e);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      // Backend socket.io middleware requires a valid JWT — resolve it lazily so
      // the token is current when the socket (re)connects.
      auth: cb => cb({ token: localStorage.getItem('token') || undefined }),
    });

    socket.on('connect', () => {
      if (isMounted) {
        // Socket connected — ready for WebRTC signaling
      }
    });
    socket.on('connect_error', err => {
      if (isMounted) {
        console.warn('Socket connection error:', err.message);
      }
    });
    socket.on('user-joined', async (data: { userId: string }) => {
      await createPeerConnection(data.userId, true);
    });
    socket.on('user-left', (data: { userId: string }) => removePeer(data.userId));
    socket.on('call-ended', () => leaveCall());
    socket.on('offer', (data: { offer: RTCSessionDescriptionInit; from: string }) => handleRemoteOffer(socket, data));
    socket.on('answer', (data: { answer: RTCSessionDescriptionInit; from: string }) => handleRemoteAnswer(data));
    socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit; from: string }) => handleRemoteIce(data));

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

  const createPeerConnection = async (
    peerId: string,
    createOffer: boolean
  ): Promise<RTCPeerConnection> => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', {
          roomId: currentRoomRef.current,
          candidate: event.candidate.toJSON(),
          from: currentUserRef.current?.id,
        });
      }
    };

    pc.ontrack = event => {
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(peerId, event.streams[0]);
        return newMap;
      });
    };

    if (localStream) {
      localStream.getTracks().forEach(track => {
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

  const startCall = useCallback(
    async (roomId: string, userId: string, userName: string) => {
      try {
        setError(null);
        currentRoomRef.current = roomId;
        currentUserRef.current = { id: userId, name: userName };

        if (!navigator.mediaDevices?.getUserMedia) {
          setError(
            'Video calls require HTTPS. Please access the dashboard via https:// or use localhost for testing.'
          );
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);

        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect();
        }

        socketRef.current?.emit('register', userId);

        socketRef.current?.emit(
          'create-room',
          { userId, userName, roomId },
          (response: { roomId: string; success: boolean; error?: string }) => {
            if (response.success) {
              setIsInCall(true);
            } else {
              setError(response.error || 'Could not start the call. Please try again.');
            }
          }
        );
      } catch (err: unknown) {
        setError((err as Error).message);
      }
    },
    []
  );

  const joinCall = useCallback(async (roomId: string, userId: string, userName: string) => {
    try {
      setError(null);
      currentRoomRef.current = roomId;
      currentUserRef.current = { id: userId, name: userName };

      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          'Video calls require HTTPS. Please access the dashboard via https:// or use localhost for testing.'
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);

      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }

      socketRef.current?.emit('register', userId);

      socketRef.current?.emit(
        'join-room',
        { roomId, userId, userName },
        (response: { success: boolean; participants?: Participant[]; error?: string }) => {
          if (response.success) {
            setParticipants(response.participants || []);
            setIsInCall(true);
          } else {
            setError(
              response.error === 'Room not found or inactive'
                ? 'This call is not active yet. Ask your extension officer to start the call, then tap Join again.'
                : response.error || 'Could not join the call. Please try again.'
            );
          }
        }
      );
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }, []);

  const leaveCall = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { }
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    if (socketRef.current && currentRoomRef.current && currentUserRef.current) {
      socketRef.current.emit('leave-room', {
        roomId: currentRoomRef.current,
        userId: currentUserRef.current.id,
      });
      socketRef.current.disconnect();
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

  const startRecording = useCallback(() => {
    if (!localStream || isRecording) return;
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const mr = new MediaRecorder(localStream, { mimeType });
      recordedChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
        setIsRecording(false);
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordedUrl(null);
    } catch (e) { setError((e as Error).message); }
  }, [localStream, isRecording]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
    else setIsRecording(false);
  }, []);

  // Bandwidth adaptation logging: poll getStats every 8s while in call (top-notch observability)
  useEffect(() => {
    if (!isInCall) return;
    const id = setInterval(() => {
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        pc.getStats().then(stats => {
          let inboundBytes = 0; let rtt: number | null = null;
          (stats as unknown as Map<string, unknown>).forEach((value: unknown) => {
            const rec = value as Record<string, unknown>;
            if (rec.type === 'inbound-rtp' && typeof rec.bytesReceived === 'number') inboundBytes = rec.bytesReceived as number;
            if (rec.type === 'candidate-pair' && rec.state === 'succeeded' && typeof rec.currentRoundTripTime === 'number') rtt = rec.currentRoundTripTime as number;
          });
          if (inboundBytes || rtt !== null) console.debug(`[webrtc stats] peer ${peerId.slice(0,8)} bytes=${inboundBytes} rtt=${rtt}`);
        }).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(id);
  }, [isInCall]);

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
    isRecording,
    recordedUrl,
    startRecording,
    stopRecording,
  };
}
