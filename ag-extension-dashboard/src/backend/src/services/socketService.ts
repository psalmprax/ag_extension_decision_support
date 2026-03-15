import { Server as SocketServer, Socket } from 'socket.io';
import { logger } from '@/utils/logger';

interface UserSocket {
    userId: string;
    role: string;
}

export function initializeSocketHandlers(io: SocketServer): void {
    io.on('connection', (socket: Socket) => {
        logger.info(`Socket connected: ${socket.id}`);

        // User authentication/joining
        socket.on('authenticate', (data: UserSocket) => {
            socket.join(`user:${data.userId}`);
            if (data.role === 'extension_officer') {
                socket.join('officers');
            } else if (data.role === 'farmer') {
                socket.join('farmers');
            } else if (data.role === 'admin') {
                socket.join('admins');
            }
            logger.info(`User ${data.userId} authenticated as ${data.role}`);
        });

        // Join conversation room
        socket.on('join_conversation', (conversationId: string) => {
            socket.join(`conversation:${conversationId}`);
            logger.info(`Socket ${socket.id} joined conversation ${conversationId}`);
        });

        // Leave conversation room
        socket.on('leave_conversation', (conversationId: string) => {
            socket.leave(`conversation:${conversationId}`);
        });

        // Chat message
        socket.on('chat_message', (data: {
            conversationId: string;
            message: any;
        }) => {
            io.to(`conversation:${data.conversationId}`).emit('new_message', data.message);
        });

        // Typing indicator
        socket.on('typing', (data: { conversationId: string; userId: string }) => {
            socket.to(`conversation:${data.conversationId}`).emit('user_typing', data.userId);
        });

        // Stop typing
        socket.on('stop_typing', (data: { conversationId: string; userId: string }) => {
            socket.to(`conversation:${data.conversationId}`).emit('user_stop_typing', data.userId);
        });

        // Location update (for field officers)
        socket.on('location_update', (data: {
            userId: string;
            lat: number;
            lng: number;
        }) => {
            socket.to('admins').emit('officer_location', data);
        });

        // Alert notification
        socket.on('alert', (data: { type: string; message: string; data?: any }) => {
            io.emit('notification', data);
        });

        // Disconnect
        socket.on('disconnect', () => {
            logger.info(`Socket disconnected: ${socket.id}`);
        });
    });
}

export function emitToUser(io: SocketServer, userId: string, event: string, data: any): void {
    io.to(`user:${userId}`).emit(event, data);
}

export function emitToRole(io: SocketServer, role: string, event: string, data: any): void {
    io.to(role).emit(event, data);
}

export function emitToConversation(io: SocketServer, conversationId: string, event: string, data: any): void {
    io.to(`conversation:${conversationId}`).emit(event, data);
}
