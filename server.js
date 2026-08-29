import http from 'node:http'
import os from 'node:os'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { buildPool, buildAuctionPool, pickPair, countImposteurs, ALL_ANIMES, CHARACTERS } from './game.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

app.use(express.static(path.join(__dirname, 'public')))

const rooms = new Map()

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code
  do {
    code = ''
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  } while (rooms.has(code))
  return code
}

function roomView(room, forPlayerId) {
  const players = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
  }))
  const view = {
    code: room.code,
    host: room.host,
    settings: room.settings,
    phase: room.phase,
    players,
    animes: room.settings.game === 'encheres' ? AUCTION_ANIMES : ALL_ANIMES,
    auctionAnime: room.settings.auctionAnime || null,
    characters: CHARACTERS,
    round: room.game?.round || 0,
    rounds: room.settings.rounds,
  }

  if (room.settings.game === 'encheres' && (room.phase === 'encheres' || room.phase === 'debat' || room.phase === 'vote' || room.phase === 'results')) {
    const g = room.game
    view.auction = {
      money: auctionMoney(room),
      target: auctionTarget(room),
      skipsLeft: g?.skipsLeft || {},
      myWallet: g?.wallets?.[forPlayerId] ?? auctionMoney(room),
      myTeam: g?.teams?.[forPlayerId] || [],
      teams: g?.teams || {},
      teamsCount: g?.teams ? Object.fromEntries(room.players.map((p) => [p.id, g.teams[p.id].length])) : {},
      wallets: g?.wallets || {},
      current: g?.current ? {
        char: g.current.char,
        bid: g.current.bid,
        bidderId: g.current.bidderId,
        turnId: g.current.turnOrder[g.current.turnPos],
      } : null,
      sold: g?.sold || [],
      poolLeft: g?.pool?.length || 0,
    }
    const meA = room.players.find((p) => p.id === forPlayerId)
    view.auction.myCanBid = !!(g && meA && canBid(room, meA))
    view.auction.mySkips = meA ? (g?.skipsLeft?.[meA.id] || 0) : 0
    if (room.phase === 'vote') {
      view.voteOptions = room.players.map((p) => ({ id: p.id, name: p.name }))
      view.haveVoted = [...room.votes.keys()]
    }
    if (room.phase === 'results') view.results = room.results
  }
  if (room.phase === 'playing' || room.phase === 'voting') {
    const isHost = forPlayerId === room.host
    const hostMode = room.settings.mode === 'host'
    const playable = playablePlayers(room)
    const meInRoom = room.players.find((p) => p.id === forPlayerId)
    if (hostMode && isHost) {
      view.myRole = 'arbitre'
      view.spectator = { citoyen: room.game?.reference || null, imposteur: room.game?.imposteur || null }
    } else if (meInRoom) {
      view.myCharacter = meInRoom.character
    }
    view.turnOrder = room.game.turnOrder
    view.turnIndex = room.game.turnIndex
    view.turnPlayerId = room.game.turnOrder[room.game.turnIndex]
    view.turnPlayerName = room.players.find((p) => p.id === view.turnPlayerId)?.name
    view.hints = {}
    for (const p of playable) {
      view.hints[p.id] = p.hints || []
    }
    if (room.phase === 'voting') {
      view.voteOptions = playable.map((p) => ({ id: p.id, name: p.name }))
      view.haveVoted = [...room.votes.keys()]
    }
  }
  if (room.phase === 'results') {
    view.results = room.results
  }
  return view
}

function broadcast(room) {
  for (const p of room.players) {
    io.to(p.socketId).emit('state', roomView(room, p.id))
  }
}

function playablePlayers(room) {
  return room.settings.mode === 'host' ? room.players.filter((p) => !p.isHost) : room.players
}

/* ---------- MODE ENCHÈRES ---------- */
const AUCTION_ANIMES = ['Dragon Ball Z', "JoJo's Bizarre Adventure", 'One Piece', 'Naruto']

function auctionPoolFor(room) {
  return buildAuctionPool(room.settings.auctionAnime)
}

function auctionMoney(room) { return room.settings.money || 20 }
function auctionTarget(room) { return room.settings.target || 4 }
function auctionSkips(room) { return Math.max(0, room.settings.skips || 1) }

function canBid(room, player) {
  return room.game.teams[player.id].length < auctionTarget(room) && room.game.wallets[player.id] >= 1
}

function allDone(room) {
  return room.players.every((p) => room.game.teams[p.id].length >= auctionTarget(room) || room.game.wallets[p.id] < 1)
}

function startAuctionGame(room) {
  const pool = auctionPoolFor(room)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  room.game = {
    pool,
    teams: Object.fromEntries(room.players.map((p) => [p.id, []])),
    wallets: Object.fromEntries(room.players.map((p) => [p.id, auctionMoney(room)])),
    skipsLeft: Object.fromEntries(room.players.map((p) => [p.id, auctionSkips(room)])),
    sold: [],
    current: null,
  }
  room.phase = 'encheres'
  room.votes = new Map()
  room.results = null
  nextAuction(room)
  return true
}

function nextAuction(room) {
  const g = room.game
  if (allDone(room) || g.pool.length === 0) { endAuctions(room); return }
  const turnOrder = room.players.filter((p) => canBid(room, p)).map((p) => p.id)
  if (turnOrder.length === 0) { endAuctions(room); return }
  g.current = {
    char: g.pool.shift(),
    bid: 0,
    bidderId: null,
    turnOrder,
    turnPos: Math.floor(Math.random() * turnOrder.length),
    passed: new Set(),
  }
  broadcast(room)
}

function currentTurnId(room) {
  const c = room.game.current
  return c ? c.turnOrder[c.turnPos] : null
}

function advanceTurn(room) {
  const c = room.game.current
  c.turnPos = (c.turnPos + 1) % c.turnOrder.length
}

function resolveAuction(room) {
  const g = room.game
  const c = g.current
  if (c.bidderId) {
    const buyer = room.players.find((p) => p.id === c.bidderId)
    if (buyer) {
      g.teams[buyer.id].push(c.char)
      g.wallets[buyer.id] -= c.bid
      g.sold.push({ char: c.char, buyerId: buyer.id, buyerName: buyer.name, price: c.bid })
    }
  }
  g.current = null
  if (allDone(room) || g.pool.length === 0) { endAuctions(room); return }
  nextAuction(room)
}

function endAuctions(room) {
  room.game.current = null
  room.phase = 'debat'
  broadcast(room)
}

function handleBid(room, player, amount) {
  const g = room.game
  const c = g.current
  if (room.phase !== 'encheres') return { ok: false, error: 'Les enchères sont terminées' }
  if (currentTurnId(room) !== player.id) return { ok: false, error: 'Ce n’est pas ton tour' }
  if (!canBid(room, player)) return { ok: false, error: 'Tu ne peux plus enchérir' }
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, error: 'Enchère invalide' }
  if (amount <= c.bid) return { ok: false, error: 'Doit être supérieur à l’enchère actuelle' }
  if (amount > g.wallets[player.id]) return { ok: false, error: 'Pas assez d’argent' }
  c.bid = amount
  c.bidderId = player.id
  c.passed.clear()
  if (c.turnOrder.length === 1) { resolveAuction(room); return { ok: true } }
  advanceTurn(room)
  broadcast(room)
  return { ok: true }
}

function handlePass(room, player) {
  const g = room.game
  const c = g.current
  if (room.phase !== 'encheres') return { ok: false, error: 'Les enchères sont terminées' }
  if (currentTurnId(room) !== player.id) return { ok: false, error: 'Ce n’est pas ton tour' }
  if (c.bid === 0) return { ok: false, error: 'Personne n’a encore misé : tu dois miser au moins 1€' }
  if (player.id !== c.bidderId) c.passed.add(player.id)
  const others = c.bidderId ? c.turnOrder.length - 1 : c.turnOrder.length
  if (c.passed.size >= others) {
    resolveAuction(room)
    return { ok: true, ended: true }
  }
  advanceTurn(room)
  broadcast(room)
  return { ok: true }
}

function handleSkip(room, player) {
  const g = room.game
  const c = g.current
  if (room.phase !== 'encheres') return { ok: false, error: 'Les enchères sont terminées' }
  if (currentTurnId(room) !== player.id) return { ok: false, error: 'Ce n’est pas ton tour' }
  if (c.bid !== 0) return { ok: false, error: 'Il y a déjà une enchère : tu ne peux pas skipper' }
  if ((g.skipsLeft[player.id] || 0) <= 0) return { ok: false, error: 'Tu n’as plus de skip' }
  g.skipsLeft[player.id] -= 1
  g.current = null
  if (allDone(room) || g.pool.length === 0) { endAuctions(room); return { ok: true, skipped: true } }
  nextAuction(room)
  return { ok: true, skipped: true }
}

function startVotePhase(room) {
  if (room.phase !== 'debat') return
  room.phase = 'vote'
  room.votes = new Map()
  broadcast(room)
}

function computeAuctionResults(room) {
  const counts = new Map(room.players.map((p) => [p.id, 0]))
  for (const target of room.votes.values()) counts.set(target, (counts.get(target) || 0) + 1)
  let max = 0
  let top = []
  for (const [id, n] of counts) {
    if (n > max) { max = n; top = [id] }
    else if (n === max && n > 0) top.push(id)
  }
  // égalité => nouveau vote
  if (top.length > 1) {
    room.phase = 'vote'
    room.votes = new Map()
    broadcast(room)
    return
  }
  const winnerId = top[0] || null
  room.phase = 'results'
  room.results = {
    winnerId,
    target: auctionTarget(room),
    counts: Object.fromEntries([...counts]),
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      team: room.game.teams[p.id],
      wallet: room.game.wallets[p.id],
    })),
    sold: room.game.sold,
  }
  broadcast(room)
}

function updateSettings(room) {
  const pool = room.settings.game === 'encheres'
    ? auctionPoolFor(room)
    : buildPool(room.settings.selectedAnimes)
  room.settings.availableCount = pool.length
  room.settings.valid = pool.length >= 2
  broadcast(room)
}

function startGame(room) {
  if (room.settings.game === 'encheres') {
    return startAuctionGame(room)
  }
  const hostMode = room.settings.mode === 'host'
  const playable = playablePlayers(room)
  if (playable.length < 3) return false

  let reference, imposteur
  if (hostMode) {
    const c = CHARACTERS.find((x) => x.id === room.hostPicks?.citoyen)
    const i = CHARACTERS.find((x) => x.id === room.hostPicks?.imposteur)
    if (!c || !i || c.id === i.id) return false
    reference = c
    imposteur = i
  } else {
    const pool = buildPool(room.settings.selectedAnimes)
    const pair = pickPair(pool, room.settings.sameAnime)
    if (!pair) return false
    reference = pair[0]
    imposteur = pair[1]
  }

  const nbImposteurs = countImposteurs(playable.length, room.settings.imposteurs)
  const playerIds = playable.map((p) => p.id)
  for (let i = playerIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]]
  }
  const imposteurIds = new Set(playerIds.slice(0, nbImposteurs))

  for (const p of room.players) {
    p.hints = []
    if (hostMode && p.isHost) {
      p.isImposteur = false
      p.character = null
      continue
    }
    p.isImposteur = imposteurIds.has(p.id)
    p.character = p.isImposteur ? imposteur : reference
  }

  room.phase = 'playing'
  room.game = {
    round: 1,
    turnOrder: playerIds,
    turnIndex: 0,
    reference,
    imposteur,
  }
  room.votes = new Map()
  room.results = null
  broadcast(room)
  return true
}

function currentTurnPlayer(room) {
  if (!room.game) return null
  return room.players.find((p) => p.id === room.game.turnOrder[room.game.turnIndex])
}

function nextTurn(room) {
  room.game.turnIndex++
  if (room.game.turnIndex >= room.game.turnOrder.length) {
    room.game.round++
    room.game.turnIndex = 0
    if (room.game.round > room.settings.rounds) {
      room.phase = 'voting'
    }
  }
  broadcast(room)
}

function submitHint(room, player, hint) {
  player.hints.push(hint)
  nextTurn(room)
}

function computeResults(room) {
  const playable = playablePlayers(room)
  const imposteurs = playable.filter((p) => p.isImposteur)
  const citizens = playable.filter((p) => !p.isImposteur)

  // votes : décompte des votes reçus
  const voteCounts = new Map(playable.map((p) => [p.id, 0]))
  for (const targetId of room.votes.values()) {
    voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1)
  }
  let max = 0
  let top = []
  for (const [id, n] of voteCounts) {
    if (n > max) { max = n; top = [id] }
    else if (n === max && n > 0) top.push(id)
  }
  const eliminated = top.length === 1 ? top[0] : null // égalité => personne éliminé
  const eliminatedPlayer = eliminated ? playable.find((p) => p.id === eliminated) : null

  let citizensWin = false
  if (eliminatedPlayer) {
    if (eliminatedPlayer.isImposteur) {
      citizensWin = true
    }
  }
  // si tous les imposteurs sont éliminés => citoyens gagnent
  const eliminatedSet = eliminatedPlayer ? [eliminatedPlayer.id] : []
  const allImposteursEliminated = imposteurs.every((i) => eliminatedSet.includes(i.id))

  const citizenEliminated = eliminatedPlayer && !eliminatedPlayer.isImposteur

  let winner = null
  let detail = ''
  if (citizenEliminated || (eliminatedPlayer && !allImposteursEliminated)) {
    winner = 'imposteurs'
    detail = 'Un citoyen a été éliminé'
  } else if (eliminatedPlayer && allImposteursEliminated) {
    winner = 'citoyens'
    detail = 'L’imposteur a été démasqué'
  } else if (!eliminatedPlayer) {
    // personne éliminé : victoire imposteurs (ils survivent)
    winner = 'imposteurs'
    detail = 'Égalité, personne n’a été éliminé'
  }

  room.phase = 'results'
  room.results = {
    winner,
    detail,
    eliminated: eliminatedPlayer ? { id: eliminatedPlayer.id, name: eliminatedPlayer.name, isImposteur: eliminatedPlayer.isImposteur } : null,
    reference: room.game.reference,
    imposteur: room.game.imposteur,
    imposteurIds: imposteurs.map((p) => p.id),
    voteCounts: Object.fromEntries([...voteCounts]),
    players: playable.map((p) => ({
      id: p.id,
      name: p.name,
      isImposteur: p.isImposteur,
      character: p.character,
      hints: p.hints,
    })),
  }
  broadcast(room)
}

function endGame(room) {
  room.phase = 'voting'
  room.votes = new Map()
  broadcast(room)
}

function restartRoom(room) {
  for (const p of room.players) {
    p.character = null
    p.isImposteur = false
    p.hints = []
  }
  room.phase = 'lobby'
  room.game = null
  room.votes = new Map()
  room.results = null
  broadcast(room)
}

io.on('connection', (socket) => {
  let room = null

  socket.on('createRoom', ({ name, settings }, cb) => {
    const code = genCode()
    room = {
      code,
      host: socket.id,
      settings: {
        rounds: settings.rounds || 3,
        sameAnime: !!settings.sameAnime,
        imposteurs: settings.imposteurs || 0,
        mode: settings.mode === 'host' ? 'host' : 'auto',
        game: settings.game === 'encheres' ? 'encheres' : 'imposteur',
        auctionAnime: AUCTION_ANIMES.includes(settings.auctionAnime) ? settings.auctionAnime : 'One Piece',
        money: Math.min(100, Math.max(5, settings.money || 20)),
        target: Math.min(8, Math.max(1, settings.target || 4)),
        skips: Math.min(5, Math.max(0, settings.skips ?? 1)),
        selectedAnimes: settings.selectedAnimes?.length ? settings.selectedAnimes : ALL_ANIMES,
      },
      hostPicks: null,
      phase: 'lobby',
      players: [],
      game: null,
      votes: new Map(),
      results: null,
    }
    rooms.set(code, room)
    const player = { id: socket.id, socketId: socket.id, name, isHost: true, character: null, isImposteur: false, hints: [] }
    room.players.push(player)
    socket.join(code)
    updateSettings(room)
    cb?.({ ok: true, code })
  })

  socket.on('joinRoom', ({ code, name }, cb) => {
    const r = rooms.get((code || '').toUpperCase())
    if (!r) return cb?.({ ok: false, error: 'Salle introuvable' })
    if (r.phase !== 'lobby') return cb?.({ ok: false, error: 'La partie a déjà commencé' })
    const player = { id: socket.id, socketId: socket.id, name, isHost: false, character: null, isImposteur: false, hints: [] }
    r.players.push(player)
    room = r
    socket.join(r.code)
    broadcast(r)
    cb?.({ ok: true })
  })

  socket.on('settings', (settings) => {
    if (!room || room.phase !== 'lobby') return
    if (socket.id !== room.host) return
    room.settings.rounds = settings.rounds || room.settings.rounds
    room.settings.sameAnime = !!settings.sameAnime
    room.settings.imposteurs = settings.imposteurs
    if (settings.mode === 'host' || settings.mode === 'auto') room.settings.mode = settings.mode
    if (settings.game === 'encheres' || settings.game === 'imposteur') room.settings.game = settings.game
    if (AUCTION_ANIMES.includes(settings.auctionAnime)) room.settings.auctionAnime = settings.auctionAnime
    if (typeof settings.money === 'number') room.settings.money = Math.min(100, Math.max(5, settings.money))
    if (typeof settings.target === 'number') room.settings.target = Math.min(8, Math.max(1, settings.target))
    if (typeof settings.skips === 'number') room.settings.skips = Math.min(5, Math.max(0, settings.skips))
    if (Array.isArray(settings.selectedAnimes)) room.settings.selectedAnimes = settings.selectedAnimes
    updateSettings(room)
  })

  socket.on('hostPicks', ({ citoyenId, imposteurId }, cb) => {
    if (!room || room.phase !== 'lobby' || socket.id !== room.host) return cb?.({ ok: false })
    if (citoyenId && imposteurId && citoyenId === imposteurId) return cb?.({ ok: false, error: 'Les 2 personnages doivent être différents' })
    room.hostPicks = { citoyen: citoyenId, imposteur: imposteurId }
    broadcast(room)
    cb?.({ ok: true })
  })

  socket.on('bid', (amount, cb) => {
    if (!room || room.settings.game !== 'encheres') return
    const me = room.players.find((p) => p.id === socket.id)
    if (!me) return
    const res = handleBid(room, me, Math.round(Number(amount)))
    cb?.({ ok: res.ok, error: res.error })
  })

  socket.on('pass', (cb) => {
    if (!room || room.settings.game !== 'encheres') return
    const me = room.players.find((p) => p.id === socket.id)
    if (!me) return
    const res = handlePass(room, me)
    cb?.({ ok: res.ok, error: res.error })
  })

  socket.on('skip', (cb) => {
    if (!room || room.settings.game !== 'encheres') return
    const me = room.players.find((p) => p.id === socket.id)
    if (!me) return
    const res = handleSkip(room, me)
    cb?.({ ok: res.ok, error: res.error, skipped: res.skipped })
  })

  socket.on('startVote', () => {
    if (!room || socket.id !== room.host) return
    startVotePhase(room)
  })

  socket.on('voteAuction', (targetId, cb) => {
    if (!room || room.settings.game !== 'encheres' || room.phase !== 'vote') return
    const me = room.players.find((p) => p.id === socket.id)
    if (!me) return
    if (!room.players.some((p) => p.id === targetId)) return cb?.({ ok: false, error: 'Cible invalide' })
    room.votes.set(socket.id, targetId)
    broadcast(room)
    if (room.votes.size >= room.players.length) computeAuctionResults(room)
    cb?.({ ok: true })
  })

  socket.on('toggleAnime', ({ anime, checked }, cb) => {
    if (!room || room.phase !== 'lobby' || socket.id !== room.host) return cb?.({ ok: false })
    let sel = new Set(room.settings.selectedAnimes)
    if (checked) sel.add(anime)
    else sel.delete(anime)
    room.settings.selectedAnimes = [...sel]
    updateSettings(room)
    cb?.({ ok: true })
  })

  socket.on('start', (cb) => {
    if (!room || socket.id !== room.host) return
    if (room.settings.game === 'encheres') {
      if (room.players.length < 2) return cb?.({ ok: false, error: 'Il faut au moins 2 joueurs' })
      const ok = startGame(room)
      return cb?.({ ok, error: ok ? null : 'Impossible de démarrer' })
    }
    const playable = playablePlayers(room)
    if (playable.length < 3) return cb?.({ ok: false, error: 'Il faut au moins 3 joueurs' })
    const ok = startGame(room)
    cb?.({
      ok,
      error: ok ? null : (room.settings.mode === 'host' ? 'Choisis 2 personnages différents' : 'Pas assez de personnages pour l’anime sélectionné'),
    })
  })

  socket.on('getAnimes', (cb) => {
    cb?.(ALL_ANIMES)
  })

  socket.on('endGame', () => {
    if (!room || room.phase !== 'playing') return
    if (socket.id !== room.host) return
    endGame(room)
  })

  socket.on('restart', () => {
    if (!room || room.phase !== 'results') return
    if (socket.id !== room.host) return
    restartRoom(room)
  })

  socket.on('hint', (hint, cb) => {
    if (!room || room.phase !== 'playing') return
    const me = room.players.find((p) => p.id === socket.id)
    if (!me) return
    if (currentTurnPlayer(room)?.id !== socket.id) return cb?.({ ok: false, error: 'Pas ton tour' })
    const clean = (hint || '').trim()
    if (!clean) return cb?.({ ok: false, error: 'Indice vide' })
    if (clean.length > 60) return cb?.({ ok: false, error: 'Indice trop long' })
    submitHint(room, me, clean)
    cb?.({ ok: true })
  })

  socket.on('vote', (targetId, cb) => {
    if (!room || room.phase !== 'voting') return
    const me = room.players.find((p) => p.id === socket.id)
    if (!me) return
    if (!playablePlayers(room).some((p) => p.id === targetId)) return cb?.({ ok: false, error: 'Cible invalide' })
    room.votes.set(socket.id, targetId)
    broadcast(room)
    // tous ont voté ?
    if (room.votes.size >= playablePlayers(room).length) {
      computeResults(room)
    }
    cb?.({ ok: true })
  })

  socket.on('disconnect', () => {
    if (!room) return
    room.players = room.players.filter((p) => p.id !== socket.id)
    room.votes.delete(socket.id)
    if (room.players.length === 0) {
      rooms.delete(room.code)
      return
    }
    // en mode enchères : le joueur part, on recale l'enchère en cours
    if (room.phase === 'encheres' && room.game?.current) {
      const c = room.game.current
      if (c.bidderId === socket.id) {
        c.bid = 0
        c.bidderId = null
        c.passed.clear()
      }
      c.turnOrder = room.players.filter((p) => canBid(room, p)).map((p) => p.id)
      c.turnPos = c.turnOrder.length ? Math.floor(Math.random() * c.turnOrder.length) : 0
      if (c.turnOrder.length === 0 || allDone(room)) {
        endAuctions(room)
      }
    }
    if (room.phase === 'encheres' && room.game && allDone(room)) {
      endAuctions(room)
    }
    // si l'host part, on transfère
    if (room.host === socket.id) {
      room.host = room.players[0].id
      room.players[0].isHost = true
    }
    broadcast(room)
  })
})

server.listen(PORT, () => {
  const nets = os.networkInterfaces()
  const ips = Object.values(nets)
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address)
  console.log(`🎮 L'Imposteur Anime lancé :`)
  console.log(`   Local : http://localhost:${PORT}`)
  for (const ip of ips) console.log(`   Réseau : http://${ip}:${PORT}`)
})
