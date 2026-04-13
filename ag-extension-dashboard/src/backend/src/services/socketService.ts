/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server as SocketServer, Socket } from 'socket.io';
import { logger } from '@/utils/logger';
import jwt from 'jsonwebtoken';
import { config } from '@/config';

interface UserSocket {
    userId: string;
    role: string;
}

// Simple rate limiter for socket events
const socketRateLimits = new Map<string, { count: number, resetTime: number }>();
const RATE_LIMIT_MAX = 60; // 60 events per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function checkRateLimit(socketId: string): boolean {
    const now = Date.now();
    let limit = socketRateLimits.get(socketId);
    
    if (!limit || now > limit.resetTime) {
        limit = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
        socketRateLimits.set(socketId, limit);
    }
    
    limit.count++;
    return limit.count <= RATE_LIMIT_MAX;
}

export function initializeSocketHandlers(io: SocketServer): void {
    // Authentication middleware
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            
            if (!token) {
                return next(new Error('Authentication required'));
            }

            const decoded = jwt.verify(token, config.jwt.secret) as any;
            socket.data.user = {
                userId: decoded.userId || decoded.id,
                role: decoded.role || 'user'
            };
            
            next();
        } catch (error) {
            logger.warn(`Socket authentication failed: ${socket.id}`);
            next(new Error('Invalid authentication token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        logger.info(`Socket connected: ${socket.id} (user: ${socket.data.user?.userId})`);

        // Auto-join user and role rooms from authenticated data
        const user = socket.data.user;
        if (user) {
            socket.join(`user:${user.userId}`);
            if (user.role === 'extension_officer') {
                socket.join('officers');
            } else if (user.role === 'farmer') {
                socket.join('farmers');
            } else if (user.role === 'admin') {
                socket.join('admins');
            }
            logger.info(`User ${user.userId} joined as ${user.role}`);
        }

        // Join conversation room
        socket.on('join_conversation', (conversationId: string) => {
            if (!checkRateLimit(socket.id)) return;
            socket.join(`conversation:${conversationId}`);
            logger.info(`Socket ${socket.id} joined conversation ${conversationId}`);
        });

        // Leave conversation room
        socket.on('leave_conversation', (conversationId: string) => {
            if (!checkRateLimit(socket.id)) return;
            socket.leave(`conversation:${conversationId}`);
        });

        // Chat message
        socket.on('chat_message', (data: {
            conversationId: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: any;
        }) => {
            if (!checkRateLimit(socket.id)) return;
            io.to(`conversation:${data.conversationId}`).emit('new_message', data.message);
        });

        // Typing indicator
        socket.on('typing', (data: { conversationId: string; userId: string }) => {
            if (!checkRateLimit(socket.id)) return;
            socket.to(`conversation:${data.conversationId}`).emit('user_typing', data.userId);
        });

        // Stop typing
        socket.on('stop_typing', (data: { conversationId: string; userId: string }) => {
            if (!checkRateLimit(socket.id)) return;
            socket.to(`conversation:${data.conversationId}`).emit('user_stop_typing', data.userId);
        });

        // Location update (for field officers)
        socket.on('location_update', (data: {
            userId: string;
            lat: number;
            lng: number;
        }) => {
            if (!checkRateLimit(socket.id)) return;
            socket.to('admins').emit('officer_location', data);
        });

        // Alert notification - only admins can send global alerts
        socket.on('alert', (data: { type: string; message: string; data?: any }) => {
            if (!checkRateLimit(socket.id)) return;
            if (socket.data.user?.role === 'admin') {
                io.emit('notification', data);
            }
        });

        // Disconnect
        socket.on('disconnect', () => {
            socketRateLimits.delete(socket.id);
            logger.info(`Socket disconnected: ${socket.id}`);
        });
    });

    // Clean up expired rate limit entries every minute
    setInterval(() => {
        const now = Date.now();
        for (const [id, limit] of socketRateLimits.entries()) {
            if (now > limit.resetTime) {
                socketRateLimits.delete(id);
            }
        }
    }, 60000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function emitToUser(io: SocketServer, userId: string, event: string, data: any): void {
    io.to(`user:${userId}`).emit(event, data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function emitToRole(io: SocketServer, role: string, event: string, data: any): void {
    io.to(role).emit(event, data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function emitToConversation(io: SocketServer, conversationId: string, event: string, data: any): void {
    io.to(`conversation:${conversationId}`).emit(event, data);
}
