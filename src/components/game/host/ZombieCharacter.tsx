"use client";

import Image from "next/image";
import { useRef, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";

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
  players: Array<{ id: string; nickname: string }>; // Tambahan untuk nama pemain
}

const chaserImages = {
  zombie: {
    src: "/character/chaser/zombie.gif",
    alt: "Zombie",
  },
  monster1: {
    src: "/character/chaser/monster1.gif",
    alt: "Mutant Gila",
  },
  monster2: {
    src: "/character/chaser/monster2.gif",
    alt: "Monster Rawa",
  },
    monster3: {
    src: "/character/chaser/monster3.gif",
    alt: "Samurai GIla",
  },
  darknight: {
    src: "/character/chaser/darknight.gif",
    alt: "Ksatria Gelap",
  },
};

export default function ZombieCharacter({
  zombieState,
  animationTime,
  gameMode,
  centerX,
  chaserType,
  players,
}: ZombieCharacterProps) {
  const attackRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const ZOMBIE_SPEED = 30;

  const selectedChaser = chaserImages[chaserType as keyof typeof chaserImages] || chaserImages.zombie;
  const targetPlayer = zombieState.isAttacking
    ? players.find((p) => p.id === zombieState.targetPlayerId)
    : null;

  // Efek kilatan saat serangan dimulai
  useEffect(() => {
    if (zombieState.isAttacking) {
      controls.start({
        scale: [1, 1.2, 1],
        filter: [
          "brightness(1.4) contrast(1.6) saturate(1.4)",
          "brightness(1.8) contrast(1.8) saturate(1.6)",
          "brightness(1.4) contrast(1.6) saturate(1.4)",
        ],
        transition: { duration: 0.3, ease: "easeInOut" },
      });
    } else {
      controls.start({
        scale: 1,
        filter: gameMode === "panic"
          ? "brightness(1.3) contrast(1.5) saturate(1.3)"
          : "brightness(1.1) contrast(1.2)",
        transition: { duration: 0.2 },
      });
    }
  }, [zombieState.isAttacking, gameMode, controls]);

  // Logging untuk debugging
  useEffect(() => {
    console.log("ZombieCharacter render:", {
      chaserType,
      selectedChaser: selectedChaser.src,
      isAttacking: zombieState.isAttacking,
      targetPlayer: targetPlayer?.nickname || "Tidak ada target",
    });
  }, [chaserType, zombieState.isAttacking, selectedChaser.src, targetPlayer]);

  const normalMovement = {
    x: Math.sin(animationTime * 0.4) * (gameMode === "panic" ? 140 : 30),
    y: Math.sin(animationTime * 1.0) * (gameMode === "panic" ? 50 : 15),
    rotation: Math.sin(animationTime * (gameMode === "panic" ? 0.3 : 0.15)) * (gameMode === "panic" ? 20 : 12),
    scale: gameMode === "panic" ? 2.0 : 1.8,
  };

  const attackMovement = {
    x: Math.sin(animationTime * 1.2) * 25, // Gerakan lebih agresif
    y: Math.sin(animationTime * 2.5) * 12,
    rotation: Math.sin(animationTime * 4) * 15,
    scale: 2.4, // Skala lebih besar untuk efek dramatis
  };

  const currentMovement = zombieState.isAttacking ? attackMovement : normalMovement;

  return (
    <motion.div
      ref={attackRef}
      className="absolute z-40 origin-bottom"
      style={{
        left: `${centerX - zombieState.currentPosition + currentMovement.x}px`,
        top: "87%",
        transform: `translateY(${currentMovement.y}px)`,
      }}
      animate={controls}
    >
      <div className="relative">
        {/* Indikator serangan dengan nama pemain */}
        {/* {zombieState.isAttacking && targetPlayer && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-1.5 rounded text-sm bg-red-800/90 text-white animate-pulse border border-red-500 shadow-lg"
          >
            Menyerang {targetPlayer.nickname}!
          </motion.div>
        )} */}

        {/* Efek darah saat menyerang */}
        {zombieState.isAttacking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-3 h-10 bg-red-600 animate-drip"
          >
            <div className="absolute bottom-0 w-5 h-5 bg-red-600 rounded-full animate-pulse"></div>
          </motion.div>
        )}

        {/* Gambar pengejar */}
        <motion.div
          key={chaserType}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Image
            src={selectedChaser.src}
            alt={selectedChaser.alt}
            width={140}
            height={140}
            className="drop-shadow-lg"
            unoptimized
            style={{
              imageRendering: "pixelated",
              transform: `scale(${currentMovement.scale}) rotate(${currentMovement.rotation}deg)`,
              transformOrigin: "bottom center",
              transition: "transform 0.1s ease-out",
            }}
          />
        </motion.div>

        {/* Jejak pengejar saat menyerang */}
        {zombieState.isAttacking &&
          [...Array(4)].map((_, i) => (
            <motion.div
              key={`blood-trail-${i}`}
              initial={{ opacity: 0.4 - i * 0.1, x: 0 }}
              animate={{ opacity: 0, x: -20 - i * 15 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
              className="absolute top-0 left-0"
            >
              <Image
                src={selectedChaser.src}
                alt={`${selectedChaser.alt} Trail`}
                width={140}
                height={140}
                unoptimized
                style={{
                  imageRendering: "pixelated",
                  filter: "brightness(0.7) contrast(1.1) hue-rotate(10deg)",
                  transform: `scale(${0.95 - i * 0.1})`,
                }}
              />
            </motion.div>
          ))}

        {/* Efek aura */}
        <motion.div
          className={`absolute -inset-4 rounded-full blur-lg ${
            zombieState.isAttacking
              ? "bg-red-600 opacity-30 animate-pulse-slow"
              : gameMode === "panic"
                ? "bg-red-500 opacity-20"
                : "bg-green-500 opacity-15"
          }`}
          animate={{
            scale: zombieState.isAttacking ? [1, 1.1, 1] : 1,
            transition: { duration: 0.5, repeat: zombieState.isAttacking ? Infinity : 0 },
          }}
        />

        {/* Indikator kecepatan pengejar */}
        <p
          className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 font-mono text-sm ${
            zombieState.isAttacking ? "text-red-400 animate-pulse" : "text-gray-400"
          }`}
        >
          Kecepatan:{ZOMBIE_SPEED}
        </p>

        {/* Efek suara serangan (opsional, uncomment jika file audio tersedia) */}
        {/* {zombieState.isAttacking && (
          <audio src="/sounds/zombie-attack.mp3" autoPlay />
        )} */}
      </div>

      <style jsx>{`
        @keyframes drip {
          0% {
            height: 0;
            opacity: 1;
          }
          50% {
            height: 10px;
            opacity: 1;
          }
          100% {
            height: 20px;
            opacity: 0;
          }
        }
        .animate-drip {
          animation: drip 0.5s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.9;
          }
          50% {
            opacity: 1;
          }
        }
        .animate-pulse {
          animation: pulse 0.5s infinite;
        }

        @keyframes pulse-slow {
          0%,
          100% {
            opacity: 0.25;
          }
          50% {
            opacity: 0.35;
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 1.2s infinite;
        }
      `}</style>
    </motion.div>
  );
}