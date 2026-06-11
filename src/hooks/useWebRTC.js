import { useRef, useCallback, useState } from 'react';
import { ICE_SERVERS } from '../utils/constants';

export function useWebRTC(socketRef) {
  const peersRef = useRef(new Map()); // Map<socketId, { pc: RTCPeerConnection, stream: MediaStream }>
  const [peerStreams, setPeerStreams] = useState(new Map()); // Map<socketId, MediaStream>
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const setLocalStream = useCallback((stream) => {
    localStreamRef.current = stream;
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

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        peersRef.current.set(remoteSocketId, {
          ...peersRef.current.get(remoteSocketId),
          stream: remoteStream,
        });
        setPeerStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteSocketId, remoteStream);
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
        // Connection failed — could implement reconnection here
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
   * Handle incoming offer (callee side)
   */
  const handleOffer = useCallback(async ({ from, offer }) => {
    const pc = createPeerConnection(from);

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
  }, []);

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
      setIsScreenSharing(true);

      // Add screen track to all peer connections
      const screenTrack = screenStream.getVideoTracks()[0];
      peersRef.current.forEach(({ pc }) => {
        pc.addTrack(screenTrack, screenStream);
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
    setIsScreenSharing(false);
  }, []);

  /**
   * Cleanup all peer connections
   */
  const cleanup = useCallback(() => {
    peersRef.current.forEach(({ pc }) => {
      if (pc) pc.close();
    });
    peersRef.current.clear();
    setPeerStreams(new Map());
    stopScreenShare();
  }, [stopScreenShare]);

  return {
    peerStreams,
    isScreenSharing,
    setLocalStream,
    callPeer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
    startScreenShare,
    stopScreenShare,
    cleanup,
  };
}
