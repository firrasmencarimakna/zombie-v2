"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { GameRoom, EmbeddedPlayer } from "@/lib/supabase" // Import types untuk type safety

// Extend EmbeddedPlayer type inline jika belum ada di supabase.ts
interface ExtendedEmbeddedPlayer extends EmbeddedPlayer {
  is_ready?: boolean;
  wrong_answers?: number;
}

interface GameLogicProps {
  room: GameRoom | null
  players: ExtendedEmbeddedPlayer[] // Gunakan extended type
  currentPlayer: ExtendedEmbeddedPlayer | null // Asumsi currentPlayer dari players.find()
}

export function useGameLogic({ room, players, currentPlayer }: GameLogicProps) {
  // Component mount tracking
  const isMountedRef = useRef(true)

  const [isGameOver, setIsGameOver] = useState(false)
  const [showCaptureAnimation, setShowCaptureAnimation] = useState(false)
  const [wrongAnswers, setWrongAnswers] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Helper: Update players array di DB (JSONB)
  const updatePlayersInRoom = useCallback(async (updatedPlayers: ExtendedEmbeddedPlayer[]) => {
    if (!room) return { error: new Error("No room provided") }

    const { error } = await supabase
      .from("game_rooms")
      .update({ 
        players: updatedPlayers,
        updated_at: new Date().toISOString() // Update timestamp sesuai schema
      }) // Update JSONB players
      .eq("id", room.id)
      .select()
      .single()

    return { error, data: updatedPlayers }
  }, [room])

  // Helper: Find and update specific player di array
  const updateCurrentPlayer = useCallback((updates: Partial<ExtendedEmbeddedPlayer>): ExtendedEmbeddedPlayer | null => {
    if (!currentPlayer) return null

    return {
      ...currentPlayer,
      ...updates,
      health: {
        ...currentPlayer.health,
        ...("health" in updates && typeof updates.health === "object" ? updates.health : {}),
      },
    }
  }, [currentPlayer])

  const submitAnswer = useCallback(
    async (answer: string, isCorrect: boolean, currentQuestionIndex: number) => {
      // Enhanced validation
      if (!currentPlayer?.player_id || !room?.id || isSubmitting) {
        console.log("submitAnswer: validation failed", {
          hasCurrentPlayer: !!currentPlayer?.player_id,
          hasRoom: !!room?.id,
          isSubmitting,
        })
        return false
      }

      try {
        setIsSubmitting(true)
        console.log(`🎯 Submitting answer: "${answer}", correct: ${isCorrect}`)

        // 1. Update player answers array (push ke EmbeddedPlayer.answers)
        const updatedPlayer = updateCurrentPlayer({
          answers: [...(currentPlayer.answers || []), {
            question_index: currentQuestionIndex,
            answer,
            is_correct: isCorrect,
            timestamp: new Date().toISOString(),
          }],
        })

        if (!updatedPlayer) return false

        let updates: Partial<ExtendedEmbeddedPlayer> = { answers: updatedPlayer.answers }

        if (isCorrect) {
          updates = {
            ...updates,
            correct_answers: (currentPlayer.correct_answers || 0) + 1,
            score: (currentPlayer.score || 0) + 10,
          }
          console.log("🎉 Correct answer - updating stats:", updates)
        } else {
          updates = {
            ...updates,
            wrong_answers: (currentPlayer.wrong_answers || 0) + 1, // Asumsi tambah field ini di type
          }
          console.log("💀 Wrong answer - updating stats:", updates)

          // Update local state for wrong answers
          if (isMountedRef.current) {
            setWrongAnswers((prev) => prev + 1)
          }

          // 2. Handle health system for wrong answers (update player.health.current)
          const currentHealth = currentPlayer.health.current ?? 3 // Handle undefined dengan default
          const newHealth = Math.max(0, currentHealth - 1)
          console.log(`🩺 Updating health: ${currentHealth} -> ${newHealth}`)

          updates = {
            ...updates,
            health: {
              ...currentPlayer.health,
              current: newHealth,
            
            },
          }

          // Update player alive status if health reaches 0
          if (newHealth <= 0) {
            console.log("💀 Player eliminated - updating alive status")
            updates = { ...updates, is_alive: false }
          }

          // 3. Create attack event (push ke player.attacks JSONB)
          const newAttack = {
            id: crypto.randomUUID(), // Generate UUID client-side
            attacker_player_id: "system", // Atau host_id
            target_player_id: currentPlayer.player_id,
            damage: 1,
            attack_type: "wrong_answer",
            attack_data: {
              question_index: currentQuestionIndex,
              player_nickname: currentPlayer.nickname,
              answer_given: answer,
            },
            created_at: new Date().toISOString(),
          }

          updates = {
            ...updates,
            attacks: [...(currentPlayer.attacks || []), newAttack],
          }

          console.log("✅ Attack event added to player data")
        }

        // 4. Apply updates to player
        const finalUpdatedPlayer = updateCurrentPlayer(updates)
        if (!finalUpdatedPlayer) return false

        const updatedPlayers = players.map(p => p.player_id === currentPlayer.player_id ? finalUpdatedPlayer : p)

        const { error: playerError } = await updatePlayersInRoom(updatedPlayers)

        if (playerError) {
          console.error("❌ Error updating player stats:", playerError)
          // Don't return false, answer was "submitted" via local update
        } else {
          console.log("✅ Player stats updated successfully")
        }

        console.log("🎯 Answer submission completed successfully")
        return true
      } catch (error) {
        console.error("❌ Critical error in submitAnswer:", error)
        return false
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false)
        }
      }
    },
    [currentPlayer, room, isSubmitting, players, updateCurrentPlayer, updatePlayersInRoom],
  )

  const nextQuestion = useCallback(
    async (currentIndex: number) => {
      if (!room?.id || isSubmitting) {
        console.log("nextQuestion: validation failed", {
          hasRoom: !!room?.id,
          isSubmitting,
        })
        return false
      }

      try {
        setIsSubmitting(true)
        console.log(`📝 Moving to next question: ${currentIndex} -> ${currentIndex + 1}`)

        // Update countdown_start untuk reset timer (sesuai schema)
        const newCountdownStart = new Date().toISOString()

        const { error } = await supabase
          .from("game_rooms")
          .update({ 
            countdown_start: newCountdownStart,
            updated_at: new Date().toISOString()
          })
          .eq("id", room.id)

        if (error) {
          console.error("❌ Error updating question:", error)
          return false
        }

        console.log("✅ Question updated successfully")
        return true
      } catch (error) {
        console.error("❌ Error in nextQuestion:", error)
        return false
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false)
        }
      }
    },
    [room, isSubmitting],
  )

  const startGame = useCallback(async () => {
    if (!room?.id || !currentPlayer?.is_host || isSubmitting) {
      return false
    }

    try {
      setIsSubmitting(true)

      // Update room status (sesuai schema: status, game_start_time)
      const { error: roomError } = await supabase
        .from("game_rooms")
        .update({
          status: "playing",
          game_start_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id)

      if (roomError) {
        console.error("Error starting game:", roomError)
        return false
      }

      console.log("✅ Game started successfully")
      return true
    } catch (error) {
      console.error("Error in startGame:", error)
      return false
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }, [room, currentPlayer, isSubmitting])

  const restartGame = useCallback(async () => {
    if (!room?.id || isSubmitting) {
      return false
    }

    try {
      setIsSubmitting(true)

      // Reset local state first
      if (isMountedRef.current) {
        setIsGameOver(false)
        setShowCaptureAnimation(false)
        setWrongAnswers(0)
      }

      // Reset room (sesuai schema: status, game_start_time)
      const { error: roomError } = await supabase
        .from("game_rooms")
        .update({
          status: "waiting",
          game_start_time: null,
          countdown_start: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id)

      if (roomError) {
        console.error("Error restarting room:", roomError)
        return false
      }

      // Reset all players (loop dan update fields)
      const resetPlayers = players.map(p => ({
        ...p,
        score: 0,
        correct_answers: 0,
        wrong_answers: 0, // Asumsi field ini ada
        is_alive: true,
        health: { 
          ...p.health, 
          current: p.health.max || 3, 
          is_being_attacked: false,
          last_attack_time: new Date().toISOString(),
          last_answer_time: new Date().toISOString(),
        },
        answers: [],
        attacks: [],
      }))

      const { error: playersError } = await updatePlayersInRoom(resetPlayers)

      if (playersError) {
        console.error("Error resetting players:", playersError)
        return false
      }

      console.log("✅ Game restarted successfully")
      return true
    } catch (error) {
      console.error("Error in restartGame:", error)
      return false
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }, [room, isSubmitting, players, updatePlayersInRoom])

  const leaveGame = useCallback(async () => {
    if (!currentPlayer?.player_id || !room?.id || isSubmitting) {
      return false
    }

    try {
      setIsSubmitting(true)

      // Hapus player dari array players JSONB
      const updatedPlayers = players.filter(p => p.player_id !== currentPlayer.player_id)

      const { error } = await updatePlayersInRoom(updatedPlayers)

      if (error) {
        console.error("Error leaving game:", error)
        return false
      }

      // Optional: Log completion jika game ongoing (sesuai schema game_completions)
      if (room.status === "playing") {
        const survivalDurationSeconds = Math.floor(Date.now() / 1000) - (new Date(room.created_at).getTime() / 1000)
        const { error: completionError } = await supabase
          .from("game_completions")
          .insert({
            player_id: currentPlayer.player_id,
            room_id: room.id,
            final_health: currentPlayer.health.current ?? 0,
            correct_answers: currentPlayer.correct_answers || 0,
            total_questions_answered: (currentPlayer.answers || []).length,
            is_eliminated: !currentPlayer.is_alive,
            completion_type: "partial",
            survival_duration: survivalDurationSeconds,
          })

        if (completionError) {
          console.error("Error logging completion:", completionError)
        }
      }

      console.log("✅ Left game successfully")
      return true
    } catch (error) {
      console.error("Error in leaveGame:", error)
      return false
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }, [currentPlayer, room, isSubmitting, players, updatePlayersInRoom])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    isGameOver,
    setIsGameOver,
    showCaptureAnimation,
    setShowCaptureAnimation,
    wrongAnswers,
    setWrongAnswers,
    isSubmitting,
    submitAnswer,
    nextQuestion,
    startGame,
    restartGame,
    leaveGame,
  }
}