import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

type Handler = (...args: unknown[]) => unknown;

// socket.io is mocked at module level so the hook's mount-time signalling
// handlers can be driven directly, with no real network or timers.
const io = vi.hoisted(() => {
  const handlers = new Map<string, Handler>();
  const emit = vi.fn();
  const connect = vi.fn();
  const disconnect = vi.fn();
  const close = vi.fn();
  const socket = {
    connected: false,
    on: vi.fn((event: string, cb: Handler) => {
      handlers.set(event, cb);
      return socket;
    }),
    emit,
    connect,
    disconnect,
    close,
  };
  return { handlers, socket, factory: vi.fn(() => socket) };
});

vi.mock('socket.io-client', () => ({ io: io.factory }));

import { useWebRTC } from '@/hooks/useWebRTC';

class MockRTCPeerConnection {
  static instances: MockRTCPeerConnection[] = [];
  onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
  ontrack: ((event: { streams: unknown[] }) => void) | null = null;
  localDescription: unknown = null;
  closed = false;

  constructor(public config: unknown) {
    MockRTCPeerConnection.instances.push(this);
  }

  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'offer-sdp' }));
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'answer-sdp' }));
  setLocalDescription = vi.fn(async (description: unknown) => {
    this.localDescription = description;
  });
  setRemoteDescription = vi.fn(async () => undefined);
  addIceCandidate = vi.fn(async () => undefined);
  addTrack = vi.fn();
  getSenders = vi.fn<() => Array<Record<string, unknown>>>(() => []);
  getStats = vi.fn(async () => new Map<string, unknown>());
  close = vi.fn(() => {
    this.closed = true;
  });
}

class MockRTCSessionDescription {
  constructor(public init: unknown) {}
}

class MockRTCIceCandidate {
  constructor(public init: unknown) {}
}

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn(() => {
    this.state = 'recording';
  });
  stop = vi.fn(() => {
    this.state = 'inactive';
    this.onstop?.();
  });
  constructor(public stream: unknown, public options: unknown) {}
}

const trackStop = vi.fn();
const audioTrack = { kind: 'audio', enabled: true, stop: trackStop };
const videoTrack = { kind: 'video', enabled: true, stop: trackStop };
const mockStream = {
  getTracks: () => [audioTrack, videoTrack],
  getAudioTracks: () => [audioTrack],
  getVideoTracks: () => [videoTrack],
};

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

function useMediaStreams(getUserMedia: ((constraints: unknown) => Promise<unknown>) | null) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: getUserMedia ? { getUserMedia } : undefined,
    configurable: true,
    writable: true,
  });
}

function lastEmit(event: string): unknown[] {
  const call = [...io.socket.emit.mock.calls].reverse().find(([name]) => name === event);
  return call ? (call as unknown[]) : [];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  MockRTCPeerConnection.instances = [];
  io.socket.connected = false;
  io.factory.mockReturnValue(io.socket);
  audioTrack.enabled = true;
  videoTrack.enabled = true;

  vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection);
  vi.stubGlobal('RTCSessionDescription', MockRTCSessionDescription);
  vi.stubGlobal('RTCIceCandidate', MockRTCIceCandidate);
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  URL.createObjectURL = vi.fn(() => 'blob:recording');
  URL.revokeObjectURL = vi.fn();
  useMediaStreams(async () => mockStream);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalMediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  } else {
    Reflect.deleteProperty(navigator, 'mediaDevices');
  }
});

/** Runs startCall and completes the create-room acknowledgement. */
async function startCall(
  hook: { current: ReturnType<typeof useWebRTC> },
  ack: { success: boolean; error?: string } = { success: true }
) {
  await act(async () => {
    await hook.current.startCall('room-1', 'user-1', 'Officer Amina');
  });
  const emitCall = lastEmit('create-room');
  const respond = emitCall[2] as (response: unknown) => void;
  act(() => respond({ roomId: 'room-1', ...ack }));
}

describe('useWebRTC call setup', () => {
  it('refuses to start without a camera API and explains the HTTPS requirement', async () => {
    useMediaStreams(null);
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.startCall('room-1', 'user-1', 'Officer');
    });

    expect(result.current.error).toMatch(/require HTTPS/);
    expect(result.current.isInCall).toBe(false);
    expect(io.socket.emit).not.toHaveBeenCalled();
  });

  it('captures the device, registers and enters the room on start', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result, { success: true });

    expect(result.current.localStream).toBe(mockStream);
    expect(io.socket.connect).toHaveBeenCalled();
    expect(lastEmit('register')[1]).toBe('user-1');
    expect(result.current.isInCall).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('surfaces the server refusal when the room cannot be created', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result, { success: false, error: 'Room already in use' });

    expect(result.current.isInCall).toBe(false);
    expect(result.current.error).toBe('Room already in use');
  });

  it('falls back to a readable message when the refusal has no reason', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result, { success: false });

    expect(result.current.error).toBe('Could not start the call. Please try again.');
  });

  it('releases the capture device when getUserMedia fails', async () => {
    useMediaStreams(async () => {
      throw new Error('Permission denied');
    });
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.startCall('room-1', 'user-1', 'Officer');
    });

    expect(result.current.error).toBe('Permission denied');
    expect(result.current.localStream).toBeNull();
  });

  it('joins an existing call and stores the participant list', async () => {
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.joinCall('room-1', 'user-1', 'Officer');
    });
    const respond = lastEmit('join-room')[2] as (response: unknown) => void;
    act(() =>
      respond({
        success: true,
        participants: [{ id: 'p1', socketId: 's1', name: 'Grace' }],
      })
    );

    expect(result.current.isInCall).toBe(true);
    expect(result.current.participants).toEqual([{ id: 'p1', socketId: 's1', name: 'Grace' }]);
  });

  it('explains that a call is not active yet instead of showing a raw server code', async () => {
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.joinCall('room-1', 'user-1', 'Officer');
    });
    const respond = lastEmit('join-room')[2] as (response: unknown) => void;
    act(() => respond({ success: false, error: 'Room not found or inactive' }));

    expect(result.current.error).toMatch(/not active yet/);
    expect(result.current.isInCall).toBe(false);
  });
});

describe('useWebRTC controls', () => {
  it('toggles the microphone track and broadcasts the change', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result);

    act(() => result.current.toggleAudio());
    expect(audioTrack.enabled).toBe(false);
    expect(result.current.isAudioEnabled).toBe(false);
    expect(lastEmit('toggle-audio')[1]).toMatchObject({ enabled: false });

    act(() => result.current.toggleAudio());
    expect(audioTrack.enabled).toBe(true);
    expect(result.current.isAudioEnabled).toBe(true);
  });

  it('toggles the camera track and broadcasts the change', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result);

    act(() => result.current.toggleVideo());
    expect(videoTrack.enabled).toBe(false);
    expect(result.current.isVideoEnabled).toBe(false);
    expect(lastEmit('toggle-video')[1]).toMatchObject({ enabled: false });
  });

  it('leaves the room, stops the device and drops peer connections', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result);

    act(() => result.current.leaveCall());

    expect(trackStop).toHaveBeenCalled();
    expect(result.current.localStream).toBeNull();
    expect(result.current.isInCall).toBe(false);
    expect(result.current.participants).toEqual([]);
    expect(lastEmit('leave-room')).not.toHaveLength(0);
    expect(io.socket.disconnect).toHaveBeenCalled();
  });

  it('ends the call for everyone before tearing down locally', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result);

    act(() => result.current.endCall());

    expect(lastEmit('end-call')).not.toHaveLength(0);
    expect(result.current.isInCall).toBe(false);
  });

  it('tears the call down when a remote peer ends it', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result);

    await act(async () => {
      await io.handlers.get('call-ended')?.();
    });

    expect(result.current.isInCall).toBe(false);
    expect(trackStop).toHaveBeenCalled();
  });

  it('releases the camera and microphone on unmount without pressing End', async () => {
    const { result, unmount } = renderHook(() => useWebRTC());
    await startCall(result);

    unmount();

    expect(trackStop).toHaveBeenCalled();
  });
});

describe('useWebRTC peer connections', () => {
  it('offers to a peer that joins and attaches the local tracks', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result);

    await act(async () => {
      await io.handlers.get('user-joined')?.({ userId: 'peer-1' });
    });

    const pc = MockRTCPeerConnection.instances[0];
    expect(pc).toBeDefined();
    expect(pc.addTrack).toHaveBeenCalledTimes(2);
    expect(lastEmit('offer')[1]).toMatchObject({ from: 'user-1' });
    expect(result.current.isInCall).toBe(true);
  });

  it('drops a peer stream when the peer leaves', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result);
    await act(async () => {
      await io.handlers.get('user-joined')?.({ userId: 'peer-1' });
    });

    await act(async () => {
      await io.handlers.get('user-left')?.({ userId: 'peer-1' });
    });

    expect(MockRTCPeerConnection.instances[0].closed).toBe(true);
    expect(result.current.remoteStreams.size).toBe(0);
  });

  it('lowers the video bitrate when round-trip time degrades', async () => {
    const setParameters = vi.fn(async () => undefined);
    // A real RTCRtpSender returns the same mutable parameters object on every
    // read; a fresh literal would hide the write the adapter makes.
    const params = { encodings: [{}] as Array<{ maxBitrate?: number }> };
    const sender = {
      track: { kind: 'video' },
      getParameters: () => params,
      setParameters,
    };

    const { result } = renderHook(() => useWebRTC());
    await startCall(result);
    await act(async () => {
      await io.handlers.get('user-joined')?.({ userId: 'peer-1' });
    });

    const pc = MockRTCPeerConnection.instances[0];
    pc.getSenders.mockReturnValue([sender]);
    pc.getStats.mockResolvedValue(
      new Map<string, unknown>([
        ['in', { type: 'inbound-rtp', bytesReceived: 4096 }],
        ['pair', { type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.5 }],
      ])
    );

    await act(async () => {
      vi.advanceTimersByTime(8000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(pc.getStats).toHaveBeenCalled();
    expect(setParameters).toHaveBeenCalled();
    expect(params.encodings[0].maxBitrate).toBe(300000);
  });

  it('restores full bitrate once round-trip time recovers', async () => {
    const setParameters = vi.fn(async () => undefined);
    const params = { encodings: [{ maxBitrate: 300000 }] };
    const sender = {
      track: { kind: 'video' },
      getParameters: () => params,
      setParameters,
    };

    const { result } = renderHook(() => useWebRTC());
    await startCall(result);
    await act(async () => {
      await io.handlers.get('user-joined')?.({ userId: 'peer-2' });
    });

    const pc = MockRTCPeerConnection.instances[0];
    pc.getSenders.mockReturnValue([sender]);
    pc.getStats.mockResolvedValue(
      new Map<string, unknown>([
        ['pair', { type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.05 }],
      ])
    );

    await act(async () => {
      vi.advanceTimersByTime(8000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(params.encodings[0].maxBitrate).toBe(800000);
  });

  it('leaves a mid-range bitrate alone', async () => {
    const setParameters = vi.fn(async () => undefined);
    const sender = {
      track: { kind: 'video' },
      getParameters: () => ({ encodings: [{}] }),
      setParameters,
    };

    const { result } = renderHook(() => useWebRTC());
    await startCall(result);
    await act(async () => {
      await io.handlers.get('user-joined')?.({ userId: 'peer-3' });
    });

    const pc = MockRTCPeerConnection.instances[0];
    pc.getSenders.mockReturnValue([sender]);
    pc.getStats.mockResolvedValue(
      new Map<string, unknown>([
        ['pair', { type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.2 }],
      ])
    );

    await act(async () => {
      vi.advanceTimersByTime(8000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(pc.getStats).toHaveBeenCalled();
    expect(setParameters).not.toHaveBeenCalled();
  });
});

describe('useWebRTC recording', () => {
  it('records the local stream and exposes a playable blob URL', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result);

    act(() => result.current.startRecording());
    expect(result.current.isRecording).toBe(true);
    expect(MockMediaRecorder.isTypeSupported).toHaveBeenCalledWith('video/webm;codecs=vp9');

    act(() => result.current.stopRecording());

    expect(result.current.isRecording).toBe(false);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(result.current.recordedUrl).toBe('blob:recording');
  });

  it('does not start a second recording while one is running', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result);

    act(() => result.current.startRecording());
    const firstUrl = result.current.recordedUrl;
    act(() => result.current.startRecording());

    expect(result.current.isRecording).toBe(true);
    expect(result.current.recordedUrl).toBe(firstUrl);
  });

  it('resets the recording flag when stopping without an active recorder', async () => {
    const { result } = renderHook(() => useWebRTC());
    await startCall(result);

    act(() => result.current.stopRecording());
    expect(result.current.isRecording).toBe(false);
  });
});
