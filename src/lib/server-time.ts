// Cache untuk offset waktu (sekarang estimasi client-only)
let timeOffset: number | null = null
let lastSyncTime = 0
const SYNC_INTERVAL = 30000 // Re-sync estimasi setiap 30 detik

// Mendapatkan waktu "server" estimasi (tanpa RPC, pakai client time + latency estimasi)
export async function getServerTime(): Promise<number> {
  try {
    const startTime = performance.now() // Gunakan high-res timer untuk estimasi latency internal

    // Simulasi "server time" dengan delay kecil untuk estimasi (bukan query real)
    await new Promise(resolve => setTimeout(resolve, 10)) // Delay 10ms untuk simulasi network

    const endTime = performance.now()
    const internalLatency = (endTime - startTime) / 2 // Estimasi half-latency

    const clientTime = Date.now()
    return clientTime + internalLatency // Return client time + estimasi
  } catch (error) {
    console.error("❌ Error estimating time:", error)
    return Date.now() // Fallback ke client time
  }
}

// Sinkronisasi waktu (sekarang estimasi client-only)
export async function syncServerTime(): Promise<void> {
  const now = Date.now()

  // Skip jika baru saja sync
  if (timeOffset !== null && now - lastSyncTime < SYNC_INTERVAL) {
    return
  }

  try {
    const estimatedServerTime = await getServerTime()
    const clientTime = Date.now()

    timeOffset = estimatedServerTime - clientTime
    lastSyncTime = now

    console.log("⏰ Client time estimated. Offset:", timeOffset, "ms")
  } catch (error) {
    console.error("❌ Failed to estimate time:", error)
  }
}

// Mendapatkan waktu yang sudah "disinkronisasi" (client-based)
export function getSyncedServerTime(): number {
  if (timeOffset === null) {
    return Date.now()
  }
  return Date.now() + timeOffset
}

// Menghitung countdown akurat menggunakan estimasi waktu
export function calculateCountdown(countdownStartTime: string | number | null, durationMs = 10000): number {
  if (countdownStartTime === null) {
    return 0
  }

  const startTime = typeof countdownStartTime === "string" ? new Date(countdownStartTime).getTime() : countdownStartTime
  const currentTime = getSyncedServerTime()
  const elapsed = currentTime - startTime
  const remaining = Math.max(0, durationMs - elapsed)

  return Math.ceil(remaining / 1000)
}