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

class WebRTCService {
    private io: Server | null = null;
    private userSockets: Map<string, string> = new Map(); // userId -> socketId

    initialize(io: Server) {
        this.io = io;
        this.setupSocketHandlers();
        logger.info('WebRTC service initialized with Database Persistence');
    }

    private setupConnectionHandlers(socket: Socket) {
        socket.on('register', (userId: string) => {
            this.userSockets.set(userId, socket.id);
            socket.data.userId = userId;
            logger.info(`User ${userId} registered with socket ${socket.id}`);
        });

        socket.on('disconnect', async () => {
            const userId = socket.data.userId;
            if (userId) {
                this.userSockets.delete(userId);
                try {
                    const prisma = getPrisma();
                    const activeRooms = await prisma.webRTCRoom.findMany({
                        where: { isActive: true }
                    });
                    for (const dbRoom of activeRooms) {
                        const participants = dbRoom.participants as any[];
                        if (participants.some(p => p.id === userId)) {
                            await this.handleLeaveRoom(dbRoom.id, userId, socket);
                        }
                    }
                } catch (error) {
                    logger.error('Failed to handle WebRTC disconnect:', error);
                }
            }
            logger.info(`Client disconnected: ${socket.id}`);
        });
    }

    private setupRoomHandlers(socket: Socket) {
        socket.on('create-room', async (data: { userId: string; userName: string; roomId?: string }, callback: (response: Record<string, unknown>) => void) => {
            // Honor a client-supplied roomId (so the host UI and the join link the
            // farmer receives reference the SAME room). Anything that is not a
            // safe opaque id falls back to a server-generated uuid.
            const requestedId = typeof data.roomId === 'string' ? data.roomId.trim() : '';
            const roomId = /^[a-zA-Z0-9-]{6,64}$/.test(requestedId) ? requestedId : uuidv4();
            const prisma = getPrisma();
            const participants = [{ id: data.userId, socketId: socket.id, name: data.userName }];

            try {
                // Upsert: re-clicking "Start Call" on an existing room re-activates
                // it instead of failing on the unique constraint.
                await prisma.webRTCRoom.upsert({
                    where: { id: roomId },
                    create: {
                        id: roomId,
                        hostId: data.userId,
                        participants: participants as any,
                        isActive: true,
                    },
                    update: {
                        hostId: data.userId,
                        participants: participants as any,
                        isActive: true,
                    },
                });

                socket.join(roomId);
                logger.info(`Room ${roomId} ready in DB (host ${data.userId})`);
                callback({ roomId, success: true });
            } catch (error) {
                logger.error('Failed to create room:', error);
                callback({ success: false, error: 'Database error' });
            }
        });

        socket.on('join-room', async (data: { roomId: string; userId: string; userName: string }, callback: (response: Record<string, unknown>) => void) => {
            const prisma = getPrisma();
            try {
                const dbRoom = await prisma.webRTCRoom.findUnique({
                    where: { id: data.roomId }
                });

                if (!dbRoom || !dbRoom.isActive) {
                    callback({ success: false, error: 'Room not found or inactive' });
                    return;
                }

                let participants = dbRoom.participants as any[];
                participants = participants.filter(p => p.id !== data.userId);
                participants.push({ id: data.userId, socketId: socket.id, name: data.userName });

                await prisma.webRTCRoom.update({
                    where: { id: data.roomId },
                    data: { participants }
                });

                socket.join(data.roomId);

                socket.to(data.roomId).emit('user-joined', {
                    userId: data.userId,
                    userName: data.userName,
                });

                callback({ success: true, participants });
                logger.info(`User ${data.userId} joined room ${data.roomId} (DB updated)`);
            } catch (error) {
                logger.error('Failed to join room:', error);
                callback({ success: false, error: 'Database error' });
            }
        });

        socket.on('leave-room', async (data: { roomId: string; userId: string }) => {
            await this.handleLeaveRoom(data.roomId, data.userId, socket);
        });
    }

    private setupSignalingHandlers(socket: Socket) {
        socket.on('offer', (data: CallOffer) => {
            socket.to(data.roomId).emit('offer', { offer: data.offer, from: data.from });
        });

        socket.on('answer', (data: CallAnswer) => {
            socket.to(data.roomId).emit('answer', { answer: data.answer, from: data.from });
        });

        socket.on('ice-candidate', (data: IceCandidate) => {
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
            const prisma = getPrisma();
            try {
                await prisma.webRTCRoom.update({
                    where: { id: data.roomId },
                    data: { isActive: false }
                });
                this.io?.to(data.roomId).emit('call-ended', { userId: data.userId });
                logger.info(`Call ended and room ${data.roomId} marked inactive in DB by ${data.userId}`);
            } catch (error) {
                logger.error('Failed to end call:', error);
            }
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
        const prisma = getPrisma();
        try {
            const dbRoom = await prisma.webRTCRoom.findUnique({
                where: { id: roomId }
            });
            if (!dbRoom) return;

            let participants = dbRoom.participants as any[];
            participants = participants.filter(p => p.id !== userId);
            const isActive = participants.length > 0;

            await prisma.webRTCRoom.update({
                where: { id: roomId },
                data: {
                    participants,
                    isActive
                }
            });

            socket.leave(roomId);

            // Notify others in the room
            socket.to(roomId).emit('user-left', { userId });

            if (!isActive) {
                logger.info(`Room ${roomId} deleted from active list (empty)`);
            }

            logger.info(`User ${userId} left room ${roomId} (DB updated)`);
        } catch (error) {
            logger.error('Failed to handle leave room:', error);
        }
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
