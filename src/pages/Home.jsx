import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home({ socket, connected }) {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Animated background bars
  const [bars] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      height: 20 + Math.random() * 60,
      delay: i * 0.08,
      duration: 1 + Math.random() * 1.5,
    }))
  );

  const handleCreate = () => {
    if (!connected || !socket) {
      setError('Not connected to server. Please wait...');
      return;
    }
    setLoading(true);
    setError('');

    socket.emit('create-room', (response) => {
      setLoading(false);
      if (response.success) {
        navigate(`/room/${response.roomCode}`, {
          state: { identity: response.identity, participants: response.participants },
        });
      } else {
        setError('Failed to create room. Please try again.');
      }
    });
  };

  const handleJoin = () => {
    const code = joinCode.trim().toLowerCase();
    if (!code) {
      setError('Please enter a room code');
      return;
    }
    if (!connected || !socket) {
      setError('Not connected to server. Please wait...');
      return;
    }
    setLoading(true);
    setError('');

    socket.emit('join-room', code, (response) => {
      setLoading(false);
      if (response.success) {
        navigate(`/room/${response.roomCode}`, {
          state: { identity: response.identity, participants: response.participants },
        });
      } else {
        setError(response.error || 'Failed to join room');
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background animation */}
      <div className="absolute inset-0 flex items-end justify-center opacity-[0.04] pointer-events-none">
        <div className="flex gap-1 items-end pb-20">
          {bars.map((bar, i) => (
            <div
              key={i}
              className="w-1.5 bg-accent rounded-full"
              style={{
                height: `${bar.height}px`,
                animation: `wave ${bar.duration}s ease-in-out ${bar.delay}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-accent/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-accent-secondary/10 rounded-full blur-[100px]" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent/10 rounded-2xl mb-4 border border-accent/20">
            <span className="text-4xl">🎭</span>
          </div>
          <h1 className="text-4xl font-bold text-text-primary tracking-tight">
            Meet<span className="text-accent">Mask</span>
          </h1>
          <p className="text-text-secondary mt-2 text-sm">
            Anonymous voice meetings. No login. No trace.
          </p>
        </div>

        {/* Card */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-6 shadow-lg backdrop-blur-sm">
          {/* Connection status */}
          <div className="flex items-center gap-2 mb-6 justify-center">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
            <span className="text-xs text-text-muted">
              {connected ? 'Connected to server' : 'Connecting...'}
            </span>
          </div>

          {/* Create Room */}
          <button
            onClick={handleCreate}
            disabled={loading || !connected}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 mb-4 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-accent/20"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create New Room
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted">or join existing</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Join Room */}
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter room code (e.g., abc-defg)"
              className="flex-1 bg-bg-primary border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors font-mono"
            />
            <button
              onClick={handleJoin}
              disabled={loading || !connected || !joinCode.trim()}
              className="bg-bg-tertiary hover:bg-border-light disabled:opacity-40 disabled:cursor-not-allowed text-text-primary font-medium px-5 py-3 rounded-xl transition-all duration-200"
            >
              Join
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-fade-in">
              {error}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          {[
            { icon: '🔒', label: 'No Login', desc: 'Completely anonymous' },
            { icon: '🎭', label: 'Voice Mask', desc: 'Real-time disguise' },
            { icon: '💨', label: 'Ephemeral', desc: 'No data stored' },
          ].map((f) => (
            <div key={f.label} className="text-center animate-slide-up">
              <div className="text-2xl mb-1">{f.icon}</div>
              <p className="text-xs font-medium text-text-primary">{f.label}</p>
              <p className="text-[10px] text-text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="absolute bottom-4 text-[10px] text-text-muted">
        MeetMask — Privacy-first anonymous meetings
      </p>
    </div>
  );
}
