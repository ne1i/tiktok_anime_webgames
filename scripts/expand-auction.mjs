import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'data', 'characters.json')

const ALIASES = {
  'Dragon Ball Z': ['dragon ball'],
  "JoJo's Bizarre Adventure": ['jojo'],
  'One Piece': ['one piece'],
  'Naruto': ['naruto'],
}

const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const matchesAnime = (titles, aliases) => {
  for (const t of titles) {
    const tw = normalize(t).split(' ')
    for (const a of aliases) {
      const aw = normalize(a).split(' ')
      if (aw.every((w) => tw.includes(w))) return true
    }
  }
  return false
}

// [nom, anime, cheveux, rôle, tempérament, objectif, rival, power] — tous marqués auctionOnly
const NEW = [
  // ---- Dragon Ball Z
  ['Gohan', 'Dragon Ball Z', 'noir', 'secondaire', 'doux', 'protéger ses proches', '', 75],
  ['Trunks', 'Dragon Ball Z', 'violet', 'secondaire', 'sang chaud', 'protéger ses proches', '', 72],
  ['Goten', 'Dragon Ball Z', 'noir', 'secondaire', 'joyeux', 'devenir le plus fort', '', 60],
  ['Krillin', 'Dragon Ball Z', 'noir', 'secondaire', 'joyeux', 'protéger ses proches', '', 55],
  ['Yamcha', 'Dragon Ball Z', 'noir', 'secondaire', 'joyeux', 'survivre', '', 45],
  ['Tien Shinhan', 'Dragon Ball Z', 'noir', 'secondaire', 'sérieux', 'devenir le plus fort', '', 60],
  ['Android 18', 'Dragon Ball Z', 'blond', 'secondaire', 'calme', 'survivre', '', 70],
  ['Android 17', 'Dragon Ball Z', 'noir', 'secondaire', 'froid', 'survivre', '', 70],
  ['Cell', 'Dragon Ball Z', 'vert', 'antagoniste', 'froid', 'régner ou dominer', '', 88],
  ['Majin Buu', 'Dragon Ball Z', 'rose', 'antagoniste', 'joyeux', 'survivre', '', 90],
  ['Kid Buu', 'Dragon Ball Z', 'blanc', 'antagoniste', 'colérique', 'régner ou dominer', '', 92],
  ['Beerus', 'Dragon Ball Z', 'violet', 'antagoniste', 'excentrique', 'survivre', '', 95],
  ['Whis', 'Dragon Ball Z', 'blanc', 'mentor', 'calme', 'survivre', '', 97],
  ['Broly', 'Dragon Ball Z', 'vert', 'antagoniste', 'colérique', 'régner ou dominer', '', 93],
  ['Bardock', 'Dragon Ball Z', 'noir', 'secondaire', 'sérieux', 'survivre', '', 72],
  ['Nappa', 'Dragon Ball Z', 'blond', 'secondaire', 'colérique', 'régner ou dominer', '', 60],
  ['Raditz', 'Dragon Ball Z', 'noir', 'antagoniste', 'colérique', 'régner ou dominer', '', 55],
  ['Zarbon', 'Dragon Ball Z', 'vert', 'secondaire', 'excentrique', 'survivre', '', 50],
  ['Captain Ginyu', 'Dragon Ball Z', 'violet', 'antagoniste', 'excentrique', 'régner ou dominer', '', 60],
  ['Dabura', 'Dragon Ball Z', 'rouge', 'antagoniste', 'calme', 'régner ou dominer', '', 75],
  ['Mr. Satan', 'Dragon Ball Z', 'noir', 'secondaire', 'joyeux', 'survivre', '', 5],
  ['Bulma', 'Dragon Ball Z', 'violet', 'secondaire', 'excentrique', 'survivre', '', 10],
  ['Hit', 'Dragon Ball Z', 'violet', 'antagoniste', 'froid', 'survivre', '', 90],
  ['Jiren', 'Dragon Ball Z', 'brun', 'rival', 'calme', 'devenir le plus fort', '', 92],
  ['Toppo', 'Dragon Ball Z', 'noir', 'secondaire', 'sérieux', 'faire régner la justice', '', 78],
  ['Goku Black', 'Dragon Ball Z', 'noir', 'antagoniste', 'froid', 'régner ou dominer', '', 90],
  ['Zamasu', 'Dragon Ball Z', 'vert', 'antagoniste', 'froid', 'régner ou dominer', '', 85],
  ['Kefla', 'Dragon Ball Z', 'vert', 'secondaire', 'sang chaud', 'devenir le plus fort', '', 85],
  ['Caulifla', 'Dragon Ball Z', 'noir', 'secondaire', 'sang chaud', 'devenir le plus fort', '', 78],
  ['Android 16', 'Dragon Ball Z', 'brun', 'secondaire', 'calme', 'protéger ses proches', '', 65],
  ['Chi-Chi', 'Dragon Ball Z', 'noir', 'secondaire', 'colérique', 'protéger ses proches', '', 20],
  ['Future Trunks', 'Dragon Ball Z', 'violet', 'secondaire', 'sérieux', 'protéger ses proches', '', 78],
  // ---- JoJo
  ['Joseph Joestar', "JoJo's Bizarre Adventure", 'noir', 'protagoniste', 'excentrique', 'survivre', '', 60],
  ['Jonathan Joestar', "JoJo's Bizarre Adventure", 'noir', 'protagoniste', 'doux', 'faire régner la justice', '', 55],
  ['Josuke Higashikata', "JoJo's Bizarre Adventure", 'noir', 'protagoniste', 'joyeux', 'survivre', '', 65],
  ['Jolyne Cujoh', "JoJo's Bizarre Adventure", 'vert', 'protagoniste', 'calme', 'survivre', '', 55],
  ['Johnny Joestar', "JoJo's Bizarre Adventure", 'brun', 'protagoniste', 'calme', 'survivre', '', 55],
  ['Bruno Bucciarati', "JoJo's Bizarre Adventure", 'noir', 'secondaire', 'calme', 'faire régner la justice', '', 58],
  ['Guido Mista', "JoJo's Bizarre Adventure", 'blond', 'secondaire', 'joyeux', 'survivre', '', 50],
  ['Narancia Ghirga', "JoJo's Bizarre Adventure", 'brun', 'secondaire', 'sang chaud', 'survivre', '', 45],
  ['Leone Abbacchio', "JoJo's Bizarre Adventure", 'blond', 'secondaire', 'calme', 'survivre', '', 48],
  ['Pannacotta Fugo', "JoJo's Bizarre Adventure", 'violet', 'secondaire', 'calme', 'survivre', '', 45],
  ['Kars', "JoJo's Bizarre Adventure", 'blond', 'antagoniste', 'froid', 'régner ou dominer', '', 70],
  ['Wamuu', "JoJo's Bizarre Adventure", 'rouge', 'antagoniste', 'calme', 'régner ou dominer', '', 65],
  ['Esidisi', "JoJo's Bizarre Adventure", 'blond', 'antagoniste', 'colérique', 'régner ou dominer', '', 60],
  ['Yoshikage Kira', "JoJo's Bizarre Adventure", 'blond', 'antagoniste', 'calme', 'survivre', '', 60],
  ['Diavolo', "JoJo's Bizarre Adventure", 'rose', 'antagoniste', 'froid', 'régner ou dominer', '', 62],
  ['Enrico Pucci', "JoJo's Bizarre Adventure", 'blanc', 'antagoniste', 'calme', 'régner ou dominer', '', 65],
  ['Jean Pierre Polnareff', "JoJo's Bizarre Adventure", 'blanc', 'secondaire', 'joyeux', 'survivre', '', 50],
  ['Muhammad Avdol', "JoJo's Bizarre Adventure", 'noir', 'secondaire', 'calme', 'survivre', '', 52],
  ['Noriaki Kakyoin', "JoJo's Bizarre Adventure", 'vert', 'secondaire', 'calme', 'survivre', '', 50],
  ['Rohan Kishibe', "JoJo's Bizarre Adventure", 'noir', 'secondaire', 'excentrique', 'survivre', '', 45],
  ['Koichi Hirose', "JoJo's Bizarre Adventure", 'brun', 'secondaire', 'doux', 'survivre', '', 40],
  ['Okuyasu Nijimura', "JoJo's Bizarre Adventure", 'brun', 'secondaire', 'joyeux', 'survivre', '', 40],
  ['Diego Brando', "JoJo's Bizarre Adventure", 'blond', 'antagoniste', 'froid', 'régner ou dominer', '', 60],
  ['Funny Valentine', "JoJo's Bizarre Adventure", 'blond', 'antagoniste', 'calme', 'régner ou dominer', '', 62],
  ['Trish Una', "JoJo's Bizarre Adventure", 'rose', 'secondaire', 'joyeux', 'survivre', '', 40],
  ['Weather Report', "JoJo's Bizarre Adventure", 'blond', 'secondaire', 'calme', 'survivre', '', 55],
  ['Vanilla Ice', "JoJo's Bizarre Adventure", 'blanc', 'antagoniste', 'froid', 'régner ou dominer', '', 55],
  ['Risotto Nero', "JoJo's Bizarre Adventure", 'noir', 'antagoniste', 'calme', 'survivre', '', 45],
  ['Prosciutto', "JoJo's Bizarre Adventure", 'blond', 'antagoniste', 'calme', 'survivre', '', 45],
  ['Pesci', "JoJo's Bizarre Adventure", 'roux', 'antagoniste', 'doux', 'survivre', '', 40],
  // ---- One Piece
  ['Usopp', 'One Piece', 'noir', 'secondaire', 'excentrique', 'survivre', '', 35],
  ['Tony Tony Chopper', 'One Piece', 'brun', 'secondaire', 'joyeux', 'survivre', '', 25],
  ['Franky', 'One Piece', 'bleu', 'secondaire', 'joyeux', 'survivre', '', 55],
  ['Brook', 'One Piece', 'noir', 'secondaire', 'excentrique', 'survivre', '', 50],
  ['Yamato', 'One Piece', 'blanc', 'secondaire', 'joyeux', 'liberté', '', 75],
  ['Marco', 'One Piece', 'blond', 'secondaire', 'calme', 'protéger ses proches', '', 70],
  ['Edward Newgate', 'One Piece', 'blanc', 'secondaire', 'calme', 'protéger ses proches', '', 95],
  ['Marshall D. Teach', 'One Piece', 'noir', 'antagoniste', 'excentrique', 'régner ou dominer', '', 85],
  ['Charlotte Linlin', 'One Piece', 'rose', 'antagoniste', 'excentrique', 'régner ou dominer', '', 85],
  ['Kaido', 'One Piece', 'vert', 'antagoniste', 'colérique', 'régner ou dominer', '', 92],
  ['Enel', 'One Piece', 'blanc', 'antagoniste', 'excentrique', 'régner ou dominer', '', 80],
  ['Crocodile', 'One Piece', 'blond', 'antagoniste', 'calme', 'régner ou dominer', '', 75],
  ['Rob Lucci', 'One Piece', 'noir', 'antagoniste', 'froid', 'régner ou dominer', '', 75],
  ['Kizaru', 'One Piece', 'blond', 'antagoniste', 'excentrique', 'faire régner la justice', '', 78],
  ['Aokiji', 'One Piece', 'blanc', 'antagoniste', 'calme', 'faire régner la justice', '', 78],
  ['Akainu', 'One Piece', 'rouge', 'antagoniste', 'colérique', 'faire régner la justice', '', 80],
  ['Fujitora', 'One Piece', 'violet', 'secondaire', 'doux', 'faire régner la justice', '', 76],
  ['Bartholomew Kuma', 'One Piece', 'brun', 'secondaire', 'calme', 'survivre', '', 70],
  ['Buggy', 'One Piece', 'bleu', 'secondaire', 'excentrique', 'survivre', '', 15],
  ['Arlong', 'One Piece', 'bleu', 'antagoniste', 'colérique', 'régner ou dominer', '', 45],
  ['Smoker', 'One Piece', 'blanc', 'secondaire', 'sérieux', 'faire régner la justice', '', 65],
  ['Monkey D. Garp', 'One Piece', 'blanc', 'secondaire', 'joyeux', 'faire régner la justice', '', 80],
  ['Silvers Rayleigh', 'One Piece', 'blanc', 'secondaire', 'calme', 'liberté', '', 88],
  ['Eustass Kid', 'One Piece', 'rouge', 'rival', 'colérique', 'régner ou dominer', '', 72],
  ['King', 'One Piece', 'noir', 'antagoniste', 'froid', 'régner ou dominer', '', 80],
  ['Queen', 'One Piece', 'brun', 'antagoniste', 'excentrique', 'régner ou dominer', '', 75],
  ['Jack', 'One Piece', 'brun', 'antagoniste', 'colérique', 'régner ou dominer', '', 68],
  ['Perona', 'One Piece', 'rose', 'secondaire', 'excentrique', 'survivre', '', 35],
  ['Jewelry Bonney', 'One Piece', 'brun', 'secondaire', 'joyeux', 'survivre', '', 40],
  // ---- Naruto
  ['Tsunade', 'Naruto', 'blond', 'mentor', 'calme', 'protéger ses proches', '', 72],
  ['Orochimaru', 'Naruto', 'noir', 'antagoniste', 'excentrique', 'survivre', '', 78],
  ['Kabuto Yakushi', 'Naruto', 'blanc', 'antagoniste', 'calme', 'survivre', '', 65],
  ['Neji Hyuga', 'Naruto', 'noir', 'secondaire', 'sérieux', 'protéger ses proches', '', 62],
  ['Tenten', 'Naruto', 'brun', 'secondaire', 'sérieux', 'survivre', '', 40],
  ['Shino Aburame', 'Naruto', 'noir', 'secondaire', 'calme', 'survivre', '', 45],
  ['Choji Akimichi', 'Naruto', 'noir', 'secondaire', 'joyeux', 'protéger ses proches', '', 40],
  ['Ino Yamanaka', 'Naruto', 'blond', 'secondaire', 'joyeux', 'protéger ses proches', '', 40],
  ['Asuma Sarutobi', 'Naruto', 'brun', 'mentor', 'calme', 'protéger ses proches', '', 55],
  ['Kurenai Yuhi', 'Naruto', 'noir', 'secondaire', 'calme', 'protéger ses proches', '', 45],
  ['Might Guy', 'Naruto', 'noir', 'mentor', 'joyeux', 'protéger ses proches', '', 70],
  ['Yamato', 'Naruto', 'brun', 'secondaire', 'calme', 'protéger ses proches', '', 55],
  ['Sai', 'Naruto', 'noir', 'secondaire', 'calme', 'survivre', '', 50],
  ['Danzo Shimura', 'Naruto', 'gris', 'antagoniste', 'froid', 'régner ou dominer', '', 60],
  ['Konan', 'Naruto', 'bleu', 'antagoniste', 'calme', 'protéger ses proches', '', 65],
  ['Nagato', 'Naruto', 'rouge', 'antagoniste', 'calme', 'régner ou dominer', '', 80],
  ['Deidara', 'Naruto', 'blond', 'antagoniste', 'excentrique', 'survivre', '', 70],
  ['Sasori', 'Naruto', 'rouge', 'antagoniste', 'calme', 'survivre', '', 68],
  ['Hidan', 'Naruto', 'blanc', 'antagoniste', 'excentrique', 'survivre', '', 62],
  ['Kakuzu', 'Naruto', 'blanc', 'antagoniste', 'froid', 'survivre', '', 65],
  ['Kisame', 'Naruto', 'bleu', 'antagoniste', 'froid', 'survivre', '', 68],
  ['Kimimaro', 'Naruto', 'blanc', 'antagoniste', 'froid', 'protéger ses proches', '', 60],
  ['Shisui Uchiha', 'Naruto', 'noir', 'secondaire', 'calme', 'protéger ses proches', '', 72],
  ['Hashirama Senju', 'Naruto', 'noir', 'mentor', 'joyeux', 'protéger ses proches', '', 88],
  ['Tobirama Senju', 'Naruto', 'blanc', 'mentor', 'calme', 'faire régner la justice', '', 78],
  ['Hiruzen Sarutobi', 'Naruto', 'blanc', 'mentor', 'calme', 'protéger ses proches', '', 60],
  ['Killer Bee', 'Naruto', 'blond', 'secondaire', 'joyeux', 'survivre', '', 75],
  ['Darui', 'Naruto', 'noir', 'secondaire', 'calme', 'faire régner la justice', '', 65],
  ['Mei Terumi', 'Naruto', 'brun', 'secondaire', 'calme', 'survivre', '', 60],
  ['Onoki', 'Naruto', 'gris', 'secondaire', 'calme', 'survivre', '', 65],
  ['Ay', 'Naruto', 'noir', 'secondaire', 'colérique', 'faire régner la justice', '', 72],
  ['Yahiko', 'Naruto', 'orange', 'secondaire', 'joyeux', 'protéger ses proches', '', 55],
]

const QUERY = `
query ($name: String) {
  Page(page: 1, perPage: 8) {
    characters(search: $name) {
      id
      name { full }
      image { large }
      media(perPage: 6) { edges { node { title { romaji english } } } }
    }
  }
}`

const fetchChar = async (name) => {
  for (let a = 0; a < 6; a++) {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { name } }),
    })
    if (r.status === 429) { await new Promise((x) => setTimeout(x, 4000)); continue }
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return (await r.json()).data?.Page?.characters || []
  }
  throw new Error('429')
}

const d = JSON.parse(fs.readFileSync(OUT, 'utf8'))
const byName = new Map(d.characters.map((c) => [c.name, c]))
let added = 0, failed = 0
for (const [name, animeFr, hair, role, temp, objectif, rival, power] of NEW) {
  if (byName.has(name)) { continue }
  try {
    const results = await fetchChar(name)
    const pick = results.find((c) => matchesAnime(
      (c.media?.edges || []).flatMap((e) => [e.node.title?.romaji, e.node.title?.english].filter(Boolean)),
      ALIASES[animeFr])) || results[0]
    if (!pick) throw new Error('aucun résultat')
    d.characters.push({
      id: pick.id, name: pick.name.full, anime: animeFr, image: pick.image?.large || '',
      hair, role, temp, objectif, rival, power, auctionOnly: true,
    })
    byName.set(pick.name.full, d.characters[d.characters.length - 1])
    added++
    console.log('OK', name, '->', pick.name.full)
  } catch (e) {
    failed++
    console.error('FAIL', name, e.message)
  }
  await new Promise((x) => setTimeout(x, 1100))
}

// dédup par id
const seen = new Set()
d.characters = d.characters.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
fs.writeFileSync(OUT, JSON.stringify(d, null, 2))
console.log(`\n+${added} nouveaux (enchères), ${failed} échecs — total ${d.characters.length}`)