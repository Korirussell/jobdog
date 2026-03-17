'use client';

import { CSSProperties } from 'react';

interface AnimatedSpriteProps {
  spriteUrl: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  duration: number;
  scale?: number;
  enableMovement?: boolean;
  movementDuration?: number;
}

export default function AnimatedSprite({
  spriteUrl,
  frameWidth,
  frameHeight,
  frameCount,
  duration,
  scale = 1,
  enableMovement = false,
  movementDuration = 8,
}: AnimatedSpriteProps) {
  const wrapperStyle: CSSProperties = {
    position: 'relative',
    width: frameWidth * scale,
    height: frameHeight * scale,
    animation: enableMovement ? `doggy-walk ${movementDuration}s ease-in-out infinite` : 'none',
  };

  const containerStyle: CSSProperties = {
    width: frameWidth * scale,
    height: frameHeight * scale,
    overflow: 'hidden',
    backgroundImage: `url(${spriteUrl})`,
    backgroundSize: `${frameWidth * frameCount * scale}px ${frameHeight * scale}px`,
    backgroundPosition: '0 0',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    animation: enableMovement ? `play-sprite ${duration}s steps(${frameCount}) infinite` : 'none',
  };

  return (
    <>
      <style jsx>{`
        @keyframes play-sprite {
          from {
            background-position: 0 0;
          }
          to {
            background-position: -${frameWidth * frameCount * scale}px 0;
          }
        }

        @keyframes doggy-walk {
          0% {
            transform: translateX(-60px);
          }
          50% {
            transform: translateX(60px);
          }
          100% {
            transform: translateX(-60px);
          }
        }
      `}</style>
      <div style={wrapperStyle}>
        <div style={containerStyle} />
      </div>
    </>
  );
}
