# MeetMask Documentation

> Anonymous voice meetings. No login. No trace.

MeetMask is a privacy-first anonymous online meeting platform built with WebRTC peer-to-peer technology and real-time voice masking using the Web Audio API. No accounts needed — just create a room, share the code, and start talking with disguised voices.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Voice Masking](#voice-masking)
- [WebRTC Mesh Topology](#webrtc-mesh-topology)
- [Room Management](#room-management)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Limitations](#limitations)

---

## Features

| Feature | Description |
|---------|-------------|
| 🔒 **No Login** | Completely anonymous — no accounts, no emails, no passwords |
| 🎭 **Voice Masking** | Real-time voice disguise with customizable pitch, modulation, and distortion |
| 💬 **Text Chat** | In-room messaging with colored anonymous names |
| 🖥️ **Screen Sharing** | Share your screen with all participants |
| 😀 **Reactions** | Send floating emoji reactions (👍 👎 😂 🎉 ❤️ 🔥 👀 🤔) |
| 🎤 **Mute/Unmute** | Toggle microphone with visual mute indicator |
| 👥 **Speaking Indicator** | Visual glow when someone is speaking |
| 🎧 **Self-Listen** | Hear your own voice-masked audio in real-time to preview effects |
| 💨 **Ephemeral** | Zero data persistence — rooms self-destruct when empty |
| ⌨️ **Keyboard Shortcuts** | Quick actions with M, C, V, S keys |
| 🌙 **Dark Mode** | Beautiful Discord-inspired dark theme |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite | UI rendering and bundling |
| Styling | Tailwind CSS v4 | Utility-first CSS framework |
| Backend | Node.js + Express v5 | HTTP server and static files |
| Real-time | Socket.IO | WebSocket signaling for WebRTC |
| Communication | WebRTC | Peer-to-peer audio/video streaming |
| Voice Processing | Web Audio API | Client-side voice masking effects |
| Font | Inter (Google Fonts) | Typography |

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- A modern browser with WebRTC support (Chrome, Firefox, Edge, Safari)

### Installation

```bash
# Clone or navigate to the project directory
cd meetmask

# Install dependencies
npm install
```

### Running in Development

```bash
# Start both frontend and backend concurrently
npm run dev:all
```

This starts:
- **Vite dev server** at `http://localhost:5173` (frontend)
- **Express server** at `http://localhost:3001` (backend/signaling)

The Vite dev server proxies Socket.IO requests to the backend automatically.

### Individual Commands

```bash
# Frontend only
npm run dev

# Backend only
npm run server

# Production build
npm run build

# Preview production build
npm run preview
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Browser (Client)                │
│                                                  │
│  ┌──────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ React UI │──│ Web Audio   │──│ WebRTC     │ │
│  │          │  │ API (Voice  │  │ Peer       │ │
│  │ Pages &  │  │ Masking)    │  │ Connection │ │
│  │ Components│  └─────────────┘  └──────┬─────┘ │
│  └──────────┘                           │       │
│       │                                 │       │
│  ┌────┴─────┐                    ┌──────┴──────┐│
│  │Socket.IO │                    │ P2P Audio   ││
│  │ Client   │                    │ Stream      ││
│  └────┬─────┘                    └──────┬──────┘│
└───────┼──────────────────────────────────┼──────┘
        │ Signaling                        │ Media
        │ (WebSocket)                      │ (SRTP)
┌───────┼──────────────────────────┐       │
│  ┌────┴─────┐                    │       │
│  │Socket.IO │  ┌──────────────┐  │       │
│  │ Server   │──│ Room Manager │  │       │
│  └──────────┘  │ (in-memory)  │  │       │
│                └──────────────┘  │       │
│          Node.js Server          │       │
└──────────────────────────────────┘       │
                                           │
                              ┌────────────┘
                              │
                    ┌─────────┴──────────┐
                    │  Other Browsers    │
                    │  (P2P Mesh)        │
                    └────────────────────┘
```

**Key Points:**
- The server only handles signaling (SDP offers/answers, ICE candidates) and room management
- Audio streams flow directly between browsers via WebRTC (peer-to-peer)
- Voice masking happens entirely in the browser using Web Audio API
- No audio data ever touches the server

---

## Project Structure

```
meetmask/
├── server/                     # Backend (Node.js)
│   ├── index.js                # Express + Socket.IO entry
│   ├── roomManager.js          # In-memory room state
│   ├── signaling.js            # WebRTC signaling events
│   └── nameGenerator.js        # Random anonymous names
├── src/                        # Frontend (React)
│   ├── main.jsx                # React entry point
│   ├── App.jsx                 # Router setup
│   ├── index.css               # Tailwind + design system
│   ├── pages/
│   │   ├── Home.jsx            # Landing page
│   │   └── Room.jsx            # Meeting room
│   ├── components/
│   │   ├── ParticipantCard.jsx # User avatar + name
│   │   ├── VoiceControls.jsx   # Voice mask sliders
│   │   ├── ChatPanel.jsx       # Text chat sidebar
│   │   ├── ControlBar.jsx      # Bottom action bar
│   │   ├── ReactionOverlay.jsx # Floating emojis
│   │   └── ScreenShare.jsx     # Screen sharing view
│   ├── hooks/
│   │   ├── useSocket.js        # Socket.IO connection
│   │   ├── useMediaStream.js   # Microphone access
│   │   ├── useVoiceMask.js     # Audio processing pipeline
│   │   └── useWebRTC.js        # Peer connections
│   └── utils/
│       ├── constants.js        # App configuration
│       └── audioProcessing.js  # DSP utilities
├── index.html                  # HTML template
├── vite.config.js              # Vite configuration
└── package.json                # Dependencies & scripts
```

---

## How It Works

### 1. Creating/Joining a Room

1. User clicks **"Create New Room"** → server generates a room code (e.g., `abc-defg`)
2. Or enters an existing code and clicks **"Join"**
3. Server assigns a random anonymous name (e.g., "Crimson Wolf") and avatar color
4. User is navigated to `/room/:code`

### 2. Audio Flow

```
Microphone ──> MediaStream ──> Web Audio API Pipeline ──> Processed Stream ──┬──> WebRTC ──> Remote Peers
                                     │                                       └──> [Self-Listen Gain] ──> Speakers/Headphones (Local Output)
                             ┌───────┴───────┐
                             │ Pitch Shift   │
                             │ Ring Mod      │
                             │ Distortion    │
                             └───────────────┘
```

### 3. Room Lifecycle

1. **Created**: When first user creates/joins
2. **Active**: Participants communicate via P2P connections
3. **Destroyed**: Automatically when last participant leaves

No data is persisted at any point.

---

## Voice Masking

Voice masking uses the Web Audio API to process audio in real-time, entirely on the client side.

### Audio Processing Pipeline

```
                                                                            ┌──> Output (to WebRTC)
Input ──> GainNode ──> Delay (Pitch) ──> RingModulator ──> WaveShaper ──────┴──> [Self-Listen Gain] ──> Local Output (ctx.destination)
```

### Self-Listen Preview

To allow users to hear how their own voice mask sounds to other participants, MeetMask includes a **Dengarkan Diri Sendiri (Self-Listen)** option. 

- **State and Volume**: Starts **disabled** by default to prevent audio loops. Includes a dynamic volume slider (0% to 100%) so users can control the self-playback volume.
- **Feedback Loop Mitigation**: If the user is using external speakers, enabling self-listen will cause a high-pitched feedback loop (echo screech). The UI includes a prominent warning recommending the use of headphones/earphones when self-listen is active.

### Parameters

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| **Pitch** | 0.5x - 2.0x | 1.0 | Shifts voice frequency. Lower = deeper, higher = chipmunk |
| **Modulation** | 0 - 100 | 0 | Ring modulation frequency. Creates robotic/alien overtones |
| **Distortion** | 0 - 100 | 0 | Waveshaper curve amount. Adds grit and crunch to voice |

### Implementation Details

- **Pitch Shifting**: Uses LFO-modulated delay nodes for real-time pitch manipulation
- **Ring Modulation**: Oscillator node (sine wave) multiplied with voice signal
- **Distortion**: WaveShaper node with dynamically generated transfer curves
- **Zero Latency**: Processing happens in audio thread, no perceptible delay
- **AudioContext Lifecycle**: Uses a single persistent context per session. Any existing context is safely closed before creating a new one to prevent memory leaks and duplicate audio streams.

---

## WebRTC Mesh Topology

MeetMask uses a **full mesh** topology where every participant maintains a direct peer connection to every other participant.

```
     P1
    / | \
   /  |  \
  P2--+--P3
   \  |  /
    \ | /
     P4
```

### Connection Flow

1. New participant joins → server notifies existing participants
2. Each existing participant creates an **RTCPeerConnection** and sends an SDP offer
3. New participant receives offers, creates answers
4. ICE candidates are exchanged through the server
5. Direct P2P audio connections are established

### STUN Servers

Uses Google's free STUN servers for NAT traversal:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`

---

## Room Management

### Room State (In-Memory)

```javascript
Map<roomCode, {
  participants: Map<socketId, {
    name: string,      // e.g., "Crimson Wolf"
    color: string,     // e.g., "#6366f1"
    joinedAt: number   // Unix timestamp
  }>,
  createdAt: number
}>
```

### Room Code Format

- Pattern: `xxx-xxxx` (3 chars + 4 chars, lowercase alphabetic)
- Example: `abc-defg`, `xyz-pqrs`

### Constraints

- Maximum **10 participants** per room
- Room code must be unique (collision check on generation)
- Room auto-destructs when last participant leaves

### Anonymous Name Generation

Names are combinations of:
- **48 adjectives**: Swift, Silent, Mystic, Crimson, Shadow, Neon, Cosmic, Frost...
- **48 animals**: Fox, Wolf, Owl, Raven, Falcon, Panther, Lynx, Viper...
- **15 avatar colors**: Indigo, violet, pink, red, orange, amber, green, teal, cyan, blue...

Each name is unique within a room. Fallback: adds a random number suffix.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `M` | Toggle mute/unmute |
| `C` | Toggle chat panel |
| `V` | Toggle voice mask controls |
| `S` | Toggle screen sharing |
| `Escape` | Leave room (shows confirmation) |

> Shortcuts are disabled when typing in the chat input field.

---

## API Reference

### Socket.IO Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `create-room` | — | Create a new room |
| `join-room` | `roomCode: string` | Join an existing room |
| `leave-room` | `roomCode: string` | Leave the current room |
| `offer` | `{ to, offer }` | Send SDP offer to peer |
| `answer` | `{ to, answer }` | Send SDP answer to peer |
| `ice-candidate` | `{ to, candidate }` | Send ICE candidate to peer |
| `chat-message` | `{ roomCode, message }` | Send a chat message |
| `reaction` | `{ roomCode, emoji }` | Send an emoji reaction |
| `screen-share-started` | `{ roomCode }` | Notify screen share started |
| `screen-share-stopped` | `{ roomCode }` | Notify screen share stopped |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `participant-joined` | `{ socketId, name, color }` | New participant joined |
| `participant-left` | `{ socketId, name }` | Participant left |
| `offer` | `{ from, offer }` | Incoming SDP offer |
| `answer` | `{ from, answer }` | Incoming SDP answer |
| `ice-candidate` | `{ from, candidate }` | Incoming ICE candidate |
| `chat-message` | `{ id, sender, color, message, timestamp }` | Chat message received |
| `reaction` | `{ id, sender, emoji }` | Emoji reaction received |
| `screen-share-started` | `{ socketId, name }` | Someone started sharing |
| `screen-share-stopped` | `{ socketId }` | Someone stopped sharing |

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Server health check with room/participant stats |

---

## Configuration

### Constants (`src/utils/constants.js`)

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_PARTICIPANTS` | 10 | Maximum users per room |
| `ICE_SERVERS` | Google STUN | WebRTC ICE configuration |
| `VOICE_DEFAULTS` | `{ pitch: 1.0, modulation: 0, distortion: 0 }` | Default voice settings |
| `REACTIONS` | 8 emojis | Available reaction emojis |
| `SOCKET_URL` | `localhost:3001` (dev) | Socket.IO server URL |

### Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Backend server port |
| `NODE_ENV` | — | Set to `production` for prod mode |

---

## Deployment

### Production Build

```bash
# Build the frontend
npm run build

# The dist/ folder contains the static files
# Start the server (serves both API and static files)
NODE_ENV=production npm run server
```

### Important Notes

1. **HTTPS Required**: WebRTC requires a secure context (HTTPS) in production. `localhost` is exempt during development.
2. **TURN Server**: For users behind strict NATs/firewalls, you may need a TURN server (e.g., Coturn) in addition to STUN.
3. **Reverse Proxy**: Use Nginx or Caddy to handle SSL termination and proxy to the Node.js server.

### Nginx Configuration Example

```nginx
server {
    listen 443 ssl http2;
    server_name meetmask.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Limitations

| Limitation | Details | Mitigation |
|------------|---------|------------|
| **Max Participants** | 10 per room (P2P mesh) | For larger rooms, consider an SFU like mediasoup |
| **No Persistence** | Chat/room data lost on disconnect | By design for privacy |
| **STUN Only** | Some strict firewalls block P2P | Add a TURN server for production |
| **Audio Only** | No video support | Aligns with anonymity goal |
| **Pitch Shift Quality** | Web Audio API limitations | Works well for voice disguise, not studio-quality |
| **Browser Support** | Requires WebRTC + Web Audio API | All modern browsers supported |
| **Direct URL Access** | Room URL only works via navigation | Auto-joins via Socket.IO if accessed directly |

---

## License

This project is private and for internal use.

---

*Built with ❤️ by MeetMask Team*
