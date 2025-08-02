"use client"

import { useEffect, useRef } from "react"

export default function CosmicPlinko() {
  const gameInitialized = useRef(false)

  useEffect(() => {
    if (gameInitialized.current) return
    gameInitialized.current = true

    // Game State
    const gameState = {
      balance: 100,
      betAmount: 1,
      ballCount: 1,
      lastWin: 0,
      audioInitialized: false,
      videoLoaded: false,
      gameStarted: false,
      balls: [],
      pegs: [],
      pegsByRow: {}, // NEW: Store pegs grouped by row for easier line generation
      particles: [],
      recentHits: [],
      lastDropTime: 0,
      multiplierLines: [], // NEW: Active multiplier lines for the current drop
      lineAnimationTime: 0, // NEW: For animating the multiplier lines
      freeDrops: 0, // NEW: Track free drops
      currentMultipliersLayout: [], // NEW: Store the randomized multiplier layout for the current drop
      isAutoDropping: false, // NEW: Flag to indicate if free drops are being automatically dropped
      isPausedForModal: false, // NEW: Flag to pause game when modal is active
      awardedFreeDropsCurrentSpin: 0, // NEW: Accumulate free drops from a single drop sequence
      totalWinDuringFreeDrops: 0, // NEW: Accumulate wins during a free drop session
      totalMultiplierDuringFreeDrops: 0, // NEW: Accumulate multipliers during a free drop session
      isTurboMode: false, // NEW: Flag for turbo spin mode
      freeDropsSessionActive: false, // NEW: Flag to indicate if a free drop session is ongoing
      freeDropsPlayedCount: 0, // NEW: Track total free drops played in a session
    }

    // Constants - UPDATED: Added $10 bet option
    const BET_AMOUNTS = [0.5, 1, 2, 3, 4, 5, 10]
    // UPDATED: Multipliers array with 1000x on both sides, symmetrical around 0.5x
    const BASE_MULTIPLIERS = [1000, 100, 50, 10, 5, 2, 1, 0.5, 1, 2, 5, 10, 50, 100, 1000] // Renamed to BASE_MULTIPLIERS
    const CANVAS_WIDTH = 600 // Increased from 520
    const CANVAS_HEIGHT = 500 // Increased from 450

    // Audio system
    let audioContext = null
    let audioBuffers = {
      sound1: null,
      sound2: null,
      sound3: null,
      ballDrop: null,
      spaceSong: null,
      buttonChange: null,
      multi: null, // Multiplier hit sound
      freeDrops: null, // NEW: Free drops sound
    }

    // Background music source node for looping
    let backgroundMusicSource = null
    let backgroundMusicGain = null

    // Canvas and video references
    const canvas = document.getElementById("game-canvas")
    const ctx = canvas?.getContext("2d")
    const video = document.getElementById("cosmic-video")

    // UI Update Timer - separate from game physics
    let uiUpdateInterval

    // Check if mobile
    function isMobile() {
      return window.innerWidth <= 1024
    }

    // Start game function - handles Chrome autoplay restrictions
    async function startGame() {
      console.log("🚀 Starting Cosmic Plinko...")

      try {
        // Hide start overlay
        const startOverlay = document.getElementById("start-overlay")
        if (startOverlay) startOverlay.style.display = "none"

        const loadingIndicator = document.getElementById("loading-indicator")
        if (loadingIndicator) loadingIndicator.style.display = "block"

        // Initialize audio context FIRST (must be done on user interaction)
        await initializeAudio()

        // Start video with audio
        await startVideo()

        // Start background music
        startBackgroundMusic()

        // Initialize game
        gameState.gameStarted = true
        initializePegs()
        // generateCurrentMultipliersLayout(); // REMOVED: Free drops should not appear on initial load
        initializeUI() // This will now render BASE_MULTIPLIERS initially
        setupEventListeners() // This now sets up listeners for game controls
        startAnimationLoop()
        startUIUpdateLoop()

        if (loadingIndicator) loadingIndicator.style.display = "none"
        console.log("✅ Game started successfully")
      } catch (error) {
        console.error("❌ Failed to start game:", error)
        alert("Failed to start game. Please refresh and try again.")
      }
    }

    // Initialize audio system - MUST be called on user gesture
    async function initializeAudio() {
      console.log("🔊 Initializing audio system...")

      try {
        // Create audio context (must be done on user gesture)
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) {
          throw new Error("Web Audio API not supported")
        }
        audioContext = new AudioContextClass()

        // Resume audio context (required by Chrome)
        if (audioContext.state === "suspended") {
          await audioContext.resume()
        }

        console.log("🎵 Audio context state:", audioContext.state)

        // Load all audio files
        const loadAudio = async (url, name) => {
          try {
            console.log(`📥 Loading ${name} from ${url}`)
            const response = await fetch(url, {
              method: "GET",
              headers: {
                Accept: "audio/*",
              },
            })

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const arrayBuffer = await response.arrayBuffer()
            console.log(`🔄 Decoding ${name}...`)
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
            console.log(`✅ ${name} loaded successfully`)
            return audioBuffer
          } catch (error) {
            console.error(`❌ Failed to load ${name}:`, error)
            return null
          }
        }

        // Load all sounds in parallel
        console.log("📦 Loading all audio files...")
        const [sound1, sound2, sound3, ballDrop, spaceSong, buttonChange, multi, freeDrops] = await Promise.all([
          loadAudio(
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-2blBIg4gAwWnvcOcAfJ18csMkgrmpR.mp3",
            "Sound 1",
          ),
          loadAudio(
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-DRu5ntJp8KOAyep8t2NrS0u4K8m0uz.mp3",
            "Sound 2",
          ),
          loadAudio(
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-Xl9zw4BwCvupErIVwySJUpAGUw7Ia1.mp3",
            "Sound 3",
          ),
          loadAudio(
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/balldrop-hCisqCs6oFv8HlHGRhoc1rKeFevo0M.mp3",
            "Ball Drop",
          ),
          loadAudio(
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/space%20-rvNZSIyJXLKZtJ6lczTy1NjfJHRzuH.mp3",
            "Space Song",
          ),
          loadAudio(
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/buttonchange-zhwkWSbkfOGp9jJXv7jjNtm1wlKYBK.mp3",
            "Button Change",
          ),
          loadAudio(
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/multi-Vx6Sza2V4G6OjyVV8iifmGIT0l93DL.mp3",
            "Multiplier Hit",
          ),
          loadAudio(
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/free%20drops-HEzfYeyhOq8rmTfzRzkOka48CW4AzI.mp3",
            "Free Drops",
          ), // NEW: Load free drops audio
        ])

        audioBuffers = { sound1, sound2, sound3, ballDrop, spaceSong, buttonChange, multi, freeDrops } // NEW: Add freeDrops to audioBuffers
        gameState.audioInitialized = true

        console.log("🎉 Audio system fully initialized")
      } catch (error) {
        console.error("❌ Audio initialization failed:", error)
        throw error
      }
    }

    // Start background music loop
    function startBackgroundMusic() {
      if (!gameState.audioInitialized || !audioContext || !audioBuffers.spaceSong) {
        console.warn("⚠️ Background music not ready")
        return
      }

      try {
        // Stop existing background music if playing
        if (backgroundMusicSource) {
          backgroundMusicSource.stop()
        }

        // Create new source and gain nodes
        backgroundMusicSource = audioContext.createBufferSource()
        backgroundMusicGain = audioContext.createGain()

        // Set up the audio chain
        backgroundMusicSource.buffer = audioBuffers.spaceSong
        backgroundMusicSource.connect(backgroundMusicGain)
        backgroundMusicGain.connect(audioContext.destination)

        // Set volume (lower for background music)
        backgroundMusicGain.gain.setValueAtTime(0.3, audioContext.currentTime)

        // Enable looping
        backgroundMusicSource.loop = true

        // Handle when the source ends (shouldn't happen with loop=true, but just in case)
        backgroundMusicSource.onended = () => {
          console.log("🎵 Background music ended, restarting...")
          setTimeout(startBackgroundMusic, 100) // Restart after brief delay
        }

        // Start playing
        backgroundMusicSource.start(audioContext.currentTime)

        console.log("🎵 Background space music started")
      } catch (error) {
        console.error("❌ Error starting background music:", error)
      }
    }

    // Play button change sound
    function playButtonChangeSound() {
      if (!gameState.audioInitialized || !audioContext || !audioBuffers.buttonChange) {
        console.warn("⚠️ Button change audio not ready")
        return
      }

      try {
        const source = audioContext.createBufferSource()
        const gainNode = audioContext.createGain()
        source.buffer = audioBuffers.buttonChange
        source.connect(gainNode)
        gainNode.connect(audioContext.destination)
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime) // Reduced from 0.6
        source.start(audioContext.currentTime)
        console.log("🔘 Button change sound played")
      } catch (error) {
        console.error("❌ Error playing button change sound:", error)
      }
    }

    // NEW: Play free drops sound
    function playFreeDropsSound() {
      if (!gameState.audioInitialized || !audioContext || !audioBuffers.freeDrops) {
        console.warn("⚠️ Free drops audio not ready")
        return
      }
      try {
        const source = audioContext.createBufferSource()
        const gainNode = audioContext.createGain()
        source.buffer = audioBuffers.freeDrops
        source.connect(gainNode)
        gainNode.connect(audioContext.destination)
        gainNode.gain.setValueAtTime(0.6, audioContext.currentTime) // Adjust volume as needed
        source.start(audioContext.currentTime)
        console.log("🎉 Free drops sound played")
      } catch (error) {
        console.error("❌ Error playing free drops sound:", error)
      }
    }

    // Start video with audio
    async function startVideo() {
      console.log("📹 Starting video...")
      try {
        if (video) {
          video.style.display = "block"
          video.muted = false // Enable audio
          video.volume = 0.08 // Set volume to 8% (reduced from 15%)
          video.currentTime = 0

          // Force play (user interaction allows this)
          await video.play()
          gameState.videoLoaded = true
          console.log("✅ Video playing with audio")

          // Setup video event listeners
          video.addEventListener("ended", () => {
            console.log("🔄 Video ended, restarting...")
            video.currentTime = 0
            video.play().catch(console.error)
          })
        }
      } catch (error) {
        console.error("❌ Video failed to start:", error)
        // Fallback: try muted
        try {
          if (video) {
            video.muted = true
            await video.play()
            console.log("📹 Video playing muted (fallback)")
          }
        } catch (mutedError) {
          console.error("❌ Even muted video failed:", mutedError)
        }
      }
    }

    // Initialize pegs in perfect formation - Updated for larger board
    function initializePegs() {
      gameState.pegs = []
      gameState.pegsByRow = {} // Reset pegs by row
      const rows = 13 // Increased for larger board
      const pegSpacing = 42 // Increased spacing for larger board
      const boardWidth = CANVAS_WIDTH
      const startY = 100

      for (let row = 0; row < rows; row++) {
        const pegsInRow = row + 4
        const totalWidth = (pegsInRow - 1) * pegSpacing
        const startX = (boardWidth - totalWidth) / 2

        gameState.pegsByRow[row] = [] // Initialize array for this row

        for (let col = 0; col < pegsInRow; col++) {
          // Add slight random offset to each peg for more chaos
          const randomOffsetX = (Math.random() - 0.5) * 4
          const randomOffsetY = (Math.random() - 0.5) * 3

          const newPeg = {
            x: startX + col * pegSpacing + randomOffsetX,
            y: startY + row * 30 + randomOffsetY, // Increased vertical spacing
            hit: false,
            hitTime: 0,
            row: row, // Store row index with peg
            boostedHit: false, // NEW: Flag if hit by a boosted ball
            boostedHitTime: 0, // NEW: Time for boosted hit glow
          }
          gameState.pegs.push(newPeg)
          gameState.pegsByRow[row].push(newPeg) // Add to pegsByRow
        }
      }
    }

    // Initialize UI elements
    function initializeUI() {
      // Generate bet controls
      const betControls = document.getElementById("bet-controls")
      if (betControls) {
        betControls.innerHTML = ""

        BET_AMOUNTS.forEach((amount) => {
          const button = document.createElement("button")
          button.className = `bet-button px-4 py-2 text-sm rounded-lg transition-all ${
            gameState.betAmount === amount ? "active" : ""
          }`
          button.textContent = `$${amount.toFixed(2)}`
          button.onclick = () => setBetAmount(amount)
          betControls.appendChild(button)
        })
      }

      // Generate multipliers - UPDATED: Better gradient colors and gold text
      const multipliersDiv = document.getElementById("multipliers")
      if (multipliersDiv) {
        multipliersDiv.innerHTML = ""

        // UPDATED: Color mapping for each multiplier value - Better gradient progression
        const getMultiplierColor = (multiplier) => {
          switch (multiplier) {
            case 1000:
              return "rgba(88, 28, 135, 0.9)" // Dark purple (highest)
            case 100:
              return "rgba(124, 58, 237, 0.9)" // Medium purple
            case 50:
              return "rgba(139, 92, 246, 0.9)" // Light purple
            case 10:
              return "rgba(168, 85, 247, 0.9)" // Lighter purple
            case 5:
              return "rgba(196, 181, 253, 0.9)" // Very light purple
            case 2:
              return "rgba(180, 170, 240, 0.9)" // UPDATED: More muted purple for 2x
            case 1:
              return "rgba(180, 180, 200, 0.9)" // Muted light purple/grey for 1x
            case 0.5:
              return "rgba(107, 114, 128, 0.9)" // Grey (lowest)
            default:
              return "rgba(59, 130, 246, 0.9)" // Fallback light blue
          }
        }

        // Use gameState.currentMultipliersLayout for rendering
        // If currentMultipliersLayout is empty (initial load or reset), use BASE_MULTIPLIERS
        const multipliersToRender =
          gameState.currentMultipliersLayout.length > 0 ? gameState.currentMultipliersLayout : BASE_MULTIPLIERS

        multipliersToRender.forEach((item) => {
          const div = document.createElement("div")
          div.className =
            "multiplier-slot flex-1 flex items-center justify-content-center font-bold border-r-2 border-purple-500 last:border-r-0"

          if (typeof item === "object" && item.type === "FREE_DROPS") {
            // Check if it's the FREE_DROPS object
            div.classList.add("free-drops-slot")
            div.innerHTML = `FREE DROPS<br>${item.value}` // Display "FREE DROPS" and the number
          } else {
            // It's a regular multiplier number
            div.style.background = getMultiplierColor(item)
            div.style.border = "2px solid rgb(147, 51, 234)" // Solid purple border
            div.style.color = "#ffd700" // Gold text color
            div.textContent = `${item}x`
          }
          multipliersDiv.appendChild(div)
        })
      }

      // Update total bet display
      updateTotalBetDisplay()
    }

    // Update total bet display
    function updateTotalBetDisplay() {
      const totalBet = gameState.betAmount * gameState.ballCount
      const ballText = gameState.ballCount === 1 ? "ball" : "balls"
      const totalBetDisplay = document.getElementById("total-bet-display")
      if (totalBetDisplay) {
        totalBetDisplay.textContent = `$${gameState.betAmount.toFixed(2)} × ${gameState.ballCount} ${ballText} = $${totalBet.toFixed(2)}`
      }
    }

    // Play ball drop sound
    function playBallDropSound() {
      if (!gameState.audioInitialized || !audioContext || !audioBuffers.ballDrop) {
        console.warn("⚠️ Ball drop audio not ready")
        return
      }

      try {
        const source = audioContext.createBufferSource()
        const gainNode = audioContext.createGain()
        source.buffer = audioBuffers.ballDrop
        source.connect(gainNode)
        gainNode.connect(audioContext.destination)
        gainNode.gain.setValueAtTime(0.7, audioContext.currentTime)
        source.start(audioContext.currentTime)
        console.log("🎾 Ball drop sound played")
      } catch (error) {
        console.error("❌ Error playing ball drop sound:", error)
      }
    }

    // Play win sound
    function playWinSound(multiplier) {
      if (!gameState.audioInitialized || !audioContext) {
        console.warn("⚠️ Audio not initialized")
        return
      }

      try {
        let buffer = null
        let soundType = ""

        if (multiplier === 0.5 || multiplier === 1 || multiplier === 2) {
          buffer = audioBuffers.sound1
          soundType = "Sound 1 (0.5x, 1x, 2x)"
        } else if (multiplier === 5 || multiplier === 10) {
          buffer = audioBuffers.sound2
          soundType = "Sound 2 (5x, 10x)"
        } else if (multiplier === 50 || multiplier === 100 || multiplier === 1000) {
          buffer = audioBuffers.sound3
          soundType = "Sound 3 (50x, 100x, 1000x)"
        }

        if (!buffer) {
          console.log(`🔇 No sound assigned for multiplier: ${multiplier}x`)
          return
        }

        const source = audioContext.createBufferSource()
        const gainNode = audioContext.createGain()
        source.buffer = buffer
        source.connect(gainNode)
        gainNode.connect(audioContext.destination)

        // Set volume based on multiplier
        if (multiplier === 100 || multiplier === 1000) {
          gainNode.gain.setValueAtTime(0.9, audioContext.currentTime)
        } else if (multiplier === 10 || multiplier === 50) {
          gainNode.gain.setValueAtTime(0.8, audioContext.currentTime)
        } else {
          gainNode.gain.setValueAtTime(0.7, audioContext.currentTime)
        }

        source.start(audioContext.currentTime)
        console.log(`🎵 ${soundType} played for ${multiplier}x win`)
      } catch (error) {
        console.error("❌ Error playing win sound:", error)
      }
    }

    // Create particles
    function createParticles(x, y, color, count = 6) {
      // Added 'count' parameter with default
      for (let i = 0; i < count; i++) {
        // Loop 'count' times
        gameState.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          life: 40,
          maxLife: 40,
          color,
        })
      }
    }

    // Helper function for distance from point to line segment (squared)
    function distToSegmentSquared(p, v, w) {
      const l2 = (w.x - v.x) * (w.x - v.x) + (w.y - v.y) * (w.y - v.y)
      if (l2 === 0) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y)
      let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
      t = Math.max(0, Math.min(1, t))
      const projectionX = v.x + t * (w.x - v.x)
      const projectionY = v.y + t * (w.y - v.y)
      return (p.x - projectionX) * (p.x - projectionX) + (p.y - projectionY) * (p.y - projectionY)
    }

    // NEW: Generate the current layout of multipliers including the FREE DROPS slot
    function generateCurrentMultipliersLayout() {
      const tempMultipliers = [...BASE_MULTIPLIERS]

      // Only add a FREE_DROPS slot if there are no active free drops
      if (gameState.freeDrops === 0) {
        const freeDropsIndex = Math.floor(Math.random() * (tempMultipliers.length + 1)) // +1 to allow insertion at the end
        tempMultipliers.splice(freeDropsIndex, 0, { type: "FREE_DROPS", value: getRandomFreeDrops() }) // Store as object with value
        console.log("🎁 Free Drops slot placed at index:", freeDropsIndex)
      } else {
        console.log("🚫 Free Drops active, not adding new FREE DROPS slot to layout.")
      }

      gameState.currentMultipliersLayout = tempMultipliers
    }

    // UPDATED: Generate multiplier lines with specific probabilities
    function generateMultiplierLines() {
      gameState.multiplierLines = [] // Clear previous lines
      const targetRows = [3, 6, 9, 12] // Rows to consider (0-indexed)
      let numLinesToSpawn = 0
      const rand = Math.random()

      // Determine number of lines based on new probabilities
      if (rand < 0.16) {
        // 16% chance for 0 lines
        numLinesToSpawn = 0
      } else if (rand < 0.16 + 0.5) {
        // 50% chance for 1 line (0.16 to 0.66)
        numLinesToSpawn = 1
      } else if (rand < 0.16 + 0.5 + 0.25) {
        // 25% chance for 2 lines (0.66 to 0.91)
        numLinesToSpawn = 2
      } else if (rand < 0.16 + 0.5 + 0.25 + 0.08) {
        // 8% chance for 3 lines (0.91 to 0.99)
        numLinesToSpawn = 3
      } else {
        // 1% chance for 4 lines (0.99 to 1.0)
        numLinesToSpawn = 4
      }

      if (numLinesToSpawn > 0) {
        const availableRows = [...targetRows]
        // Shuffle availableRows to pick unique rows randomly
        for (let i = availableRows.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[availableRows[i], availableRows[j]] = [availableRows[j], availableRows[i]]
        }

        const selectedRows = availableRows.slice(0, numLinesToSpawn)

        selectedRows.forEach((rowIndex) => {
          const pegsInThisRow = gameState.pegsByRow[rowIndex]
          if (pegsInThisRow && pegsInThisRow.length >= 2) {
            // Pick two adjacent pegs randomly
            const startIndex = Math.floor(Math.random() * (pegsInThisRow.length - 1))
            const peg1 = pegsInThisRow[startIndex]
            const peg2 = pegsInThisRow[startIndex + 1]

            // Assign a specific random multiplier (2x, 3x, 4x, or 5x)
            const possibleLineMultipliers = [2, 3, 4, 5]
            const assignedMultiplier =
              possibleLineMultipliers[Math.floor(Math.random() * possibleLineMultipliers.length)]

            gameState.multiplierLines.push({
              id: `line-${rowIndex}-${startIndex}`,
              peg1: { x: peg1.x, y: peg1.y },
              peg2: { x: peg2.x, y: peg2.y },
              row: rowIndex,
              active: true,
              multiplier: assignedMultiplier, // Store the assigned multiplier
              hitByBalls: new Set(), // Track which balls hit this line
            })
            console.log(
              `✨ Multiplier line spawned on row ${rowIndex} with ${assignedMultiplier}x (Total lines: ${numLinesToSpawn})`,
            )
          }
        })
      } else {
        console.log("No multiplier lines spawned this drop.")
      }
    }

    // Check if can drop ball - Updated for multiple balls and free drops, and auto-dropping
    function canDropBall() {
      const currentTime = Date.now()
      const timeUntilNextDrop = Math.max(0, 300 - (currentTime - gameState.lastDropTime))
      const hasActiveBalls = gameState.balls.some((ball) => ball.active)
      const totalBet = gameState.betAmount * gameState.ballCount

      // If there are active balls or still on cooldown, prevent drop.
      // This applies to both manual and auto-drops, ensuring one ball at a time.
      if (hasActiveBalls || timeUntilNextDrop > 0) {
        return false
      }

      // If it's a manual drop AND we don't have free drops AND balance is insufficient, prevent drop.
      if (gameState.freeDrops === 0 && gameState.balance < totalBet) {
        return false
      }

      return true
    }

    // Drop ball function - UPDATED: Drop multiple balls and handle free drops
    async function dropBall(isFreeDropTrigger = false) {
      // Added isFreeDropTrigger parameter
      if (!gameState.gameStarted || gameState.isPausedForModal) return // Prevent drops if game not started or paused

      // Perform the comprehensive canDropBall check
      if (!canDropBall()) {
        return
      }

      // NEW: Reset awardedFreeDropsCurrentSpin only for new manual drops
      if (!isFreeDropTrigger) {
        gameState.awardedFreeDropsCurrentSpin = 0
      }

      // --- Board layout generation logic ---
      // This should happen for every *new* drop sequence, whether manual or auto.
      // The board should reflect the *current* free drop state.
      // If free drops are active, the free drop slot should disappear.
      // If free drops are 0, it should potentially appear.
      generateMultiplierLines() // Always generate new lines for each drop
      generateCurrentMultipliersLayout() // This function will now handle the conditional FREE_DROPS slot
      initializeUI() // Re-render multipliers based on the new layout

      // Update state
      gameState.lastDropTime = Date.now()

      // Determine cost: 0 for free drops, otherwise normal bet
      const totalBet = isFreeDropTrigger ? 0 : gameState.betAmount * gameState.ballCount

      if (!isFreeDropTrigger) {
        // Only deduct balance for manual drops
        gameState.balance -= totalBet
      }

      // Determine delay per ball (still based on user's ballCount for manual drops)
      const delayPerBall = gameState.ballCount > 2 ? 400 : 100

      // Crucial change: If it's a free drop trigger, always drop 1 ball. Otherwise, use gameState.ballCount.
      const ballsToDrop = isFreeDropTrigger ? 1 : gameState.ballCount

      for (let i = 0; i < ballsToDrop; i++) {
        setTimeout(() => {
          playBallDropSound() // MOVED: Play sound for EACH ball
          const newBall = {
            id: Date.now() + Math.random() + i,
            // UPDATED: Make balls drop closer to the middle
            x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 30 + (i - ballsToDrop / 2) * 5,
            y: 50 + i * 5, // Slight vertical offset
            // More random initial velocity
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 0.5,
            active: true,
            trail: [],
            chaosMultiplier: 0.8 + Math.random() * 0.4, // Wider range for more natural physics (0.8 to 1.2)
            currentMultiplier: 1, // FIXED: Initialize current multiplier to 1
            hasHitFirstMultiplierLine: false, // Flag to track first multiplier line hit
            hitLines: new Set(), // NEW: Track lines hit by this specific ball
            multiplierLineHits: 0, // NEW: Track number of multiplier lines hit
            isMultiplierBoosted: false, // NEW: Flag for ball having hit a multiplier line
            betAmount: gameState.betAmount, // NEW: Store the bet amount for this specific ball
          }

          gameState.balls.push(newBall)
          console.log(
            `🎾 Ball ${i + 1}/${ballsToDrop} dropped at x:${newBall.x.toFixed(1)}, chaos:${newBall.chaosMultiplier.toFixed(2)}`,
          )
        }, i * delayPerBall) // Use dynamic delay
      }
    }

    // NEW: Function to show a generic modal
    function showModal(modalId, title, message, onContinueCallback) {
      gameState.isPausedForModal = true
      const modalOverlay = document.getElementById(modalId)
      if (!modalOverlay) return

      const modalTitle = modalOverlay.querySelector(".modal-title")
      const modalMessage = modalOverlay.querySelector(".modal-message")
      const modalButton = modalOverlay.querySelector(".modal-button")

      if (modalTitle) modalTitle.textContent = title
      if (modalMessage) modalMessage.innerHTML = message

      if (modalButton) {
        // Remove any existing event listener to prevent duplicates
        if (modalButton._currentListener) {
          modalButton.removeEventListener("click", modalButton._currentListener)
        }

        const newListener = () => {
          playButtonChangeSound() // Play sound on click
          hideModal(modalId)
          if (onContinueCallback) {
            onContinueCallback()
          }
        }
        modalButton.addEventListener("click", newListener)
        modalButton._currentListener = newListener // Store reference to the current listener
      }

      modalOverlay.classList.add("active")
      console.log(`Modal "${modalId}" shown.`)
    }

    // NEW: Function to hide a generic modal
    function hideModal(modalId) {
      const modalOverlay = document.getElementById(modalId)
      if (modalOverlay) {
        modalOverlay.classList.remove("active")
      }
      gameState.isPausedForModal = false
      console.log(`Modal "${modalId}" hidden.`)
    }

    // NEW: Function to automatically drop free balls
    async function startAutoDrops() {
      // No parameter needed, it will consume gameState.freeDrops
      if (gameState.isAutoDropping) {
        // Prevent re-entry if already auto-dropping
        return
      }

      // If this is a new free drop session (not a re-trigger within an existing one)
      if (!gameState.freeDropsSessionActive) {
        gameState.lastWin = 0 // Reset lastWin display at the start of auto-drops
        gameState.totalWinDuringFreeDrops = 0
        gameState.totalMultiplierDuringFreeDrops = 0
        gameState.freeDropsPlayedCount = 0 // Reset count for a new session
        gameState.freeDropsSessionActive = true // Mark session as active
        console.log(`Starting NEW auto-drop sequence with ${gameState.freeDrops} free balls.`)
      } else {
        console.log(`Continuing auto-drop sequence. Remaining: ${gameState.freeDrops}`)
      }

      gameState.isAutoDropping = true

      while (gameState.freeDrops > 0) {
        // Wait for any currently active balls to finish before dropping the next one
        await new Promise((resolve) => {
          const checkBalls = setInterval(() => {
            if (!gameState.balls.some((ball) => ball.active) && !gameState.isPausedForModal) {
              clearInterval(checkBalls)
              resolve()
            }
          }, 50) // Check every 50ms
        })

        // If a modal is active, wait for it to be dismissed
        if (gameState.isPausedForModal) {
          await new Promise((resolve) => {
            const checkModal = setInterval(() => {
              if (!gameState.isPausedForModal) {
                clearInterval(checkModal)
                resolve()
              }
            }, 100)
          })
        }

        // Decrement free drops BEFORE dropping the ball
        gameState.freeDrops--
        gameState.freeDropsPlayedCount++ // Increment played count for each ball dropped
        console.log(
          `🎁 Consuming 1 free drop. Remaining: ${gameState.freeDrops}. Played: ${gameState.freeDropsPlayedCount}`,
        )

        // Drop one free ball
        await dropBall(true)

        // Add a small delay between drops
        await new Promise((resolve) => setTimeout(resolve, 500)) // 0.5 second delay between free drops
      }

      // After all free drops are consumed, wait for any remaining balls to settle
      await new Promise((resolve) => {
        const checkFinalBalls = setInterval(() => {
          if (!gameState.balls.some((ball) => ball.active) && !gameState.isPausedForModal) {
            clearInterval(checkFinalBalls)
            resolve()
          }
        }, 50)
      })

      gameState.isAutoDropping = false
      gameState.freeDropsSessionActive = false // End the session
      console.log("Auto-drop sequence finished.")
      updateUIElements() // Ensure UI is fully updated after auto-drops

      // Show free drops summary modal if there were any wins/multipliers
      gameState.lastWin = gameState.totalWinDuringFreeDrops // Set lastWin to total for summary display
      showModal(
        "free-drops-summary-modal",
        "FREE DROPS SUMMARY",
        `You won <span class="text-yellow-300 font-bold">$${gameState.totalWinDuringFreeDrops.toFixed(2)}</span> from <span class="text-green-300 font-bold">${gameState.freeDropsPlayedCount}</span> Free Drops for a total multiplier of <span class="text-yellow-300 font-bold">${gameState.totalMultiplierDuringFreeDrops.toFixed(2)}x</span>!`,
        () => {
          // Reset summary stats after modal is dismissed
          gameState.totalWinDuringFreeDrops = 0
          gameState.totalMultiplierDuringFreeDrops = 0
          gameState.freeDropsPlayedCount = 0 // Reset for next session
        },
      )
    }

    // Set bet amount - WITH BUTTON SOUND
    function setBetAmount(amount) {
      if (gameState.betAmount !== amount) {
        playButtonChangeSound()
        gameState.betAmount = amount
        initializeUI() // Refresh bet buttons and total display
      }
    }

    // Set ball count - WITH BUTTON SOUND
    function setBallCount(count) {
      if (gameState.ballCount !== count) {
        playButtonChangeSound()
        gameState.ballCount = count
        updateTotalBetDisplay()
      }
    }

    // NEW: Toggle Turbo Mode
    function toggleTurboMode() {
      playButtonChangeSound()
      gameState.isTurboMode = !gameState.isTurboMode
      updateUIElements() // Update button text
      console.log(`Turbo mode: ${gameState.isTurboMode ? "ON" : "OFF"}`)
    }

    // Reset game - WITH BUTTON SOUND
    function resetGame() {
      playButtonChangeSound()

      gameState.balance = 100
      gameState.betAmount = 1
      gameState.ballCount = 1
      gameState.lastWin = 0
      gameState.lastDropTime = 0
      gameState.balls = []
      gameState.particles = []
      gameState.recentHits = []
      gameState.multiplierLines = [] // NEW: Clear multiplier lines on reset
      gameState.lineAnimationTime = 0 // Reset line animation time
      gameState.freeDrops = 0 // NEW: Reset free drops
      gameState.currentMultipliersLayout = [] // NEW: Reset current multiplier layout
      gameState.isAutoDropping = false // NEW: Reset auto-dropping flag
      gameState.isPausedForModal = false // NEW: Reset modal pause flag
      gameState.awardedFreeDropsCurrentSpin = 0 // NEW: Reset awarded free drops for current spin
      gameState.totalWinDuringFreeDrops = 0 // NEW: Reset free drop session wins
      gameState.totalMultiplierDuringFreeDrops = 0 // NEW: Reset free drop session multipliers
      gameState.isTurboMode = false // NEW: Reset turbo mode
      gameState.freeDropsSessionActive = false // NEW: Reset session flag
      gameState.freeDropsPlayedCount = 0 // NEW: Reset played count

      // Reset pegs
      gameState.pegs.forEach((peg) => {
        peg.hit = false
        peg.hitTime = 0
        peg.boostedHit = false // Reset boosted hit state
        peg.boostedHitTime = 0
      })

      // Hide win cards on reset
      const winCard = document.getElementById("win-card")
      const mobileWinCard = document.getElementById("mobile-win-card")
      const freeDropsDisplay = document.getElementById("free-drops-display")

      if (winCard) winCard.classList.add("hidden")
      if (mobileWinCard) mobileWinCard.classList.add("hidden")
      if (freeDropsDisplay) freeDropsDisplay.classList.add("hidden") // NEW: Hide free drops display

      // Hide any active modals
      hideModal("free-drops-awarded-modal")
      hideModal("free-drops-summary-modal")

      // Reset ball count dropdown
      const ballCountSelect = document.getElementById("ball-count-select")
      if (ballCountSelect) ballCountSelect.value = "1"

      // Regenerate pegs with new random positions
      initializePegs()
      // generateCurrentMultipliersLayout(); // REMOVED: Free drops should not appear on reset
      initializeUI() // This will now render BASE_MULTIPLIERS after reset
    }

    // NEW: Function to update all UI elements
    function updateUIElements() {
      // Update balance display
      const balanceEl = document.getElementById("balance")
      const betAmountEl = document.getElementById("bet-amount")

      if (balanceEl) balanceEl.textContent = `$${gameState.balance.toFixed(2)}`
      if (betAmountEl) betAmountEl.textContent = `$${gameState.betAmount.toFixed(2)}`

      // Update win display - ONLY show/update when there's actually a win
      const winCard = document.getElementById("win-card")
      const mobileWinCard = document.getElementById("mobile-win-card")
      const lastWin = document.getElementById("last-win")
      const mobileLastWin = document.getElementById("mobile-last-win")

      if (gameState.isAutoDropping) {
        // Hide win cards during auto-dropping
        if (winCard) winCard.classList.add("hidden")
        if (mobileWinCard) mobileWinCard.classList.add("hidden")
      } else if (gameState.lastWin > 0) {
        // Only show/update when not auto-dropping and there's actually a win
        // Desktop win card
        if (lastWin) lastWin.textContent = `+$${gameState.lastWin.toFixed(2)}`
        if (winCard) winCard.classList.remove("hidden")

        // Mobile win card
        if (mobileLastWin) mobileLastWin.textContent = `+$${gameState.lastWin.toFixed(2)}`
        if (mobileWinCard) mobileWinCard.classList.remove("hidden")
      } else {
        // Ensure they are hidden if lastWin is 0 and not auto-dropping
        if (winCard) winCard.classList.add("hidden")
        if (mobileWinCard) mobileWinCard.classList.add("hidden")
      }

      // Update free drops display
      const freeDropsDisplay = document.getElementById("free-drops-display")
      if (freeDropsDisplay) {
        if (gameState.freeDrops > 0) {
          freeDropsDisplay.textContent = `FREE DROPS: ${gameState.freeDrops}`
          freeDropsDisplay.classList.remove("hidden")
        } else {
          freeDropsDisplay.classList.add("hidden")
        }
      }

      // Update drop button state using centralized check
      const dropBtn = document.getElementById("drop-ball-btn")
      if (dropBtn) {
        const hasActiveBalls = gameState.balls.some((ball) => ball.active)
        const totalBet = gameState.betAmount * gameState.ballCount

        // Disable button if auto-dropping or if canDropBall is false or if a modal is active
        dropBtn.disabled = gameState.isAutoDropping || !canDropBall() || gameState.isPausedForModal

        // Update button text based on state
        if (gameState.isPausedForModal) {
          dropBtn.textContent = "GAME PAUSED"
        } else if (gameState.isAutoDropping) {
          dropBtn.textContent = "AUTO DROPPING..."
        } else if (hasActiveBalls) {
          const activeBallCount = gameState.balls.filter((ball) => ball.active).length
          dropBtn.textContent = `${activeBallCount} BALL${activeBallCount > 1 ? "S" : ""} IN PLAY...`
        } else if (gameState.freeDrops > 0) {
          // Prioritize free drops text
          dropBtn.textContent = `DROP FREE BALL${gameState.freeDrops > 1 ? "S" : ""}`
        } else if (gameState.balance < totalBet) {
          dropBtn.textContent = "INSUFFICIENT BALANCE"
        } else {
          const ballText = gameState.ballCount === 1 ? "BALL" : "BALLS"
          dropBtn.textContent = `DROP ${gameState.ballCount} ${ballText}`
        }
      }

      // Show/hide insufficient balance warning
      const insufficientBalance = document.getElementById("insufficient-balance")
      if (insufficientBalance) {
        const totalBet = gameState.betAmount * gameState.ballCount
        if (
          gameState.balance < totalBet &&
          gameState.freeDrops === 0 &&
          !gameState.isAutoDropping &&
          !gameState.isPausedForModal
        ) {
          // Only show if no free drops and not auto-dropping
          insufficientBalance.classList.remove("hidden")
        } else {
          insufficientBalance.classList.add("hidden")
        }
      }

      // NEW: Update Turbo button text and styling
      const turboBtn = document.getElementById("turbo-btn")
      if (turboBtn) {
        if (gameState.isTurboMode) {
          turboBtn.textContent = ">>> TURBO"
          turboBtn.classList.add("turbo-active")
        } else {
          turboBtn.textContent = "> REGULAR"
          turboBtn.classList.remove("turbo-active")
        }
      }

      // Update recent hits
      updateRecentHits()
    }

    // Separate UI update loop - runs independently of game physics
    function startUIUpdateLoop() {
      uiUpdateInterval = setInterval(updateUIElements, 16) // Call the new function
    }

    // Update recent hits display
    function updateRecentHits() {
      const mobile = isMobile()

      if (mobile) {
        updateMobileRecentHits()
      } else {
        updateDesktopRecentHits()
      }
    }

    // Update desktop recent hits display
    function updateDesktopRecentHits() {
      const recentHitsDiv = document.getElementById("recent-hits")
      if (!recentHitsDiv) return

      if (gameState.recentHits.length === 0) {
        recentHitsDiv.innerHTML = '<div class="text-blue-300/50 text-xs text-center py-6">No hits yet</div>'
        return
      }

      recentHitsDiv.innerHTML = ""
      // Display up to 20 recent hits
      gameState.recentHits.slice(0, 20).forEach((hit, index) => {
        const div = document.createElement("div")
        div.className = `recent-hit p-2 rounded-lg text-sm transition-all duration-300 ${
          index === 0 ? "animate-pulse border-2 border-purple-400/60" : ""
        }`

        div.style.opacity = 1 - index * 0.05 // Slightly less aggressive fade for more items
        div.style.transform = `scale(${1 - index * 0.02})` // Slightly less aggressive scale

        // UPDATED: Display for Free Drops
        if (hit.isFreeDrop) {
          div.innerHTML = `
                  <div class="flex justify-between items-center">
                      <span class="font-bold text-green-300">FREE DROPS</span>
                      <span class="text-green-300 font-bold">${hit.winAmount} BALLS</span>
                  </div>
              `
        } else {
          div.innerHTML = `
                  <div class="flex justify-between items-center">
                      <span class="font-bold text-blue-200">${hit.multiplier}x</span>
                      <span class="text-yellow-300 font-bold">$${hit.winAmount.toFixed(2)}</span>
                  </div>
              `
        }

        recentHitsDiv.appendChild(div)
      })
    }

    // Update mobile recent hits display - HORIZONTAL with 20 items and fading effect
    function updateMobileRecentHits() {
      const mobileRecentHitsDiv = document.getElementById("mobile-recent-hits")
      if (!mobileRecentHitsDiv) return

      if (gameState.recentHits.length === 0) {
        mobileRecentHitsDiv.innerHTML =
          '<div class="text-blue-300/50 text-xs text-center py-4 w-full">No hits yet</div>'
        return
      }

      mobileRecentHitsDiv.innerHTML = ""
      mobileRecentHitsDiv.className = "mobile-recent-hits-horizontal" // Horizontal layout

      // Show up to 20 items like desktop, with same fading effect
      gameState.recentHits.slice(0, 20).forEach((hit, index) => {
        const div = document.createElement("div")
        div.className = `mobile-recent-hit-item recent-hit transition-all duration-300 ${
          index === 0 ? "animate-pulse border-2 border-purple-400/60" : ""
        }`

        // Apply same fade effect as desktop
        div.style.opacity = 1 - index * 0.05
        div.style.transform = `scale(${1 - index * 0.02})`

        // UPDATED: Display for Free Drops
        if (hit.isFreeDrop) {
          div.innerHTML = `
                  <div class="font-bold text-green-300 text-xs">FREE</div>
                  <div class="text-green-300 font-bold text-xs">${hit.winAmount} BALLS</div>
              `
        } else {
          div.innerHTML = `
                  <div class="font-bold text-blue-200 text-xs">${hit.multiplier}x</div>
                  <div class="text-yellow-300 font-bold text-xs">$${hit.winAmount.toFixed(2)}</div>
              `
        }

        mobileRecentHitsDiv.appendChild(div)
      })
    }

    // Setup event listeners
    function setupEventListeners() {
      // Drop ball button - FIXED: Handle clicks on button text properly
      const dropBallBtn = document.getElementById("drop-ball-btn")
      if (dropBallBtn) {
        dropBallBtn.addEventListener("click", (event) => {
          // Prevent any default behavior and stop propagation
          event.preventDefault()
          event.stopPropagation()

          // Only allow manual drop if not currently auto-dropping or paused by modal
          if (!gameState.isAutoDropping && !gameState.isPausedForModal) {
            dropBall(false) // Explicitly not a free drop trigger
          }
        })
      }

      // ADDITIONAL FIX: Add event listener to the button using event delegation
      document.addEventListener("click", (event) => {
        // Check if the clicked element is the drop ball button or any of its children
        const dropButton = document.getElementById("drop-ball-btn")
        if (dropButton && (event.target === dropButton || dropButton.contains(event.target))) {
          event.preventDefault()
          event.stopPropagation()

          // Only allow manual drop if not currently auto-dropping or paused by modal
          if (!gameState.isAutoDropping && !gameState.isPausedForModal) {
            dropBall(false) // Explicitly not a free drop trigger
          }
        }
      })

      // Reset button
      const resetBtn = document.getElementById("reset-btn")
      if (resetBtn) {
        resetBtn.addEventListener("click", resetGame)
      }

      // Ball count dropdown
      const ballCountSelect = document.getElementById("ball-count-select")
      if (ballCountSelect) {
        ballCountSelect.addEventListener("change", (event) => {
          setBallCount(Number.parseInt(event.target.value))
        })
      }

      // NEW: Turbo button
      const turboBtn = document.getElementById("turbo-btn")
      if (turboBtn) {
        turboBtn.addEventListener("click", toggleTurboMode)
      }

      // Keyboard controls
      document.addEventListener("keydown", (event) => {
        if (event.code === "Space" && gameState.gameStarted && canDropBall() && !gameState.isPausedForModal) {
          // Added canDropBall check and modal check
          event.preventDefault()
          dropBall(false) // Explicitly not a free drop trigger
        }
      })

      // Handle window resize for responsive updates
      window.addEventListener("resize", () => {
        updateRecentHits()
      })
    }

    // Function to get progressively brighter blue color based on hits
    function getBrightBlueColor(hits, opacity = 1) {
      const clampedHits = Math.min(hits, 4) // Max 4 stages of brightness

      // Base blue (original peg color): RGB(99, 102, 241)
      const r1 = 99
      const g1 = 102
      const b1 = 241
      // Target brightest blue (e.g., a light, almost cyan blue): RGB(150, 220, 255)
      const r2 = 150
      const g2 = 220
      const b2 = 255

      // Linear interpolation for each color component
      const r = r1 + (r2 - r1) * (clampedHits / 4)
      const g = g1 + (g2 - g1) * (clampedHits / 4)
      const b = b1 + (b2 - b1) * (clampedHits / 4)

      return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${opacity})`
    }

    // NEW: Function to get a random number of free drops with weighted probability
    function getRandomFreeDrops() {
      const rand = Math.random()
      if (rand < 0.5) {
        // 50% chance for 1 or 2
        return Math.random() < 0.5 ? 1 : 2 // 25% for 1, 25% for 2
      } else if (rand < 0.5 + 0.3) {
        // 30% chance for 3, 4, or 5
        return Math.floor(Math.random() * 3) + 3 // 3, 4, or 5
      } else if (rand < 0.5 + 0.15 + 0.3) {
        // 15% chance for 6 or 7
        return Math.random() < 0.5 ? 6 : 7 // 7.5% for 6, 7.5% for 7
      } else {
        // 5% chance for 8, 9, or 10
        return Math.floor(Math.random() * 3) + 8 // 8, 9, or 10
      }
    }

    // NEW: Function to get ball color and shadow based on multiplier hits
    function getBallVisuals(hits) {
      const clampedHits = Math.min(hits, 4) // Max 4 stages of color change

      let color
      let shadowColor

      if (clampedHits === 0) {
        // Default state, before hitting any multiplier lines
        color = `rgba(255, 230, 150, 1)` // Light yellow/gold for the ball body
        shadowColor = `rgba(255, 215, 0, 0.8)` // Gold glow
      } else if (clampedHits === 1) {
        // 1 hit: Gold (same as multiplier line color)
        color = `rgba(255, 215, 0, 1)` // Gold
        shadowColor = `rgba(255, 215, 0, 0.8)` // Gold glow
      } else if (clampedHits === 2) {
        // 2 hits: More reddish
        color = `rgba(255, 100, 0, 1)` // Orange-red
        shadowColor = `rgba(255, 150, 0, 0.8)` // Orange glow
      } else if (clampedHits === 3) {
        // 3 hits: Even more reddish
        color = `rgba(255, 50, 0, 1)` // Stronger red-orange
        shadowColor = `rgba(255, 100, 0, 0.8)` // Red-orange glow
      } else {
        // clampedHits === 4
        // 4 hits: Super glowing red
        color = `rgba(255, 0, 0, 1)` // Pure red
        shadowColor = `rgba(255, 0, 0, 1)` // Intense red glow
      }

      return { color, shadowColor }
    }

    // Play multiplier hit sound
    function playMultiplierSound() {
      if (!gameState.audioInitialized || !audioContext || !audioBuffers.multi) {
        console.warn("⚠️ Multiplier hit audio not ready")
        return
      }

      try {
        const source = audioContext.createBufferSource()
        const gainNode = audioContext.createGain()
        source.buffer = audioBuffers.multi
        source.connect(gainNode)
        gainNode.connect(audioContext.destination)
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime) // Adjust volume as needed
        source.start(audioContext.currentTime)
        console.log("⚡ Multiplier hit sound played")
      } catch (error) {
        console.error("❌ Error playing multiplier hit sound:", error)
      }
    }

    // Animation loop (120fps) - FIXED: Much more chaotic physics
    function startAnimationLoop() {
      if (!canvas || !ctx) return

      let lastTime = 0
      const targetFPS = 120
      const frameInterval = 1000 / targetFPS

      function animate(currentTime) {
        if (currentTime - lastTime < frameInterval) {
          requestAnimationFrame(animate)
          return
        }
        lastTime = currentTime

        // Pause animation if a modal is active
        if (gameState.isPausedForModal) {
          requestAnimationFrame(animate)
          return
        }

        // Increment line animation time
        gameState.lineAnimationTime += 0.05 // Adjust speed of electricity flow

        // Clear canvas
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

        // Update and draw pegs
        gameState.pegs.forEach((peg) => {
          peg.hitTime = peg.hit ? Math.max(0, peg.hitTime - 1) : 0
          peg.hit = peg.hitTime > 0

          peg.boostedHitTime = peg.boostedHit ? Math.max(0, peg.boostedHitTime - 1) : 0
          peg.boostedHit = peg.boostedHitTime > 0 // Reset if time runs out

          const glowIntensity = peg.hit ? 0.9 : 0.4
          const size = peg.hit ? 6 : 4

          // Determine peg color based on whether it was hit by a boosted ball
          // Use getBrightBlueColor for pegs hit by multiplier-boosted balls
          const pegColor = peg.boostedHit
            ? getBrightBlueColor((peg.boostedHitTime / 25) * 4, glowIntensity)
            : `rgba(99, 102, 241, ${glowIntensity})`
          const innerPegColor = peg.boostedHit
            ? getBrightBlueColor((peg.boostedHitTime / 25) * 4, glowIntensity * 1.2)
            : `rgba(167, 139, 250, ${glowIntensity})`

          ctx.save()
          ctx.shadowColor = pegColor
          ctx.shadowBlur = 12
          ctx.beginPath()
          ctx.arc(peg.x, peg.y, size, 0, Math.PI * 2)
          ctx.fillStyle = pegColor
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.beginPath()
          ctx.arc(peg.x, peg.y, size * 0.5, 0, Math.PI * 2)
          ctx.fillStyle = innerPegColor
          ctx.fill()
          ctx.restore()
        })

        // NEW: Draw multiplier lines with electricity effect and text
        gameState.multiplierLines.forEach((line) => {
          if (line.active) {
            ctx.save()
            ctx.lineWidth = 3
            ctx.strokeStyle = "rgba(255, 215, 0, 0.8)" // Gold color for lines
            ctx.shadowColor = "rgba(255, 215, 0, 0.6)"
            ctx.shadowBlur = 15 // Stronger glow

            // Calculate line vector
            const dx = line.peg2.x - line.peg1.x
            const dy = line.peg2.y - line.peg1.y
            const length = Math.sqrt(dx * dx + dy * dy)
            const angle = Math.atan2(dy, dx)

            // Perpendicular vector for offset
            const perpDx = -Math.sin(angle)
            const perpDy = Math.cos(angle)

            const numSegments = 15 // More segments for a jagged look
            const maxJaggedOffset = 6 // Max perpendicular offset for jaggedness (increased)
            const flowFrequency = 8 // Higher frequency for more "wiggly" base
            const jitterMagnitude = 2 // Smaller random jitter for smoother crackle

            ctx.beginPath()
            ctx.moveTo(line.peg1.x, line.peg1.y)

            for (let i = 0; i <= numSegments; i++) {
              const t = i / numSegments // Normalized position along the line
              const currentX = line.peg1.x + dx * t
              const currentY = line.peg1.y + dy * t

              // Base wave for flowing motion
              const baseWaveOffset =
                Math.sin(gameState.lineAnimationTime * 0.03 + t * Math.PI * flowFrequency) * maxJaggedOffset
              // Add random jitter for electricity crackle
              const jitter = (Math.random() - 0.5) * jitterMagnitude
              const offset = baseWaveOffset + jitter

              ctx.lineTo(currentX + perpDx * offset, currentY + perpDy * offset)
            }
            ctx.stroke()
            ctx.restore()

            // Draw the multiplier text
            ctx.save()
            ctx.font = "bold 14px Orbitron"
            ctx.fillStyle = "#ffd700" // Gold text color
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.shadowColor = "rgba(255, 215, 0, 0.8)"
            ctx.shadowBlur = 8

            // Position text slightly above the midpoint of the line
            const midX = (line.peg1.x + line.peg2.x) / 2
            const midY = (line.peg1.y + line.peg2.y) / 2 - 15 // Offset upwards

            ctx.fillText(`${line.multiplier}x`, midX, midY) // Display the assigned multiplier
            ctx.restore()
          }
        })

        // Update balls - MUCH MORE CHAOTIC PHYSICS
        gameState.balls = gameState.balls.map((ball) => {
          if (!ball.active) return ball

          const baseSpeedMultiplier = 0.45 // Original speed
          const currentSpeedMultiplier = gameState.isTurboMode ? baseSpeedMultiplier * 2 : baseSpeedMultiplier // NEW: Apply turbo speed

          let newX = ball.x + ball.vx * currentSpeedMultiplier
          const newY = ball.y + ball.vy * currentSpeedMultiplier
          let newVx = ball.vx
          let newVy = ball.vy + 0.2 // Stronger gravity

          // Add random air resistance/turbulence
          newVx += (Math.random() - 0.5) * 0.1 * ball.chaosMultiplier
          newVy += (Math.random() - 0.5) * 0.05 * ball.chaosMultiplier

          // Collision detection with pegs - MORE CHAOTIC
          for (const peg of gameState.pegs) {
            const dx = newX - peg.x
            const dy = newY - peg.y
            const distSq = dx * dx + dy * dy
            if (distSq < 300) {
              // Larger collision radius
              peg.hit = true
              peg.hitTime = 25
              if (ball.isMultiplierBoosted) {
                // If the current ball is boosted
                peg.boostedHit = true
                peg.boostedHitTime = 25 // Same duration as regular hit
              }
              const angle = Math.atan2(dy, dx)

              // MUCH MORE random bounce
              const bounceForce = 2.5 + Math.random() * 2 // Random bounce strength
              const randomAngle = angle + (Math.random() - 0.5) * 1.2 // More random angle

              newVx = Math.cos(randomAngle) * bounceForce * ball.chaosMultiplier
              newVy = Math.abs(Math.sin(randomAngle) * bounceForce) + Math.random() * 1.5

              createParticles(peg.x, peg.y, "rgba(99, 102, 241, 0.8)")
              break
            }
          }

          // NEW: Collision detection with multiplier lines
          gameState.multiplierLines.forEach((line) => {
            if (line.active && !ball.hitLines.has(line.id)) {
              const ballPos = { x: ball.x, y: ball.y }
              const distSq = distToSegmentSquared(ballPos, line.peg1, line.peg2)
              const collisionThresholdSq = (10 + 5) * (10 + 5) // Ball radius + line thickness/fudge factor

              if (distSq < collisionThresholdSq) {
                // Ball hit the multiplier line!
                if (!ball.hasHitFirstMultiplierLine) {
                  ball.currentMultiplier *= line.multiplier // First hit: multiply
                  ball.hasHitFirstMultiplierLine = true
                } else {
                  ball.currentMultiplier += line.multiplier // Subsequent hits: add
                }

                ball.hitLines.add(line.id) // Mark line as hit for this ball
                ball.multiplierLineHits = (ball.multiplierLineHits || 0) + 1 // Increment hit counter
                ball.isMultiplierBoosted = true // Mark ball as boosted

                console.log(
                  `⚡ Ball ${ball.id} hit multiplier line on row ${line.row}! Multiplier: ${line.multiplier}x. Current total multiplier: ${ball.currentMultiplier.toFixed(2)}x, Hits: ${ball.multiplierLineHits}`,
                )
                createParticles(ball.x, ball.y, "rgba(255, 255, 0, 1)", 20) // UPDATED: More yellow particles (20 particles)
                playMultiplierSound() // NEW: Play sound on multiplier hit
              }
            }
          })

          // Wall bounces - More chaotic
          if (newX < 20 || newX > CANVAS_WIDTH - 20) {
            newVx = -newVx * (0.5 + Math.random() * 0.3) // Random bounce dampening
            newX = Math.max(20, Math.min(CANVAS_WIDTH - 20, newX))
            // Add random vertical component on wall bounce
            newVy += (Math.random() - 0.5) * 0.5
          }

          // NEW: Repulsion from high-value slots
          const repulsionThresholdY = CANVAS_HEIGHT - 120 // Start repulsion when ball is 120px from bottom
          const repulsionForce = 0.05 // Small force to push away

          if (ball.y > repulsionThresholdY) {
            const slotWidth = CANVAS_WIDTH / gameState.currentMultipliersLayout.length
            const currentSlotIndex = Math.floor(ball.x / slotWidth)

            // Check if current slot is a high-value slot (10x or higher)
            const currentMultiplierValue = gameState.currentMultipliersLayout[currentSlotIndex]
            // Ensure currentMultiplierValue is a number before comparison
            if (typeof currentMultiplierValue === "number" && currentMultiplierValue >= 10) {
              const slotCenterX = slotWidth * (currentSlotIndex + 0.5)

              // Determine direction to push: away from the center of the high-value slot
              // If ball is to the left of center, push right. If to the right, push left.
              if (ball.x < slotCenterX) {
                ball.vx -= repulsionForce // Push left
              } else {
                ball.vx += repulsionForce // Push right
              }
              // Add a slight vertical push to keep it bouncing a bit more
              ball.vy -= 0.01
            }
          }

          // Bottom collision - determine slot based on final X position
          if (newY > CANVAS_HEIGHT - 40) {
            const slotWidth = CANVAS_WIDTH / gameState.currentMultipliersLayout.length // UPDATED: Use currentMultipliersLayout
            let finalSlotIndex = Math.floor(ball.x / slotWidth)

            // Ensure the index is within valid bounds
            finalSlotIndex = Math.max(0, Math.min(gameState.currentMultipliersLayout.length - 1, finalSlotIndex)) // UPDATED

            const landedItem = gameState.currentMultipliersLayout[finalSlotIndex] // UPDATED

            if (typeof landedItem === "object" && landedItem.type === "FREE_DROPS") {
              // NEW: Handle Free Drops object
              const awardedFreeDrops = Math.round(landedItem.value * ball.currentMultiplier) // Use stored value, multiply by ball's line multiplier

              gameState.awardedFreeDropsCurrentSpin += awardedFreeDrops // Accumulate for the current spin

              console.log(
                `🎁 Ball landed on FREE DROPS! Base: ${landedItem.value}, Line Multiplier: ${ball.currentMultiplier.toFixed(2)}x, Awarded: ${awardedFreeDrops} free drops. Total for spin: ${gameState.awardedFreeDropsCurrentSpin}`,
              )
              playFreeDropsSound() // NEW: Play free drops sound
              createParticles(ball.x, ball.y, "rgba(0, 255, 0, 1)", 30) // Green particles for free drops

              // Add to recent hits as a free drop event
              gameState.recentHits.unshift({
                multiplier: "FREE",
                winAmount: awardedFreeDrops, // Store awarded drops as winAmount for display
                timestamp: Date.now(),
                isFreeDrop: true, // Flag for special display
              })
              gameState.recentHits = gameState.recentHits.slice(0, 20)

              // DO NOT show modal here, it will be shown after all balls settle
            } else {
              // Existing win calculation for regular multipliers
              const finalMultiplier = landedItem // UPDATED
              // Win calculation now uses ball.currentMultiplier (sum of line multipliers)
              const winAmount = ball.betAmount * ball.currentMultiplier * finalMultiplier // CHANGED: Use ball.betAmount
              gameState.balance += winAmount
              gameState.lastWin = winAmount

              // If currently in an auto-drop session, accumulate wins and multipliers
              if (gameState.isAutoDropping) {
                gameState.totalWinDuringFreeDrops += winAmount
                gameState.totalMultiplierDuringFreeDrops += ball.currentMultiplier * finalMultiplier
              }

              // Add to recent hits
              gameState.recentHits.unshift({
                // Display total multiplier (line multiplier * final slot multiplier)
                multiplier: (ball.currentMultiplier * finalMultiplier).toFixed(2),
                winAmount,
                timestamp: Date.now(),
              })
              // Keep only the most recent 20 hits
              gameState.recentHits = gameState.recentHits.slice(0, 20)

              console.log(
                `🎯 Ball landed in slot ${finalSlotIndex} (${finalMultiplier}x base, ${ball.currentMultiplier.toFixed(2)}x line total, ${(ball.currentMultiplier * finalMultiplier).toFixed(2)}x final total) at x:${ball.x.toFixed(1)}`,
              )
              playWinSound(finalMultiplier)
              createParticles(ball.x, ball.y, "rgba(255, 215, 0, 1)")
            }
            return { ...ball, active: false }
          }

          const newTrail = [...ball.trail, { x: ball.x, y: ball.y }].slice(-4)
          return {
            ...ball,
            x: newX,
            y: newY,
            vx: newVx * 0.96, // Less dampening for more chaos
            vy: newVy,
            trail: newTrail,
          }
        })

        gameState.balls = gameState.balls.filter((ball) => ball.active)

        // NEW: Check for awarded free drops from the current spin after all balls have settled
        if (
          gameState.awardedFreeDropsCurrentSpin > 0 &&
          !gameState.isAutoDropping &&
          !gameState.balls.some((ball) => ball.active) &&
          !gameState.isPausedForModal
        ) {
          showModal(
            "free-drops-awarded-modal",
            "FREE DROPS!",
            `You've won <span class="text-green-300 font-bold">${gameState.awardedFreeDropsCurrentSpin}</span> free drops!`,
            () => {
              gameState.freeDrops += gameState.awardedFreeDropsCurrentSpin // Add to total free drops after modal dismissed
              gameState.awardedFreeDropsCurrentSpin = 0 // Reset for next spin
              // If not already auto-dropping, start the sequence
              if (!gameState.isAutoDropping && gameState.freeDrops > 0) {
                startAutoDrops()
              }
            },
          )
        }
        // NEW: Check for free drops to auto-drop after all balls have settled (if no awarded free drops modal is active)
        else if (
          gameState.freeDrops > 0 &&
          !gameState.isAutoDropping &&
          !gameState.balls.some((ball) => ball.active) &&
          !gameState.isPausedForModal
        ) {
          startAutoDrops()
        }

        // Draw balls
        gameState.balls.forEach((ball) => {
          if (!ball.active) return

          // Trail
          ball.trail.forEach((point, index) => {
            const opacity = (index / ball.trail.length) * 0.4
            ctx.save()
            ctx.globalAlpha = opacity
            ctx.fillStyle = "rgba(255, 215, 0, 1)"
            ctx.beginPath()
            ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          })

          // Ball
          ctx.save()
          const baseGlow = 15
          const glowIncreasePerHit = 10
          const maxGlowHits = 4
          const currentGlow = baseGlow + Math.min(ball.multiplierLineHits, maxGlowHits) * glowIncreasePerHit

          // Draw black border
          ctx.beginPath()
          ctx.arc(ball.x, ball.y, 11, 0, Math.PI * 2) // Slightly larger radius for border
          ctx.strokeStyle = "#000000" // Black border
          ctx.lineWidth = 2 // Border thickness
          ctx.stroke()

          // Get ball visuals (color and shadow color) based on hits
          const { color: ballBodyColor, shadowColor: ballShadowColor } = getBallVisuals(ball.multiplierLineHits)

          ctx.shadowColor = ballShadowColor // Dynamic glow color
          ctx.shadowBlur = currentGlow // Dynamic glow

          const gradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, 10)
          gradient.addColorStop(0, ballBodyColor)
          gradient.addColorStop(0.7, ballBodyColor.replace("1)", "0.4)")) // Adjust opacity for gradient
          gradient.addColorStop(1, ballBodyColor.replace("1)", "0)")) // Adjust opacity for gradient
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.fillStyle = "rgba(255, 255,255, 1)" // Inner white circle remains
          ctx.beginPath()
          ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()

          // Draw ball's current multiplier value
          // Display ball.currentMultiplier directly if it's greater than 1 (initial value)
          if (ball.currentMultiplier > 1) {
            ctx.save()
            ctx.font = "bold 10px Orbitron" // UPDATED: Smaller font for better fit
            ctx.fillStyle = "#000000" // Black text for contrast
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillText(`${ball.currentMultiplier.toFixed(0)}x`, ball.x, ball.y + 1) // UPDATED: Slight Y offset
            ctx.restore()
          }
        })

        // Update particles
        gameState.particles = gameState.particles
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vx: p.vx * 0.94,
            vy: p.vy * 0.94,
            life: p.life - 1,
          }))
          .filter((p) => p.life > 0)

        gameState.particles.forEach((particle) => {
          ctx.save()
          ctx.globalAlpha = particle.life / particle.maxLife
          ctx.fillStyle = particle.color
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, 1, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        })

        requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }

    // NEW: Event listener for the "START COSMIC EXPERIENCE" button
    const startGameBtn = document.getElementById("start-game")
    if (startGameBtn) {
      startGameBtn.addEventListener("click", startGame)
    }

    // PWA Service Worker Registration
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("✅ SW registered: ", registration)

            // Check for updates
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("🔄 New content available, please refresh.")
                    // You could show a notification to the user here
                  }
                })
              }
            })
          })
          .catch((registrationError) => {
            console.log("❌ SW registration failed: ", registrationError)
          })
      })
    }

    // PWA Install Prompt
    let deferredPrompt
    window.addEventListener("beforeinstallprompt", (e) => {
      console.log("💾 Install prompt available")
      e.preventDefault()
      deferredPrompt = e

      // You could show a custom install button here
      // For now, the browser will handle the install prompt
    })

    window.addEventListener("appinstalled", (evt) => {
      console.log("🎉 App was installed successfully")
      deferredPrompt = null
    })
  }, [])

  return (
    <>
      {/* Start Overlay for Chrome Autoplay Policy */}
      <div id="start-overlay" className="fixed inset-0 flex items-center justify-center">
        <div className="text-center py-4 px-2">
          <h1 className="text-5xl font-bold gradient-text mb-4">COSMIC PLINKO</h1>
          <p className="text-white mb-6 text-xl font-bold" style={{ fontFamily: "Orbitron, monospace" }}>
            #BovadaPlinkoChallenge
          </p>
          <p className="text-white mb-6 text-xl font-bold" style={{ fontFamily: "Orbitron, monospace" }}>
            #1st Place Challanage $5,000 Winner!
          </p>
          <div className="text-blue-200 mb-8 max-w-md mx-auto text-lg text-center">
            <h2 className="text-yellow-300 font-bold text-center mb-3">HOW TO PLAY:</h2>
            <ol className="list-decimal list-inside space-y-1">
              <li>Drop balls from the top.</li>
              <li>Balls bounce off pegs into prize slots.</li>
              <li>Hit multiplier lines (2x-5x) to boost your ball&apos;s multiplier!</li>
              <li>
                Stack multipliers for huge wins, up to <span className="text-yellow-300 font-bold">20x</span>!
              </li>
              <li>
                Final prize slot multiplier combines with your ball&apos;s multiplier for epic wins, up to{" "}
                <span className="text-yellow-300 font-bold">20,000x MAX WIN!</span>
              </li>
              <li>
                Land on a <span className="text-green-300 font-bold">FREE DROPS</span> slot for bonus balls! Your
                ball&apos;s multiplier boosts free drops, up to{" "}
                <span className="text-yellow-300 font-bold">200 spins!</span>
              </li>
            </ol>
            <p className="text-center mt-4">Will the stars align in your favor?</p>
          </div>
          <button id="start-game" className="start-button text-white font-bold px-8 py-4 rounded-xl text-xl">
            🚀 START COSMIC EXPERIENCE
          </button>
        </div>
      </div>

      <div id="app" className="h-screen w-screen relative">
        {/* Cosmic Video Background */}
        <video
          id="cosmic-video"
          className="absolute inset-0 w-full h-full object-cover"
          loop
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          style={{ display: "none" }}
        >
          <source
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/BackGround-mxRb0rKXSqoh1DHNoh7HMJMnl40Ut8.mp4"
            type="video/mp4"
          />
          Your browser does not support the video tag.
        </video>

        {/* Loading Indicator */}
        <div
          id="loading-indicator"
          className="absolute top-4 left-4 status-indicator text-white px-3 py-2 rounded-lg text-sm"
          style={{ display: "none" }}
        >
          🚀 Loading cosmic experience...
        </div>

        {/* FIXED: Perfect centering layout */}
        <div className="game-layout relative z-10">
          <div className="desktop-container">
            {/* Left Sidebar (Hidden on Mobile) */}
            <div className="left-sidebar">
              <div className="sidebar-content">
                {/* Win Display - UPDATED: Positioned relative to game board start */}
                <div className="win-section">
                  <div id="win-card" className="win-card rounded-xl w-48 hidden animate-glow">
                    <div className="p-4 text-center">
                      <div id="last-win" className="text-2xl font-bold win-value">
                        $0.00
                      </div>
                      <div className="stat-label text-xs mt-1">LAST WIN</div>
                    </div>
                  </div>
                </div>

                {/* Recent Hits - UPDATED: Bottom aligned with game board bottom */}
                <div className="recent-hits-section">
                  <div className="game-card rounded-xl w-48">
                    <div className="p-4">
                      <h3 className="stat-value text-sm font-bold mb-3 text-center">RECENT HITS</h3>
                      <div className="recent-hits-container">
                        <div id="recent-hits" className="space-y-2">
                          <div className="text-blue-300/50 text-xs text-center py-6">No hits yet</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Center Content */}
            <div className="center-content">
              {/* Floating Alien */}
              <div className="alien-container animate-float">
                <img
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Alien-uzfEiE9Kl7eFnvILT9jpv6ATb1JQjX.png"
                  alt="Cosmic Alien"
                  crossOrigin="anonymous"
                  className="alien-image"
                />
              </div>
              {/* Header */}
              <div className="text-center mb-4 relative w-full">
                <h1 className="text-4xl font-bold gradient-text mb-2">COSMIC PLINKO</h1>
                <div className="text-blue-300 text-lg font-bold" style={{ fontFamily: "Orbitron, monospace" }}>
                  #BovadaPlinkoChallenge
                </div>
                 <div className="text-blue-300 text-lg font-bold" style={{ fontFamily: "Orbitron, monospace" }}>
                  #1st Place Challanage $5,000 Winner!
                </div>
              </div>

              {/* Game Board with Background */}
              <div className="game-board-container mb-4">
                {/* Background Image */}
                <div id="plinko-board-background"></div>

                {/* Game Canvas */}
                <canvas
                  id="game-canvas"
                  width="600"
                  height="500"
                  className="rounded-xl shadow-2xl backdrop-blur-sm"
                ></canvas>

                {/* FIXED: Prize Multipliers - Now properly visible above canvas and background */}
                <div id="multipliers" className="absolute bottom-0 left-0 right-0 flex">
                  {/* Multipliers will be generated by JavaScript */}
                </div>
              </div>

              {/* Bet Controls */}
              <div id="bet-controls" className="flex gap-2 mb-4 flex-wrap justify-center">
                {/* Bet buttons will be generated by JavaScript */}
              </div>

              {/* Game Controls */}
              <div id="game-controls-container" className="flex gap-4 mb-4 items-center">
                {/* Ball Count Dropdown */}
                <select
                  id="ball-count-select"
                  className="ball-count-dropdown game-control-button-base rounded-xl transition-all"
                >
                  <option value="1">1 Ball</option>
                  <option value="2">2 Balls</option>
                  <option value="3">3 Balls</option>
                  <option value="4">4 Balls</option>
                  <option value="5">5 Balls</option>
                  <option value="6">6 Balls</option>
                  <option value="7">7 Balls</option>
                  <option value="8">8 Balls</option>
                  <option value="9">9 Balls</option>
                  <option value="10">10 Balls</option>
                </select>

                <button
                  id="drop-ball-btn"
                  className="btn-primary game-control-button-base text-white font-bold rounded-xl shadow-xl"
                >
                  DROP BALL
                </button>
                {/* NEW: Turbo Spin Button */}
                <button id="turbo-btn" className="reset-button game-control-button-base rounded-xl transition-all">
                  &gt;
                </button>
                <button id="reset-btn" className="reset-button game-control-button-base rounded-xl transition-all">
                  <span className="inline-block w-5 h-5 mr-2">↻</span>
                  RESET
                </button>
              </div>

              {/* Total Bet Display */}
              <div
                id="total-bet-display"
                className="text-center text-blue-300 text-sm mb-4"
                style={{ fontFamily: "Orbitron, monospace" }}
              >
                $1.00 × 1 ball = $1.00
              </div>

              {/* Free Drops Display */}
              <div
                id="free-drops-display"
                className="text-center text-green-400 text-sm mb-4 hidden"
                style={{ fontFamily: "Orbitron, monospace" }}
              >
                FREE DROPS: 0
              </div>

              {/* Stats - Desktop and Mobile layout */}
              <div className="flex flex-col gap-2 mb-4 stats-mobile lg:flex-row lg:gap-2 lg:justify-center">
                <div className="game-card rounded-xl balance-box mx-auto lg:mx-0">
                  <div className="p-4 text-center">
                    <div id="balance" className="text-2xl font-bold stat-value">
                      $100.00
                    </div>
                    <div className="stat-label text-xs mt-1">BALANCE</div>
                  </div>
                </div>
                <div className="game-card rounded-xl bet-box mx-auto lg:mx-0">
                  <div className="p-4 text-center">
                    <div id="bet-amount" className="text-2xl font-bold stat-value">
                      $1.00
                    </div>
                    <div className="stat-label text-xs mt-1">BET PER BALL</div>
                  </div>
                </div>
              </div>

              {/* Mobile Win Display and Recent Hits (Only visible on mobile) */}
              <div className="lg:hidden mb-4 mobile-stats-container mx-auto">
                {/* Mobile Win Display */}
                <div className="mb-2">
                  <div id="mobile-win-card" className="win-card rounded-xl hidden animate-glow">
                    <div className="p-3 text-center">
                      <div id="mobile-last-win" className="text-lg font-bold win-value">
                        $0.00
                      </div>
                      <div className="stat-label text-xs mt-1">LAST WIN</div>
                    </div>
                  </div>
                </div>

                {/* Mobile Recent Hits - HORIZONTAL */}
                <div className="game-card rounded-xl">
                  <div className="p-3">
                    <h3 className="stat-value text-sm font-bold mb-2 text-center">RECENT HITS</h3>
                    <div id="mobile-recent-hits" className="mobile-recent-hits-horizontal">
                      <div className="text-blue-300/50 text-xs text-center py-4 w-full">No hits yet</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-center text-blue-300/80 text-sm mb-2" style={{ fontFamily: "Orbitron, monospace" }}>
                Press <kbd className="px-2 py-1 rounded text-sm">SPACE</kbd> or click DROP BALL
              </div>

              {/* Insufficient Balance Warning */}
              <div
                id="insufficient-balance"
                className="text-purple-300 text-sm font-bold animate-pulse hidden"
                style={{ fontFamily: "Orbitron, monospace" }}
              >
                INSUFFICIENT BALANCE
              </div>
            </div>

            {/* Right Sidebar (Hidden for now) */}
            <div className="right-sidebar hidden lg:block">{/* Future features can go here */}</div>
          </div>
        </div>
      </div>

      {/* Free Drops Awarded Modal */}
      <div id="free-drops-awarded-modal" className="modal-overlay">
        <div className="modal-content">
          <h2 className="modal-title">FREE DROPS!</h2>
          <p id="free-drops-awarded-message" className="modal-message">
            You&apos;ve won X free drops!
          </p>
          <button id="free-drops-awarded-continue-btn" className="modal-button">
            CONTINUE
          </button>
        </div>
      </div>

      {/* Free Drops Summary Modal */}
      <div id="free-drops-summary-modal" className="modal-overlay">
        <div className="modal-content">
          <h2 className="modal-title">FREE DROPS SUMMARY</h2>
          <p id="free-drops-summary-message" className="modal-message">
            You won $X and Yx total during your free drops!
          </p>
          <button id="free-drops-summary-continue-btn" className="modal-button">
            CONTINUE
          </button>
        </div>
      </div>
    </>
  )
}
