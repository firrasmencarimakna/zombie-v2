"use client";

import Image from "next/image";
import { useEffect } from "react";
import { motion } from "framer-motion";
import React from "react";

interface ZombieState {
  isAttacking: boolean;
  targetPlayerId: string | null;
  attackProgress: number;
  basePosition: number;
  currentPosition: number;
}

interface ZombieCharacterProps {
  zombieState: ZombieState;
  animationTime: number;
  gameMode: "normal" | "panic";
  centerX: number;
  chaserType: string;
  players: Array<{ id: string; nickname: string }>;
}

const chaserImages = {
  zombie: {
    src: "/character/chaser/zombie.gif",
    alt: "Zombie",
    width: 150,
    height: 50,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
  monster1: {
    src: "/character/chaser/monster1.gif",
    alt: "Mutant Gila",
    width: 150,
    height: 60,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
  monster2: {
    src: "/character/chaser/monster2.gif",
    alt: "Monster Rawa",
    width: 150,
    height: 75,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
  monster3: {
    src: "/character/chaser/monster3.gif",
    alt: "Samurai Gila",
    width: 150,
    height: 65,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
  darknight: {
    src: "/character/chaser/darknight.gif",
    alt: "Ksatria Gelap",
    width: 150,
    height: 70,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
};

const ZombieCharacter = React.memo(
  ({ zombieState, animationTime, gameMode, centerX, chaserType, players }: ZombieCharacterProps) => {
    const selectedChaser = chaserImages[chaserType as keyof typeof chaserImages] || chaserImages.zombie;
    const ZOMBIE_SPEED = 30;
    const ATTACK_DISTANCE = 50;

    const normalMovement = {
      x: Math.sin(animationTime * 0.4) * (gameMode === "panic" ? 100 : 20), // Reduced movement range
      y: Math.sin(animationTime * 1.0) * (gameMode === "panic" ? 30 : 10),
      rotation: Math.sin(animationTime * (gameMode === "panic" ? 0.3 : 0.15)) * (gameMode === "panic" ? 15 : 10),
      scale: gameMode === "panic" ? 1.8 : 1.6,
    };

    const attackMovement = {
      x: zombieState.attackProgress * ATTACK_DISTANCE,
      y: 0,
      rotation: 0,
      scale: gameMode === "panic" ? 2.0 : 1.8,
    };

    const currentMovement = zombieState.isAttacking ? attackMovement : normalMovement;

    return (
      <motion.div
        className="absolute z-40 origin-bottom"
        style={{
          left: `${centerX - zombieState.currentPosition + currentMovement.x + selectedChaser.horizontalOffset}px`,
          top: selectedChaser.verticalOffset,
          transform: `translateY(${currentMovement.y}px)`,
        }}
        animate={{
          scale: zombieState.isAttacking ? [1, 1.2, 1] : 1,
          filter: zombieState.isAttacking
            ? "brightness(1.4) contrast(1.4) drop-shadow(0 0 10px rgba(255,50,50,0.6))"
            : gameMode === "panic"
              ? "brightness(1.2) contrast(1.2)"
              : "brightness(1.0) contrast(1.0)",
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative">
          {/* Efek darah saat menyerang */}
          {zombieState.isAttacking && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-4 h-12 bg-red-700 animate-drip">
              <div className="absolute bottom-0 w-6 h-6 bg-red-700 rounded-full animate-pulse" />
            </div>
          )}

          {/* Gambar pengejar */}
          <Image
            src={selectedChaser.src}
            alt={selectedChaser.alt}
            width={selectedChaser.width}
            height={selectedChaser.height}
            className="drop-shadow-xl"
            loading="lazy"
            style={{
              imageRendering: "pixelated",
              transform: `scale(${currentMovement.scale}) rotate(${currentMovement.rotation}deg)`,
              transformOrigin: "bottom center",
            }}
          />

          {/* Bayangan dinamis */}
          <div
            className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-black/50 rounded-full blur-md animate-shadow"
            style={{
              transform: `translateX(-50%) scaleX(${zombieState.isAttacking ? 1.2 + zombieState.attackProgress * 0.2 : 1})`,
              opacity: zombieState.isAttacking ? 0.6 : 0.4,
            }}
          />
        </div>

        <style jsx>{`
          @keyframes drip { 
            0% { height: 0; opacity: 1; }
            50% { height: 12px; opacity: 1; }
            100% { height: 24px; opacity: 0; }
          }
          .animate-drip {
            animation: drip 0.5s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.9; }
            50% { opacity: 1; }
          }
          .animate-pulse {
            animation: pulse 0.5s infinite;
          }
          @keyframes shadow {
            0%, 100% { transform: translateX(-50%) scaleX(0.8); }
            50% { transform: translateX(-50%) scaleX(1); }
          }
          .animate-shadow {
            animation: shadow 1s infinite ease-in-out;
          }
        `}</style>
      </motion.div>
    );
  }
);

export default ZombieCharacter;