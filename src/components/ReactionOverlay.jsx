import { useState, useEffect } from 'react';

export default function ReactionOverlay({ reactions }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {reactions.map((reaction) => (
        <FloatingReaction key={reaction.id} emoji={reaction.emoji} sender={reaction.sender} />
      ))}
    </div>
  );
}

function FloatingReaction({ emoji, sender }) {
  const [style] = useState(() => ({
    left: `${20 + Math.random() * 60}%`,
    bottom: '80px',
    animationDuration: `${1.5 + Math.random() * 1}s`,
  }));

  return (
    <div
      className="absolute animate-float-up flex flex-col items-center"
      style={style}
    >
      <span className="text-4xl drop-shadow-lg">{emoji}</span>
      <span className="text-[10px] text-text-secondary bg-bg-secondary/80 px-2 py-0.5 rounded-full mt-1 backdrop-blur-sm">
        {sender}
      </span>
    </div>
  );
}
