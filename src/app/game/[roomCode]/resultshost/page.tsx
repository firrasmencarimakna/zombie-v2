"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { motion } from "framer-motion"
import Image from "next/image"
import Confetti from "react-confetti"
import { Skull, Bone, Trophy, Clock, Heart, Target } from "lucide-react"

interface Player {
  id: string
  nickname: string
  character_type: string
  score: number
  is_alive: boolean
  joined_at: string
}

interface GameCompletion {
  id: string
  player_id: string
  room_id: string
  final_health: number
  correct_answers: number
  total_questions_answered: number
  is_eliminated: boolean
  completion_type: string
  completed_at: string
  survival_duration: number // Added survival_duration field
}

interface PlayerHealthState {
  id: string
  player_id: string
  room_id: string
  health: number
  speed: number
  last_answer_time: string
}

interface GameRoom {
  id: string
  room_code: string
  title: string
  status: string
  max_players: number
  current_phase: string
  game_start_time: string | null
  questions: any[]
}

interface PlayerResult {
  id: string
  nickname: string
  character_type: string
  rank: number
  duration: string
  isLolos: boolean
  correctAnswers: number
  totalQuestions: number
  finalScore: number
  finalHealth: number
  completionTime: string
  survivalSeconds: number // Added for accurate sorting
}

const characterGifs = [
  { src: "/character/character.gif", alt: "Karakter Hijau", color: "bg-green-500", type: "robot1", name: "Hijau" },
  { src: "/character/character1.gif", alt: "Karakter Biru", color: "bg-blue-500", type: "robot2", name: "Biru" },
  { src: "/character/character2.gif", alt: "Karakter Merah", color: "bg-red-500", type: "robot3", name: "Merah" },
  { src: "/character/character3.gif", alt: "Karakter Ungu", color: "bg-purple-500", type: "robot4", name: "Ungu" },
  { src: "/character/character4.gif", alt: "Karakter Oranye", color: "bg-orange-500", type: "robot5", name: "Oranye" },
  { src: "/character/character5.gif", alt: "Karakter Kuning", color: "bg-yellow-500", type: "robot6", name: "Kuning" },
  { src: "/character/character6.gif", alt: "Karakter Abu-abu", color: "bg-gray-500", type: "robot7", name: "Abu-abu" },
  { src: "/character/character7.gif", alt: "Karakter Pink", color: "bg-pink-500", type: "robot8", name: "Pink" },
  { src: "/character/character8.gif", alt: "Karakter Cokelat", color: "bg-brown-500", type: "robot9", name: "Cokelat" },
  { src: "/character/character9.gif", alt: "Karakter Emas", color: "bg-yellow-600", type: "robot10", name: "Emas" },
]

export default function ResultsHostPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.roomCode as string
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null)
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [showContent, setShowContent] = useState(false)

  const getCharacterByType = (type: string) => {
    return characterGifs.find((char) => char.type === type) || characterGifs[0]
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const calculateFallbackDuration = (start: string | null, end: string, joined: string) => {
    if (!start) return 0
    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()
    const joinTime = new Date(joined).getTime()
    const effectiveStart = Math.max(startTime, joinTime)
    const durationMs = Math.max(0, endTime - effectiveStart)
    return Math.floor(durationMs / 1000)
  }

  const getColumnsLayout = (players: PlayerResult[]) => {
    const playersPerColumn = 8
    const columns: PlayerResult[][] = []

    for (let i = 0; i < players.length; i += playersPerColumn) {
      columns.push(players.slice(i, i + playersPerColumn))
    }

    return columns
  }

  const getGridCols = (playerCount: number) => {
    if (playerCount <= 8) return "grid-cols-1"
    if (playerCount <= 16) return "grid-cols-2"
    if (playerCount <= 24) return "grid-cols-3"
    if (playerCount <= 32) return "grid-cols-4"
    if (playerCount <= 40) return "grid-cols-5"
    return "grid-cols-6"
  }

  useEffect(() => {
    const fetchGameData = async () => {
      if (!roomCode) {
        setLoadingError("Kode ruangan tidak valid")
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)

        const { data: room, error: roomError } = await supabase
          .from("game_rooms")
          .select("*, questions")
          .eq("room_code", roomCode.toUpperCase())
          .single()

        if (roomError || !room) {
          throw new Error("Ruangan tidak ditemukan")
        }
        setGameRoom(room)

        const { data: playersData, error: playersError } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", room.id)

        if (playersError) {
          throw new Error("Gagal mengambil data pemain")
        }

        const { data: completionData, error: completionError } = await supabase
          .from("game_completions")
          .select("*, survival_duration")
          .eq("room_id", room.id)
          .order("completed_at", { ascending: false })

        if (completionError) {
          console.error("Error fetching completions:", completionError)
        }

        const uniqueCompletions =
          completionData?.reduce((acc: GameCompletion[], current: GameCompletion) => {
            if (!acc.some((c) => c.player_id === current.player_id)) {
              acc.push(current)
            }
            return acc
          }, []) || []

        const { data: healthData, error: healthError } = await supabase
          .from("player_health_states")
          .select("*")
          .eq("room_id", room.id)

        if (healthError) {
          console.error("Error fetching health states:", healthError)
        }

        const totalQuestions = room.questions?.length || 0
        const gameEndTime = new Date().toISOString()

        const processedResults: PlayerResult[] = (playersData || []).map((player: Player) => {
          const completion = uniqueCompletions.find((c: any) => c.player_id === player.id)
          const healthState = healthData?.find((h) => h.player_id === player.id)

          let finalHealth = 3
          let survivalSeconds = 0
          let isEliminated = false

          if (completion) {
            finalHealth = completion.final_health
            isEliminated = completion.is_eliminated
            survivalSeconds =
              completion.survival_duration ||
              calculateFallbackDuration(room.game_start_time, completion.completed_at, player.joined_at)
          } else if (healthState) {
            finalHealth = healthState.health
            isEliminated = finalHealth <= 0
            survivalSeconds = calculateFallbackDuration(room.game_start_time, gameEndTime, player.joined_at)
          } else {
            survivalSeconds = 0
            isEliminated = true
            finalHealth = 0
          }

          const actuallyEliminated = isEliminated || finalHealth <= 0
          const isLolos = !actuallyEliminated && finalHealth > 0

          const completionTime = completion ? completion.completed_at : gameEndTime
          const duration = formatDuration(survivalSeconds)
          const correctAnswers = completion ? completion.correct_answers : 0
          const finalScore = correctAnswers * 100 + finalHealth * 50

          console.log(
            `[v0] Player ${player.nickname}: health=${finalHealth}, eliminated=${actuallyEliminated}, duration=${survivalSeconds}s`,
          )

          return {
            id: player.id,
            nickname: player.nickname,
            character_type: player.character_type,
            rank: 0,
            duration,
            isLolos,
            correctAnswers,
            totalQuestions,
            finalScore,
            finalHealth,
            completionTime,
            survivalSeconds, // Store for accurate sorting
          }
        })

        const rankedResults = processedResults
          .sort((a, b) => {
            // First priority: survivors vs eliminated
            if (a.isLolos !== b.isLolos) {
              return a.isLolos ? -1 : 1
            }

            // Second priority: score (higher is better)
            if (a.finalScore !== b.finalScore) {
              return b.finalScore - a.finalScore
            }

            // Third priority: survival time (longer is better for survivors, shorter is better for eliminated)
            if (a.isLolos) {
              // For survivors, longer survival time is better
              return b.survivalSeconds - a.survivalSeconds
            } else {
              // For eliminated players, longer survival time is still better
              return b.survivalSeconds - a.survivalSeconds
            }
          })
          .map((result, index) => ({
            ...result,
            rank: index + 1,
          }))

        console.log(
          `[v0] Final rankings:`,
          rankedResults.map(
            (r) =>
              `${r.rank}. ${r.nickname} - ${r.isLolos ? "LOLOS" : "ELIMINATED"} - ${r.duration} - Score: ${r.finalScore}`,
          ),
        )

        setPlayerResults(rankedResults)

        if (rankedResults.some((r) => r.isLolos)) {
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 5000)
        }

        setTimeout(() => {
          setShowContent(true)
        }, 1000)
      } catch (error) {
        console.error("Gagal mengambil data:", error)
        setLoadingError("Gagal memuat hasil permainan. Silakan coba lagi.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchGameData()
  }, [roomCode])

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-2xl font-mono">
          Memuat Hasil Permainan...
        </motion.div>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-500 text-2xl font-mono text-center"
        >
          <Skull className="w-16 h-16 mx-auto mb-4" />
          {loadingError}
          <button
            onClick={() => window.location.reload()}
            className="block mx-auto mt-4 bg-red-600 hover:bg-red-500 text-white font-mono py-2 px-4 rounded"
          >
            Coba Lagi
          </button>
        </motion.div>
      </div>
    )
  }

  const columnsData = getColumnsLayout(playerResults)

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-black to-purple-900/20">
        <div className="absolute inset-0 opacity-40">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute bg-gradient-to-r from-red-900/50 to-orange-900/50 rounded-full mix-blend-multiply blur-3xl animate-pulse"
              style={{
                width: `${80 + i * 20}px`,
                height: `${80 + i * 20}px`,
                left: `${i * 8 + 2}%`,
                top: `${i * 8 + 2}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${2 + i * 0.3}s`,
              }}
            />
          ))}
        </div>
      </div>

      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 animate-fall"
          style={{
            left: `${Math.random() * 100}%`,
            animation: `fall ${2 + Math.random() * 4}s linear ${Math.random() * 10}s infinite`,
            opacity: 0.4 + Math.random() * 0.4,
          }}
        >
          {i % 4 === 0 ? (
            <div className="w-1 h-8 bg-gradient-to-b from-red-500 to-transparent" />
          ) : i % 4 === 1 ? (
            <div className="w-2 h-2 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(255,215,0,0.8)]" />
          ) : i % 4 === 2 ? (
            <Trophy className="w-4 h-4 text-yellow-400" />
          ) : (
            <Skull className="w-3 h-3 text-red-400" />
          )}
        </div>
      ))}

      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-red-900/20 animate-float"
            style={{
              left: `${i * 6 + 5}%`,
              top: `${i * 6 + 5}%`,
              fontSize: `${1 + (i % 3) * 0.3}rem`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${8 + (i % 4) * 2}s`,
            }}
          >
            {i % 4 === 0 ? (
              <Skull aria-hidden="true" />
            ) : i % 4 === 1 ? (
              <Bone aria-hidden="true" />
            ) : i % 4 === 2 ? (
              <Trophy aria-hidden="true" />
            ) : (
              <Heart aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
          colors={["#ff0000", "#8b0000", "#ff4500", "#dc143c", "#ffd700"]}
        />
      )}

      <audio src="/musics/victory.mp3" autoPlay />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showContent ? 1 : 0 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        className="relative z-10 container mx-auto px-2 py-4"
      >
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.5 }}
          className="text-2xl md:text-4xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-500 to-orange-500 drop-shadow-[0_0_15px_rgba(255,0,0,0.6)] font-mono relative"
        >
          <div className="absolute inset-0 text-red-500/20 blur-sm">Hasil Permainan - {gameRoom?.title}</div>
          Hasil Permainan - {gameRoom?.title}
        </motion.h1>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.8 }}
          className="mb-4"
        >
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 1.0 }}
            className="text-xl md:text-2xl font-bold text-center mb-4 font-mono flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            >
              <Trophy className="w-6 h-6 mr-3 text-yellow-500 drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]" />
            </motion.div>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-500 to-orange-500">
              Leaderboard Final
            </span>
            <motion.div
              animate={{ rotate: [360, 0] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            >
              <Trophy className="w-6 h-6 ml-3 text-yellow-500 drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]" />
            </motion.div>
          </motion.h2>

          <div className={`grid ${getGridCols(playerResults.length)} gap-2 max-w-7xl mx-auto`}>
            {columnsData.map((column, columnIndex) => (
              <div key={columnIndex} className="space-y-2">
                {column.map((player, playerIndex) => {
                  const character = getCharacterByType(player.character_type)
                  const statusColor = player.isLolos
                    ? "bg-gradient-to-r from-green-600 to-green-500"
                    : "bg-gradient-to-r from-red-600 to-red-500"
                  const statusText = player.isLolos ? "LOLOS" : "TIDAK LOLOS"
                  const rankColor =
                    player.rank === 1
                      ? "bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-600"
                      : player.rank === 2
                        ? "bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500"
                        : player.rank === 3
                          ? "bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"
                          : "bg-gradient-to-r from-red-600 via-red-500 to-red-700"

                  const animationDelay = 1.5 + (player.rank - 1) * 0.15

                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.6,
                        delay: animationDelay,
                        ease: "easeOut",
                      }}
                      whileHover={{
                        scale: 1.02,
                        transition: { duration: 0.2 },
                      }}
                      className="bg-gradient-to-r from-gray-900/95 via-gray-800/95 to-gray-900/95 border border-red-500/40 rounded-lg overflow-hidden shadow-[0_0_15px_rgba(255,0,0,0.25)] hover:shadow-[0_0_25px_rgba(255,0,0,0.5)] transition-all duration-300 backdrop-blur-sm"
                    >
                      <div className="flex items-center h-14 relative">
                        <div
                          className={`${rankColor} h-full flex items-center justify-center px-3 min-w-[50px] relative overflow-hidden`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                          <div className="text-white font-bold text-sm font-mono flex items-center relative z-10 drop-shadow-lg">
                            {player.rank === 1 && (
                              <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                              >
                                <Trophy className="w-3 h-3 mr-1 text-yellow-200" />
                              </motion.div>
                            )}
                            <span className="text-shadow-lg">{player.rank.toString().padStart(2, "0")}</span>
                          </div>
                        </div>

                        <div className="flex-1 flex items-center px-2 py-2 bg-gradient-to-r from-transparent to-gray-800/20 min-w-0">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.2 }}
                              className="relative flex-shrink-0"
                            >
                              <div
                                className={`absolute inset-0 rounded-full ${player.isLolos ? "bg-green-500/30" : "bg-red-500/30"} blur-sm`}
                              />
                              <Image
                                src={character.src || "/placeholder.svg"}
                                alt={character.alt}
                                width={32}
                                height={32}
                                className={`object-contain rounded-full relative z-10 border ${player.isLolos ? "border-green-400/50" : "border-red-400/50"} ${!player.isLolos ? "opacity-70 grayscale" : ""}`}
                              />
                            </motion.div>

                            <div className="flex-1 min-w-0">
                              <h3 className="text-xs font-bold text-white truncate mb-1 drop-shadow-md max-w-full">
                                {player.nickname}
                              </h3>
                              <div className="flex items-center space-x-1 text-xs text-gray-300">
                                <span className="flex items-center bg-blue-900/30 px-1 py-0.5 rounded text-xs">
                                  <Clock className="w-2 h-2 mr-1 text-blue-400" />
                                  <span className="font-mono text-xs">{player.duration}</span>
                                </span>
                                <span className="flex items-center bg-purple-900/30 px-1 py-0.5 rounded text-xs">
                                  <Target className="w-2 h-2 mr-1 text-purple-400" />
                                  <span className="font-mono text-xs">
                                    {player.correctAnswers}/{player.totalQuestions}
                                  </span>
                                </span>
                                <span className="flex items-center bg-pink-900/30 px-1 py-0.5 rounded text-xs">
                                  <Heart className="w-2 h-2 mr-1 text-pink-400" />
                                  <span className="font-mono text-xs">{player.finalHealth}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`${statusColor} h-full flex items-center justify-center px-2 min-w-[80px] relative overflow-hidden`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
                          <motion.span
                            className="text-white font-bold text-xs font-mono relative z-10 drop-shadow-lg text-center leading-tight"
                            animate={player.isLolos ? { scale: [1, 1.05, 1] } : {}}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                          >
                            {statusText}
                          </motion.span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 2.0 }}
          className="mb-4 bg-gradient-to-r from-gray-800/90 via-gray-900/90 to-gray-800/90 border border-red-500/60 rounded-lg p-3 backdrop-blur-sm shadow-[0_0_20px_rgba(255,0,0,0.2)]"
        >
          <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400 mb-2 text-center">
            Ringkasan Permainan
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
            {[
              {
                value: playerResults.filter((p) => p.isLolos).length,
                label: "Lolos",
                color: "text-green-400",
                bg: "bg-green-900/30",
              },
              {
                value: playerResults.filter((p) => !p.isLolos).length,
                label: "Gugur",
                color: "text-red-400",
                bg: "bg-red-900/30",
              },
              {
                value: gameRoom?.questions?.length || 0,
                label: "Total Soal",
                color: "text-yellow-400",
                bg: "bg-yellow-900/30",
              },
              { value: playerResults.length, label: "Total Pemain", color: "text-blue-400", bg: "bg-blue-900/30" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.5, delay: 2.2 + index * 0.1 }}
                className={`${stat.bg} rounded-lg p-2 border border-gray-600/50`}
              >
                <motion.div
                  className={`text-lg font-bold ${stat.color} font-mono`}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: index * 0.2 }}
                >
                  {stat.value}
                </motion.div>
                <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 2.5 }}
          className="text-center"
        >
          <motion.button
            onClick={() => router.push("/")}
            whileHover={{ scale: 1.03, boxShadow: "0 0 25px rgba(255,0,0,0.5)" }}
            whileTap={{ scale: 0.97 }}
            className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-500 hover:via-red-400 hover:to-red-500 text-white font-mono py-3 px-8 rounded-lg text-base transition-all duration-300 shadow-[0_0_15px_rgba(255,0,0,0.3)] border border-red-400/50 backdrop-blur-sm"
          >
            Kembali ke Menu Utama
          </motion.button>
        </motion.div>
      </motion.div>

      <style jsx global>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg) scale(1);
          }
          33% {
            transform: translateY(-10px) rotate(120deg) scale(1.05);
          }
          66% {
            transform: translateY(-5px) rotate(240deg) scale(0.95);
          }
        }
        .animate-fall {
          animation: fall var(--animation-duration) linear infinite;
        }
        .animate-float {
          animation: float var(--animation-duration) ease-in-out infinite;
        }
        .text-shadow-lg {
          text-shadow: 0 3px 6px rgba(0,0,0,0.8);
        }
      `}</style>
    </div>
  )
}
