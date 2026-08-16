import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface RefractiveGlassCardProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  highlightColor?: string;
  onClick?: () => void;
}

export const RefractiveGlassCard: React.FC<RefractiveGlassCardProps> = ({
  children,
  className = '',
  intensity = 15,
  highlightColor = 'rgba(16, 185, 129, 0.15)',
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotateX, setRotateX] = useState<number>(0);
  const [rotateY, setRotateY] = useState<number>(0);
  const [glarePosition, setGlarePosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = ((y - centerY) / centerY) * -intensity;
    const rY = ((x - centerX) / centerX) * intensity;

    setRotateX(rX);
    setRotateY(rY);

    setGlarePosition({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
    setGlarePosition({ x: 50, y: 50 });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transformStyle: 'preserve-3d',
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.5s ease-out',
      }}
      className={`relative overflow-hidden rounded-2xl bg-white/[0.04] dark:bg-black/30 border border-white/10 backdrop-blur-xl shadow-xl transition-shadow duration-300 ${
        isHovered ? 'shadow-emerald-950/40 border-emerald-500/30' : ''
      } ${className}`}
    >
      {/* Specular Glare / Refractive Light Layer */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 rounded-2xl"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(600px circle at ${glarePosition.x}% ${glarePosition.y}%, ${highlightColor}, transparent 40%)`,
        }}
      />

      {/* Edge highlight reflection */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,${
            isHovered ? '0.12' : '0.04'
          }) 0%, transparent 60%)`,
        }}
      />

      {/* Card Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

export default RefractiveGlassCard;
