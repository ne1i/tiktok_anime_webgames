const socket = io()
const app = document.getElementById('app')

let myId = null
let state = null
let myName = localStorage.getItem('imposteur_name') || ''
let selectedAnimes = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('imposteur_animes'))
    return Array.isArray(saved) ? new Set(saved) : null
  } catch {
    return null
  }
})()
let searchQuery = ''
let pendingGridScroll = 0
let pendingSettings = {
  rounds: 3,
  sameAnime: true,
  imposteurs: 0,
  mode: 'auto',
}
let pendingGame = 'imposteur'
let pendingAuctionAnime = 'One Piece'
let pendingAuction = { money: 20, target: 4, skips: 1 }
let hostPicks = { citoyen: null, imposteur: null }
let pickSearch = { citoyen: '', imposteur: '' }

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else if (k === 'text') node.textContent = v
    else if (k === 'html') node.innerHTML = v
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
    else if (k === 'disabled' || k === 'checked') {
      if (v) node.setAttribute(k, '')
      else node.removeAttribute(k)
    }
    else if (v !== null && v !== undefined) node.setAttribute(k, v)
  }
  for (const c of [].concat(children)) {
    if (c) node.appendChild(c)
  }
  return node
}

function card(children) {
  return el('div', { class: 'card' }, children)
}

function render() {
  if (!state) return renderHome()
  if (state.settings?.game === 'encheres') {
    if (state.phase === 'lobby') return renderLobby()
    if (state.phase === 'encheres') return renderEncheres()
    if (state.phase === 'debat') return renderDebat()
    if (state.phase === 'vote') return renderVoteEncheres()
    if (state.phase === 'results') return renderResultsEncheres()
  }
  if (state.phase === 'lobby') return renderLobby()
  if (state.phase === 'playing') return renderPlaying()
  if (state.phase === 'voting') return renderVoting()
  if (state.phase === 'results') return renderResults()
}

/* ---------- HOME ---------- */
function renderHome() {
  app.innerHTML = ''
  app.appendChild(el('div', { class: 'center' }, [
    el('h1', { text: '🕵️ L’Imposteur Anime' }),
    el('p', { class: 'sub mt', text: 'Deux façons de jouer, à toi de choisir.' }),
  ]))

  const nameInput = el('input', {
    type: 'text', placeholder: 'Ton pseudo', value: myName, maxlength: 20,
    oninput: (e) => { myName = e.target.value; localStorage.setItem('imposteur_name', myName) },
  })
  app.appendChild(card([el('label', { text: 'Ton pseudo' }), nameInput]))

  app.appendChild(card([
    el('h3', { text: 'Quel jeu ?' }),
    el('div', { class: 'game-choice' }, [
      el('button', { class: 'game-card' + (pendingGame === 'imposteur' ? ' active' : ''), onclick: () => { pendingGame = 'imposteur'; renderHome() } }, [
        el('span', { class: 'gc-icon', text: '🕵️' }),
        el('span', { class: 'gc-name', text: 'L’Imposteur' }),
        el('span', { class: 'gc-desc', text: 'Indices, suspicion, vote. Démasque celui qui a un personnage différent.' }),
      ]),
      el('button', { class: 'game-card' + (pendingGame === 'encheres' ? ' active' : ''), onclick: () => { pendingGame = 'encheres'; renderHome() } }, [
        el('span', { class: 'gc-icon', text: '💰' }),
        el('span', { class: 'gc-name', text: 'Enchères' }),
        el('span', { class: 'gc-desc', text: '20€ pour composer la meilleure équipe de 4 combattants.' }),
      ]),
    ]),
  ]))

  app.appendChild(el('div', { class: 'mt' }, [
    el('button', { class: 'btn green block', text: 'Créer une partie', onclick: () => createRoom() }),
    el('button', { class: 'btn secondary block mt', text: 'Rejoindre une partie', onclick: () => promptJoin() }),
  ]))
}

function promptJoin() {
  const existing = document.getElementById('join-form')
  if (existing) existing.remove()
  const codeInput = el('input', { type: 'text', placeholder: 'Code de la salle', maxlength: 4, style: 'text-transform:uppercase' })
  const form = card([el('h3', { text: 'Rejoindre' }), codeInput, el('div', { class: 'mt' }, [
    el('button', { class: 'btn block', text: 'Rejoindre', onclick: () => {
      socket.emit('joinRoom', { code: codeInput.value.trim(), name: myName }, (res) => {
        if (!res.ok) alert(res.error)
      })
    } }),
    el('button', { class: 'btn secondary block mt', text: 'Annuler', onclick: () => render() }),
  ])])
  form.id = 'join-form'
  app.appendChild(form)
}

function createRoom() {
  socket.emit('createRoom', {
    name: myName,
    settings: { ...pendingSettings, game: pendingGame },
  }, (res) => {
    if (res.ok) {
      socket.emit('settings', {
        ...pendingSettings,
        game: pendingGame,
        selectedAnimes: selectedAnimes === null ? undefined : [...selectedAnimes],
      })
    }
  })
}

/* ---------- LOBBY ---------- */
function renderLobby() {
  const prevGridScroll = document.querySelector('.anime-grid')?.scrollTop || 0
  pendingGridScroll = prevGridScroll
  app.innerHTML = ''
  const isHost = state.host === myId

  const isEncheres = state.settings?.game === 'encheres'
  const hostMode = pendingSettings.mode === 'host'

  app.appendChild(el('div', { class: 'center' }, [
    el('h1', { text: isEncheres ? '💰 Salle ' + state.code : 'Salle ' + state.code }),
    el('p', { class: 'sub', text: 'Partage ce code aux joueurs pour qu’ils rejoignent' }),
    el('div', { class: 'mt' }, [
      el('button', { class: 'btn secondary', text: '📋 Copier le code', onclick: () => {
        navigator.clipboard?.writeText(state.code); alert('Code copié : ' + state.code)
      } }),
    ]),
  ]))

  app.appendChild(card([
    el('h3', { text: 'Joueurs (' + state.players.length + ')' }),
    el('ul', { class: 'player-list' }, state.players.map((p) =>
      el('li', {}, [
        el('span', { class: 'dot ' + (p.isHost ? 'host' : 'citoyen') }),
        el('span', { text: p.name + (p.isHost ? ' 👑' : '') + (hostMode && p.isHost ? ' · arbitre' : '') }),
      ])
    )),
  ]))

  if (isEncheres) {
    if (isHost) {
      app.appendChild(card([
        el('h3', { text: 'Règles' }),
        el('ul', { class: 'rules' }, [
          el('li', { text: 'Chaque joueur dispose de ' + pendingAuction.money + '€ pour acheter des combattants.' }),
          el('li', { text: 'Une seule anime est tirée : un personnage est proposé, on mise au tour par tour, les autres passent ou surenchérissent.' }),
          el('li', { text: 'Le premier à miser peut skipper le personnage (si skips restants).' }),
          el('li', { text: 'La partie s’arrête quand tout le monde a ' + pendingAuction.target + ' personnages (ou n’a plus d’argent).' }),
          el('li', { text: 'On débat, puis on vote pour élire la meilleure équipe de combat.' }),
        ]),
      ]))
      app.appendChild(card([
        el('h3', { text: 'Réglages' }),
        stepperRow('Budget', 'Argent de départ par joueur', pendingAuction.money, (v) => { pendingAuction.money = v; sendSettings() }, 5, 100),
        stepperRow('Équipe', 'Combien de personnages à réunir', pendingAuction.target, (v) => { pendingAuction.target = v; sendSettings() }, 1, 8),
        stepperRow('Skips', 'Skipper un personnage sans miser (pour le premier à devoir miser)', pendingAuction.skips, (v) => { pendingAuction.skips = v; sendSettings() }, 0, 5),
      ]))
      app.appendChild(card([
        el('h3', { text: 'L’anime des enchères' }),
        el('div', { class: 'desc', text: 'Une seule anime par partie, pour pouvoir comparer les combattants.' }),
        el('div', { class: 'anime-pick mt' }, (state.animes || []).map((anime) =>
          el('button', { class: 'anime-radio' + (pendingAuctionAnime === anime ? ' active' : ''), onclick: () => {
            pendingAuctionAnime = anime
            sendSettings()
          } }, el('span', { text: anime }))
        )),
      ]))
      app.appendChild(el('div', { class: 'mt' }, [
        el('button', { class: 'btn big green block', text: '▶️ Démarrer les enchères',
          onclick: () => socket.emit('start', (res) => { if (!res.ok) alert(res.error) }) }),
      ]))
    } else {
      app.appendChild(card([
        el('h3', { text: 'En attente du créateur…' }),
        el('p', { class: 'sub', text: 'Il choisit l’anime des enchères puis lance la partie.' }),
      ]))
    }
    return
  }

  if (isHost) {
    app.appendChild(card([
      el('h3', { text: 'Mode de jeu' }),
      el('div', { class: 'seg' }, [
        el('button', { class: 'seg-btn' + (!hostMode ? ' active' : ''), text: 'Automatique', onclick: () => setMode('auto') }),
        el('button', { class: 'seg-btn' + (hostMode ? ' active' : ''), text: 'L’hôte choisit', onclick: () => setMode('host') }),
      ]),
      el('div', { class: 'desc mt', text: hostMode
        ? 'Tu choisis les 2 personnages et tu ne joues pas (arbitre).'
        : 'Les personnages sont tirés automatiquement, tu joues comme les autres.' }),
    ]))

    app.appendChild(card([
      el('h3', { text: 'Réglages' }),
      hostMode ? null : toggleRow('Même anime pour tous', 'L’imposteur est un perso du même anime, très similaire', pendingSettings.sameAnime,
        (v) => { pendingSettings.sameAnime = v; sendSettings() }),
      toggleRow('Imposteurs multiples', '', pendingSettings.imposteurs > 0,
        (v) => { pendingSettings.imposteurs = v ? 2 : 0; sendSettings() }),
      roundsRow(),
    ]))

    if (hostMode) {
      app.appendChild(hostPickerCard())
    } else {
      app.appendChild(card([
        el('h3', { text: 'Animes disponibles' }),
        el('div', { class: 'desc', text: 'Décoche ceux que tu ne connais pas' }),
        el('input', { type: 'text', class: 'search', placeholder: '🔍 Rechercher un anime…', value: searchQuery,
          oninput: (e) => { searchQuery = e.target.value.toLowerCase(); renderAnimeGrid() } }),
        el('div', { class: 'anime-grid', id: 'anime-grid' }),
      ]))
      renderAnimeGrid()
    }

    const ready = !hostMode || (hostPicks.citoyen && hostPicks.imposteur)
    app.appendChild(el('div', { class: 'mt' }, [
      el('button', { class: 'btn big green block', disabled: !ready, text: '▶️ Démarrer la partie',
        onclick: () => socket.emit('start', (res) => { if (!res.ok) alert(res.error) }) }),
    ]))
  } else {
    app.appendChild(card([
      el('h3', { text: hostMode ? 'L’hôte choisit les personnages…' : 'En attente du créateur…' }),
      el('p', { class: 'sub', text: hostMode
        ? 'Il ne joue pas : il choisit le personnage des citoyens et celui des imposteurs, puis lance la partie.'
        : 'Le créateur de la salle configure et lance la partie.' }),
    ]))
  }
}

function fetchAnimes() {
  if (!state) return []
  return (state.animes || []).filter((a) => a.toLowerCase().includes(searchQuery))
}

function renderAnimeGrid() {
  const grid = document.getElementById('anime-grid')
  if (!grid) return
  if (pendingGridScroll === 0) pendingGridScroll = grid.scrollTop || 0
  grid.innerHTML = ''
  const items = fetchAnimes().map((anime) => {
    const checked = selectedAnimes === null ? true : selectedAnimes.has(anime)
    return el('label', { class: 'anime-item' }, [
      el('input', { type: 'checkbox', checked,
        onchange: (e) => {
          if (selectedAnimes === null) selectedAnimes = new Set(state.animes)
          if (e.target.checked) selectedAnimes.add(anime)
          else selectedAnimes.delete(anime)
          localStorage.setItem('imposteur_animes', JSON.stringify([...selectedAnimes]))
          sendSettings()
        } }),
      el('span', { text: anime }),
    ])
  })
  for (const it of items) grid.appendChild(it)
  grid.scrollTop = pendingGridScroll
  pendingGridScroll = 0
}

function toggleRow(title, desc, checked, onchange) {
  return el('div', { class: 'toggle-row' }, [
    el('label', {}, [el('span', { text: title }), el('div', { class: 'desc', text: desc })]),
    el('label', { class: 'switch' }, [
      el('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }),
      el('span', { class: 'slider' }),
    ]),
  ])
}

function roundsRow() {
  const value = el('span', { class: 'rounds-value', text: pendingSettings.rounds })
  const change = (delta) => {
    pendingSettings.rounds = Math.min(9, Math.max(1, pendingSettings.rounds + delta))
    value.textContent = pendingSettings.rounds
    sendSettings()
  }
  return el('div', { class: 'toggle-row' }, [
    el('label', {}, [el('span', { text: 'Nombre de tours' }), el('div', { class: 'desc', text: 'Un indice par joueur et par tour' })]),
    el('div', { class: 'stepper' }, [
      el('button', { class: 'stepper-btn', text: '−', onclick: () => change(-1) }),
      value,
      el('button', { class: 'stepper-btn', text: '+', onclick: () => change(1) }),
    ]),
  ])
}

function stepperRow(label, desc, value, onChange, min, max) {
  const val = el('span', { class: 'rounds-value', text: value })
  const change = (d) => {
    const v = Math.min(max, Math.max(min, value + d))
    onChange(v)
    val.textContent = v
  }
  return el('div', { class: 'toggle-row' }, [
    el('label', {}, [el('span', { text: label }), el('div', { class: 'desc', text: desc })]),
    el('div', { class: 'stepper' }, [
      el('button', { class: 'stepper-btn', text: '−', onclick: () => change(-1) }),
      val,
      el('button', { class: 'stepper-btn', text: '+', onclick: () => change(1) }),
    ]),
  ])
}

function sendSettings() {
  socket.emit('settings', {
    rounds: pendingSettings.rounds,
    sameAnime: pendingSettings.sameAnime,
    imposteurs: pendingSettings.imposteurs,
    mode: pendingSettings.mode,
    game: pendingSettings.game,
    auctionAnime: pendingAuctionAnime,
    money: pendingAuction.money,
    target: pendingAuction.target,
    skips: pendingAuction.skips,
    selectedAnimes: selectedAnimes === null ? undefined : [...selectedAnimes],
  })
}

function setMode(mode) {
  pendingSettings.mode = mode
  sendSettings()
  render()
}

function hostPickerCard() {
  const sections = [
    ['citoyen', 'Personnage des citoyens'],
    ['imposteur', 'Personnage de(s) imposteur(s)'],
  ]
  return card([
    el('h3', { text: 'Choisis les personnages' }),
    el('div', { class: 'desc', text: 'Les joueurs devront deviner qui a le personnage différent' }),
    el('div', { class: 'mt' }, sections.map(([role, label]) => {
      const sel = hostPicks[role]
      return el('div', { class: 'char-pick' }, [
        el('h4', { text: label }),
        el('div', { class: 'char-selected', id: 'char-selected-' + role }, [
          sel ? miniChar(sel) : el('span', { class: 'muted', text: 'Aucun choisi — clique un personnage ci-dessous' }),
        ]),
        el('input', { type: 'text', class: 'search', placeholder: '🔍 Rechercher un personnage ou un anime…', value: pickSearch[role],
          oninput: (e) => { pickSearch[role] = e.target.value.toLowerCase(); renderCharList(role) } }),
        el('div', { class: 'char-options', id: 'char-list-' + role }),
      ])
    })),
  ])
}

function charOptions(role) {
  const q = pickSearch[role]
  const chars = (state.characters || []).filter((c) =>
    !q || c.name.toLowerCase().includes(q) || c.anime.toLowerCase().includes(q)
  )
  const pickedId = hostPicks[role]?.id
  return chars.map((c) =>
    el('button', { class: 'char-opt' + (c.id === pickedId ? ' picked' : ''), onclick: () => pickChar(role, c) }, [
      c.image ? el('img', { src: c.image, alt: c.name }) : el('span', { class: 'thumb-ph' }),
      el('span', { class: 'opt-info' }, [
        el('span', { class: 'opt-name', text: c.name }),
        el('span', { class: 'opt-anime', text: c.anime }),
      ]),
    ])
  )
}

function renderCharList(role) {
  const box = document.getElementById('char-list-' + role)
  if (!box) return
  box.innerHTML = ''
  for (const it of charOptions(role)) box.appendChild(it)
}

function pickChar(role, c) {
  const other = role === 'citoyen' ? 'imposteur' : 'citoyen'
  if (hostPicks[other] && hostPicks[other].id === c.id) {
    alert('Ce personnage est déjà choisi pour ' + (other === 'citoyen' ? 'les citoyens' : 'les imposteurs'))
    return
  }
  hostPicks[role] = c
  socket.emit('hostPicks', { citoyenId: hostPicks.citoyen?.id, imposteurId: hostPicks.imposteur?.id })
  render()
}

function miniChar(c) {
  return el('div', { class: 'char-card mini' }, [
    c.image ? el('img', { src: c.image, alt: c.name }) : null,
    el('div', {}, [
      el('div', { class: 'name', text: c.name }),
      el('div', { class: 'anime', text: c.anime }),
    ]),
  ])
}

/* ---------- PLAYING ---------- */
function renderPlaying() {
  app.innerHTML = ''
  const isArbitre = state.myRole === 'arbitre'
  const isMyTurn = state.turnPlayerId === myId

  app.appendChild(el('div', { class: 'center' }, [
    el('p', { class: 'sub', text: 'Tour ' + (state.turnIndex + 1) + '/' + (state.turnOrder.length) + ' · Round ' + state.round + '/' + state.rounds }),
    el('h1', { class: 'mt', text: isArbitre ? '👁️ Tu observes' : (isMyTurn ? 'À toi !' : 'Tour de ' + state.turnPlayerName) }),
  ]))

  if (isArbitre) {
    app.appendChild(card([
      el('h3', { text: 'Tu es l’arbitre' }),
      el('p', { class: 'sub', text: 'Tu connais les deux personnages, tu ne joues pas. Suis les indices et regarde si les joueurs se font avoir.' }),
      el('div', { class: 'mt role-strip' }, [
        el('div', { class: 'pill', text: 'Citoyens' }),
        el('div', { class: 'pill', text: 'Imposteur' }),
      ]),
      el('div', { class: 'mt' }, [
        state.spectator?.citoyen ? miniChar(state.spectator.citoyen) : null,
        el('div', { class: 'mt' }, [
          state.spectator?.imposteur ? miniChar(state.spectator.imposteur) : null,
        ]),
      ]),
    ]))
  } else {
    // Mon personnage
    app.appendChild(card([
      el('h3', { text: 'Ton personnage' }),
      el('div', { class: 'mt' }, [
        el('div', { class: 'char-card' }, [
          state.myCharacter.image ? el('img', { src: state.myCharacter.image, alt: state.myCharacter.name }) : null,
          el('div', {}, [
            el('div', { class: 'name', text: state.myCharacter.name }),
            el('div', { class: 'anime', text: state.myCharacter.anime }),
          ]),
        ]),
      ]),
    ]))

    // Zone d'indice
    if (isMyTurn) {
      const input = el('input', { type: 'text', placeholder: 'Un mot qui évoque ton personnage…', maxlength: 60,
        onkeydown: (e) => { if (e.key === 'Enter') sendHint(input) } })
      app.appendChild(card([
        el('h3', { text: 'Ton indice (round ' + state.round + ')' }),
        el('div', { class: 'mt' }, [
          input,
        ]),
        el('button', { class: 'btn green block mt', text: 'Envoyer', onclick: () => sendHint(input) }),
      ]))
    } else {
      app.appendChild(card([
        el('h3', { text: 'À toi de jouer quand ce sera ton tour' }),
        el('p', { class: 'sub', text: 'Réfléchis à tes indices…' }),
      ]))
    }
  }

  // Indices déjà donnés
  const hCard = hintsCard()
  if (hCard) app.appendChild(hCard)

  if (state.host === myId) {
    app.appendChild(el('button', { class: 'btn secondary block mt', text: '🛑 Terminer la partie (vote)', onclick: () => socket.emit('endGame') }))
  }
}

function collectHints() {
  const hints = []
  for (const p of state.players) {
    const h = state.hints[p.id] || []
    h.forEach((text, i) => hints.push({ name: p.name, text, round: i + 1 }))
  }
  return hints
}

function hintsCard() {
  const hints = collectHints()
  if (!hints.length) return null
  return card([
    el('h3', { text: 'Indices donnés' }),
    el('div', { class: 'hints-list' }, hints.map((h) =>
      el('div', { class: 'hint-item' }, [
        el('span', { class: 'who', text: h.name + ' · R' + h.round }),
        el('span', { class: 'text', text: h.text }),
      ])
    )),
  ])
}

function sendHint(input) {
  const value = input.value.trim()
  if (!value) return
  socket.emit('hint', value, (res) => {
    if (!res.ok) alert(res.error)
  })
}

/* ---------- VOTING ---------- */
function renderVoting() {
  app.innerHTML = ''
  const isArbitre = state.myRole === 'arbitre'
  const hasVoted = state.haveVoted.includes(myId)

  app.appendChild(el('div', { class: 'center' }, [
    el('h1', { text: '🗳️ Vote final' }),
    el('p', { class: 'sub', text: 'Qui est l’imposteur ?' }),
  ]))

  const hCard = hintsCard()
  if (hCard) app.appendChild(hCard)

  if (isArbitre) {
    app.appendChild(card([
      el('h3', { text: 'Tu observes' }),
      el('p', { class: 'sub', text: 'Tu connais l’imposteur, tu ne votes pas.' }),
      el('p', { class: 'sub mt', text: state.voteOptions.length - state.haveVoted.length + ' joueur(s) n’ont pas encore voté' }),
    ]))
    return
  }

  app.appendChild(card([
    el('h3', { text: hasVoted ? 'Ton vote est enregistré' : 'Choisis qui éliminer' }),
    el('div', { class: 'vote-grid' }, state.voteOptions.map((p) =>
      el('button', { class: 'vote-btn', disabled: hasVoted, onclick: () => socket.emit('vote', p.id) }, [
        el('span', { text: p.name }),
        hasVoted && state.haveVoted.includes(myId) ? null : el('span', { class: 'badge', text: 'Éliminer' }),
      ])
    )),
    el('p', { class: 'sub mt', text: state.voteOptions.length - state.haveVoted.length + ' joueur(s) n’ont pas encore voté' }),
  ]))
}

/* ---------- MODE ENCHÈRES ---------- */
const PHASES = ['encheres', 'debat', 'vote', 'results']
const PHASE_LABELS = ['Enchères', 'Débat', 'Vote', 'Résultat']

function phaseBar(current) {
  const idx = PHASES.indexOf(current)
  return el('div', { class: 'phase-bar' }, PHASES.map((p, i) =>
    el('div', { class: 'phase-step' + (i <= idx ? ' done' : '') + (i === idx ? ' current' : '') }, [
      el('span', { class: 'phase-dot', text: String(i + 1) }),
      el('span', { class: 'phase-label', text: PHASE_LABELS[i] }),
    ])
  ))
}

function teamSlots(team, target) {
  const slots = []
  for (let i = 0; i < target; i++) {
    const c = team[i]
    slots.push(c
      ? el('div', { class: 'team-slot filled' }, [
        c.image ? el('img', { src: c.image, alt: c.name }) : null,
        el('span', { class: 'team-name', text: c.name }),
      ])
      : el('div', { class: 'team-slot empty', text: '…' }))
  }
  return el('div', { class: 'team-grid' }, slots)
}

function allTeams() {
  const a = state.auction
  return el('div', { class: 'teams-list' }, state.players.map((p) => {
    const team = a.teams[p.id] || []
    return el('div', { class: 'team-block' }, [
      el('div', { class: 'team-head' }, [el('span', { text: p.name })]),
      teamSlots(team, a.target),
    ])
  }))
}

function renderEncheres() {
  app.innerHTML = ''
  const a = state.auction
  const done = a.myTeam.length >= a.target
  const isMyTurn = a.current?.turnId === myId

  app.appendChild(phaseBar('encheres'))

  if (a.current) {
    const c = a.current.char
    const bidder = state.players.find((p) => p.id === a.current.bidderId)
    const turnName = state.players.find((p) => p.id === a.current.turnId)?.name
    app.appendChild(card([
      el('div', { class: 'auction-head' }, [
        el('div', { class: 'auction-char' }, [
          c.image ? el('img', { src: c.image, alt: c.name }) : null,
          el('div', { class: 'auction-char-info' }, [
            el('div', { class: 'name', text: c.name }),
            el('div', { class: 'anime', text: c.anime }),
          ]),
        ]),
        el('div', { class: 'auction-turn' }, [
          el('span', { class: 'timer-label', text: 'C’est à' }),
          el('span', { class: 'auction-turn-name', text: isMyTurn ? 'toi' : turnName }),
        ]),
      ]),
      el('div', { class: 'auction-bid-status' }, [
        a.current.bid > 0
          ? el('p', { text: '💰 ' + (bidder?.name || '?') + ' : ' + a.current.bid + '€' })
          : el('p', { class: 'muted', text: 'Aucune enchère pour l’instant.' }),
      ]),
      done ? null : (isMyTurn ? bidControls() : el('p', { class: 'sub mt', text: 'Attends ton tour pour miser ou passer.' })),
    ]))
  }

  app.appendChild(card([
    el('div', { class: 'wallet-row' }, [
      el('span', { text: 'Ton portefeuille' }),
      el('span', { class: 'wallet', text: a.myWallet + '€' }),
    ]),
    el('h3', { class: 'mt', text: 'Ton équipe (' + a.myTeam.length + '/' + a.target + ')' }),
    teamSlots(a.myTeam, a.target),
    done ? el('div', { class: 'done-banner mt', text: 'Ton équipe est complète (ou ton budget est épuisé). Tu attends la fin des enchères.' }) : null,
  ]))

  app.appendChild(card([
    el('h3', { text: 'Les joueurs' }),
    el('ul', { class: 'player-list' }, state.players.map((p) =>
      el('li', {}, [
        el('span', { class: 'dot citoyen' }),
        el('span', { text: p.name }),
        el('span', { class: 'count-badge', text: (a.wallets[p.id] ?? '?') + '€ · ' + (a.teamsCount[p.id] ?? 0) + '/4' }),
      ])
    )),
  ]))

  if (a.sold.length) {
    app.appendChild(card([
      el('h3', { text: 'Dernières ventes' }),
      el('div', { class: 'sold-list' }, a.sold.slice(-6).reverse().map((s) =>
        el('div', { class: 'sold-item' }, [
          el('span', { class: 'who', text: s.buyerName }),
          el('span', { class: 'text', text: s.char.name + ' · ' + s.price + '€' }),
        ])
      )),
    ]))
  }
}

function bidControls() {
  const a = state.auction
  const min = a.current.bid + 1
  const max = a.myWallet
  if (min > max) {
    return el('div', { class: 'mt' }, [
      el('p', { class: 'sub', text: 'L’enchère dépasse ton budget : tu ne peux que passer.' }),
      el('button', { class: 'btn secondary block mt', text: 'Passer', onclick: () => socket.emit('pass', (res) => { if (!res.ok) alert(res.error) }) }),
    ])
  }
  const input = el('input', { type: 'number', class: 'bid-input', min: 1, max, value: min })
  const place = (amt) => {
    amt = Math.max(min, Math.min(max, amt))
    input.value = amt
    socket.emit('bid', amt, (res) => { if (!res.ok) alert(res.error) })
  }
  return el('div', { class: 'mt' }, [
    el('div', { class: 'bid-row' }, [
      input,
      el('button', { class: 'btn green', text: 'Enchérir', onclick: () => place(parseInt(input.value, 10) || min) }),
      a.current.bid > 0
        ? el('button', { class: 'btn secondary', text: 'Passer', onclick: () => socket.emit('pass', (res) => { if (!res.ok) alert(res.error) }) })
        : (a.mySkips > 0
          ? el('button', { class: 'btn secondary', text: 'Skipper (' + a.mySkips + (a.mySkips > 1 ? ' restants' : ' restant') + ')', onclick: () => socket.emit('skip', (res) => { if (!res.ok) alert(res.error) }) })
          : null),
    ]),
    a.current.bid === 0
      ? el('p', { class: 'sub mt', text: a.mySkips > 0 ? 'Personne n’a misé : mets au moins 1€ ou utilise ton skip pour changer de personnage.' : 'Personne n’a misé : tu dois lancer les enchères avec au moins 1€.' })
      : null,
    el('div', { class: 'bid-chips mt' }, [
      el('button', { class: 'chip', text: '+1', onclick: () => place((parseInt(input.value, 10) || min) + 1) }),
      el('button', { class: 'chip', text: '+5', onclick: () => place((parseInt(input.value, 10) || min) + 5) }),
      el('button', { class: 'chip', text: 'Max (' + max + '€)', onclick: () => place(max) }),
    ]),
  ])
}

function renderDebat() {
  app.innerHTML = ''
  app.appendChild(phaseBar('debat'))
  app.appendChild(el('div', { class: 'center' }, [
    el('h1', { text: '💬 Débat' }),
    el('p', { class: 'sub mt', text: 'Chacun a son équipe. Débattez : qui a la meilleure force de combat ?' }),
  ]))
  app.appendChild(card([el('h3', { text: 'Les équipes' }), allTeams()]))
  if (state.host === myId) {
    app.appendChild(el('div', { class: 'mt' }, [
      el('button', { class: 'btn big block', text: '🗳️ Passer au vote', onclick: () => socket.emit('startVote') }),
    ]))
  } else {
    app.appendChild(el('p', { class: 'sub mt center', text: 'Le créateur lancera le vote quand le débat sera fini.' }))
  }
}

function renderVoteEncheres() {
  app.innerHTML = ''
  const hasVoted = state.haveVoted.includes(myId)
  app.appendChild(phaseBar('vote'))
  app.appendChild(el('div', { class: 'center' }, [
    el('h1', { text: '🗳️ Vote final' }),
    el('p', { class: 'sub mt', text: 'Quelle équipe est la plus forte ?' }),
  ]))
  app.appendChild(card([el('h3', { text: 'Les équipes' }), allTeams()]))
  app.appendChild(card([
    el('h3', { text: hasVoted ? 'Ton vote est enregistré' : 'Qui gagne ?' }),
    el('div', { class: 'vote-grid' }, state.voteOptions.map((p) =>
      el('button', { class: 'vote-btn', disabled: hasVoted, onclick: () => socket.emit('voteAuction', p.id) }, [
        el('span', { text: p.name + (p.id === myId ? ' (toi)' : '') }),
        hasVoted ? null : el('span', { class: 'badge', text: 'Élire' }),
      ])
    )),
    el('p', { class: 'sub mt', text: state.voteOptions.length - state.haveVoted.length + ' joueur(s) n’ont pas encore voté' }),
  ]))
}

function renderResultsEncheres() {
  app.innerHTML = ''
  const r = state.results
  const winner = r.players.find((p) => p.id === r.winnerId)
  app.appendChild(phaseBar('results'))
  app.appendChild(el('div', { class: 'winner-banner citoyens' }, [
    el('div', { text: '🏆 ' + (winner?.name || 'Égalité') + ' remporte le vote !' }),
    el('div', { class: 'small', style: 'font-weight:500;margin-top:6px', text: 'La meilleure équipe de combat' }),
  ]))
  app.appendChild(card([
    el('h3', { text: 'Résultat du vote' }),
    el('ul', { class: 'player-list' }, r.players.map((p) =>
      el('li', {}, [
        el('span', { class: 'dot ' + (p.id === r.winnerId ? 'host' : 'citoyen') }),
        el('span', { text: p.name + (p.id === r.winnerId ? ' 👑' : '') }),
        el('span', { class: 'count-badge', text: (r.counts[p.id] || 0) + ' voix' }),
      ])
    )),
  ]))
  app.appendChild(card([
    el('h3', { text: 'Les équipes' }),
    el('div', { class: 'teams-list' }, r.players.map((p) =>
      el('div', { class: 'team-block' }, [
        el('div', { class: 'team-head' }, [el('span', { text: p.name })]),
        teamSlots(p.team, r.target || 4),
      ])
    )),
  ]))
  if (state.host === myId) {
    app.appendChild(el('div', { class: 'mt' }, [
      el('button', { class: 'btn big block', text: '🔁 Rejouer dans cette salle', onclick: () => socket.emit('restart') }),
    ]))
  } else {
    app.appendChild(el('p', { class: 'sub mt center', text: 'Le créateur va relancer une partie…' }))
  }
}

/* ---------- RESULTS (imposteur) ---------- */
function renderResults() {
  app.innerHTML = ''
  const r = state.results
  app.appendChild(el('div', { class: 'winner-banner ' + (r.winner === 'citoyens' ? 'citoyens' : 'imposteurs') }, [
    el('div', { text: r.winner === 'citoyens' ? '🎉 Les citoyens gagnent !' : '😈 Les imposteurs gagnent !' }),
    el('div', { class: 'small', style: 'font-weight:500;margin-top:6px', text: r.detail }),
  ]))

  app.appendChild(card([
    el('h3', { text: 'Le personnage à trouver' }),
    el('div', { class: 'char-card mt' }, [
      r.reference?.image ? el('img', { src: r.reference.image, alt: r.reference.name }) : null,
      el('div', {}, [
        el('div', { class: 'name', text: r.reference?.name }),
        el('div', { class: 'anime', text: r.reference?.anime }),
      ]),
    ]),
    el('h3', { class: 'mt', text: 'L’imposteur' }),
    el('div', { class: 'char-card mt' }, [
      r.imposteur?.image ? el('img', { src: r.imposteur.image, alt: r.imposteur.name }) : null,
      el('div', {}, [
        el('div', { class: 'name', text: r.imposteur?.name }),
        el('div', { class: 'anime', text: r.imposteur?.anime }),
        el('span', { class: 'tag imposteur', text: 'IMPOSTEUR' }),
      ]),
    ]),
  ]))

  app.appendChild(card([
    el('h3', { text: 'Rôles' }),
    el('ul', { class: 'player-list' }, r.players.map((p) =>
      el('li', {}, [
        el('span', { class: 'dot ' + (p.isImposteur ? 'imposteur' : 'citoyen') }),
        el('span', { text: p.name }),
        el('span', { class: 'count-badge', text: p.isImposteur ? '😈 imposteur' : '😇 citoyen' }),
      ])
    )),
  ]))

  if (state.host === myId) {
    app.appendChild(el('div', { class: 'mt' }, [
      el('button', { class: 'btn big block', text: '🔁 Rejouer dans cette salle', onclick: () => socket.emit('restart') }),
    ]))
  } else {
    app.appendChild(el('p', { class: 'sub mt center', text: 'Le créateur va relancer une partie…' }))
  }
}

/* ---------- SOCKET ---------- */
socket.on('connect', () => { myId = socket.id })

socket.on('state', (s) => {
  state = s
  render()
})

render()
