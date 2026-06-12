export const MAX_PARTICIPANTS = 10;

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const VOICE_DEFAULTS = {
  pitch: 0.75,     // Slightly deeper voice by default for noticeable disguise
  modulation: 15,  // Light ring modulation for subtle robotic tinge
  distortion: 0,   // No distortion by default
};

export const REACTIONS = ['👍', '👎', '😂', '🎉', '❤️', '🔥', '👀', '🤔'];

export const KEYBOARD_SHORTCUTS = {
  MUTE: 'm',
  CHAT: 'c',
  VOICE: 'v',
  SCREEN_SHARE: 's',
  LEAVE: 'Escape',
};

export const SOCKET_URL =
  import.meta.env.MODE === 'production'
    ? ''
    : `http://${window.location.hostname}:3001`;
