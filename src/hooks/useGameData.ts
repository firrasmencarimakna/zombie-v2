"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

// Export interfaces (updated for compatibility with new schema)
export interface TransformedPlayer {
  id: string
  nickname: string
  health: number
  maxHealth: number
  score: number
  correctAnswers: number
  isHost?: boolean
  isReady?: boolean
  hasAnswered?: boolean
  status?: "alive" | "dead" | "spectating"
  character_type?: string
  room_id: string
  player_id?: string  // Added for original field preservation
  is_host?: boolean   // Added for original field preservation
}

export interface TransformedRoom {
  code: string
  hostId: string
  id: string
  status: string
  title: string  // From schema: NOT NULL
  questions?: any[]
  embedded_questions?: any[]  // Tambahan untuk kompatibilitas
  quiz_id?: string  // Added from schema for potential quiz fetching
  duration?: number  // Added from schema (in seconds)
  max_players?: number  // Added from schema
  difficulty_level?: string  // Added from schema
  chaser_type?: string  // Added from schema
  question_count?: number  // Added from schema
  game_start_time?: string  // Added from schema (replaces current_phase)
  countdown_start?: string  // Added from schema
  created_at?: string  // Added from schema
  updated_at?: string  // Added from schema
}

export function useGameData(roomCode: string | undefined, nickname: string | null) {
  const [room, setRoom] = useState<TransformedRoom | null>(null)
  const [players, setPlayers] = useState<TransformedPlayer[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<TransformedPlayer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSoloMode, setIsSoloMode] = useState(false)

  const loadGameData = useCallback(async (payload?: any) => {
    if (!roomCode) return

    try {
      setError(null)
      console.log(`Loading game data for room: ${roomCode}`)

      let roomData: any
      if (payload && payload.new) {
        // Use payload if available (from realtime)
        roomData = payload.new
      } else {
        // Fetch fresh
        const { data: fetchedData, error: roomError } = await supabase
          .from("game_rooms")
          .select(`
            *,
            players,
            embedded_questions
          `)
          .eq("room_code", roomCode.toUpperCase())
          .single()

        if (roomError || !fetchedData) {
          console.error("Room not found:", roomError)
          setError("Room not found")
          setIsLoading(false)
          return
        }
        roomData = fetchedData
      }

      // Ensure embedded_questions are loaded from quiz if missing
      if ((!roomData.embedded_questions || roomData.embedded_questions.length === 0) && roomData.quiz_id) {
        console.log("Fetching questions from quiz...")
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .select("questions")
          .eq("id", roomData.quiz_id)
          .single()

        if (!quizError && quizData && quizData.questions && quizData.questions.length > 0) {
          const { error: updateError } = await supabase
            .from("game_rooms")
            .update({ 
              embedded_questions: quizData.questions,
              updated_at: new Date().toISOString()
            })
            .eq("id", roomData.id)

          if (!updateError) {
            roomData.embedded_questions = quizData.questions
          } else {
            console.error("Failed to embed questions:", updateError)
          }
        }
      }

      // Parse embedded players
      const parsedPlayers = roomData.players || []

      // Transform room data (aligned with schema: removed current_phase, added schema fields)
      const transformedRoom: TransformedRoom = {
        code: roomData.room_code,
        hostId: roomData.host_id || "",
        id: roomData.id,
        status: roomData.status,
        title: roomData.title,  // Required per schema
        questions: roomData.embedded_questions || [],  // Fallback ke embedded_questions
        embedded_questions: roomData.embedded_questions,  // Simpan original
        quiz_id: roomData.quiz_id,
        duration: roomData.duration,
        max_players: roomData.max_players,
        difficulty_level: roomData.difficulty_level,
        chaser_type: roomData.chaser_type,
        question_count: roomData.question_count,
        game_start_time: roomData.game_start_time,  // Replaces current_phase
        countdown_start: roomData.countdown_start,
        created_at: roomData.created_at,
        updated_at: roomData.updated_at,
      }

      // Transform players data (assumes players JSONB structure matches schema expectations)
      const transformedPlayers: TransformedPlayer[] = parsedPlayers.map((player: any) => ({
        id: player.player_id || player.id,  // Fallback
        player_id: player.player_id,  // Simpan original
        nickname: player.nickname,
        health: player.health?.current || 3,
        maxHealth: player.health?.max || 3,
        score: player.score || 0,
        correctAnswers: player.correct_answers || 0,
        isHost: player.is_host,  // Alias
        is_host: player.is_host,  // Simpan original
        isReady: true,
        hasAnswered: false,
        status: player.is_alive ? "alive" : "dead",
        character_type: player.character_type,
        room_id: roomData.id,
      }))

      // Find or create current player
      let transformedCurrentPlayer: TransformedPlayer | null = null
      const playerId = localStorage.getItem('playerId') // Use stored playerId from join
      if (playerId) {
        transformedCurrentPlayer = transformedPlayers.find((p) => p.id === playerId) || null

        // If player not found, append new player to embedded array
        if (!transformedCurrentPlayer && roomData.status === "waiting") {
          console.log(`Creating new player: ${nickname}`)
          const newPlayer = {
            player_id: playerId,
            nickname: nickname || 'Unknown',
            character_type: `robot${Math.floor(Math.random() * 10) + 1}`,
            score: 0,
            correct_answers: 0,
            is_host: parsedPlayers.length === 0, // First player is host
            position_x: 0,
            position_y: 0,
            is_alive: true,
            power_ups: 0,
            joined_at: new Date().toISOString(),
            health: {
              current: 3,
              max: 3,
              is_being_attacked: false,
              last_attack_time: new Date().toISOString(),
              speed: 20,
              last_answer_time: new Date().toISOString(),
              countdown: 0
            },
            answers: [],
            attacks: []
          }

          // Prepare updates
          const updates: any = { 
            players: [...parsedPlayers, newPlayer],
            updated_at: new Date().toISOString()
          }

          // If first player and no host_id, set host_id
          if (parsedPlayers.length === 0 && !roomData.host_id) {
            updates.host_id = playerId
            newPlayer.is_host = true
          }

          const { error: playerError } = await supabase
            .from("game_rooms")
            .update(updates)
            .eq("id", roomData.id)

          if (playerError) {
            console.error("Failed to create player:", playerError)
            setError("Failed to join game")
          } else {
            transformedCurrentPlayer = {
              id: newPlayer.player_id,
              player_id: newPlayer.player_id,
              nickname: newPlayer.nickname,
              health: newPlayer.health.current,
              maxHealth: newPlayer.health.max,
              score: 0,
              correctAnswers: 0,
              isHost: newPlayer.is_host,
              is_host: newPlayer.is_host,
              isReady: true,
              hasAnswered: false,
              status: "alive",
              character_type: newPlayer.character_type,
              room_id: roomData.id,
            }
            transformedPlayers.push(transformedCurrentPlayer)
          }
        }
      }

      // Set state after transformations
      setRoom(transformedRoom)
      setPlayers(transformedPlayers)
      setCurrentPlayer(transformedCurrentPlayer)
      setIsLoading(false)
    } catch (err) {
      console.error("Error loading game data:", err)
      setError("Failed to load game data")
      setIsLoading(false)
    }
  }, [roomCode, nickname])

  // Setup realtime subscriptions (only to game_rooms)
  useEffect(() => {
    if (!room) return

    console.log(`Setting up realtime subscriptions for room ${room.id}`)

    // Subscribe to all changes in game_rooms (covers players, embedded_questions, etc.)
    const roomChannel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          console.log("Room updated:", payload)
          loadGameData(payload)  // Pass payload to avoid full refetch if possible
        },
      )
      .subscribe()

    return () => {
      console.log("Cleaning up subscriptions")
      supabase.removeChannel(roomChannel)
    }
  }, [room, loadGameData])

  // Initial data load
  useEffect(() => {
    if (roomCode) {
      loadGameData()
    }
  }, [loadGameData, roomCode])

  const refetch = useCallback(() => {
    console.log("Refetching game data...")
    setIsLoading(true)
    loadGameData()
  }, [loadGameData])

  return {
    room,
    players,
    currentPlayer,
    isLoading,
    error,
    isSoloMode,
    refetch,
  }
}