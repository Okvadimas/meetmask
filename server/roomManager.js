const MAX_PARTICIPANTS = 10;

class RoomManager {
  constructor() {
    /** @type {Map<string, { participants: Map<string, { name: string, color: string, joinedAt: number }>, createdAt: number }>} */
    this.rooms = new Map();
  }

  /**
   * Generate a random room code in format xxx-xxxx
   * @returns {string}
   */
  generateRoomCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const code = `${part1}-${part2}`;

    // Make sure code doesn't already exist
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }

  /**
   * Create a new room
   * @returns {string} room code
   */
  createRoom() {
    const code = this.generateRoomCode();
    this.rooms.set(code, {
      participants: new Map(),
      createdAt: Date.now(),
    });
    console.log(`[Room] Created room: ${code}`);
    return code;
  }

  /**
   * Check if room exists
   * @param {string} code
   * @returns {boolean}
   */
  roomExists(code) {
    return this.rooms.has(code);
  }

  /**
   * Check if room is full
   * @param {string} code
   * @returns {boolean}
   */
  isRoomFull(code) {
    const room = this.rooms.get(code);
    if (!room) return true;
    return room.participants.size >= MAX_PARTICIPANTS;
  }

  /**
   * Add participant to room
   * @param {string} code
   * @param {string} socketId
   * @param {{ name: string, color: string }} identity
   * @returns {{ success: boolean, error?: string, participants?: Array }}
   */
  joinRoom(code, socketId, identity) {
    const room = this.rooms.get(code);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    if (room.participants.size >= MAX_PARTICIPANTS) {
      return { success: false, error: 'Room is full' };
    }

    room.participants.set(socketId, {
      name: identity.name,
      color: identity.color,
      joinedAt: Date.now(),
    });

    console.log(`[Room] ${identity.name} joined room ${code} (${room.participants.size} participants)`);
    return {
      success: true,
      participants: this.getParticipants(code),
    };
  }

  /**
   * Remove participant from room, destroy room if empty
   * @param {string} code
   * @param {string} socketId
   * @returns {{ removed: boolean, roomDestroyed: boolean, participant?: { name: string } }}
   */
  leaveRoom(code, socketId) {
    const room = this.rooms.get(code);
    if (!room) return { removed: false, roomDestroyed: false };

    const participant = room.participants.get(socketId);
    if (!participant) return { removed: false, roomDestroyed: false };

    room.participants.delete(socketId);
    console.log(`[Room] ${participant.name} left room ${code} (${room.participants.size} remaining)`);

    if (room.participants.size === 0) {
      this.rooms.delete(code);
      console.log(`[Room] Destroyed empty room: ${code}`);
      return { removed: true, roomDestroyed: true, participant };
    }

    return { removed: true, roomDestroyed: false, participant };
  }

  /**
   * Get all participants in a room
   * @param {string} code
   * @returns {Array<{ socketId: string, name: string, color: string }>}
   */
  getParticipants(code) {
    const room = this.rooms.get(code);
    if (!room) return [];

    return Array.from(room.participants.entries()).map(([socketId, data]) => ({
      socketId,
      name: data.name,
      color: data.color,
    }));
  }

  /**
   * Get existing names in a room (for uniqueness check)
   * @param {string} code
   * @returns {Set<string>}
   */
  getExistingNames(code) {
    const room = this.rooms.get(code);
    if (!room) return new Set();
    return new Set(Array.from(room.participants.values()).map((p) => p.name));
  }

  /**
   * Find a specific participant in a room by socketId
   * @param {string} code
   * @param {string} socketId
   * @returns {{ name: string, color: string } | null}
   */
  findParticipant(code, socketId) {
    const room = this.rooms.get(code);
    if (!room) return null;
    const p = room.participants.get(socketId);
    if (!p) return null;
    return { name: p.name, color: p.color };
  }

  /**
   * Find which room a socket is in
   * @param {string} socketId
   * @returns {string|null} room code or null
   */
  findRoomBySocket(socketId) {
    for (const [code, room] of this.rooms.entries()) {
      if (room.participants.has(socketId)) {
        return code;
      }
    }
    return null;
  }

  /**
   * Get stats
   * @returns {{ totalRooms: number, totalParticipants: number }}
   */
  getStats() {
    let totalParticipants = 0;
    for (const room of this.rooms.values()) {
      totalParticipants += room.participants.size;
    }
    return { totalRooms: this.rooms.size, totalParticipants };
  }
}

export default RoomManager;
