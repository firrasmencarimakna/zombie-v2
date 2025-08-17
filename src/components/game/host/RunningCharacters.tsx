"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

interface Player {
  id: string;
  nickname: string;
  character_type: string;
  score: number;
  is_alive: boolean;
  joined_at: string;
}

interface PlayerHealthState {
  id: string;
  player_id: string;
  room_id: string;
  health: number;
  max_health: number;
  speed: number;
  is_being_attacked: boolean;
  last_attack_time: string;
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

interface ZombieState {
  isAttacking: boolean;
  targetPlayerId: string | null;
  attackProgress: number;
  basePosition: number;
  currentPosition: number;
}

interface RunningCharactersProps {
  players: Player[];
  playerStates: { [playerId: string]: PlayerState };
  playerHealthStates: { [playerId: string]: PlayerHealthState };
  zombieState: ZombieState;
  animationTime: number;
  gameMode: "normal" | "panic";
  centerX: number;
  getCharacterByType: (type: string) => any;
  getWorkingImagePath: (character: any) => string;
}

export default function RunningCharacters({
  players,
  playerStates,
  playerHealthStates,
  zombieState,
  animationTime,
  gameMode,
  centerX,
  getCharacterByType,
  getWorkingImagePath,
}: RunningCharactersProps) {
  const [eliminatedPlayers, setEliminatedPlayers] = useState<Set<string>>(new Set());
  const router = useRouter();
  const params = useParams()
    const roomCode = params.roomCode as string

  useEffect(() => {
    const newEliminated = new Set<string>();
    const allPlayersEliminated = players.every((player) => {
      const playerState = playerStates[player.id];
      const healthState = playerHealthStates[player.id];
      const health = playerState?.health ?? healthState?.health ?? 3;
      const isEliminated = !player.is_alive || health <= 0;
      if (isEliminated) {
        newEliminated.add(player.id);
      }
      return isEliminated;
    });

    setEliminatedPlayers(newEliminated);

    if (allPlayersEliminated && players.length > 0) {
      const redirectTimeout = setTimeout(() => {
        router.push(`/game/${roomCode}/resultshost`);
      }, 1000);
      return () => clearTimeout(redirectTimeout);
    }
  }, [players, playerStates, playerHealthStates, router]);

  return (
    <div className="absolute bottom-20 z-30">
      {players.slice(0, 5).map((player, i) => {
        const character = getCharacterByType(player.character_type);
        const workingPath = getWorkingImagePath(character);
        const playerState = playerStates[player.id];
        const healthState = playerHealthStates[player.id];
        const isBeingAttacked = playerState?.isBeingAttacked || false;
        const health = playerState?.health ?? healthState?.health ?? 3;
        const speed = playerState?.speed ?? healthState?.speed ?? 20;
        const attackIntensity = playerState?.attackIntensity ?? 0;
        const isZombieTarget = zombieState.targetPlayerId === player.id;
        const isEliminated = !player.is_alive || health <= 0;

        if (isEliminated && !eliminatedPlayers.has(player.id)) {
          return null;
        }

        const speedOffset = (speed - 20) * 10;
        const charX =
          centerX -
          130 +
          i * 120 +
          speedOffset +
          Math.sin(animationTime * (gameMode === "panic" ? 1.2 : 0.4) + i) * (gameMode === "panic" ? 60 : 15);
        const charY =
          -77 +
          Math.abs(Math.sin(animationTime * (gameMode === "panic" ? 2 : 0.6) + i * 0.5)) *
          (gameMode === "panic" ? 25 : 8);

        const attackShakeIntensity = isBeingAttacked ? attackIntensity * 8 : 0; // Meningkatkan intensitas getaran
        const attackShakeX = isBeingAttacked ? Math.sin(animationTime * 10) * attackShakeIntensity : 0; // Frekuensi lebih rendah
        const attackShakeY = isBeingAttacked ? Math.sin(animationTime * 8) * attackShakeIntensity : 0;

        return (
          <motion.div
            key={`character-${player.id}`}
            className="absolute"
            initial={{ opacity: 1, scale: 1 }}
            animate={{
              opacity: isEliminated ? 0 : 1,
              scale: isEliminated ? 0 : isBeingAttacked ? 1.2 : gameMode === "panic" ? 1.8 : 1.6,
              x: charX + attackShakeX,
              y: charY + attackShakeY,
            }}
            exit={{ opacity: 0, scale: 0, transition: { duration: 0.5 } }}
            transition={{
              opacity: { duration: isEliminated ? 0.5 : 0.1 },
              scale: { duration: isBeingAttacked ? 0.1 : 0.2 },
              x: { duration: 0.1 },
              y: { duration: 0.1 },
            }}
            style={{
              zIndex: isEliminated ? 25 : isZombieTarget ? 40 : 35,
            }}
            onAnimationComplete={() => {
              if (isEliminated) {
                setEliminatedPlayers((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(player.id);
                  return newSet;
                });
              }
            }}
          >
            <div className="relative flex flex-col items-center">
              {/* Efek aura saat diserang */}
              {isZombieTarget && !isEliminated && (
                <motion.div
                  className="absolute -inset-3 rounded-full bg-red-600 opacity-30 blur-lg"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}

              {/* Efek partikel saat diserang */}
              {isZombieTarget && !isEliminated &&
                [...Array(3)].map((_, i) => (
                  <motion.div
                    key={`particle-${i}`}
                    className="absolute w-2 h-2 bg-red-500 rounded-full"
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{
                      x: (Math.random() - 0.5) * 30,
                      y: (Math.random() - 0.5) * 30,
                      opacity: 0,
                    }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  />
                ))}

              <motion.div
                animate={{
                  scale: isBeingAttacked ? [1, 1.1, 1] : 1,
                  filter: isEliminated
                    ? "grayscale(100%) brightness(0.3) contrast(1.2)"
                    : isZombieTarget
                      ? "brightness(2) contrast(2.2) saturate(2) hue-rotate(15deg) drop-shadow(0 0 10px rgba(255,50,50,0.8))"
                      : gameMode === "panic"
                        ? "brightness(1.2) contrast(1.4) saturate(1.2)"
                        : "brightness(1.1) contrast(1.2)",
                }}
                transition={{ duration: isBeingAttacked ? 0.3 : 0.2 }}
              >
                <Image
                  src={workingPath}
                  alt={character.alt}
                  width={gameMode === "panic" ? 120 : 96}
                  height={gameMode === "panic" ? 120 : 96}
                  className="drop-shadow-2xl"
                  unoptimized
                  style={{
                    imageRendering: "pixelated",
                  }}
                />
              </motion.div>

              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 flex gap-1">
                {[...Array(3)].map((_, heartIndex) => (
                  <Heart
                    key={heartIndex}
                    className={`w-4 h-4 transition-all ${
                      heartIndex < health
                        ? isZombieTarget
                          ? "text-red-600 fill-red-600 animate-pulse"
                          : "text-red-500 fill-red-500"
                        : "text-gray-600 fill-gray-600"
                    }`}
                  />
                ))}
              </div>

              <p className="text-white font-mono text-xs mt-1 text-center">{player.nickname}</p>
              <p className="text-gray-400 font-mono text-xs">kecepatan:{speed}</p>

              {isEliminated && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: -14 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute -top-14 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-800 text-gray-300 text-xs font-bold rounded"
                >
                  TERELIMINASI
                </motion.div>
              )}

              {/* Bayangan dinamis */}
              <div
                className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-20 h-4 bg-black rounded-full opacity-30 blur-md"
                style={{
                  transform: `translateX(-50%) scaleX(${0.8 + Math.sin(animationTime * 0.6) * 0.2})`,
                }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}