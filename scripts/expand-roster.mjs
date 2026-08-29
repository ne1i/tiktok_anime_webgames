import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'data', 'characters.json')
const ANIMES = ['Naruto', 'One Piece', 'Dragon Ball Z', 'Bleach', 'Jujutsu Kaisen', 'Demon Slayer', "L'Attaque des Titans", 'My Hero Academia', 'Fullmetal Alchemist', 'Hunter x Hunter', 'Death Note', 'Tokyo Ghoul', 'Chainsaw Man', 'Code Geass', 'Sword Art Online', 'Black Clover', 'One Punch Man', 'Mob Psycho 100', 'Vinland Saga', 'Berserk', 'Spy x Family', 'Steins;Gate', 'Cowboy Bebop', 'Evangelion', 'Tokyo Revengers', 'Haikyuu !!', 'Frieren', 'Kaiju No. 8', "Hell's Paradise", 'Dorohedoro', 'Re:Zero', 'Solo Leveling', 'Fire Force', 'Gintama', 'Yu Yu Hakusho', 'Fairy Tail', "JoJo's Bizarre Adventure", 'Seven Deadly Sins', 'Soul Eater', 'Dr. Stone', 'Noragami', 'Dandadan', 'Boruto', 'Inuyasha', 'Akame ga Kill']

const ALIASES = {
  'Naruto': ['naruto'], 'One Piece': ['one piece'], 'Dragon Ball Z': ['dragon ball'],
  'Bleach': ['bleach'], 'Jujutsu Kaisen': ['jujutsu'], 'Demon Slayer': ['demon slayer', 'kimetsu'],
  "L'Attaque des Titans": ['attack on titan', 'shingeki'], 'My Hero Academia': ['my hero academia', 'boku no hero'],
  'Fullmetal Alchemist': ['fullmetal'], 'Hunter x Hunter': ['hunter x hunter', 'hunterxhunter'],
  'Death Note': ['death note'], 'Tokyo Ghoul': ['tokyo ghoul'], 'Chainsaw Man': ['chainsaw'],
  'Code Geass': ['code geass'], 'Sword Art Online': ['sword art online'], 'Black Clover': ['black clover'],
  'One Punch Man': ['one punch'], 'Mob Psycho 100': ['mob psycho'], 'Vinland Saga': ['vinland'],
  'Berserk': ['berserk'], 'Spy x Family': ['spy x family', 'spy family'], 'Steins;Gate': ['steins'],
  'Cowboy Bebop': ['bebop'], 'Evangelion': ['evangelion'], 'Tokyo Revengers': ['tokyo revengers'],
  'Haikyuu !!': ['haikyu'], 'Frieren': ['frieren'], 'Kaiju No. 8': ['kaiju'], "Hell's Paradise": ['hells paradise', 'jigokuraku'],
  'Dorohedoro': ['dorohedoro'], 'Re:Zero': ['re:zero', 'rezero', 're zero'], 'Solo Leveling': ['solo leveling'],
  'Fire Force': ['fire force', 'enen no shouboutai'], 'Gintama': ['gintama'],
  'Yu Yu Hakusho': ['yu yu hakusho', 'yuuyuu hakusho'], 'Fairy Tail': ['fairy tail'],
  "JoJo's Bizarre Adventure": ['jojo'], 'Seven Deadly Sins': ['seven deadly sins', 'nanatsu no taizai'],
  'Soul Eater': ['soul eater'], 'Dr. Stone': ['dr stone', 'dr.stone', 'doctor stone'],
  'Noragami': ['noragami'], 'Dandadan': ['dandadan', 'dan da dan'], 'Boruto': ['boruto'],
  'Inuyasha': ['inuyasha'], 'Akame ga Kill': ['akame ga kill'],
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

// power des personnages DÉJÀ présents (clé = nom stocké)
const POWER = {
  'Naruto Uzumaki': 72, 'Sasuke Uchiha': 74, 'Sakura Haruno': 55, 'Kakashi Hatake': 78, 'Itachi Uchiha': 90, 'Gaara': 78,
  'Luffy Monkey': 78, 'Zoro Roronoa': 75, 'Sanji': 73, 'Nami': 30, 'Shanks': 92, 'Ace Portgas': 80,
  'Gokuu Son': 98, 'Vegeta': 96, 'Piccolo': 82, 'Freeza': 94,
  'Ichigo Kurosaki': 85, 'Rukia Kuchiki': 60, 'Byakuya Kuchiki': 78, 'Kenpachi Zaraki': 88,
  'Megumi Fushiguro': 70, 'Satoru Gojou': 92, 'Nobara Kugisaki': 60,
  'Nezuko Kamado': 58, 'Zenitsu Agatsuma': 62, 'Inosuke Hashibira': 65, 'Muzan Kibutsuji': 95,
  'Eren Yeager': 78, 'Mikasa Ackerman': 75, 'Armin Arlert': 40, 'Erwin Smith': 50,
  'Izuku Midoriya': 72, 'Katsuki Bakugou': 74, 'Toshinori Yagi': 90, 'Shouto Todoroki': 72, 'Enji Todoroki': 84, 'Dabi': 70,
  'Edward Elric': 65, 'Alphonse Elric': 60, 'Roy Mustang': 70, 'King Bradley': 82,
  'Gon Freecss': 62, 'Killua Zoldyck': 70, 'Hisoka Morow': 78, 'Kurapika': 60,
  'Light Yagami': 30, 'L Lawliet': 30, 'Ryuk': 60,
  'Ken Kaneki': 72, 'Touka Kirishima': 55, 'Kishou Arima': 80,
  'Denji': 68, 'Power': 60, 'Makima': 82, 'Aki Hayakawa': 60,
  'Lelouch Lamperouge': 45, 'Suzaku Kururugi': 62, 'C.C.': 55,
  'Kazuto Kirigaya': 55, 'Asuna Yuuki': 52,
  'Asta': 75, 'Yuno': 75, 'Noelle Silva': 68,
  'Saitama': 100, 'Genos': 70, 'Garou': 88,
  'Shigeo Kageyama': 90, 'Arataka Reigen': 10, 'Ritsu Kageyama': 40,
  'Thorfinn Karlsefni': 65, 'Askeladd': 62, 'Canute Svenson': 40,
  'Guts': 82, 'Griffith': 70, 'Casca': 55,
  'Loid Forger': 55, 'Yor Forger': 58, 'Anya Forger': 5,
  'Kurisu Makise': 10, 'Rintarou Okabe': 10,
  'Spike Spiegel': 55, 'Faye Valentine': 45, 'Vicious': 58,
  'Shinji Ikari': 30, 'Rei Ayanami': 55, 'Asuka Langley Souryuu': 55,
  'Takemichi Hanagaki': 25, 'Manjirou Sano': 62, 'Ken Ryuuguji': 55,
  'Shouyou Hinata': 40, 'Tobio Kageyama': 45, 'Daichi Sawamura': 35,
  'Frieren': 85, 'Fern': 55, 'Stark': 60,
  'Kafka Hibino': 70, 'Mina Ashiro': 65,
  'Gabimaru': 68, 'Sagiri': 55,
  'Kaiman': 68, 'Nikaido': 55,
  'Subaru Natsuki': 35, 'Emilia': 55, 'Rem': 58,
  'Jin-U Seong': 92, 'Hae-In Cha': 60,
  'Shinra Kusakabe': 70, 'Akitaru Oubi': 60,
  'Gintoki Sakata': 60, 'Kagura': 65,
}

// [nom de recherche, anime, cheveux, rôle, tempérament, objectif, rival, power]
const NEW = [
  ['Hinata Hyuuga', 'Naruto', 'brun', 'secondaire', 'doux', 'protéger ses proches', '', 52],
  ['Rock Lee', 'Naruto', 'noir', 'secondaire', 'sang chaud', 'devenir le plus fort', '', 55],
  ['Shikamaru Nara', 'Naruto', 'noir', 'secondaire', 'calme', 'protéger ses proches', '', 58],
  ['Minato Namikaze', 'Naruto', 'blond', 'mentor', 'calme', 'protéger ses proches', '', 86],
  ['Madara Uchiha', 'Naruto', 'noir', 'antagoniste', 'froid', 'régner ou dominer', '', 96],
  ['Obito Uchiha', 'Naruto', 'noir', 'antagoniste', 'froid', 'régner ou dominer', '', 88],
  ['Jiraiya', 'Naruto', 'blanc', 'mentor', 'joyeux', 'chercher la vérité', '', 82],
  ['Trafalgar Law', 'One Piece', 'noir', 'secondaire', 'calme', 'liberté', '', 80],
  ['Nico Robin', 'One Piece', 'noir', 'secondaire', 'calme', 'chercher la vérité', '', 58],
  ['Jinbe', 'One Piece', 'bleu', 'secondaire', 'calme', 'protéger ses proches', '', 75],
  ['Boa Hancock', 'One Piece', 'noir', 'secondaire', 'excentrique', 'liberté', '', 72],
  ['Doflamingo', 'One Piece', 'blond', 'antagoniste', 'cynique', 'régner ou dominer', '', 84],
  ['Dracule Mihawk', 'One Piece', 'noir', 'rival', 'froid', 'devenir le plus fort', '', 95],
  ['Katakuri', 'One Piece', 'rose', 'rival', 'calme', 'protéger ses proches', '', 88],
  ['Sabo', 'One Piece', 'blond', 'secondaire', 'joyeux', 'liberté', '', 78],
  ['Toshiro Hitsugaya', 'Bleach', 'blanc', 'secondaire', 'calme', 'faire régner la justice', '', 74],
  ['Kisuke Urahara', 'Bleach', 'blond', 'mentor', 'excentrique', 'chercher la vérité', '', 80],
  ['Renji Abarai', 'Bleach', 'rouge', 'secondaire', 'sang chaud', 'devenir le plus fort', '', 68],
  ['Ulquiorra Cifer', 'Bleach', 'vert', 'antagoniste', 'froid', 'chercher la vérité', '', 82],
  ['Yuta Okkotsu', 'Jujutsu Kaisen', 'noir', 'secondaire', 'calme', 'protéger ses proches', '', 85],
  ['Maki Zenin', 'Jujutsu Kaisen', 'noir', 'secondaire', 'sérieux', 'liberté', '', 72],
  ['Toji Fushiguro', 'Jujutsu Kaisen', 'noir', 'antagoniste', 'froid', 'survivre', '', 78],
  ['Suguru Geto', 'Jujutsu Kaisen', 'noir', 'antagoniste', 'calme', 'régner ou dominer', '', 80],
  ['Reiner Braun', "L'Attaque des Titans", 'blond', 'secondaire', 'sérieux', 'survivre', '', 76],
  ['Annie Leonhart', "L'Attaque des Titans", 'blond', 'secondaire', 'froid', 'survivre', '', 72],
  ['Hange Zoe', "L'Attaque des Titans", 'brun', 'mentor', 'excentrique', 'chercher la vérité', '', 45],
  ['Zeke Yeager', "L'Attaque des Titans", 'blond', 'antagoniste', 'calme', 'liberté', '', 80],
  ['Tomura Shigaraki', 'My Hero Academia', 'blanc', 'antagoniste', 'colérique', 'régner ou dominer', '', 78],
  ['Himiko Toga', 'My Hero Academia', 'blond', 'antagoniste', 'joyeux', 'survivre', '', 62],
  ['Stain', 'My Hero Academia', 'blanc', 'antagoniste', 'froid', 'faire régner la justice', '', 65],
  ['Mirio Togata', 'My Hero Academia', 'blond', 'secondaire', 'joyeux', 'faire régner la justice', '', 74],
  ['Kanao Tsuyuri', 'Demon Slayer', 'noir', 'secondaire', 'calme', 'protéger ses proches', '', 62],
  ['Shinobu Kocho', 'Demon Slayer', 'violet', 'secondaire', 'joyeux', 'chasser les créatures', '', 70],
  ['Sanemi Shinazugawa', 'Demon Slayer', 'blanc', 'secondaire', 'colérique', 'chasser les créatures', '', 78],
  ['Muichiro Tokito', 'Demon Slayer', 'blanc', 'secondaire', 'calme', 'chasser les créatures', '', 80],
  ['Chrollo Lucilfer', 'Hunter x Hunter', 'noir', 'antagoniste', 'calme', 'survivre', '', 80],
  ['Meruem', 'Hunter x Hunter', 'blanc', 'antagoniste', 'froid', 'régner ou dominer', '', 92],
  ['Isaac Netero', 'Hunter x Hunter', 'blanc', 'mentor', 'joyeux', 'devenir le plus fort', '', 85],
  ['Leorio Paladiknight', 'Hunter x Hunter', 'noir', 'secondaire', 'joyeux', 'survivre', '', 40],
  ['Scar', 'Fullmetal Alchemist', 'noir', 'antagoniste', 'colérique', 'vengeance', '', 70],
  ['Alex Armstrong', 'Fullmetal Alchemist', 'blond', 'secondaire', 'excentrique', 'protéger ses proches', '', 60],
  ['Envy', 'Fullmetal Alchemist', 'brun', 'antagoniste', 'cynique', 'régner ou dominer', '', 65],
  ['Kobeni Higashiyama', 'Chainsaw Man', 'noir', 'secondaire', 'doux', 'survivre', '', 45],
  ['Himeno', 'Chainsaw Man', 'noir', 'secondaire', 'joyeux', 'survivre', '', 50],
  ['Reze', 'Chainsaw Man', 'blond', 'antagoniste', 'doux', 'survivre', '', 62],
  ['Tatsumaki', 'One Punch Man', 'vert', 'secondaire', 'tsundere', 'faire régner la justice', '', 80],
  ['King', 'One Punch Man', 'blond', 'secondaire', 'calme', 'survivre', '', 45],
  ['Eto Yoshimura', 'Tokyo Ghoul', 'blanc', 'antagoniste', 'excentrique', 'chercher la vérité', '', 75],
  ['Shuu Tsukiyama', 'Tokyo Ghoul', 'violet', 'secondaire', 'excentrique', 'survivre', '', 55],
  ['Beatrice', 'Re:Zero', 'blond', 'secondaire', 'tsundere', 'survivre', '', 55],
  ['Reinhard van Astrea', 'Re:Zero', 'rouge', 'secondaire', 'joyeux', 'faire régner la justice', '', 90],
  ['Himmel', 'Frieren', 'blond', 'secondaire', 'joyeux', 'protéger ses proches', '', 60],
  ['Aura', 'Frieren', 'blanc', 'antagoniste', 'froid', 'régner ou dominer', '', 68],
  ['Yusuke Urameshi', 'Yu Yu Hakusho', 'noir', 'protagoniste', 'sang chaud', 'devenir le plus fort', '', 75],
  ['Hiei', 'Yu Yu Hakusho', 'noir', 'secondaire', 'froid', 'survivre', '', 70],
  ['Kurama', 'Yu Yu Hakusho', 'rouge', 'secondaire', 'calme', 'survivre', '', 68],
  ['Natsu Dragneel', 'Fairy Tail', 'rose', 'protagoniste', 'sang chaud', 'protéger ses proches', '', 72],
  ['Erza Scarlet', 'Fairy Tail', 'rouge', 'secondaire', 'sérieux', 'protéger ses proches', '', 70],
  ['Gray Fullbuster', 'Fairy Tail', 'noir', 'secondaire', 'sérieux', 'protéger ses proches', '', 62],
  ['Jotaro Kujo', "JoJo's Bizarre Adventure", 'noir', 'protagoniste', 'froid', 'faire régner la justice', '', 70],
  ['Dio Brando', "JoJo's Bizarre Adventure", 'blond', 'antagoniste', 'froid', 'régner ou dominer', '', 78],
  ['Giorno Giovanna', "JoJo's Bizarre Adventure", 'blond', 'protagoniste', 'calme', 'régner ou dominer', '', 72],
  ['Meliodas', 'Seven Deadly Sins', 'blond', 'protagoniste', 'joyeux', 'protéger ses proches', '', 80],
  ['Escanor', 'Seven Deadly Sins', 'roux', 'secondaire', 'excentrique', 'devenir le plus fort', '', 85],
  ['Ban', 'Seven Deadly Sins', 'blanc', 'secondaire', 'joyeux', 'survivre', '', 68],
  ['Maka Albarn', 'Soul Eater', 'blond', 'protagoniste', 'sérieux', 'chasser les créatures', '', 50],
  ['Black Star', 'Soul Eater', 'bleu', 'secondaire', 'excentrique', 'devenir le plus fort', '', 55],
  ['Senku Ishigami', 'Dr. Stone', 'vert', 'protagoniste', 'calme', 'chercher la vérité', '', 30],
  ['Tsukasa Shishio', 'Dr. Stone', 'blanc', 'antagoniste', 'calme', 'régner ou dominer', '', 68],
  ['Yato', 'Noragami', 'noir', 'protagoniste', 'joyeux', 'survivre', '', 55],
  ['Bishamon', 'Noragami', 'noir', 'secondaire', 'sérieux', 'faire régner la justice', '', 60],
  ['Ken Takakura', 'Dandadan', 'noir', 'protagoniste', 'doux', 'survivre', '', 50],
  ['Momo Ayase', 'Dandadan', 'brun', 'secondaire', 'colérique', 'survivre', '', 55],
  ['Boruto Uzumaki', 'Boruto', 'blond', 'protagoniste', 'joyeux', 'protéger ses proches', '', 62],
  ['Kawaki', 'Boruto', 'noir', 'secondaire', 'froid', 'survivre', '', 65],
  ['Inuyasha', 'Inuyasha', 'blanc', 'protagoniste', 'colérique', 'protéger ses proches', '', 65],
  ['Sesshomaru', 'Inuyasha', 'blanc', 'antagoniste', 'froid', 'régner ou dominer', '', 70],
  ['Akame', 'Akame ga Kill', 'noir', 'protagoniste', 'calme', 'survivre', '', 65],
  ['Esdeath', 'Akame ga Kill', 'bleu', 'antagoniste', 'froid', 'régner ou dominer', '', 75],
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

// 1. assigne les power des existants
let updated = 0
for (const c of d.characters) {
  if (typeof POWER[c.name] === 'number') { c.power = POWER[c.name]; updated++ }
}
console.log('power assignés à', updated, 'persos existants')

// 2. ajoute les nouveaux
let added = 0, failed = 0
for (const [name, animeFr, hair, role, temp, objectif, rival, power] of NEW) {
  if (byName.has(name)) {
    const c = byName.get(name)
    if (typeof c.power !== 'number') c.power = power
    continue
  }
  const aliases = ALIASES[animeFr]
  try {
    const results = await fetchChar(name)
    let pick = results.find((c) => matchesAnime(
      (c.media?.edges || []).flatMap((e) => [e.node.title?.romaji, e.node.title?.english].filter(Boolean)),
      aliases)) || results[0]
    if (!pick) throw new Error('aucun résultat')
    d.characters.push({
      id: pick.id, name: pick.name.full, anime: animeFr, image: pick.image?.large || '',
      hair, role, temp, objectif, rival, power,
    })
    byName.set(pick.name.full, d.characters[d.characters.length - 1])
    added++
    console.log('OK', name, '->', pick.name.full, `(power ${power})`)
  } catch (e) {
    failed++
    console.error('FAIL', name, e.message)
  }
  await new Promise((x) => setTimeout(x, 1100))
}

d.animes = ANIMES.filter((a) => d.characters.some((c) => c.anime === a))
fs.writeFileSync(OUT, JSON.stringify(d, null, 2))
console.log(`\n+${added} nouveaux, ${failed} échecs — total ${d.characters.length} persos / ${d.animes.length} anime`)