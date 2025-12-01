"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Play, Copy, Check, Clock, List, Skull, Bone, Trash2 } from "lucide-react";
import { supabase, mysupa } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { syncServerTime, calculateCountdown } from "@/lib/server-time";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useHostGuard } from "@/lib/host-guard";
import { createPortal } from "react-dom";
import Link from "next/link";

// Adjusted interfaces for the new data structure
interface Session {
  id: string;
  game_pin: string;
  host_id: string;
  quiz_id: string;
  status: "waiting" | "playing" | "finished";
  question_limit: number;
  total_time_minutes: number;
  difficulty: string;
  countdown_started_at: string | null;
}

interface Participant {
  id: string;
  session_id: string;
  nickname: string;
  character_type: string; // Assuming this column exists based on old UI
  is_host: boolean;
  // Add other participant fields as needed from your schema
}

function QRModal({ open, onClose, roomCode }: { open: boolean; onClose: () => void; roomCode: string }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  if (!open) return null;

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.section initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, opacity: 0 }} transition={{ type: "spring", stiffness: 240, damping: 28 }} className="relative z-10 w-full max-w-sm sm:max-w-md bg-black/95 text-white rounded-2xl p-4 sm:p-6 shadow-[0_0_60px_rgba(255,0,0,0.45)]" role="dialog" aria-modal="true">
        <div className="flex flex-col items-center justify-center gap-4 py-4" style={{ minHeight: 300 }}>
          <div className="w-full bg-white rounded-lg p-2 sm:p-3 flex items-center justify-center">
            <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-64 md:h-64">
              <QRCode value={`${window.location.origin}/?code=${roomCode}`} style={{ width: "100%", height: "100%" }} viewBox="0 0 256 256" />
            </div>
          </div>
          <p className="text-center text-sm sm:text-base text-red-400">Scan QR Code untuk bergabung</p>
          <Button onClick={onClose} variant="outline" className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-red-600"> Tutup </Button>
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  );
}

export default function HostLobbyPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flickerText, setFlickerText] = useState(true);
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([]);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Participant | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useHostGuard(roomCode);

  const confirmKickPlayer = async () => {
    if (!selectedPlayer) return;
    try {
      // New simplified kick logic
      const { error } = await mysupa.from("participants").delete().eq("id", selectedPlayer.id);
      if (error) throw error;
      toast.success(t("kickPlayerSuccess", { nickname: selectedPlayer.nickname }));
    } catch (error) {
      console.error("Kick player error:", error);
      toast.error(t("kickPlayerError"));
    } finally {
      setKickDialogOpen(false);
      setSelectedPlayer(null);
    }
  };

  // New useEffect for initial data fetching
  useEffect(() => {
    const initializeLobby = async () => {
      setIsLoading(true);
      if (!roomCode) {
        toast.error("Invalid Room Code");
        router.push("/");
        return;
      }

      // 1. Fetch session data from mysupa
      const { data: sessionData, error: sessionError } = await mysupa.from("sessions").select("*").eq("game_pin", roomCode).single();

      if (sessionError || !sessionData) {
        console.error("Session not found in mysupa:", sessionError);
        toast.error("Lobby session not found.");
        router.push("/host");
        return;
      }
      setSession(sessionData);

      // 2. Fetch initial participants
      const { data: participantsData, error: participantsError } = await mysupa.from("participants").select("*").eq("session_id", sessionData.id);

      if (participantsError) {
        console.error("Error fetching participants:", participantsError);
        toast.error("Could not load participant list.");
      } else {
        setParticipants(participantsData || []);
      }

      setIsLoading(false);
    };
    initializeLobby();
  }, [roomCode, router]);

  // New useEffect for Realtime subscriptions
  useEffect(() => {
    if (!session?.id) return;

    const channel = mysupa
      .channel(`lobby_${session.id}`)
      .on<Participant>(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${session.id}` },
        (payload) => {
          console.log("Realtime event:", payload.eventType, payload);
          if (payload.eventType === "INSERT") {
            setParticipants((current) => [...current, payload.new]);
          } else if (payload.eventType === "DELETE") {
            setParticipants((current) => current.filter((p) => p.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setParticipants((current) => current.map((p) => (p.id === payload.new.id ? payload.new : p)));
          }
        },
      )
      .subscribe();

    return () => {
      mysupa.removeChannel(channel);
    };
  }, [session?.id]);
  
  const startGame = async () => {
    if (!session || participants.length === 0) {
      toast.error("Gagal memulai game: Tidak ada sesi atau pemain.");
      return;
    }

    setIsStarting(true);
    try {
      await syncServerTime();
      const startTime = new Date().toISOString();

      // Update status on both databases
      const [mysupaResult, supabaseResult] = await Promise.all([
        mysupa.from("sessions").update({ status: "playing", countdown_started_at: startTime }).eq("id", session.id),
        supabase.from("game_sessions").update({ status: "active", countdown_started_at: startTime }).eq("id", session.id),
      ]);

      if (mysupaResult.error) throw new Error(`Mysupa update failed: ${mysupaResult.error.message}`);
      if (supabaseResult.error) throw new Error(`Supabase update failed: ${supabaseResult.error.message}`);
      
      setCountdown(10);
      
      setTimeout(() => {
        router.push(`/host/${roomCode}/game`);
      }, 10000);

    } catch (error: any) {
      console.error("Error starting game:", error);
      toast.error("Gagal memulai game: " + error.message);
      setIsStarting(false);
    }
  };

  // --- Aesthetic and minor logic hooks ---
  useEffect(() => {
    const generateBlood = () => setBloodDrips(Array.from({ length: 10 }, (_, i) => ({ id: i, left: Math.random() * 100, speed: 2 + Math.random() * 1.5, delay: Math.random() * 3 })));
    generateBlood();
    const flickerInterval = setInterval(() => setFlickerText((prev) => !prev), 100 + Math.random() * 150);
    return () => clearInterval(flickerInterval);
  }, []);

  useEffect(() => {
    if (!session?.countdown_started_at) {
      setCountdown(null);
      setIsStarting(false);
      return;
    }
    const timer = setInterval(() => {
      const remaining = calculateCountdown(session.countdown_started_at, 10000);
      setCountdown(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [session?.countdown_started_at]);
  
  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const characterOptions = [
    { value: "robot1", name: "Hijau", gif: "/character/player/character.webp" },
    { value: "robot2", name: "Biru", gif: "/character/player/character1-crop.webp" },
    { value: "robot3", name: "Merah", gif: "/character/player/character2-crop.webp" },
    { value: "robot4", name: "Ungu", gif: "/character/player/character3-crop.webp" },
    { value: "robot5", name: "Oranye", gif: "/character/player/character4-crop.webp" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-red-400 text-xl font-mono text-center">Lobby tidak ditemukan.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      {/* Backgrounds and decorative elements */}
      <div className="absolute top-4 left-4 z-20 hidden md:block"> <Link href={"/"}> <h1 className="text-3xl md:text-5xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]" style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}> {t("title")} </h1> </Link> </div>
      <div className="absolute top-4 right-4 z-20 hidden md:block"> <img src={`/logo/gameforsmartlogo-horror.png`} alt="Game for Smart Logo" className="w-40 md:w-48 lg:w-56 h-auto" /> </div>
      <audio src="/musics/background-music-room.mp3" autoPlay loop muted />
      <div className="absolute inset-0 z-0" style={{ backgroundImage: "url('/background/21.gif')", backgroundSize: "cover", backgroundPosition: "center" }}></div>
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5" />
      {bloodDrips.map((drip) => ( <motion.div key={drip.id} initial={{ y: -100 }} animate={{ y: "100vh" }} transition={{ duration: drip.speed, delay: drip.delay, ease: "linear", repeat: Infinity }} className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50" style={{ left: `${drip.left}%` }} /> ))}
      <div className="absolute inset-0 pointer-events-none"> {[...Array(8)].map((_, i) => ( <div key={i} className="absolute text-red-900/20 animate-float hidden sm:block" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, fontSize: `${2 + Math.random() * 3}rem`, animationDelay: `${Math.random() * 5}s`, animationDuration: `${15 + Math.random() * 20}s`, }}> {Math.random() > 0.5 ? <Skull /> : <Bone />} </div> ))} </div>

      <AnimatePresence>
        {countdown !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }} className="text-[8rem] sm:text-[12rem] md:text-[16rem] font-mono font-bold text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
              {Math.ceil(countdown / 1000)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`relative z-10 mx-auto p-4 sm:p-6 lg:p-7 ${countdown !== null ? "blur-sm" : ""}`}>
        <header className="flex flex-col gap-2 sm:gap-4 mb-6 text-center max-w-7xl mx-auto mt-10">
          <h1 className={`text-xl sm:text-3xl md:text-4xl font-bold font-mono tracking-wider transition-all duration-150 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse ${flickerText ? 'opacity-100' : 'opacity-50'}`} style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}>
            {t("hostRoomTitle")}
          </h1>
        </header>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
          {/* Info Cards */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-3 lg:grid-cols-1 gap-4 lg:col-span-1">
            <Card className="bg-black/40 border border-red-900/50"> <CardContent> <div className="flex items-center gap-2"> <Users className="w-6 h-6 text-red-500" /> <div className="text-3xl font-bold text-red-500 font-mono">{participants.length}</div> </div> </CardContent> </Card>
            <Card className="bg-black/40 border border-red-900/50"> <CardContent> <div className="flex items-center gap-2"> <Clock className="w-6 h-6 text-red-500" /> <div className="text-3xl font-bold text-red-500 font-mono">{session.total_time_minutes}</div> </div> </CardContent> </Card>
            <Card className="bg-black/40 border border-red-900/50"> <CardContent> <div className="flex items-center gap-2"> <List className="w-6 h-6 text-red-500" /> <div className="text-3xl font-bold text-red-500 font-mono">{session.question_limit}</div> </div> </CardContent> </Card>
          </motion.div>

          {/* QR Code and Actions */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="relative flex flex-col items-stretch bg-black/40 border border-red-900/50 rounded-lg p-6 lg:col-span-4 gap-6">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <div className="relative w-full bg-black/50 p-4 rounded-2xl border border-red-500/30 text-center">
                        <Button variant="ghost" size="sm" onClick={copyRoomCode} className="absolute top-2 right-2 text-red-400 hover:bg-red-500/20 p-2">
                            <motion.div key={copied ? "check" : "copy"} initial={{ scale: 0 }} animate={{ scale: 1 }}>{copied ? <Check /> : <Copy />}</motion.div>
                        </Button>
                        <div className="text-5xl font-mono font-bold text-red-500 tracking-widest">{roomCode}</div>
                    </div>
                     <Button onClick={startGame} disabled={participants.length === 0 || isStarting || countdown !== null} className="w-full mt-4 bg-gradient-to-r from-red-900 to-red-700 text-white font-mono text-xl py-6 rounded-lg border-2 border-red-700 shadow-[0_0_20px_rgba(239,68,68,0.5)] disabled:opacity-50">
                        <Play className="w-5 h-5 mr-2" /> {isStarting ? t("startGame.starting") : t("startGame.start")}
                     </Button>
                </div>
                <div className="w-full h-full bg-white rounded-lg p-2 cursor-pointer hover:scale-105 transition-transform flex items-center justify-center" onClick={() => setIsQrModalOpen(true)}>
                    <QRCode value={`${window.location.origin}/?code=${roomCode}`} size={256} style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox={`0 0 256 256`} />
                </div>
            </div>
          </motion.div>
        </div>

        <QRModal open={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} roomCode={roomCode} />
        
        {/* Player List */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="max-w-7xl mx-auto">
          <Card className="bg-black/40 border border-red-900/50">
            <CardHeader><CardTitle className="text-red-500 text-2xl font-mono flex items-center gap-3"><Users /> {t("players")}</CardTitle></CardHeader>
            <CardContent>
              <AnimatePresence>
                {participants.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-10">
                    <p className="text-red-400 text-lg font-mono animate-pulse">{t("waitingHost")}</p>
                  </motion.div>
                ) : (
                  <motion.div key="players" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-4">
                    {participants.map((player, index) => {
                      const selectedCharacter = characterOptions.find((char) => char.value === player.character_type);
                      return (
                        <motion.div key={player.id} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ type: "spring", stiffness: 200, damping: 20, delay: index * 0.05 }} className="bg-black/40 border border-red-900/50 rounded-lg p-4 text-center relative group">
                          {!player.is_host && (
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedPlayer(player); setKickDialogOpen(true); }} className="absolute z-10 top-2 left-2 bg-black/60 text-red-500 hover:bg-red-700/60 p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          {selectedCharacter && <div className="h-24 w-full flex items-center justify-center mb-2"> <img src={selectedCharacter.gif} alt={player.nickname} className="max-h-full max-w-full object-contain" /> </div>}
                          <div className="text-red-500 font-medium truncate font-mono">{player.nickname}</div>
                          {player.is_host && (<Badge variant="secondary" className="text-xs bg-red-900 text-red-400 font-mono">{t("host")}</Badge>)}
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
        <DialogContent className="bg-black/95 border border-red-600/70 text-red-400">
          <DialogHeader><DialogTitle className="text-lg font-bold text-red-500">{t("kickPlayerConfirm", { nickname: selectedPlayer?.nickname })}</DialogTitle></DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setKickDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={confirmKickPlayer} className="bg-red-600 hover:bg-red-700 text-white">{t("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
