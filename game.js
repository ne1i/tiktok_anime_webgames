import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'characters.json'), 'utf8'))

export const ALL_ANIMES = DATA.animes
export const CHARACTERS = DATA.characters

// groupes de couleurs de cheveux "proches"
const HAIR_GROUPS = [
  ['noir', 'brun'],
  ['blond', 'roux'],
  ['rouge', 'orange', 'roux'],
  ['blanc', 'gris', 'chauve'],
  ['bleu', 'violet', 'cyan'],
  ['vert'],
  ['rose'],
]

// rôle "secondaire" est peu discriminant => poids faible
const ROLE_WEIGHT = { protagoniste: 1.2, rival: 1.2, antagoniste: 1.2, mentor: 1.0, secondaire: 0.5 }

// tempéraments opposés => pénalité
const TEMP_OPPOSITES = [
  ['joyeux', 'froid'],
  ['sang chaud', 'calme'],
  ['colérique', 'doux'],
  ['cynique', 'doux'],
]

const STOP = new Set(['de', 'le', 'la', 'les', 'ses', 'sa', 'son', 'et', 'au', 'aux', 'du', 'des', 'ou', 'pour', 'en', 'l', 'à', 'un', 'une', 'n', '1'])

const normalize = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ')

function objTokens(s) {
  return normalize(s).split(' ').filter((w) => w && !STOP.has(w))
}

function hairCloseness(h1, h2) {
  if (!h1 || !h2) return 0
  if (h1 === h2) return 1.5
  if (HAIR_GROUPS.some((g) => g.includes(h1) && g.includes(h2))) return 0.75
  return 0
}

export function similarity(a, b) {
  let score = 0
  score += hairCloseness(a.hair, b.hair)

  if (a.role && b.role && a.role === b.role) score += ROLE_WEIGHT[a.role] || 1

  if (a.temp && b.temp) {
    if (a.temp === b.temp) score += 2
    else if (TEMP_OPPOSITES.some((g) => g.includes(a.temp) && g.includes(b.temp))) score -= 1.5
  }

  if (a.objectif && b.objectif) {
    if (a.objectif === b.objectif) score += 2
    else {
      const ta = objTokens(a.objectif)
      const tb = objTokens(b.objectif)
      if (ta.some((w) => tb.includes(w))) score += 1
    }
  }

  if (a.rival && b.rival && a.rival === b.rival) score += 1
  if ((a.rival && a.rival === b.name) || (b.rival && b.rival === a.name)) score += 3

  return score
}

// choisit la PAIR (citoyen, imposteur) la plus similaire du pool
export function pickPair(pool, sameAnime) {
  let best = null
  let bestScore = -Infinity
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i]
      const b = pool[j]
      if (a.id === b.id) continue
      if (sameAnime && a.anime !== b.anime) continue
      if (!sameAnime && a.anime === b.anime) continue
      const s = similarity(a, b)
      if (s > bestScore) {
        bestScore = s
        best = [a, b]
      }
    }
  }
  if (!best) return null
  // qui est "référence" vs "imposteur" est aléatoire
  return Math.random() < 0.5 ? best : [best[1], best[0]]
}

export function pickReference(pool) {
  return pool[Math.floor(Math.random() * pool.length)]
}

export function pickImposteur(referenceChar, { sameAnime, pool }) {
  let candidates
  if (sameAnime) {
    candidates = pool.filter((c) => c.anime === referenceChar.anime && c.id !== referenceChar.id)
  } else {
    candidates = pool.filter((c) => c.anime !== referenceChar.anime && c.id !== referenceChar.id)
    if (candidates.length === 0) candidates = pool.filter((c) => c.id !== referenceChar.id)
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => similarity(b, referenceChar) - similarity(a, referenceChar))
  const bestScore = similarity(candidates[0], referenceChar)
  const tied = candidates.filter((c) => similarity(c, referenceChar) === bestScore)
  return tied[Math.floor(Math.random() * tied.length)]
}

export function buildPool(selectedAnimes) {
  if (selectedAnimes == null) return CHARACTERS.filter((c) => !c.auctionOnly)
  return CHARACTERS.filter((c) => !c.auctionOnly && selectedAnimes.includes(c.anime))
}

export function buildAuctionPool(anime) {
  return CHARACTERS.filter((c) => c.anime === anime)
}

export function countImposteurs(nPlayers, fixed) {
  if (typeof fixed === 'number' && fixed > 0) return Math.min(fixed, Math.floor((nPlayers - 1) / 2))
  return Math.max(1, Math.floor(nPlayers / 2) - 1)
}