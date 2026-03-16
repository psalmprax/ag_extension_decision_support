/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server } from 'socket.io';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface Room {
    id: string;
    hostId: string;
    participants: Map<string, { id: string; socketId: string; name: string }>;
    createdAt: Date;
    isActive: boolean;
}

export interface CallOffer {
    roomId: string;
    offer: any;
    from: string;
}

export interface CallAnswer {
    roomId: string;
    answer: any;
    from: string;
}

export interface IceCandidate {
    roomId: string;
    candidate: any;
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

class WebRTCService {
    private io: Server | null = null;
    private rooms: Map<string, Room> = new Map();
    private consultations: Map<string, VideoConsultation> = new Map();
    private userSockets: Map<string, string> = new Map(); // userId -> socketId

    initialize(io: Server) {
        this.io = io;
        this.setupSocketHandlers();
        logger.info('WebRTC service initialized');
    }

    private setupSocketHandlers() {
        if (!this.io) return;

        this.io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);

            // User joins with their ID
            socket.on('register', (userId: string) => {
                this.userSockets.set(userId, socket.id);
                socket.data.userId = userId;
                logger.info(`User ${userId} registered with socket ${socket.id}`);
            });

            // Create a new video call room
            socket.on('create-room', (data: { userId: string; userName: string }, callback) => {
                const roomId = uuidv4();
                const room: Room = {
                    id: roomId,
                    hostId: data.userId,
                    participants: new Map([[data.userId, { id: data.userId, socketId: socket.id, name: data.userName }]]),
                    createdAt: new Date(),
                    isActive: true,
                };

                this.rooms.set(roomId, room);
                socket.join(roomId);

                logger.info(`Room ${roomId} created by ${data.userId}`);
                callback({ roomId, success: true });
            });

            // Join an existing room
            socket.on('join-room', (data: { roomId: string; userId: string; userName: string }, callback) => {
                const room = this.rooms.get(data.roomId);

                if (!room || !room.isActive) {
                    callback({ success: false, error: 'Room not found or inactive' });
                    return;
                }

                room.participants.set(data.userId, { id: data.userId, socketId: socket.id, name: data.userName });
                socket.join(data.roomId);

                // Notify others in the room
                socket.to(data.roomId).emit('user-joined', {
                    userId: data.userId,
                    userName: data.userName,
                });

                // Send list of existing participants to the new user
                const participants = Array.from(room.participants.values());
                callback({ success: true, participants });

                logger.info(`User ${data.userId} joined room ${data.roomId}`);
            });

            // Leave a room
            socket.on('leave-room', (data: { roomId: string; userId: string }) => {
                this.handleLeaveRoom(data.roomId, data.userId, socket);
            });

            // WebRTC signaling: offer
            socket.on('offer', (data: CallOffer) => {
                socket.to(data.roomId).emit('offer', {
                    offer: data.offer,
                    from: data.from,
                });
            });

            // WebRTC signaling: answer
            socket.on('answer', (data: CallAnswer) => {
                socket.to(data.roomId).emit('answer', {
                    answer: data.answer,
                    from: data.from,
                });
            });

            // WebRTC signaling: ICE candidate
            socket.on('ice-candidate', (data: IceCandidate) => {
                socket.to(data.roomId).emit('ice-candidate', {
                    candidate: data.candidate,
                    from: data.from,
                });
            });

            // Toggle audio
            socket.on('toggle-audio', (data: { roomId: string; userId: string; enabled: boolean }) => {
                socket.to(data.roomId).emit('audio-toggled', {
                    userId: data.userId,
                    enabled: data.enabled,
                });
            });

            // Toggle video
            socket.on('toggle-video', (data: { roomId: string; userId: string; enabled: boolean }) => {
                socket.to(data.roomId).emit('video-toggled', {
                    userId: data.userId,
                    enabled: data.enabled,
                });
            });

            // End call
            socket.on('end-call', (data: { roomId: string; userId: string }) => {
                const room = this.rooms.get(data.roomId);
                if (room) {
                    room.isActive = false;
                    this.io?.to(data.roomId).emit('call-ended', { userId: data.userId });
                    logger.info(`Call ended in room ${data.roomId} by ${data.userId}`);
                }
            });

            // Disconnect handling
            socket.on('disconnect', () => {
                const userId = socket.data.userId;
                if (userId) {
                    this.userSockets.delete(userId);

                    // Find and clean up any rooms this user was in
                    for (const [roomId, room] of this.rooms.entries()) {
                        if (room.participants.has(userId)) {
                            this.handleLeaveRoom(roomId, userId, socket);
                        }
                    }
                }
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });
    }

    private handleLeaveRoom(roomId: string, userId: string, socket: any) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.participants.delete(userId);
        socket.leave(roomId);

        // Notify others in the room
        socket.to(roomId).emit('user-left', { userId });

        // Clean up empty or inactive rooms
        if (room.participants.size === 0) {
            room.isActive = false;
            this.rooms.delete(roomId);
            logger.info(`Room ${roomId} deleted (empty)`);
        }

        logger.info(`User ${userId} left room ${roomId}`);
    }

    // Create a scheduled video consultation
    async createConsultation(farmerId: string, extensionOfficerId: string, scheduledTime: Date): Promise<VideoConsultation> {
        const consultation: VideoConsultation = {
            id: uuidv4(),
            farmerId,
            extensionOfficerId,
            scheduledTime,
            status: 'pending',
            roomId: uuidv4(),
        };

        this.consultations.set(consultation.id, consultation);
        logger.info(`Video consultation ${consultation.id} scheduled for ${scheduledTime}`);

        return consultation;
    }

    // Get consultation by ID
    getConsultation(id: string): VideoConsultation | undefined {
        return this.consultations.get(id);
    }

    // Update consultation status
    updateConsultationStatus(id: string, status: VideoConsultation['status']): boolean {
        const consultation = this.consultations.get(id);
        if (!consultation) return false;

        consultation.status = status;
        logger.info(`Consultation ${id} status updated to ${status}`);
        return true;
    }

    // Get active rooms
    getActiveRooms(): Room[] {
        return Array.from(this.rooms.values()).filter(room => room.isActive);
    }

    // Get room by ID
    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    // Get all consultations
    getAllConsultations(): VideoConsultation[] {
        return Array.from(this.consultations.values());
    }

    // Get user's consultation
    getUserConsultations(userId: string): VideoConsultation[] {
        return Array.from(this.consultations.values()).filter(
            c => c.farmerId === userId || c.extensionOfficerId === userId
        );
    }
}

export const webrtcService = new WebRTCService();
