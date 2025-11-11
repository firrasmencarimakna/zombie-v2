"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Background3 from "@/components/game/host/Background3";
import GameUI from "@/components/game/host/GameUI";
import { motion } from "framer-motion";
import ZombieCharacter from "@/components/game/host/ZombieCharacter";
import RunningCharacters from "@/components/game/host/RunningCharacters";
import { useHostGuard } from "@/lib/host-guard";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import { throttle } from "lodash";
import React from "react";
import type { GameRoom, EmbeddedPlayer as Player, GameCompletion } from "@/lib/supabase";

// ✅ [PERUBAHAN 1] — PINDAHKAN SEMUA MEMO KE LUAR KOMPONEN
// Ini penting agar React.memo tidak dibuat ulang setiap render — yang akan menghancurkan optimisasi

const MemoizedBackground3 = React.memo(Background3);
const MemoizedGameUI = React.memo(GameUI);

// ✅ [PERUBAHAN 2] — Memoisasi RunningCharacters dengan custom comparator
// ❗ Tidak membandingkan `animationTime` agar tidak trigger re-render tiap frame
const MemoizedRunningCharacters = React.memo(
  RunningCharacters,
  (prevProps, nextProps) => {
    return (
      prevProps.players === nextProps.players &&
      prevProps.playerStates === nextProps.playerStates &&
      prevProps.zombieState.targetPlayerId === nextProps.zombieState.targetPlayerId &&
      prevProps.gameMode === nextProps.gameMode &&
      prevProps.centerX === nextProps.centerX &&
      prevProps.completedPlayers === nextProps.completedPlayers
    );
  }
);

// ✅ [PERUBAHAN 3] — Memoisasi ZombieCharacter dengan custom comparator
// ❗ Hanya bandingkan prop yang memengaruhi logika/visual, abaikan animationTime
const MemoizedZombieCharacter = React.memo(
  ZombieCharacter,
  (prevProps, nextProps) => {
    const prevZ = prevProps.zombieState;
    const nextZ = nextProps.zombieState;
    return (
      prevZ.isAttacking === nextZ.isAttacking &&
      prevZ.targetPlayerId === nextZ.targetPlayerId &&
      prevZ.attackProgress === nextZ.attackProgress &&
      prevProps.gameMode === nextProps.gameMode &&
      prevProps.centerX === nextProps.centerX &&
      prevProps.chaserType === nextProps.chaserType &&
      prevProps.players === nextProps.players
    );
  }
);

// Local Player interface removed

// Local GameRoom and PlayerHealthState interfaces removed

interface PlayerState {
  id: string;
  health: number;
  maxHealth: number;
  speed: number;
  position: number;
  attackIntensity: number;
  countdown?: number;
}

interface ZombieState {
  isAttacking: boolean;
  targetPlayerId: string | null;
  attackProgress: number;
  basePosition: number;
  currentPosition: number;
}



export default function HostGamePage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [animationTime, setAnimationTime] = useState(0);
  const [gameMode, setGameMode] = useState<"normal" | "panic">("normal");
  const [isClient, setIsClient] = useState(false);
  const [screenWidth, setScreenWidth] = useState(1200);
  const [imageLoadStatus, setImageLoadStatus] = useState<{ [key: string]: boolean }>({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [chaserType, setChaserType] = useState<"zombie" | "monster1" | "monster2" | "monster3" | "darknight">("zombie");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [completedPlayers, setCompletedPlayers] = useState<Player[]>([]);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [playerStates, setPlayerStates] = useState<{ [playerId: string]: PlayerState }>({});

  const [zombieState, setZombieState] = useState<ZombieState>({
    isAttacking: false,
    targetPlayerId: null,
    attackProgress: 0,
    basePosition: 500,
    currentPosition: 500,
  });
  const [attackQueue, setAttackQueue] = useState<string[]>([]);
  const [backgroundFlash, setBackgroundFlash] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const attackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  useHostGuard(roomCode);

  // Definisikan pengaturan berdasarkan difficulty_level
  const difficultySettings = {
    easy: { zombieAttackCountdown: 35 },
    medium: { zombieAttackCountdown: 20 },
    hard: { zombieAttackCountdown: 10 },
  };
  const zombieAttackCountdown = gameRoom && ["easy", "medium", "hard"].includes(gameRoom.difficulty_level)
    ? difficultySettings[gameRoom.difficulty_level as keyof typeof difficultySettings].zombieAttackCountdown
    : difficultySettings.medium.zombieAttackCountdown;

  // Initialize player states
  const initializePlayerStates = useCallback(
    (playersData: Player[]) => {
      const newStates: { [playerId: string]: PlayerState } = {};
      playersData.forEach((player, index) => {
        newStates[player.player_id] = {
          id: player.player_id,
          health: player.health.current,
          maxHealth: player.health.max,
          speed: player.health.speed,
          position: index,
          attackIntensity: 0,
          countdown:
            player.health.speed <= 30 && player.health.current > 0 && player.is_alive
              ? zombieAttackCountdown
              : undefined,
        };
      });
      setPlayerStates(newStates);
    },
    [zombieAttackCountdown]
  );

  // ✅ [PERUBAHAN 4] — Memoisasi zombieState hanya untuk prop yang relevan
  // Agar custom comparator di MemoizedZombieCharacter bisa bekerja efektif (karena objek stabil)
  const memoizedZombieState = useMemo(() => ({
    isAttacking: zombieState.isAttacking,
    targetPlayerId: zombieState.targetPlayerId,
    attackProgress: zombieState.attackProgress,
    // ❗ Tidak perlu basePosition & currentPosition jika ZombieCharacter tidak menggunakannya untuk logika comparator
    // Tapi tetap disertakan jika dibutuhkan untuk rendering
    basePosition: zombieState.basePosition,
    currentPosition: zombieState.currentPosition,
  }), [zombieState.isAttacking, zombieState.targetPlayerId, zombieState.attackProgress]);

  // Centralized function to update player state
  const updatePlayerState = useCallback(
    async (playerId: string, updates: Partial<Player>) => {
      if (!gameRoom) return;

      const currentPlayers = gameRoom.players || [];
      const playerIndex = currentPlayers.findIndex((p: Player) => p.player_id === playerId);
      if (playerIndex === -1) {
        console.error(t("log.playerNotFoundInRoom", { playerId }));
        return;
      }

      // Deep merge for nested objects like health
      const originalPlayer = currentPlayers[playerIndex];
      const updatedPlayer = {
        ...originalPlayer,
        ...updates,
        health: {
          ...originalPlayer.health,
          ...(updates.health || {}),
        },
      };
      
      const updatedPlayers = [...currentPlayers];
      updatedPlayers[playerIndex] = updatedPlayer;

      const { error: updateError } = await supabase
        .from("game_rooms")
        .update({ players: updatedPlayers })
        .eq("id", gameRoom.id);

      if (updateError) {
        console.error(t("log.updatePlayerStateError", { playerId, error: updateError.message }));
      }
    },
    [gameRoom, t]
  );

  // Handle chaser attack
  const handleZombieAttack = useCallback(
    (playerId: string, newHealth: number, newSpeed: number) => {
      const player = gameRoom?.players.find((p) => p.player_id === playerId);
      if (!player || newHealth < 0 || !player.is_alive) {
        setAttackQueue((prev) => prev.filter((id) => id !== playerId));
        return;
      }

      if (zombieState.isAttacking && zombieState.targetPlayerId !== playerId) {
        setAttackQueue((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
        return;
      }

      if (attackIntervalRef.current) {
        clearInterval(attackIntervalRef.current);
        attackIntervalRef.current = null;
      }

      setZombieState({ isAttacking: true, targetPlayerId: playerId, attackProgress: 0, basePosition: 500, currentPosition: 500 });
      setBackgroundFlash(true);
      setGameMode("panic");

      const finalSpeed = Math.max(20, newSpeed - 5);
      updatePlayerState(playerId, {
        health: { ...player.health, current: newHealth, speed: finalSpeed }
      });

      let progress = 0;
      attackIntervalRef.current = setInterval(() => {
        progress += 0.0333;
        setZombieState((prev) => ({ ...prev, attackProgress: progress, currentPosition: prev.basePosition * (1 - progress * 0.8) }));

        if (progress >= 1) {
          clearInterval(attackIntervalRef.current!);
          attackIntervalRef.current = null;
          setZombieState({ isAttacking: false, targetPlayerId: null, attackProgress: 0, basePosition: 500, currentPosition: 500 });
          
          // Removed redundant updatePlayerState call that was overwriting health.
          // The health update is handled by the initial updatePlayerState call.

          setBackgroundFlash(false);
          setGameMode("normal");

          setAttackQueue((prev) => {
            const nextQueue = prev.filter((id) => id !== playerId);
            if (nextQueue.length > 0) {
              const nextPlayerId = nextQueue[0];
              const nextPlayer = gameRoom?.players.find((p) => p.player_id === nextPlayerId);
              if (nextPlayer && nextPlayer.health.speed <= 30 && nextPlayer.health.current > 0 && nextPlayer.is_alive) {
                setTimeout(() => {
                  handleZombieAttack(nextPlayerId, nextPlayer.health.current - 1, nextPlayer.health.speed);
                }, 500);
              }
            }
            return nextQueue;
          });
        }
      }, 30);
    },
    [gameRoom, updatePlayerState, zombieState.isAttacking, zombieState.targetPlayerId]
  );

  useEffect(() => {
    if (!gameRoom?.countdown_start || countdown !== null) return;

    const countdownStartTime = new Date(gameRoom.countdown_start).getTime();
    const countdownDuration = 10000;

    const updateCountdown = () => {
      const now = Date.now();
      const elapsed = now - countdownStartTime;
      const remaining = Math.max(0, Math.ceil((countdownDuration - elapsed) / 1000));
      setCountdown(remaining);

      if (remaining <= 0) {
        setCountdown(null);
        setIsStarting(false);
        return false;
      }
      return true;
    };

    if (updateCountdown()) {
      const timer = setInterval(() => {
        if (!updateCountdown()) {
          clearInterval(timer);
        }
      }, 100);

      return () => clearInterval(timer);
    } else {
      setCountdown(null);
      setIsStarting(false);
    }
  }, [gameRoom?.countdown_start, t]);

  // Handle correct answer — asli, untuk throttle
  const handleCorrectAnswer = useCallback((playerId: string) => {
    const player = gameRoom?.players.find(p => p.player_id === playerId);
    if (!player) return;

    const newSpeed = Math.min(player.health.speed + 5, 90);
    updatePlayerState(playerId, {
        health: { ...player.health, speed: newSpeed, last_answer_time: new Date().toISOString() }
    });

    if (zombieState.targetPlayerId === playerId && zombieState.isAttacking) {
        clearInterval(attackIntervalRef.current!);
        attackIntervalRef.current = null;
        setZombieState({ isAttacking: false, targetPlayerId: null, attackProgress: 0, basePosition: 500, currentPosition: 500 });
        setBackgroundFlash(false);
        setGameMode("normal");
    }
    setAttackQueue((prev) => prev.filter((id) => id !== playerId));
  }, [gameRoom, updatePlayerState, zombieState]);

  const throttledHandleCorrectAnswer = useMemo(() => throttle(handleCorrectAnswer, 100, { leading: true, trailing: true }), [handleCorrectAnswer]);
  
  const prevCorrectRef = useRef<{ [key: string]: number }>({});
  useEffect(() => {
    if (!gameRoom?.players) return;
    const newCorrect = gameRoom.players.reduce((acc, p) => {
      acc[p.player_id] = p.correct_answers || 0;
      return acc;
    }, {} as { [key: string]: number });

    Object.entries(newCorrect).forEach(([id, val]) => {
      const prevVal = prevCorrectRef.current[id] || 0;
      if (val > prevVal) {
        throttledHandleCorrectAnswer(id);
      }
    });
    prevCorrectRef.current = newCorrect;
  }, [gameRoom?.players, throttledHandleCorrectAnswer]);

  // Manage player status — dengan early return
  const managePlayerStatus = useCallback(() => {
    if (!gameRoom) return;

    const activePlayersList = gameRoom.players.filter((p) => p.is_alive && !completedPlayers.some((c) => c.player_id === p.player_id));

    if (activePlayersList.length === 0 && gameRoom.players.length > 0) {
      supabase.from("game_rooms").update({ status: "finished" }).eq("id", gameRoom.id);
      // The subscription will handle the redirect
      return;
    }

    setPlayerStates((prevStates) => {
      const updatedStates = { ...prevStates };
      let needsUpdate = false;

      activePlayersList.forEach((player) => {
        const state = updatedStates[player.player_id];
        if (!state) return;

        // Inactivity penalty
        const timeSinceLastAnswer = (Date.now() - new Date(player.health.last_answer_time).getTime()) / 1000;
        if (timeSinceLastAnswer >= zombieAttackCountdown + 5 && state.speed > 20) {
          const newSpeed = Math.max(20, state.speed - 10);
          updatePlayerState(player.player_id, { health: { ...player.health, speed: newSpeed, last_answer_time: new Date().toISOString() } });
          needsUpdate = true;
        }

        // Countdown for low speed
        if (state.speed <= 30 && state.health > 0) {
          if (state.countdown === undefined) {
            updatedStates[player.player_id] = { ...state, countdown: zombieAttackCountdown };
            needsUpdate = true;
          } else if (state.countdown > 0) {
            const newCountdown = state.countdown - 1;
            updatedStates[player.player_id] = { ...state, countdown: newCountdown };
            needsUpdate = true;
            if (newCountdown <= 0) {
              if (!zombieState.isAttacking || activePlayersList.length === 1) {
                handleZombieAttack(player.player_id, state.health - 1, state.speed);
              }
            }
          }
        } else if (state.countdown !== undefined) {
          updatedStates[player.player_id] = { ...state, countdown: undefined };
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        return updatedStates;
      }
      return prevStates;
    });
  }, [gameRoom, completedPlayers, playerStates, zombieState.isAttacking, zombieAttackCountdown, updatePlayerState, handleZombieAttack]);

  // Fetch game data
  const fetchGameData = useCallback(async () => {
    if (!roomCode) {
      console.error(t("log.invalidRoomCode"));
      setLoadingError(t("error.invalidRoomCode"));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("room_code", roomCode.toUpperCase())
        .single();

      if (roomError || !room) {
        throw new Error(t("error.roomNotFound"));
      }

      setGameRoom(room as GameRoom);
      setChaserType(room.chaser_type || "zombie");

      if (room.status === "finished") {
        setIsLoading(false);
        router.push(`/host/${roomCode}/result`);
        return;
      }
      
      const playersData = (room.players as Player[] || []).sort((a: Player, b: Player) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
      setPlayers(playersData);
      initializePlayerStates(playersData);

    } catch (error) {
      console.error(t("log.fetchGameDataError", { error }));
      setLoadingError(t("error.loadGame"));
      setPlayers([]);
      setPlayerStates({});
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, initializePlayerStates, router, t]);



  // Supabase real-time subscriptions
  useEffect(() => {
    if (!gameRoom?.id) return;

    const roomChannel = supabase.channel(`room-${gameRoom.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${gameRoom.id}` },
        (payload) => {
          const newRoom = payload.new as GameRoom;
          setGameRoom(newRoom);
          setChaserType(newRoom.chaser_type || "zombie");
          
          const playersData = (newRoom.players as Player[] || []).sort((a: Player, b: Player) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
          setPlayers(playersData);
          initializePlayerStates(playersData);

          if (newRoom.status === "finished") {
            router.push(`/host/${roomCode}/result`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [gameRoom?.id, initializePlayerStates, router, roomCode]);

  // Initialize game data
  useEffect(() => {
    fetchGameData();
  }, [roomCode, fetchGameData, t]);

  // Interval for player status
  useEffect(() => {
    if (!gameRoom) return;
    const interval = setInterval(managePlayerStatus, 1500);
    return () => clearInterval(interval);
  }, [managePlayerStatus, gameRoom]);

  // Check image loading
  useEffect(() => {
    const testAllImages = async () => {
      const status: { [key: string]: boolean } = {};
      const characterFiles = [
        "/character/player/character.webp",
        "/character/player/character1-crop.webp",
        "/character/player/character2-crop.webp",
        "/character/player/character3-crop.webp",
        "/character/player/character4-crop.webp",
        "/character/player/character5.webp",
        "/character/player/character6.webp",
        "/character/player/character7-crop.webp",
        "/character/player/character8-crop.webp",
        "/character/player/character9-crop.webp",
      ];
      for (const file of characterFiles) {
        const works = await testImageLoad(file);
        status[file] = works;
      }
      const chaserFiles = [
        "/character/chaser/zombie.webp",
        "/character/chaser/monster1.webp",
        "/character/chaser/monster2.webp",
        "/character/chaser/monster3.webp",
        "/character/chaser/darknight.webp",
      ];
      for (const file of chaserFiles) {
        const works = await testImageLoad(file);
        status[file] = works;
      }
      setImageLoadStatus(status);
    };
    testAllImages();
  }, [t]);

  const testImageLoad = (src: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
      setTimeout(() => resolve(false), 5000);
    });
  };

  // Set client and screen size
  useEffect(() => {
    setIsClient(true);
    setScreenWidth(window.innerWidth);
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [t]);

  // Animation time — hanya tergantung gameMode
  useEffect(() => {
    const interval = setInterval(() => setAnimationTime((prev) => prev + 1), gameMode === "panic" ? 30 : 100);
    return () => clearInterval(interval);
  }, [gameMode]);

  // Check Supabase connection
  useEffect(() => {
    const checkConnection = () => {
      const state = supabase.getChannels()[0]?.state || "closed";
      setIsConnected(state === "joined");
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [t]);

  // ✅ Memoisasi activePlayers dan centerX
  const activePlayers = useMemo(() => {
    return players.filter((p) => !completedPlayers.some((c) => c.player_id === p.player_id));
  }, [players, completedPlayers]);

  const centerX = useMemo(() => screenWidth / 2, [screenWidth]);

  // ✅ Audio effect — hanya sekali
  useEffect(() => {
    const zombiesAudio = new Audio('/musics/zombies.mp3');
    const bgAudio = new Audio('/musics/background-music.mp3');

    zombiesAudio.play().catch(console.warn);
    bgAudio.loop = true;
    bgAudio.play().catch(console.warn);

    return () => {
      zombiesAudio.pause();
      bgAudio.pause();
      zombiesAudio.src = '';
      bgAudio.src = '';
    };
  }, []);

  // Loading & completed state
  if (!isClient || isLoading) {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">{loadingError ? loadingError : t("")}</div>
      </div>
    );
  }

  if (gameRoom?.status === "finished") {
    return null;
  }

  // ✅ Render akhir — gunakan komponen yang sudah dimemoisasi
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <MemoizedBackground3 isFlashing={backgroundFlash} />

      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
        className="flex flex-col gap-3 mb-10 px-4"
      >
        <div className="flex justify-between items-center">
          <h1
            className="text-5xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
            style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
          >
            {t("title")}
          </h1>

          <div className="flex w-fit gap-2 items-center">
            <Image src={`/logo/gameforsmartlogo-horror.png`} alt="" width={254} height={0} className="z-20" />
          </div>
        </div>
      </motion.header>

      {/* ✅ Gunakan MemoizedRunningCharacters */}
      <MemoizedRunningCharacters
        players={activePlayers}
        playerStates={playerStates}
        zombieState={zombieState}  // Boleh pakai zombieState langsung karena comparator hanya bandingkan targetPlayerId
        animationTime={animationTime}
        gameMode={gameMode}
        centerX={centerX}
        completedPlayers={completedPlayers}
      />

      {/* ✅ Gunakan MemoizedZombieCharacter dengan memoizedZombieState */}
      {/* ❗ Tidak perlu kirim animationTime jika tidak dipakai di dalam komponen */}
      <MemoizedZombieCharacter
        zombieState={memoizedZombieState}
        gameMode={gameMode}
        centerX={centerX}
        chaserType={chaserType}
        players={activePlayers} animationTime={0}        // animationTime={animationTime} — dihapus karena tidak dibandingkan di comparator & tidak perlu
      />

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <MemoizedGameUI roomCode={roomCode} />
      </div>

      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #ff0000 rgba(26, 0, 0, 0.8);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(26, 0, 0, 0.8);
          border-left: 2px solid rgba(255, 0, 0, 0.3);
          box-shadow: inset 0 0 6px rgba(255, 0, 0, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #2e2a2aff, #ff0000);
          border-radius: 6px;
          border: 2px solid rgba(255, 0, 0, 0.5);
          box-shadow: 0 0 8px rgba(255, 0, 0, 0.7);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #ff0000, #8b0000);
          box-shadow: 0 0 12px rgba(255, 0, 0, 0.9);
        }
      `}</style>
    </div>
  );
}