"use client";

import Image from "next/image";
import { useRef, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { getGridPosition } from "@/utils/gridUtils";

interface ZombieState {
  isAttacking: boolean;
  targetPlayerId: string | null;
  attackProgress: number;
  basePosition: number;
  currentPosition: number;
}

interface PlayerState {
  id: string;
  health: number;
  speed: number;
  isBeingAttacked: boolean;
  position: number;
  lastAttackTime: number;
  attackIntensity: number;
}

interface ZombieCharacterProps {
  zombieState: ZombieState;
  animationTime: number;
  gameMode: "normal" | "panic";
  centerX: number;
  chaserType: string;
  players: Array<{ id: string; nickname: string; character_type: string }>;
  playerStates: { [playerId: string]: PlayerState };
}

const chaserImages = {
  zombie: {
    src: "/character/chaser/zombie.gif",
    alt: "Zombie",
    width: 200,
    height: 50,
    verticalOffset: "80%",
    horizontalOffset: -300,
  },
  monster1: {
    src: "/character/chaser/monster1.gif",
    alt: "Mutant Gila",
    width: 220,
    height: 60,
    verticalOffset: "80%",
    horizontalOffset: -350,
  },
  monster2: {
    src: "/character/chaser/monster2.gif",
    alt: "Monster Rawa",
    width: 280,
    height: 75,
    verticalOffset: "83%",
    horizontalOffset: -330,
  },
  monster3: {
    src: "/character/chaser/monster3.gif",
    alt: "Samurai Gila",
    width: 210,
    height: 65,
    verticalOffset: "81%",
    horizontalOffset: -360,
  },
  darknight: {
    src: "/character/chaser/darknight.gif",
    alt: "Ksatria Gelap",
    width: 230,
    height: 70,
    verticalOffset: "81%",
    horizontalOffset: -380,
  },
};

const characterConfigs = [
  { 
    src: "/character/player/character.gif", 
    alt: "Karakter Hijau", 
    type: "robot1", 
    name: "Hijau", 
    width: 48, 
    height: 48, 
    verticalOffset: 5,
    horizontalOffset: 0
  },
  { 
    src: "/character/player/character1.gif", 
    alt: "Karakter Biru", 
    type: "robot2", 
    name: "Biru", 
    width: 52, 
    height: 50, 
    verticalOffset: -2,
    horizontalOffset: 10
  },
  { 
    src: "/character/player/character2.gif", 
    alt: "Karakter Merah", 
    type: "robot3", 
    name: "Merah", 
    width: 50, 
    height: 46, 
    verticalOffset: 2,
    horizontalOffset: -10
  },
  { 
    src: "/character/player/character3.gif", 
    alt: "Karakter Ungu", 
    type: "robot4", 
    name: "Ungu", 
    width: 48, 
    height: 48, 
    verticalOffset: 0,
    horizontalOffset: 5
  },
  { 
    src: "/character/player/character4.gif", 
    alt: "Karakter Oranye", 
    type: "robot5", 
    name: "Oranye", 
    width: 46, 
    height: 50, 
    verticalOffset: -4,
    horizontalOffset: -5
  },
  { 
    src: "/character/player/character5.gif", 
    alt: "Karakter Kuning", 
    type: "robot6", 
    name: "Kuning", 
    width: 50, 
    height: 48, 
    verticalOffset: 0,
    horizontalOffset: 15
  },
  { 
    src: "/character/player/character6.gif", 
    alt: "Karakter Abu-abu", 
    type: "robot7", 
    name: "Abu-abu", 
    width: 48, 
    height: 46, 
    verticalOffset: 2,
    horizontalOffset: -15
  },
  { 
    src: "/character/player/character7.gif", 
    alt: "Karakter Pink", 
    type: "robot8", 
    name: "Pink", 
    width: 52, 
    height: 50, 
    verticalOffset: -2,
    horizontalOffset: 20
  },
  { 
    src: "/character/player/character8.gif", 
    alt: "Karakter Cokelat", 
    type: "robot9", 
    name: "Cokelat", 
    width: 48, 
    height: 48, 
    verticalOffset: 0,
    horizontalOffset: -20
  },
  { 
    src: "/character/player/character9.gif", 
    alt: "Karakter Emas", 
    type: "robot10", 
    name: "Emas", 
    width: 50, 
    height: 52, 
    verticalOffset: -4,
    horizontalOffset: 25
  },
];

export default function ZombieCharacter({
  zombieState,
  animationTime,
  gameMode,
  centerX,
  chaserType,
  players,
  playerStates,
}: ZombieCharacterProps) {
  const attackRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const ZOMBIE_SPEED = 30;

  const selectedChaser = chaserImages[chaserType as keyof typeof chaserImages] || chaserImages.zombie;

  // Hitung posisi pemain target dengan offset karakter pemain
  const getPlayerPosition = (playerId: string | null) => {
    if (!playerId || !playerStates[playerId]) {
      return { x: 0, y: 0 };
    }
    const playerState = playerStates[playerId];
    const playerIndex = players.findIndex((p) => p.id === playerId);
    const player = players[playerIndex];
    const character = characterConfigs.find((char) => char.type === player.character_type) || characterConfigs[0];
    const { x: gridX, y: gridY } = getGridPosition(playerIndex, players.length);
    const speedOffset = (playerState.speed - 5) * 8; // Offset berdasarkan kecepatan pemain
    const charX =
      gridX +
      speedOffset +
      Math.sin(animationTime * 0.4 + playerIndex) * (gameMode === "panic" ? 15 : 8) +
      character.horizontalOffset;
    const charY =
      gridY +
      Math.abs(Math.sin(animationTime * 0.6 + playerIndex * 0.5)) * (gameMode === "panic" ? 10 : 5) +
      character.verticalOffset;
    return { x: charX, y: charY };
  };

  // Efek kilatan dan skala saat serangan dimulai
  useEffect(() => {
    if (zombieState.isAttacking) {
      controls.start({
        scale: [1, 1.3, 1.2],
        filter: [
          "brightness(1.4) contrast(1.6) saturate(1.4) drop-shadow(0 0 15px rgba(255,50,50,0.8))",
          "brightness(1.8) contrast(1.8) saturate(1.6) drop-shadow(0 0 20px rgba(255,50,50,1))",
          "brightness(1.4) contrast(1.6) saturate(1.4) drop-shadow(0 0 15px rgba(255,50,50,0.8))",
        ],
        transition: { duration: 0.4, ease: "easeInOut", times: [0, 0.5, 1] },
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

  // Logging untuk debugging posisi dan offset
  useEffect(() => {
    const targetPlayer = zombieState.isAttacking
      ? players.find((p) => p.id === zombieState.targetPlayerId)
      : null;
    const targetPosition = getPlayerPosition(zombieState.targetPlayerId);
    console.log("ZombieCharacter render:", {
      chaserType,
      selectedChaser: selectedChaser.src,
      isAttacking: zombieState.isAttacking,
      targetPlayer: targetPlayer?.nickname || "Tidak ada target",
      targetPosition,
      attackProgress: zombieState.attackProgress,
      horizontalOffset: selectedChaser.horizontalOffset,
    });
  }, [chaserType, zombieState.isAttacking, selectedChaser.src, zombieState.targetPlayerId, zombieState.attackProgress, players, playerStates]);

  // Pergerakan normal dengan horizontalOffset
  const normalMovement = {
    x: Math.sin(animationTime * 0.4) * (gameMode === "panic" ? 140 : 30),
    y: Math.sin(animationTime * 1.0) * (gameMode === "panic" ? 50 : 15),
    rotation: Math.sin(animationTime * (gameMode === "panic" ? 0.3 : 0.15)) * (gameMode === "panic" ? 20 : 12),
    scale: gameMode === "panic" ? 2.0 : 1.8,
  };

  // Pergerakan saat menyerang dengan fokus pada horizontal dan mempertimbangkan kecepatan pemain
  const attackMovement = () => {
    const targetPosition = getPlayerPosition(zombieState.targetPlayerId);
    const playerState = zombieState.targetPlayerId ? playerStates[zombieState.targetPlayerId] : null;
    const playerSpeed = playerState ? playerState.speed : 5; // Default kecepatan jika tidak ada data
    const speedFactor = playerSpeed / 5; // Skala kecepatan relatif terhadap kecepatan default
    const adjustedZombieSpeed = ZOMBIE_SPEED * speedFactor; // Kecepatan zombie disesuaikan dengan kecepatan pemain
    const startX = centerX - zombieState.currentPosition + selectedChaser.horizontalOffset;
    const targetX = targetPosition.x + selectedChaser.horizontalOffset;
    const distance = targetX - startX;
    const attackX = startX + zombieState.attackProgress * distance * speedFactor; // Faktor kecepatan memengaruhi jarak serangan
    const attackY = targetPosition.y * zombieState.attackProgress; // Gerakan vertikal tetap smooth

    return {
      x: attackX,
      y: attackY,
      rotation: 0,
      scale: gameMode === "panic" ? 2.2 : 2.0,
    };
  };

  const currentMovement = zombieState.isAttacking ? attackMovement() : normalMovement;

  return (
    <motion.div
      ref={attackRef}
      className="absolute z-40 origin-bottom"
      style={{
        left: `${centerX - zombieState.currentPosition + currentMovement.x}px`,
        top: `calc(${selectedChaser.verticalOffset} + ${currentMovement.y}px)`,
      }}
      animate={controls}
    >
      <div className="relative">
        {/* Efek darah saat menyerang */}
        {zombieState.isAttacking && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-4 h-12 bg-red-700 animate-drip"
          >
            <div className="absolute bottom-0 w-6 h-6 bg-red-700 rounded-full animate-pulse"></div>
          </motion.div>
        )}

        {/* Efek partikel asap/percikan saat menyerang */}
        {zombieState.isAttacking &&
          [...Array(5)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              initial={{ opacity: 0.6, x: 0, y: 0, scale: 0.5 }}
              animate={{
                opacity: 0,
                x: -30 - i * 10,
                y: (Math.random() - 0.5) * 20,
                scale: 0.2,
              }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
              className="absolute w-4 h-4 bg-red-500/50 rounded-full blur-sm"
            />
          ))}

        {/* Efek gelombang kejut saat serangan dimulai */}
        {zombieState.isAttacking && zombieState.attackProgress < 0.2 && (
          <motion.div
            initial={{ opacity: 0.5, scale: 0.5 }}
            animate={{ opacity: 0, scale: 2 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute -inset-8 rounded-full bg-red-600/30 blur-lg"
          />
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
            width={selectedChaser.width}
            height={selectedChaser.height}
            className="drop-shadow-xl"
            unoptimized
            style={{
              imageRendering: "pixelated",
              transform: `scale(${currentMovement.scale}) rotate(${currentMovement.rotation}deg)`,
              transformOrigin: "bottom center",
              filter: zombieState.isAttacking
                ? "drop-shadow(0 0 15px rgba(99, 99, 99, 0.8))"
                : "none",
            }}
          />
        </motion.div>

        {/* Jejak pengejar saat menyerang */}
        {zombieState.isAttacking &&
          [...Array(4)].map((_, i) => (
            <motion.div
              key={`trail-${i}`}
              initial={{ opacity: 0.5 - i * 0.1, x: 0 }}
              animate={{ opacity: 0, x: -50 - i * 20 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
              className="absolute top-0 left-0"
            >
              <Image
                src={selectedChaser.src}
                alt={`${selectedChaser.alt} Trail`}
                width={selectedChaser.width * (0.9 - i * 0.1)}
                height={selectedChaser.height * (0.9 - i * 0.1)}
                unoptimized
                style={{
                  imageRendering: "pixelated",
                  filter: "brightness(0.6) contrast(1.2) hue-rotate(20deg)",
                  transform: `scale(${0.9 - i * 0.1})`,
                }}
              />
            </motion.div>
          ))}

        {/* Bayangan dinamis */}
        <motion.div
          className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-black/50 rounded-full blur-md"
          animate={{
            scaleX: zombieState.isAttacking ? 1.2 + zombieState.attackProgress * 0.3 : 1,
            opacity: zombieState.isAttacking ? 0.6 : 0.4,
            x: zombieState.isAttacking ? -zombieState.attackProgress * 20 : 0,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <style jsx>{`
        @keyframes drip {
          0% {
            height: 0;
            opacity: 1;
          }
          50% {
            height: 12px;
            opacity: 1;
          }
          100% {
            height: 24px;
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
      `}</style>
    </motion.div>
  );
}