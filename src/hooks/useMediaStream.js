import { useState, useRef, useCallback, useEffect } from 'react';
import { getAudioLevel } from '../utils/audioProcessing';

export function useMediaStream() {
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioContextRef = useRef(null);

  const startStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Set up audio analyser for level detection
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setLocalStream(stream);
      setError(null);

      // Start audio level monitoring
      const monitorLevel = () => {
        if (analyserRef.current) {
          const level = getAudioLevel(analyserRef.current);
          setAudioLevel(level);
        }
        animFrameRef.current = requestAnimationFrame(monitorLevel);
      };
      monitorLevel();

      return stream;
    } catch (err) {
      console.error('[Media] Failed to get user media:', err);
      setError(err.message || 'Microphone access denied');
      return null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const stopStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, [localStream]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    localStream,
    isMuted,
    audioLevel,
    error,
    startStream,
    toggleMute,
    stopStream,
  };
}
