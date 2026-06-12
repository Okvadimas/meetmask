import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ParticipantCard from '../components/ParticipantCard';
import ControlBar from '../components/ControlBar';
import VoiceControls from '../components/VoiceControls';
import ChatPanel from '../components/ChatPanel';
import ReactionOverlay from '../components/ReactionOverlay';
import ScreenShare from '../components/ScreenShare';
import { useMediaStream } from '../hooks/useMediaStream';
import { useVoiceMask } from '../hooks/useVoiceMask';
import { useWebRTC } from '../hooks/useWebRTC';
import { KEYBOARD_SHORTCUTS } from '../utils/constants';

export default function Room({ socket, socketRef, connected }) {
  const { code } = useParams();
  const navigate = useNavigate();

  // State — never trust location.state for join status (it persists across refreshes)
  const [identity, setIdentity] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [screenSharer, setScreenSharer] = useState(null);
  const screenSharerRef = useRef(null);
  useEffect(() => {
    screenSharerRef.current = screenSharer;
  }, [screenSharer]);
  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState(false);

  // Hooks
  const { localStream, isMuted, audioLevel, error: mediaError, startStream, toggleMute, stopStream } = useMediaStream();
  const {
    settings,
    processStream,
    setPitch,
    setModulation,
    setDistortion,
    setVolume,
    setDenoise,
    resetDefaults,
    cleanup: cleanupVoice,
    isSelfListenEnabled,
    setSelfListenEnabled,
    selfListenVolume,
    setSelfListenVolume,
  } = useVoiceMask();
  const {
    peerStreams,
    peerScreenStreams,
    localScreenStream,
    isScreenSharing,
    setLocalStream,
    callPeer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
    removePeerScreenStream,
    startScreenShare,
    stopScreenShare,
    syncPeers,
    cleanup: cleanupWebRTC,
  } = useWebRTC(socketRef);

  const processedStreamRef = useRef(null);

  // Always join/rejoin the room via socket when connected
  // Server handles idempotency: if socket is already in room, returns existing identity
  useEffect(() => {
    if (!joined && socket && connected) {
      socket.emit('join-room', code, (response) => {
        if (response.success) {
          setIdentity(response.identity);
          setParticipants(response.participants);
          setJoined(true);
          
          // Instantly check if someone is already screen sharing in the room
          const sharer = response.participants.find((p) => p.isScreenSharing);
          if (sharer) {
            setScreenSharer({ socketId: sharer.socketId, name: sharer.name });
          }
        } else {
          navigate('/', { state: { error: response.error } });
        }
      });
    }
  }, [joined, socket, connected, code, navigate]);

  // Initialize audio
  useEffect(() => {
    if (joined) {
      startStream().then(async (stream) => {
        if (stream) {
          // Process through voice mask (async — loads AudioWorklet)
          const processed = await processStream(stream);
          processedStreamRef.current = processed || stream;
          setLocalStream(processedStreamRef.current);
          
          // Notify server that our local stream is ready
          socket?.emit('client-ready', { roomCode: code });
        }
      });
    }
  }, [joined]);


  // Immediately notify server on page refresh/close so socket is cleaned up fast
  useEffect(() => {
    if (!socket || !joined) return;

    const handleBeforeUnload = () => {
      socket.emit('leave-room', code);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [socket, joined, code]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleParticipantJoined = (participant) => {
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === participant.socketId)) return prev;
        return [...prev, participant];
      });
      // Do NOT call callPeer here, wait for the peer-ready signal!
    };

    const handleParticipantLeft = ({ socketId }) => {
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      removePeer(socketId);
      if (screenSharerRef.current?.socketId === socketId) {
        setScreenSharer(null);
      }
    };

    // Server sends the authoritative participant list after any join/leave
    const handleForceSync = ({ participants: serverParticipants }) => {
      console.log('[Sync] Force-sync received, participants:', serverParticipants.length);
      setParticipants(serverParticipants);

      // Sync WebRTC peer connections
      const activeSocketIds = serverParticipants.map((p) => p.socketId);
      syncPeers(activeSocketIds);

      // Sync screen sharer state
      const sharer = serverParticipants.find((p) => p.isScreenSharing);
      if (sharer) {
        setScreenSharer({ socketId: sharer.socketId, name: sharer.name });
      } else {
        if (screenSharerRef.current && screenSharerRef.current.socketId !== socket?.id) {
          setScreenSharer(null);
        }
      }
    };

    const handlePeerReady = ({ socketId }) => {
      console.log('[WebRTC] Peer is ready, initiating call to:', socketId);
      callPeer(socketId);
    };

    const handleChatMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleReaction = (reaction) => {
      setReactions((prev) => [...prev, reaction]);
      // Remove after animation
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 2500);
    };

    const handleScreenShareStarted = ({ socketId, name }) => {
      setScreenSharer({ socketId, name });
    };

    const handleScreenShareStopped = ({ socketId }) => {
      if (screenSharerRef.current?.socketId === socketId) {
        setScreenSharer(null);
      }
      removePeerScreenStream(socketId);
    };

    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('force-sync', handleForceSync);
    socket.on('peer-ready', handlePeerReady);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('chat-message', handleChatMessage);
    socket.on('reaction', handleReaction);
    socket.on('screen-share-started', handleScreenShareStarted);
    socket.on('screen-share-stopped', handleScreenShareStopped);

    return () => {
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('force-sync', handleForceSync);
      socket.off('peer-ready', handlePeerReady);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('chat-message', handleChatMessage);
      socket.off('reaction', handleReaction);
      socket.off('screen-share-started', handleScreenShareStarted);
      socket.off('screen-share-stopped', handleScreenShareStopped);
    };
  }, [socket]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case KEYBOARD_SHORTCUTS.MUTE:
          toggleMute();
          break;
        case KEYBOARD_SHORTCUTS.CHAT:
          setIsChatOpen((prev) => !prev);
          break;
        case KEYBOARD_SHORTCUTS.VOICE:
          setIsVoiceOpen((prev) => !prev);
          break;
        case KEYBOARD_SHORTCUTS.SCREEN_SHARE:
          handleToggleScreenShare();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMute]);

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      socket?.emit('screen-share-stopped', { roomCode: code });
      setScreenSharer(null);
    } else {
      const stream = await startScreenShare();
      if (stream) {
        socket?.emit('screen-share-started', { roomCode: code });
        setScreenSharer({ socketId: socket.id, name: identity?.name, stream });
      }
    }
  };

  const handleToggleDenoise = () => {
    setDenoise(!(settings.denoise ?? true));
  };

  const handleSendMessage = (message) => {
    socket?.emit('chat-message', { roomCode: code, message });
  };

  const handleReaction = (emoji) => {
    socket?.emit('reaction', { roomCode: code, emoji });
  };

  const handleLeave = () => {
    socket?.emit('leave-room', code);
    stopStream();
    cleanupVoice();
    cleanupWebRTC();
    navigate('/');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Joining room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎭</span>
          <div>
            <h1 className="text-sm font-semibold text-text-primary">
              Meet<span className="text-accent">Mask</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Room code */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 bg-bg-primary border border-border rounded-lg px-3 py-1.5 hover:border-accent/50 transition-colors group"
          >
            <span className="text-xs font-mono text-text-secondary group-hover:text-text-primary transition-colors">
              {code}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-text-muted transition-colors ${copied ? 'text-success' : ''}`}
            >
              {copied ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </>
              )}
            </svg>
          </button>

          {/* Participant count */}
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {participants.length}
          </div>

          {/* Your identity */}
          {identity && (
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: identity.color + '20', color: identity.color, border: `2px solid ${identity.color}` }}
              >
                {identity.name.split(' ').map((w) => w[0]).join('')}
              </div>
              <span className="text-xs font-medium" style={{ color: identity.color }}>
                {identity.name}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Meeting area */}
        <div className="flex-1 flex flex-col">
          {/* Screen share area */}
          {screenSharer && (
            <div className="p-4 shrink-0">
              <ScreenShare
                stream={screenSharer.socketId === socket?.id ? localScreenStream : peerScreenStreams.get(screenSharer.socketId)}
                sharerName={screenSharer.name}
                isLocal={screenSharer.socketId === socket?.id}
                onStopSharing={handleToggleScreenShare}
              />
            </div>
          )}

          {/* Participants grid */}
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 max-w-4xl">
              {/* Local participant */}
              {identity && (
                <ParticipantCard
                  name={identity.name}
                  color={identity.color}
                  isSpeaking={audioLevel > 0.05}
                  isMuted={isMuted}
                  isLocal={true}
                  audioLevel={audioLevel}
                />
              )}

              {/* Remote participants */}
              {participants
                .filter((p) => p.socketId !== socket?.id)
                .map((p) => (
                  <ParticipantCard
                    key={p.socketId}
                    name={p.name}
                    color={p.color}
                    isSpeaking={false}
                    isMuted={false}
                    isLocal={false}
                    audioLevel={0}
                  />
                ))}
            </div>
          </div>

          {/* Media error */}
          {mediaError && (
            <div className="mx-4 mb-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-2 animate-fade-in">
              ⚠️ Microphone error: {mediaError}
            </div>
          )}

          {/* Voice controls panel */}
          <VoiceControls
            settings={settings}
            onPitchChange={setPitch}
            onModulationChange={setModulation}
            onDistortionChange={setDistortion}
            onVolumeChange={setVolume}
            onDenoiseToggle={setDenoise}
            onReset={resetDefaults}
            isOpen={isVoiceOpen}
            isSelfListenEnabled={isSelfListenEnabled}
            onSelfListenToggle={setSelfListenEnabled}
            selfListenVolume={selfListenVolume}
            onSelfListenVolumeChange={setSelfListenVolume}
          />

          {/* Control bar */}
          <ControlBar
            isMuted={isMuted}
            onToggleMute={toggleMute}
            isScreenSharing={isScreenSharing}
            onToggleScreenShare={handleToggleScreenShare}
            onToggleChat={() => setIsChatOpen(!isChatOpen)}
            isChatOpen={isChatOpen}
            onToggleVoice={() => setIsVoiceOpen(!isVoiceOpen)}
            isVoiceOpen={isVoiceOpen}
            onReaction={handleReaction}
            onLeave={handleLeave}
            isDenoiseActive={settings.denoise ?? true}
            onToggleDenoise={handleToggleDenoise}
          />
        </div>

        {/* Chat panel */}
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </div>

      {/* Reaction overlay */}
      <ReactionOverlay reactions={reactions} />

      {/* Hidden audio elements for remote peers */}
      {Array.from(peerStreams.entries()).map(([peerId, stream]) => (
        <audio
          key={peerId}
          autoPlay
          playsInline
          ref={(el) => {
            if (el && stream) el.srcObject = stream;
          }}
        />
      ))}
    </div>
  );
}
