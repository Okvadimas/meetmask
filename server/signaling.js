import { generateName } from './nameGenerator.js';

/**
 * Set up Socket.IO signaling event handlers
 * @param {import('socket.io').Server} io
 * @param {import('./roomManager.js').default} roomManager
 */
export function setupSignaling(io, roomManager) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Create a new room
    socket.on('create-room', (callback) => {
      const code = roomManager.createRoom();
      const existingNames = roomManager.getExistingNames(code);
      const identity = generateName(existingNames);

      socket.join(code);
      const result = roomManager.joinRoom(code, socket.id, identity);

      callback({
        success: true,
        roomCode: code,
        identity,
        participants: result.participants,
      });
    });

    // Join an existing room
    socket.on('join-room', (roomCode, callback) => {
      const code = roomCode.toLowerCase().trim();

      if (!roomManager.roomExists(code)) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // If this socket is already in the room (e.g., after create-room on same page load),
      // return existing identity without re-adding or broadcasting
      const existingParticipant = roomManager.findParticipant(code, socket.id);
      if (existingParticipant) {
        socket.join(code); // Ensure Socket.IO room membership
        callback({
          success: true,
          roomCode: code,
          identity: existingParticipant,
          participants: roomManager.getParticipants(code),
        });
        return;
      }

      if (roomManager.isRoomFull(code)) {
        callback({ success: false, error: 'Room is full (max 10 participants)' });
        return;
      }

      const existingNames = roomManager.getExistingNames(code);
      const identity = generateName(existingNames);

      socket.join(code);
      const result = roomManager.joinRoom(code, socket.id, identity);

      if (!result.success) {
        callback({ success: false, error: result.error });
        return;
      }

      // Notify existing participants about the new member
      socket.to(code).emit('participant-joined', {
        socketId: socket.id,
        name: identity.name,
        color: identity.color,
      });

      callback({
        success: true,
        roomCode: code,
        identity,
        participants: result.participants,
      });

      // Force-sync all clients in the room with the authoritative participant list
      io.to(code).emit('force-sync', {
        participants: roomManager.getParticipants(code),
      });
    });

    // Client is ready with their audio stream (WebRTC handshake trigger)
    socket.on('client-ready', ({ roomCode }) => {
      socket.to(roomCode).emit('peer-ready', {
        socketId: socket.id,
      });
    });

    // WebRTC signaling: offer
    socket.on('offer', ({ to, offer }) => {
      socket.to(to).emit('offer', {
        from: socket.id,
        offer,
      });
    });

    // WebRTC signaling: answer
    socket.on('answer', ({ to, answer }) => {
      socket.to(to).emit('answer', {
        from: socket.id,
        answer,
      });
    });

    // WebRTC signaling: ICE candidate
    socket.on('ice-candidate', ({ to, candidate }) => {
      socket.to(to).emit('ice-candidate', {
        from: socket.id,
        candidate,
      });
    });

    // Chat message
    socket.on('chat-message', ({ roomCode, message }) => {
      const room = roomCode;
      const participants = roomManager.getParticipants(room);
      const sender = participants.find((p) => p.socketId === socket.id);

      if (sender) {
        io.to(room).emit('chat-message', {
          id: `${socket.id}-${Date.now()}`,
          sender: sender.name,
          color: sender.color,
          message,
          timestamp: Date.now(),
        });
      }
    });

    // Reaction
    socket.on('reaction', ({ roomCode, emoji }) => {
      const room = roomCode;
      const participants = roomManager.getParticipants(room);
      const sender = participants.find((p) => p.socketId === socket.id);

      if (sender) {
        io.to(room).emit('reaction', {
          id: `${socket.id}-${Date.now()}`,
          sender: sender.name,
          emoji,
        });
      }
    });

    // Screen share status
    socket.on('screen-share-started', ({ roomCode }) => {
      const participants = roomManager.getParticipants(roomCode);
      const sender = participants.find((p) => p.socketId === socket.id);
      if (sender) {
        socket.to(roomCode).emit('screen-share-started', {
          socketId: socket.id,
          name: sender.name,
        });
      }
    });

    socket.on('screen-share-stopped', ({ roomCode }) => {
      socket.to(roomCode).emit('screen-share-stopped', {
        socketId: socket.id,
      });
    });

    // Leave room
    socket.on('leave-room', (roomCode) => {
      handleLeave(socket, roomManager, io, roomCode);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      const roomCode = roomManager.findRoomBySocket(socket.id);
      if (roomCode) {
        handleLeave(socket, roomManager, io, roomCode);
      }
    });
  });
}

function handleLeave(socket, roomManager, io, roomCode) {
  const result = roomManager.leaveRoom(roomCode, socket.id);
  if (result.removed) {
    socket.leave(roomCode);
    io.to(roomCode).emit('participant-left', {
      socketId: socket.id,
      name: result.participant?.name,
    });

    // Force-sync remaining clients with authoritative list
    if (!result.roomDestroyed) {
      io.to(roomCode).emit('force-sync', {
        participants: roomManager.getParticipants(roomCode),
      });
    }
  }
}
