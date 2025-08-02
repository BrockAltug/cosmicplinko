const CACHE_NAME = "cosmic-plinko-v1"
const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
  // External resources
  "https://cdn.tailwindcss.com",
  "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;700;900&display=swap",
  // Game assets
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/BackGround-mxRb0rKXSqoh1DHNoh7HMJMnl40Ut8.mp4",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/plinkoboard-FTo2cMZvLjJ9wi7frhMy1hnhIwlKPg.png",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-2blBIg4gAwWnvcOcAfJ18csMkgrmpR.mp3",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-DRu5ntJp8KOAyep8t2NrS0u4K8m0uz.mp3",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-Xl9zw4BwCvupErIVwySJUpAGUw7Ia1.mp3",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/balldrop-hCisqCs6oFv8HlHGRhoc1rKeFevo0M.mp3",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/space%20-rvNZSIyJXLKZtJ6lczTy1NjfJHRzuH.mp3",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/buttonchange-zhwkWSbkfOGp9jJXv7jjNtm1wlKYBK.mp3",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Alien-uzfEiE9Kl7eFnvILT9jpv6ATb1JQjX.png",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/multi-Vx6Sza2V4G6OjyVV8iifmGIT0l93DL.mp3",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/free%20drops-HEzfYeyhOq8rmTfzRzkOka48CW4AzI.mp3",
]

// Install event - cache resources
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker installing...")
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("📦 Caching app resources")
        return cache.addAll(urlsToCache)
      })
      .then(() => {
        console.log("✅ Service Worker installed successfully")
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error("❌ Service Worker installation failed:", error)
      }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker activating...")
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("🗑️ Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        console.log("✅ Service Worker activated")
        return self.clients.claim()
      }),
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          console.log("📋 Serving from cache:", event.request.url)
          return response
        }

        console.log("🌐 Fetching from network:", event.request.url)
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          // Clone the response
          const responseToCache = response.clone()

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })

          return response
        })
      })
      .catch(() => {
        // If both cache and network fail, return offline page for navigation requests
        if (event.request.destination === "document") {
          return caches.match("/")
        }
      }),
  )
})

// Background sync for when connection is restored
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync") {
    console.log("🔄 Background sync triggered")
    // Handle any background sync tasks here
  }
})

// Push notification support (for future features)
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json()
    console.log("📬 Push notification received:", data)

    const options = {
      body: data.body,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey,
      },
    }

    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})
