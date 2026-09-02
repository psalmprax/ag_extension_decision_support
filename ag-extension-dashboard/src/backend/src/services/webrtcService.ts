/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { getPrisma } from './prismaService';

export interface Room {
    id: string;
    hostId: string;
    participants: Map<string, { id: string; socketId: string; name: string }>;
    createdAt: Date;
    isActive: boolean;
}

const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2h
const MAX_ACTIVE_ROOMS = 2000;
const MAX_PARTICIPANTS_PER_ROOM = 4;

export interface CallOffer {
    roomId: string;
    offer: Record<string, unknown>;
    from: string;
}

export interface CallAnswer {
    roomId: string;
    answer: Record<string, unknown>;
    from: string;
}

export interface IceCandidate {
    roomId: string;
    candidate: Record<string, unknown>;
    from: string;
}

export interface VideoConsultation {
    id: string;
    farmerId: string;
    extensionOfficerId: string;
    scheduledTime: Date;
    status: 'pending' | 'active' | 'completed' | 'cancelled';
    roomId: string;
}

function dbToRoom(dbRoom: any): Room {
    const participantsMap = new Map<string, { id: string; socketId: string; name: string }>();
    const list = Array.isArray(dbRoom.participants) ? dbRoom.participants : [];
    for (const p of list) {
        participantsMap.set(p.id, p);
    }
    return {
        id: dbRoom.id,
        hostId: dbRoom.hostId,
        participants: participantsMap,
        createdAt: dbRoom.createdAt,
        isActive: dbRoom.isActive,
    };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(id?: string | null): boolean {
    return typeof id === 'string' && UUID_REGEX.test(id);
}

class WebRTCService {
    private io: Server | null = null;
    private userSockets: Map<string, string> = new Map(); // userId -> socketId
    private activeRooms: Map<string, Room> = new Map(); // roomId -> Room

    private async cacheRoom(room: Room): Promise<void> {
        try {
            const { getCache } = await import('./cacheService');
            const c = getCache();
            if (!c) return;
            const payload = JSON.stringify({
                id: room.id, hostId: room.hostId, participants: Array.from(room.participants.values()),
                createdAt: room.createdAt.toISOString(), isActive: room.isActive
            });
            await c.setEx(`webrtc:room:${room.id}`, Math.ceil(ROOM_TTL_MS / 1000), payload);
        } catch { }
    }

    private async fetchRoomFromCache(roomId: string): Promise<Room | null> {
        try {
            const { getCache } = await import('./cacheService');
            const c = getCache();
            if (!c) return null;
            const raw = await c.get(`webrtc:room:${roomId}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as { id: string; hostId: string; participants: { id: string; socketId: string; name: string }[]; createdAt: string; isActive: boolean };
            const map = new Map<string, { id: string; socketId: string; name: string }>();
            for (const p of parsed.participants) map.set(p.id, p);
            return { id: parsed.id, hostId: parsed.hostId, participants: map, createdAt: new Date(parsed.createdAt), isActive: parsed.isActive };
        } catch { return null; }
    }

    private async delRoomCache(roomId: string): Promise<void> {
        try {
            const { getCache } = await import('./cacheService');
            const c = getCache();
            if (c) await c.del(`webrtc:room:${roomId}`);
        } catch { }
    }

    private async syncConsultationStatus(roomId: string, status: VideoConsultation['status']): Promise<void> {
        if (!isValidUuid(roomId)) return;
        try {
            const prisma = getPrisma();
            const consult = await prisma.videoConsultation.findFirst({ where: { roomId } });
            if (consult) {
                await prisma.videoConsultation.update({ where: { id: consult.id }, data: { status } });
                logger.info(`Consultation ${consult.id} for room ${roomId} → ${status}`);
            }
        } catch (e) { logger.warn(`Consultation status sync failed for ${roomId}:`, e); }
    }

    initialize(io: Server) {
        this.io = io;
        this.setupSocketHandlers();
        // Periodic reap of stale in-memory rooms (prevents leak on multi-instance without Redis)
        setInterval(() => {
            const now = Date.now();
            for (const [id, r] of this.activeRooms.entries()) {
                if (!r.isActive && now - r.createdAt.getTime() > 10_000) {
                    this.activeRooms.delete(id);
                    void this.delRoomCache(id);
                } else if (now - r.createdAt.getTime() > ROOM_TTL_MS) {
                    r.isActive = false;
                    if (r.participants.size === 0) {
                        this.activeRooms.delete(id);
                        void this.delRoomCache(id);
                    } else void this.cacheRoom(r);
                }
            }
            if (this.activeRooms.size > MAX_ACTIVE_ROOMS) {
                const sorted = [...this.activeRooms.entries()].sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
                const drop = this.activeRooms.size - MAX_ACTIVE_ROOMS;
                for (let i = 0; i < drop; i++) {
                    const rid = sorted[i][0];
                    this.activeRooms.delete(rid);
                    void this.delRoomCache(rid);
                }
            }
        }, 60_000).unref?.();
        logger.info('WebRTC service initialized with Redis-hybrid Signaling & DB Persistence');
    }

    private setupConnectionHandlers(socket: Socket) {
        socket.on('register', (userId: string) => {
            if (userId) {
                this.userSockets.set(userId, socket.id);
                socket.data.userId = userId;
                logger.info(`User ${userId} registered with socket ${socket.id}`);
            }
        });

        socket.on('disconnect', async () => {
            const userId = socket.data.userId;
            if (userId) {
                this.userSockets.delete(userId);
                // Clean up active in-memory rooms
                for (const [roomId, room] of this.activeRooms.entries()) {
                    if (room.participants.has(userId)) {
                        await this.handleLeaveRoom(roomId, userId, socket);
                    }
                }
            }
            logger.info(`Client disconnected: ${socket.id}`);
        });
    }

    private setupRoomHandlers(socket: Socket) {
        socket.on('create-room', async (data: { userId: string; userName: string; roomId?: string }, callback: (response: Record<string, unknown>) => void) => {
            const requestedId = typeof data.roomId === 'string' ? data.roomId.trim() : '';
            const roomId = requestedId && /^[a-zA-Z0-9_-]{3,64}$/.test(requestedId) ? requestedId : uuidv4();
            const participantId = data.userId || uuidv4();
            const participantName = data.userName || 'Extension Officer';
            const participant = { id: participantId, socketId: socket.id, name: participantName };

            // In-Memory Room Registration (Always Works)
            if (this.activeRooms.size >= MAX_ACTIVE_ROOMS && !this.activeRooms.has(roomId)) {
                if (typeof callback === 'function') callback({ success: false, error: 'Server at capacity, try again shortly.' });
                return;
            }
            let room = this.activeRooms.get(roomId);
            if (!room) {
                const participantsMap = new Map<string, { id: string; socketId: string; name: string }>();
                participantsMap.set(participantId, participant);
                room = {
                    id: roomId,
                    hostId: participantId,
                    participants: participantsMap,
                    createdAt: new Date(),
                    isActive: true,
                };
                this.activeRooms.set(roomId, room);
            } else {
                if (room.participants.size >= MAX_PARTICIPANTS_PER_ROOM && !room.participants.has(participantId)) {
                    if (typeof callback === 'function') callback({ success: false, error: 'Room is full (max 4 participants).' });
                    return;
                }
                room.isActive = true;
                room.participants.set(participantId, participant);
            }

            socket.join(roomId);
            void this.cacheRoom(room);
            void this.syncConsultationStatus(roomId, 'active');
            logger.info(`WebRTC room ${roomId} ready in memory (host: ${participantId})`);

            // Safe DB persistence (if valid UUID and user exists in DB)
            if (isValidUuid(roomId) && isValidUuid(participantId)) {
                try {
                    const prisma = getPrisma();
                    const hostUser = await prisma.user.findUnique({ where: { id: participantId } });
                    if (hostUser) {
                        await prisma.webRTCRoom.upsert({
                            where: { id: roomId },
                            create: {
                                id: roomId,
                                hostId: participantId,
                                participants: [participant] as any,
                                isActive: true,
                            },
                            update: {
                                hostId: participantId,
                                participants: [participant] as any,
                                isActive: true,
                            },
                        });
                    }
                } catch (dbError) {
                    logger.warn(`WebRTC room ${roomId} DB sync skipped:`, dbError);
                }
            }

            if (typeof callback === 'function') {
                callback({ roomId, success: true });
            }
        });

        socket.on('join-room', async (data: { roomId: string; userId: string; userName: string }, callback: (response: Record<string, unknown>) => void) => {
            const roomId = data.roomId;
            const participantId = data.userId || uuidv4();
            const participantName = data.userName || 'Farmer / Guest';
            const participant = { id: participantId, socketId: socket.id, name: participantName };

            let room: Room | undefined = this.activeRooms.get(roomId);
            if (!room) {
                const cached = await this.fetchRoomFromCache(roomId);
                if (cached) {
                    room = cached;
                    this.activeRooms.set(roomId, room);
                }
            }

            if (!room && isValidUuid(roomId)) {
                try {
                    const prisma = getPrisma();
                    const dbRoom = await prisma.webRTCRoom.findUnique({ where: { id: roomId } });
                    if (dbRoom && dbRoom.isActive) {
                        room = dbToRoom(dbRoom);
                        this.activeRooms.set(roomId, room);
                        void this.cacheRoom(room);
                    }
                } catch (err) {
                    logger.warn(`WebRTC DB room lookup error:`, err);
                }
            }

            if (this.activeRooms.size >= MAX_ACTIVE_ROOMS && !this.activeRooms.has(roomId)) {
                if (typeof callback === 'function') callback({ success: false, error: 'Server at capacity, try again shortly.' });
                return;
            }
            // Create on-demand if not already existing so join link always succeeds
            if (!room) {
                const participantsMap = new Map<string, { id: string; socketId: string; name: string }>();
                room = {
                    id: roomId,
                    hostId: participantId,
                    participants: participantsMap,
                    createdAt: new Date(),
                    isActive: true,
                };
                this.activeRooms.set(roomId, room);
            }

            if (room.participants.size >= MAX_PARTICIPANTS_PER_ROOM && !room.participants.has(participantId)) {
                if (typeof callback === 'function') callback({ success: false, error: 'Room is full (max 4 participants).' });
                return;
            }
            room.isActive = true;
            room.participants.set(participantId, participant);

            socket.join(roomId);
            void this.cacheRoom(room);
            void this.syncConsultationStatus(roomId, 'active');

            // Notify existing room members of new joiner
            socket.to(roomId).emit('user-joined', {
                userId: participantId,
                userName: participantName,
            });

            const participantsList = Array.from(room.participants.values());
            logger.info(`User ${participantName} (${participantId}) joined WebRTC room ${roomId}`);

            // Safe DB update if room is in DB
            if (isValidUuid(roomId)) {
                try {
                    const prisma = getPrisma();
                    await prisma.webRTCRoom.update({
                        where: { id: roomId },
                        data: { participants: participantsList as any }
                    });
                } catch (dbErr) {
                    logger.warn(`WebRTC join room ${roomId} DB sync skipped:`, dbErr);
                }
            }

            if (typeof callback === 'function') {
                callback({ success: true, participants: participantsList });
            }
        });

        socket.on('leave-room', async (data: { roomId: string; userId: string }) => {
            await this.handleLeaveRoom(data.roomId, data.userId, socket);
        });
    }

    private setupSignalingHandlers(socket: Socket) {
        socket.on('offer', (data: CallOffer) => {
            if (!data?.roomId || !data?.offer) return;
            socket.to(data.roomId).emit('offer', { offer: data.offer, from: data.from });
        });

        socket.on('answer', (data: CallAnswer) => {
            if (!data?.roomId || !data?.answer) return;
            socket.to(data.roomId).emit('answer', { answer: data.answer, from: data.from });
        });

        socket.on('ice-candidate', (data: IceCandidate) => {
            if (!data?.roomId || !data?.candidate) return;
            socket.to(data.roomId).emit('ice-candidate', { candidate: data.candidate, from: data.from });
        });
    }

    private setupCallControlHandlers(socket: Socket) {
        socket.on('toggle-audio', (data: { roomId: string; userId: string; enabled: boolean }) => {
            socket.to(data.roomId).emit('audio-toggled', { userId: data.userId, enabled: data.enabled });
        });

        socket.on('toggle-video', (data: { roomId: string; userId: string; enabled: boolean }) => {
            socket.to(data.roomId).emit('video-toggled', { userId: data.userId, enabled: data.enabled });
        });

        socket.on('end-call', async (data: { roomId: string; userId: string }) => {
            const room = this.activeRooms.get(data.roomId);
            if (room) {
                room.isActive = false;
                room.participants.clear();
                void this.cacheRoom(room);
                void this.delRoomCache(data.roomId);
            } else {
                void this.delRoomCache(data.roomId);
            }

            if (isValidUuid(data.roomId)) {
                try {
                    const prisma = getPrisma();
                    await prisma.webRTCRoom.update({
                        where: { id: data.roomId },
                        data: { isActive: false }
                    });
                } catch (err) {
                    // ignore
                }
            }
            void this.syncConsultationStatus(data.roomId, 'completed');

            this.io?.to(data.roomId).emit('call-ended', { userId: data.userId });
            logger.info(`Call ended in room ${data.roomId} by ${data.userId}`);
        });
    }

    private setupSocketHandlers() {
        if (!this.io) return;

        this.io.on('connection', (socket: Socket) => {
            logger.info(`Client connected to WebRTC signaling: ${socket.id}`);

            this.setupConnectionHandlers(socket);
            this.setupRoomHandlers(socket);
            this.setupSignalingHandlers(socket);
            this.setupCallControlHandlers(socket);
        });
    }

    private async handleLeaveRoom(roomId: string, userId: string, socket: Socket) {
        const room = this.activeRooms.get(roomId) ?? await this.fetchRoomFromCache(roomId);
        if (room) {
            room.participants.delete(userId);
            if (room.participants.size === 0) {
                room.isActive = false;
                this.activeRooms.set(roomId, room);
                await this.cacheRoom(room);
                void this.syncConsultationStatus(roomId, 'completed');
            } else {
                this.activeRooms.set(roomId, room);
                await this.cacheRoom(room);
            }
            if (!this.activeRooms.has(roomId)) this.activeRooms.set(roomId, room);
        }

        socket.leave(roomId);
        socket.to(roomId).emit('user-left', { userId });

        if (isValidUuid(roomId)) {
            try {
                const prisma = getPrisma();
                const dbRoom = await prisma.webRTCRoom.findUnique({ where: { id: roomId } });
                if (dbRoom) {
                    const participants = (dbRoom.participants as any[]).filter(p => p.id !== userId);
                    await prisma.webRTCRoom.update({
                        where: { id: roomId },
                        data: {
                            participants,
                            isActive: participants.length > 0
                        }
                    });
                }
            } catch (error) {
                logger.warn('Failed to update DB on leave room:', error);
            }
        }

        logger.info(`User ${userId} left room ${roomId}`);
    }

    // Create a scheduled video consultation
    async createConsultation(farmerId: string, extensionOfficerId: string, scheduledTime: Date): Promise<VideoConsultation> {
        const prisma = getPrisma();
        const id = uuidv4();
        const roomId = uuidv4();

        const dbConsultation = await prisma.videoConsultation.create({
            data: {
                id,
                farmerId,
                extensionOfficerId,
                scheduledTime,
                status: 'pending',
                roomId
            }
        });

        logger.info(`Video consultation ${id} scheduled in DB for ${scheduledTime}`);
        return dbConsultation as any;
    }

    // Get consultation by ID
    async getConsultation(id: string): Promise<VideoConsultation | null> {
        const prisma = getPrisma();
        const dbConsultation = await prisma.videoConsultation.findUnique({
            where: { id }
        });
        return dbConsultation as any;
    }

    // Update consultation status
    async updateConsultationStatus(id: string, status: VideoConsultation['status']): Promise<boolean> {
        const prisma = getPrisma();
        try {
            await prisma.videoConsultation.update({
                where: { id },
                data: { status }
            });
            logger.info(`Consultation ${id} status updated in DB to ${status}`);
            return true;
        } catch (error) {
            logger.error(`Failed to update consultation status for ${id}:`, error);
            return false;
        }
    }

    // Get active rooms
    async getActiveRooms(): Promise<Room[]> {
        const prisma = getPrisma();
        try {
            const activeRooms = await prisma.webRTCRoom.findMany({
                where: { isActive: true }
            });
            return activeRooms.map(r => dbToRoom(r));
        } catch (error) {
            logger.error('Failed to get active rooms:', error);
            return [];
        }
    }

    // Get room by ID
    async getRoom(roomId: string): Promise<Room | null> {
        const prisma = getPrisma();
        try {
            const dbRoom = await prisma.webRTCRoom.findUnique({
                where: { id: roomId }
            });
            return dbRoom ? dbToRoom(dbRoom) : null;
        } catch (error) {
            logger.error(`Failed to get room ${roomId}:`, error);
            return null;
        }
    }

    // Get all consultations
    async getAllConsultations(): Promise<VideoConsultation[]> {
        const prisma = getPrisma();
        try {
            const consultations = await prisma.videoConsultation.findMany();
            return consultations as any[];
        } catch (error) {
            logger.error('Failed to get all consultations:', error);
            return [];
        }
    }

    // Get user's consultation
    async getUserConsultations(userId: string): Promise<VideoConsultation[]> {
        const prisma = getPrisma();
        try {
            const consultations = await prisma.videoConsultation.findMany({
                where: {
                    OR: [
                        { farmerId: userId },
                        { extensionOfficerId: userId }
                    ]
                }
            });
            return consultations as any[];
        } catch (error) {
            logger.error(`Failed to get consultations for user ${userId}:`, error);
            return [];
        }
    }
}

export const webrtcService = new WebRTCService();
