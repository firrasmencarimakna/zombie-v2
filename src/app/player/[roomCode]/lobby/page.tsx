"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, Skull, Zap, Ghost, Bone, HeartPulse, ArrowLeft, Play, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, GameRoom, EmbeddedPlayer } from "@/lib/supabase";
import SoulStatus from "@/components/game/SoulStatus";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { syncServerTime, calculateCountdown } from "@/lib/server-time";

import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useDetectBackAction } from "@/hooks/useDetectBackAction";

// Extended EmbeddedPlayer type to include optional fields from useGameLogic
interface ExtendedEmbeddedPlayer extends EmbeddedPlayer {
  is_ready?: boolean;
  wrong_answers?: number;
}

// Opsi karakter yang tersedia
const characterOptions = [
  { value: "robot1", name: "Hijau", gif: "/character/player/character.webp", alt: "Karakter Hijau" },
  { value: "robot2", name: "Biru", gif: "/character/player/character1-crop.webp", alt: "Karakter Biru" },
  { value: "robot3", name: "Merah", gif: "/character/player/character2-crop.webp", alt: "Karakter Merah" },
  { value: "robot4", name: "Ungu", gif: "/character/player/character3-crop.webp", alt: "Karakter Ungu" },
  { value: "robot5", name: "Oranye", gif: "/character/player/character4-crop.webp", alt: "Karakter Oranye" },
  { value: "robot6", name: "Kuning", gif: "/character/player/character5.webp", alt: "Karakter Kuning" },
  { value: "robot7", name: "Abu-abu", gif: "/character/player/character6.webp", alt: "Karakter Abu-abu" },
  { value: "robot8", name: "Pink", gif: "/character/player/character7-crop.webp", alt: "Karakter Pink" },
  { value: "robot9", name: "Cokelat", gif: "/character/player/character8-crop.webp", alt: "Karakter Cokelat" },
  { value: "robot10", name: "Emas", gif: "/character/player/character9-crop.webp", alt: "Karakter Emas" },
];

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode as string;
  const { t } = useTranslation();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<ExtendedEmbeddedPlayer[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<ExtendedEmbeddedPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [atmosphereText, setAtmosphereText] = useState(() => {
    const texts = t("atmosphereTexts", { returnObjects: true }) as string[];
    return texts[0] || "Menunggu pemain lain...";
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCharacterDialogOpen, setIsCharacterDialogOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState("robot1");
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const atmosphereTexts = (t("atmosphereTexts", { returnObjects: true }) as string[]) || [];

  // Initial data fetching
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!roomCode) return;
      setIsLoading(true);

      const { data: roomData, error: roomError } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("room_code", roomCode)
        .single();

      if (roomError || !roomData) {
        console.error("Error fetching room:", roomError);
        toast.error("Room tidak ditemukan!");
        router.replace("/");
        return;
      }

      setRoom(roomData);
      const roomPlayers = (roomData.players as ExtendedEmbeddedPlayer[]) || [];
      setPlayers(roomPlayers);

      const playerId = localStorage.getItem("playerId");
      if (playerId) {
        const player = roomPlayers.find(p => p.player_id === playerId) || null;
        setCurrentPlayer(player);
      } else {
        console.error("Player ID not found in localStorage. Cannot identify current player.");
        toast.error("Tidak dapat mengidentifikasi pemain. Silakan bergabung kembali.");
        router.replace("/");
      }

      setIsLoading(false);
    };

    fetchInitialData();
    syncServerTime();
  }, [roomCode, router]);

  // Real-time subscription for room updates
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`lobby_${room.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          const newRoom = payload.new as GameRoom;
          setRoom(newRoom);
          const newPlayers = (newRoom.players as ExtendedEmbeddedPlayer[]) || [];
          setPlayers(newPlayers);
          
          const playerId = localStorage.getItem("player_id");
          if (playerId) {
            const updatedPlayer = newPlayers.find(p => p.player_id === playerId) || null;
            setCurrentPlayer(updatedPlayer);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  // Sync selected character with currentPlayer state
  useEffect(() => {
    if (currentPlayer?.character_type) {
      setSelectedCharacter(currentPlayer.character_type);
    }
  }, [currentPlayer]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Countdown logic
  useEffect(() => {
    if (!room?.countdown_start) {
      setCountdown(null);
      return;
    }
    const updateCountdown = () => {
      const remaining = calculateCountdown(room.countdown_start, 10000);
      setCountdown(remaining);
      return remaining > 0;
    };
    if (updateCountdown()) {
      const timer = setInterval(() => {
        if (!updateCountdown()) clearInterval(timer);
      }, 100);
      return () => clearInterval(timer);
    }
  }, [room?.countdown_start]);

  // Redirect player when game starts
  useEffect(() => {
    if (room?.status === "playing" || (countdown !== null && countdown <= 0)) {
      router.replace(`/player/${roomCode}/quiz`);
    }
  }, [room?.status, countdown, roomCode, router]);

  // Atmosphere text interval
  useEffect(() => {
    if (atmosphereTexts.length === 0) return;
    const textInterval = setInterval(() => {
      setAtmosphereText(atmosphereTexts[Math.floor(Math.random() * atmosphereTexts.length)]);
    }, 2500);
    return () => clearInterval(textInterval);
  }, [atmosphereTexts]);

  const handleCharacterSelect = async (characterValue: string) => {
    if (!currentPlayer) return;
    const previousCharacter = selectedCharacter;
    try {
      setSelectedCharacter(characterValue);
      // Optimistic update in the local state first
      const updatedPlayers = players.map(p => 
        p.player_id === currentPlayer.player_id ? { ...p, character_type: characterValue } : p
      );
      setPlayers(updatedPlayers);

      const { error } = await supabase
        .from("game_rooms")
        .update({ players: updatedPlayers })
        .eq("id", room?.id);

      if (error) {
        // Revert on error
        setPlayers(players);
        setSelectedCharacter(previousCharacter);
        toast.error("Gagal memperbarui karakter: " + error.message);
        return;
      }
      setIsCharacterDialogOpen(false);
    } catch (error) {
      setPlayers(players);
      setSelectedCharacter(previousCharacter);
      toast.error("Gagal memperbarui karakter: " + (error instanceof Error ? error.message : "Kesalahan tidak diketahui"));
    }
  };

  const handleExitLobby = async () => {
    if (!currentPlayer || !room) return;
    try {
      localStorage.setItem("exitBySelf", "1");
      const updatedPlayers = room.players.filter(p => p.player_id !== currentPlayer.player_id);
      await supabase.from("game_rooms").update({ players: updatedPlayers }).eq("id", room.id);
      router.replace("/");
    } catch (err) {
      console.error("Gagal keluar lobby:", err);
    } finally {
      setIsExitDialogOpen(false);
    }
  };

  const startGame = async () => {
    if (!room?.id || !currentPlayer?.is_host || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: roomError } = await supabase
        .from("game_rooms")
        .update({
          status: "playing",
          game_start_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id);

      if (roomError) {
        console.error("Error starting game:", roomError);
        toast.error("Gagal memulai permainan: " + roomError.message);
      }
    } catch (error) {
      console.error("Error in startGame:", error);
      toast.error("Gagal memulai permainan: " + (error instanceof Error ? error.message : "Kesalahan tidak diketahui"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedPlayers = useMemo(() => {
    if (!currentPlayer) return players;
    return [...players].sort((a, b) => {
      if (a.player_id === currentPlayer.player_id) return -1;
      if (b.player_id === currentPlayer.player_id) return 1;
      if (a.is_host) return -1;
      if (b.is_host) return 1;
      return 0;
    });
  }, [players, currentPlayer]);

  const bloodDrips = useMemo(() => {
    const dripCount = isMobile ? 4 : 8;
    return Array.from({ length: dripCount }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      speed: 2 + Math.random() * 1.5,
      delay: Math.random() * 5,
      opacity: 0.7 + Math.random() * 0.3,
    }));
  }, [isMobile]);

  useDetectBackAction(setIsExitDialogOpen);

  if (isLoading || !currentPlayer || !room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-500 font-mono text-2xl animate-pulse">
        MEMUAT RUANGAN...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      {/* Countdown Overlay */}
      {countdown !== null && countdown > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }} className="text-[20rem] md:text-[30rem] font-mono font-bold text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
            {countdown}
          </motion.div>
        </motion.div>
      )}

      <div className="relative z-10 mx-auto p-7 mb-10">
        <motion.header initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3 }} className="flex flex-col gap-1 mb-10">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl md:text-4xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]" onClick={() => setIsExitDialogOpen(true)}>
              {t("title")}
            </h1>
            <Button onClick={() => setIsExitDialogOpen(true)} variant="ghost" size="icon" className="bg-red-600/80 hover:bg-red-700 text-white rounded-lg p-2 shadow-lg">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.5 }} className="flex justify-center items-center text-center pb-5">
            <HeartPulse className="w-12 h-12 text-red-500 mr-4 animate-pulse" />
            <h1 className="text-4xl md:text-6xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse">
              {t("waitingRoomTitle")}
            </h1>
            <HeartPulse className="w-12 h-12 text-red-500 ml-4 animate-pulse" />
          </motion.div>
          <p className="text-red-400/80 text-base md:text-xl text-center font-mono animate-pulse tracking-wider">{atmosphereText}</p>
        </motion.header>

        <div className="max-w-auto mx-auto mb-8 md:h-auto h-[calc(100vh-150px)] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {sortedPlayers.map((player) => (
              <div key={player.player_id} className="relative bg-black/40 border border-red-900/50 rounded-lg p-4 lg:mx-2 md:mx-5 mx-10 m-2 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                <SoulStatus
                  player={{ ...player, id: player.player_id, health: player.health?.current || 3, maxHealth: player.health?.max || 3 }}
                  isCurrentPlayer={player.player_id === currentPlayer.player_id}
                  variant="detailed"
                  showDetailed={true}
                />
                {player.is_host && <div className="absolute -bottom-2 -right-2 text-xs bg-red-900 text-white px-2 py-1 rounded font-mono">HOST</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center space-y-6">
          <div className="flex items-center justify-center space-x-4 text-red-400 font-mono text-lg">
            <Users className="w-6 h-6" />
            <span className="tracking-wider">{players.length} {t("cursedSouls")}</span>
          </div>

          {/* Ready/Unready button removed */}
          {currentPlayer.is_host && (
            <Button onClick={startGame} disabled={isSubmitting || (countdown !== null && countdown > 0)} className="bg-red-700 hover:bg-red-600 text-white font-mono text-xl px-8 py-4 rounded-lg">
              {t("startGame")}
            </Button>
          )}
        </div>

        {!currentPlayer.is_host && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-md px-4">
            <Button onClick={() => setIsCharacterDialogOpen(true)} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-mono text-xl px-10 py-6 rounded-lg">
              {t("selectCharacter")}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isCharacterDialogOpen} onOpenChange={setIsCharacterDialogOpen}>
        <DialogContent className="bg-black/95 text-white border-red-500/50 max-w-lg rounded-xl p-6">
          <DialogHeader><DialogTitle className="text-3xl font-bold text-red-400 font-mono">{t("selectCharacter")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-6">
            {characterOptions.map((character) => (
              <div key={character.value} role="button" tabIndex={0} onClick={() => handleCharacterSelect(character.value)} className={`relative flex flex-col items-center p-4 rounded-lg cursor-pointer transition-all duration-300 ${selectedCharacter === character.value ? "border-2 border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.7)]" : "border border-white/20 bg-white/10 hover:bg-red-500/20"}`}>
                <Image src={character.gif} alt={character.alt} width={80} height={80} unoptimized className="object-contain" />
                <span className="text-white font-mono text-sm text-center mt-2">{character.name}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="bg-black/95 border border-red-600/70 text-red-400 rounded-xl">
          <DialogHeader><DialogTitle className="text-lg font-bold text-red-500">{t("exitConfirm")}</DialogTitle></DialogHeader>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsExitDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleExitLobby} className="bg-red-600 hover:bg-red-700 text-white">{t("exit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}