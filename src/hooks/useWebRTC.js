import { useRef, useCallback, useState } from 'react';
import { ICE_SERVERS } from '../utils/constants';

export function useWebRTC(socketRef) {
  const peersRef = useRef(new Map()); // Map<socketId, { pc: RTCPeerConnection, stream: MediaStream }>
  const [peerStreams, setPeerStreams] = useState(new Map()); // Map<socketId, MediaStream> (Audio only)
  const [peerScreenStreams, setPeerScreenStreams] = useState(new Map()); // Map<socketId, MediaStream> (Video only)
  const [localScreenStream, setLocalScreenStream] = useState(null); // Local screen share stream for preview
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const setLocalStream = useCallback((stream) => {
    localStreamRef.current = stream;
  }, []);

  /**
   * Remove screen stream for a specific socketId
   */
  const removePeerScreenStream = useCallback((socketId) => {
    setPeerScreenStreams((prev) => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
  }, []);

  /**
   * Create a peer connection for a remote participant
   */
  const createPeerConnection = useCallback((remoteSocketId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local audio track
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Add local screen share track if currently sharing
    if (screenStreamRef.current) {
      const screenTrack = screenStreamRef.current.getVideoTracks()[0];
      if (screenTrack) {
        pc.addTrack(screenTrack, screenStreamRef.current);
      }
    }

    // Handle incoming remote stream tracks
    pc.ontrack = (event) => {
      const track = event.track;
      const stream = event.streams[0];
      if (!stream) return;

      console.log(`[WebRTC] ontrack from ${remoteSocketId}: kind=${track.kind}`);
      if (track.kind === 'audio') {
        peersRef.current.set(remoteSocketId, {
          ...peersRef.current.get(remoteSocketId),
          stream: stream,
        });
        setPeerStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteSocketId, stream);
          return next;
        });
      } else if (track.kind === 'video') {
        setPeerScreenStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteSocketId, stream);
          return next;
        });
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state for ${remoteSocketId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn(`[WebRTC] Connection to ${remoteSocketId} ${pc.iceConnectionState}`);
      }
    };

    peersRef.current.set(remoteSocketId, { pc, stream: null });
    return pc;
  }, [socketRef]);

  /**
   * Initiate a connection to a remote peer (caller side)
   */
  const callPeer = useCallback(async (remoteSocketId) => {
    const pc = createPeerConnection(remoteSocketId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socketRef.current) {
        socketRef.current.emit('offer', {
          to: remoteSocketId,
          offer: pc.localDescription,
        });
      }
    } catch (err) {
      console.error('[WebRTC] Error creating offer:', err);
    }
  }, [createPeerConnection, socketRef]);

  /**
   * Handle WebRTC renegotiation when tracks are added/removed
   */
  const renegotiate = useCallback(async (remoteSocketId) => {
    const peer = peersRef.current.get(remoteSocketId);
    if (peer?.pc) {
      if (peer.pc.signalingState !== 'stable') {
        console.warn(`[WebRTC] Signaling state for ${remoteSocketId} is ${peer.pc.signalingState}, postponing renegotiation...`);
        setTimeout(() => renegotiate(remoteSocketId), 200);
        return;
      }
      try {
        console.log('[WebRTC] Creating renegotiation offer for:', remoteSocketId);
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        if (socketRef.current) {
          socketRef.current.emit('offer', {
            to: remoteSocketId,
            offer: peer.pc.localDescription,
          });
        }
      } catch (err) {
        console.error('[WebRTC] Renegotiation offer error:', err);
      }
    }
  }, [socketRef]);

  /**
   * Handle incoming offer (callee side) - supports renegotiation
   */
  const handleOffer = useCallback(async ({ from, offer }) => {
    let pc = peersRef.current.get(from)?.pc;
    if (!pc) {
      pc = createPeerConnection(from);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socketRef.current) {
        socketRef.current.emit('answer', {
          to: from,
          answer: pc.localDescription,
        });
      }
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
    }
  }, [createPeerConnection, socketRef]);

  /**
   * Handle incoming answer
   */
  const handleAnswer = useCallback(async ({ from, answer }) => {
    const peer = peersRef.current.get(from);
    if (peer?.pc) {
      try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('[WebRTC] Error setting remote description:', err);
      }
    }
  }, []);

  /**
   * Handle incoming ICE candidate
   */
  const handleIceCandidate = useCallback(async ({ from, candidate }) => {
    const peer = peersRef.current.get(from);
    if (peer?.pc) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    }
  }, []);

  /**
   * Remove a peer connection
   */
  const removePeer = useCallback((socketId) => {
    const peer = peersRef.current.get(socketId);
    if (peer?.pc) {
      peer.pc.close();
    }
    peersRef.current.delete(socketId);
    setPeerStreams((prev) => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
    setPeerScreenStreams((prev) => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
  }, []);

  /**
   * Sync active peer connections with server list (removes stale/ghost peers)
   */
  const syncPeers = useCallback((activeSocketIds) => {
    const activeSet = new Set(activeSocketIds);
    peersRef.current.forEach((peer, socketId) => {
      if (!activeSet.has(socketId)) {
        console.log(`[WebRTC] Closing stale peer connection: ${socketId}`);
        if (peer.pc) {
          try {
            peer.pc.close();
          } catch (e) {
            console.error('[WebRTC] Error closing peer:', e);
          }
        }
        peersRef.current.delete(socketId);
        setPeerStreams((prev) => {
          const next = new Map(prev);
          next.delete(socketId);
          return next;
        });
        setPeerScreenStreams((prev) => {
          const next = new Map(prev);
          next.delete(socketId);
          return next;
        });
      }
    });
  }, []);

  /**
   * Stop screen sharing
   */
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        // Remove track from all peers
        peersRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find((s) => s.track === track);
          if (sender) {
            pc.removeTrack(sender);
          }
        });
      });
      screenStreamRef.current = null;
    }
    setLocalScreenStream(null);
    setIsScreenSharing(false);

    // Trigger renegotiation for all peers so they know the screen share track is gone
    peersRef.current.forEach((peer, remoteSocketId) => {
      renegotiate(remoteSocketId);
    });
  }, [renegotiate]);

  /**
   * Start screen sharing
   */
  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;
      setLocalScreenStream(screenStream);
      setIsScreenSharing(true);

      // Add screen track to all peer connections and renegotiate
      const screenTrack = screenStream.getVideoTracks()[0];
      peersRef.current.forEach(({ pc }, remoteSocketId) => {
        const hasVideo = pc.getSenders().some((s) => s.track && s.track.kind === 'video');
        if (!hasVideo) {
          pc.addTrack(screenTrack, screenStream);
          renegotiate(remoteSocketId);
        }
      });

      // Handle when user stops sharing via browser UI
      screenTrack.onended = () => {
        stopScreenShare();
      };

      return screenStream;
    } catch (err) {
      console.error('[WebRTC] Screen share error:', err);
      return null;
    }
  }, [renegotiate, stopScreenShare]);

  /**
   * Cleanup all peer connections
   */
  const cleanup = useCallback(() => {
    peersRef.current.forEach(({ pc }) => {
      if (pc) pc.close();
    });
    peersRef.current.clear();
    setPeerStreams(new Map());
    setPeerScreenStreams(new Map());
    setLocalScreenStream(null);
    stopScreenShare();
  }, [stopScreenShare]);

  return {
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
    cleanup,
  };
}
