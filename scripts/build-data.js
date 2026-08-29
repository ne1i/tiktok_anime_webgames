import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'data', 'characters.json')

const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const matchesAnime = (titles, aliases) => {
  for (const t of titles) {
    const tw = normalize(t).split(' ')
    for (const alias of aliases) {
      const aw = normalize(alias).split(' ')
      if (aw.every((w) => tw.includes(w))) return true
    }
  }
  return false
}

const ANIME_ALIASES = {
  'Naruto': ['naruto'],
  'One Piece': ['one piece'],
  'Dragon Ball Z': ['dragon ball'],
  'Bleach': ['bleach'],
  'Jujutsu Kaisen': ['jujutsu'],
  'Demon Slayer': ['demon slayer', 'kimetsu'],
  "L'Attaque des Titans": ['attack on titan', 'shingeki'],
  'My Hero Academia': ['my hero academia', 'boku no hero'],
  'Fullmetal Alchemist': ['fullmetal'],
  'Hunter x Hunter': ['hunter x hunter', 'hunterxhunter', 'hunter  hunter'],
  'Death Note': ['death note'],
  'Tokyo Ghoul': ['tokyo ghoul'],
  'Chainsaw Man': ['chainsaw'],
  'Code Geass': ['code geass'],
  'Sword Art Online': ['sword art online'],
  'Black Clover': ['black clover'],
  'One Punch Man': ['one punch'],
  'Mob Psycho 100': ['mob psycho'],
  'Vinland Saga': ['vinland'],
  'Berserk': ['berserk'],
  'Spy x Family': ['spy x family', 'spy family'],
  'Steins;Gate': ['steins'],
  'Cowboy Bebop': ['bebop'],
  'Evangelion': ['evangelion'],
  'Tokyo Revengers': ['tokyo revengers'],
  'Haikyuu !!': ['haikyu'],
  'Frieren': ['frieren'],
  'Kaiju No. 8': ['kaiju'],
  "Hell's Paradise": ['hells paradise', 'jigokuraku'],
  'Dorohedoro': ['dorohedoro'],
  'Re:Zero': ['re:zero', 'rezero', 're zero'],
  'Solo Leveling': ['solo leveling'],
  'Fire Force': ['fire force', 'enen no shouboutai'],
  'Gintama': ['gintama'],
}

const ENTRIES = [
  // ---- Naruto
  ['Naruto Uzumaki', 'Naruto', 'blond', 'protagoniste', 'sang chaud', 'devenir n°1', 'Sasuke'],
  ['Sasuke Uchiha', 'Naruto', 'noir', 'rival', 'froid', 'vengeance', 'Naruto'],
  ['Sakura Haruno', 'Naruto', 'rose', 'secondaire', 'sérieux', 'protéger ses proches', ''],
  ['Kakashi Hatake', 'Naruto', 'blanc', 'mentor', 'calme', 'protéger ses proches', ''],
  ['Itachi Uchiha', 'Naruto', 'noir', 'antagoniste', 'calme', 'protéger ses proches', ''],
  ['Gaara', 'Naruto', 'roux', 'rival', 'froid', 'survivre', ''],
  // ---- One Piece
  ['Monkey D. Luffy', 'One Piece', 'noir', 'protagoniste', 'joyeux', 'liberté', ''],
  ['Roronoa Zoro', 'One Piece', 'vert', 'secondaire', 'sérieux', 'devenir n°1', ''],
  ['Sanji', 'One Piece', 'blond', 'secondaire', 'excentrique', 'liberté', ''],
  ['Nami', 'One Piece', 'orange', 'secondaire', 'sérieux', 'liberté', ''],
  ['Shanks', 'One Piece', 'rouge', 'mentor', 'calme', 'liberté', ''],
  ['Portgas D. Ace', 'One Piece', 'noir', 'secondaire', 'joyeux', 'liberté', ''],
  // ---- Dragon Ball Z
  ['Son Goku', 'Dragon Ball Z', 'noir', 'protagoniste', 'joyeux', 'devenir le plus fort', 'Vegeta'],
  ['Vegeta', 'Dragon Ball Z', 'noir', 'rival', 'colérique', 'devenir le plus fort', 'Goku'],
  ['Piccolo', 'Dragon Ball Z', 'vert', 'mentor', 'calme', 'protéger ses proches', ''],
  ['Freezer', 'Dragon Ball Z', 'blanc', 'antagoniste', 'froid', 'régner ou dominer', ''],
  // ---- Bleach
  ['Ichigo Kurosaki', 'Bleach', 'orange', 'protagoniste', 'sang chaud', 'protéger ses proches', ''],
  ['Rukia Kuchiki', 'Bleach', 'noir', 'secondaire', 'sérieux', 'protéger ses proches', ''],
  ['Byakuya Kuchiki', 'Bleach', 'noir', 'rival', 'froid', 'faire régner la justice', ''],
  ['Sōsuke Aizen', 'Bleach', 'brun', 'antagoniste', 'calme', 'régner ou dominer', ''],
  ['Kenpachi Zaraki', 'Bleach', 'noir', 'secondaire', 'sang chaud', 'devenir le plus fort', ''],
  // ---- Jujutsu Kaisen
  ['Yuji Itadori', 'Jujutsu Kaisen', 'rose', 'protagoniste', 'joyeux', 'protéger ses proches', ''],
  ['Megumi Fushiguro', 'Jujutsu Kaisen', 'noir', 'secondaire', 'calme', 'protéger ses proches', ''],
  ['Satoru Gojo', 'Jujutsu Kaisen', 'blanc', 'mentor', 'excentrique', 'faire régner la justice', ''],
  ['Ryomen Sukuna', 'Jujutsu Kaisen', 'rose', 'antagoniste', 'froid', 'régner ou dominer', ''],
  ['Nobara Kugisaki', 'Jujutsu Kaisen', 'orange', 'secondaire', 'excentrique', 'survivre', ''],
  // ---- Demon Slayer
  ['Tanjiro Kamado', 'Demon Slayer', 'roux', 'protagoniste', 'doux', 'protéger ses proches', ''],
  ['Nezuko Kamado', 'Demon Slayer', 'noir', 'secondaire', 'doux', 'protéger ses proches', ''],
  ['Zenitsu Agatsuma', 'Demon Slayer', 'blond', 'secondaire', 'excentrique', 'survivre', ''],
  ['Inosuke Hashibira', 'Demon Slayer', 'noir', 'secondaire', 'sang chaud', 'devenir le plus fort', ''],
  ['Kyojuro Rengoku', 'Demon Slayer', 'roux', 'secondaire', 'sang chaud', 'chasser les créatures', ''],
  ['Muzan Kibutsuji', 'Demon Slayer', 'noir', 'antagoniste', 'froid', 'survivre', ''],
  // ---- Attack on Titan
  ['Eren Yeager', "L'Attaque des Titans", 'noir', 'protagoniste', 'sang chaud', 'liberté', ''],
  ['Mikasa Ackerman', "L'Attaque des Titans", 'noir', 'secondaire', 'froid', 'protéger ses proches', ''],
  ['Levi Ackerman', "L'Attaque des Titans", 'noir', 'mentor', 'froid', 'protéger l’humanité', ''],
  ['Armin Arlert', "L'Attaque des Titans", 'blond', 'secondaire', 'calme', 'survivre', ''],
  ['Erwin Smith', "L'Attaque des Titans", 'blond', 'mentor', 'sérieux', 'chercher la vérité', ''],
  // ---- My Hero Academia
  ['Izuku Midoriya', 'My Hero Academia', 'vert', 'protagoniste', 'doux', 'devenir n°1', 'Bakugo'],
  ['Katsuki Bakugo', 'My Hero Academia', 'blond', 'rival', 'colérique', 'devenir n°1', 'Deku'],
  ['All Might', 'My Hero Academia', 'blond', 'mentor', 'joyeux', 'faire régner la justice', ''],
  ['Shoto Todoroki', 'My Hero Academia', 'blanc', 'secondaire', 'froid', 'protéger ses proches', ''],
  ['Endeavor', 'My Hero Academia', 'rouge', 'mentor', 'colérique', 'devenir n°1', ''],
  ['Dabi', 'My Hero Academia', 'blanc', 'antagoniste', 'cynique', 'vengeance', ''],
  // ---- Fullmetal Alchemist
  ['Edward Elric', 'Fullmetal Alchemist', 'blond', 'protagoniste', 'sang chaud', 'chercher la vérité', ''],
  ['Alphonse Elric', 'Fullmetal Alchemist', 'blond', 'secondaire', 'calme', 'chercher la vérité', ''],
  ['Roy Mustang', 'Fullmetal Alchemist', 'noir', 'secondaire', 'calme', 'faire régner la justice', ''],
  ['King Bradley', 'Fullmetal Alchemist', 'gris', 'antagoniste', 'froid', 'régner ou dominer', ''],
  // ---- Hunter x Hunter
  ['Gon Freecss', 'Hunter x Hunter', 'vert', 'protagoniste', 'joyeux', 'devenir le plus fort', ''],
  ['Killua Zoldyck', 'Hunter x Hunter', 'blanc', 'secondaire', 'calme', 'liberté', ''],
  ['Hisoka', 'Hunter x Hunter', 'rose', 'antagoniste', 'excentrique', 'devenir le plus fort', ''],
  ['Kurapika', 'Hunter x Hunter', 'blond', 'secondaire', 'sérieux', 'vengeance', ''],
  // ---- Death Note
  ['Light Yagami', 'Death Note', 'brun', 'protagoniste', 'froid', 'régner ou dominer', ''],
  ['L Lawliet', 'Death Note', 'noir', 'rival', 'excentrique', 'faire régner la justice', ''],
  ['Ryuk', 'Death Note', 'noir', 'secondaire', 'cynique', 'survivre', ''],
  // ---- Tokyo Ghoul
  ['Ken Kaneki', 'Tokyo Ghoul', 'blanc', 'protagoniste', 'doux', 'survivre', ''],
  ['Touka Kirishima', 'Tokyo Ghoul', 'violet', 'secondaire', 'colérique', 'survivre', ''],
  ['Kishou Arima', 'Tokyo Ghoul', 'noir', 'antagoniste', 'froid', 'chasser les créatures', ''],
  // ---- Chainsaw Man
  ['Denji', 'Chainsaw Man', 'blond', 'protagoniste', 'joyeux', 'survivre', ''],
  ['Power', 'Chainsaw Man', 'blond', 'secondaire', 'excentrique', 'survivre', ''],
  ['Makima', 'Chainsaw Man', 'rose', 'antagoniste', 'froid', 'régner ou dominer', ''],
  ['Aki Hayakawa', 'Chainsaw Man', 'noir', 'secondaire', 'sérieux', 'vengeance', ''],
  // ---- Code Geass
  ['Lelouch Lamperouge', 'Code Geass', 'noir', 'protagoniste', 'calme', 'régner ou dominer', ''],
  ['Suzaku Kururugi', 'Code Geass', 'vert', 'rival', 'sérieux', 'paix', ''],
  ['C.C.', 'Code Geass', 'vert', 'secondaire', 'cynique', 'survivre', ''],
  // ---- Sword Art Online
  ['Kirito', 'Sword Art Online', 'noir', 'protagoniste', 'calme', 'survivre', ''],
  ['Asuna', 'Sword Art Online', 'orange', 'secondaire', 'sérieux', 'survivre', ''],
  // ---- Black Clover
  ['Asta', 'Black Clover', 'blond', 'protagoniste', 'sang chaud', 'devenir n°1', 'Yuno'],
  ['Yuno', 'Black Clover', 'noir', 'rival', 'calme', 'devenir n°1', 'Asta'],
  ['Noelle Silva', 'Black Clover', 'blond', 'secondaire', 'tsundere', 'devenir le plus fort', ''],
  // ---- One Punch Man
  ['Saitama', 'One Punch Man', 'chauve', 'protagoniste', 'calme', 'devenir le plus fort', ''],
  ['Genos', 'One Punch Man', 'blond', 'secondaire', 'sérieux', 'vengeance', ''],
  ['Garou', 'One Punch Man', 'noir', 'antagoniste', 'colérique', 'devenir le plus fort', ''],
  // ---- Mob Psycho 100
  ['Shigeo Kageyama', 'Mob Psycho 100', 'noir', 'protagoniste', 'calme', 'devenir le plus fort', ''],
  ['Arataka Reigen', 'Mob Psycho 100', 'noir', 'mentor', 'excentrique', 'survivre', ''],
  ['Ritsu Kageyama', 'Mob Psycho 100', 'brun', 'secondaire', 'sérieux', 'chercher la vérité', ''],
  // ---- Vinland Saga
  ['Thorfinn', 'Vinland Saga', 'blond', 'protagoniste', 'froid', 'vengeance', ''],
  ['Askeladd', 'Vinland Saga', 'blond', 'antagoniste', 'calme', 'survivre', ''],
  ['Canute', 'Vinland Saga', 'blond', 'secondaire', 'calme', 'régner ou dominer', ''],
  // ---- Berserk
  ['Guts', 'Berserk', 'noir', 'protagoniste', 'sang chaud', 'vengeance', ''],
  ['Griffith', 'Berserk', 'blanc', 'antagoniste', 'calme', 'régner ou dominer', ''],
  ['Casca', 'Berserk', 'noir', 'secondaire', 'sérieux', 'protéger ses proches', ''],
  // ---- Spy x Family
  ['Loid Forger', 'Spy x Family', 'blond', 'protagoniste', 'calme', 'protéger ses proches', ''],
  ['Yor Forger', 'Spy x Family', 'noir', 'secondaire', 'doux', 'survivre', ''],
  ['Anya Forger', 'Spy x Family', 'rose', 'secondaire', 'joyeux', 'survivre', ''],
  // ---- Steins;Gate
  ['Rintaro Okabe', 'Steins;Gate', 'noir', 'protagoniste', 'excentrique', 'chercher la vérité', ''],
  ['Kurisu Makise', 'Steins;Gate', 'roux', 'secondaire', 'tsundere', 'chercher la vérité', ''],
  // ---- Cowboy Bebop
  ['Spike Spiegel', 'Cowboy Bebop', 'vert', 'protagoniste', 'calme', 'survivre', ''],
  ['Faye Valentine', 'Cowboy Bebop', 'vert', 'secondaire', 'excentrique', 'survivre', ''],
  ['Vicious', 'Cowboy Bebop', 'noir', 'antagoniste', 'froid', 'régner ou dominer', ''],
  // ---- Evangelion
  ['Shinji Ikari', 'Evangelion', 'noir', 'protagoniste', 'calme', 'survivre', ''],
  ['Rei Ayanami', 'Evangelion', 'bleu', 'secondaire', 'froid', 'chercher la vérité', ''],
  ['Asuka Langley', 'Evangelion', 'roux', 'secondaire', 'tsundere', 'devenir le plus fort', ''],
  // ---- Tokyo Revengers
  ['Takemichi Hanagaki', 'Tokyo Revengers', 'noir', 'protagoniste', 'doux', 'protéger ses proches', ''],
  ['Mikey Sano', 'Tokyo Revengers', 'noir', 'rival', 'excentrique', 'régner ou dominer', ''],
  ['Ken Ryuguji', 'Tokyo Revengers', 'blond', 'secondaire', 'calme', 'protéger ses proches', ''],
  // ---- Haikyuu !!
  ['Shoyo Hinata', 'Haikyuu !!', 'orange', 'protagoniste', 'joyeux', 'devenir n°1', 'Kageyama'],
  ['Tobio Kageyama', 'Haikyuu !!', 'noir', 'rival', 'froid', 'devenir n°1', 'Hinata'],
  ['Daichi Sawamura', 'Haikyuu !!', 'noir', 'mentor', 'sérieux', 'protéger ses proches', ''],
  // ---- Frieren
  ['Frieren', 'Frieren', 'blanc', 'protagoniste', 'calme', 'chercher la vérité', ''],
  ['Fern', 'Frieren', 'violet', 'secondaire', 'calme', 'protéger ses proches', ''],
  ['Stark', 'Frieren', 'rouge', 'secondaire', 'joyeux', 'devenir le plus fort', ''],
  // ---- Kaiju No. 8
  ['Kafka Hibino', 'Kaiju No. 8', 'brun', 'protagoniste', 'joyeux', 'protéger l’humanité', ''],
  ['Mina Ashiro', 'Kaiju No. 8', 'noir', 'secondaire', 'froid', 'protéger l’humanité', ''],
  // ---- Hell's Paradise
  ['Gabimaru', "Hell's Paradise", 'noir', 'protagoniste', 'calme', 'liberté', ''],
  ['Sagiri', "Hell's Paradise", 'noir', 'secondaire', 'sérieux', 'faire régner la justice', ''],
  // ---- Dorohedoro
  ['Caiman', 'Dorohedoro', 'blanc', 'protagoniste', 'sang chaud', 'vengeance', ''],
  ['Nikaido', 'Dorohedoro', 'noir', 'secondaire', 'joyeux', 'survivre', ''],
  // ---- Re:Zero
  ['Subaru Natsuki', 'Re:Zero', 'noir', 'protagoniste', 'excentrique', 'protéger ses proches', ''],
  ['Emilia', 'Re:Zero', 'blanc', 'secondaire', 'doux', 'liberté', ''],
  ['Rem', 'Re:Zero', 'bleu', 'secondaire', 'tsundere', 'protéger ses proches', ''],
  // ---- Solo Leveling
  ['Sung Jin-woo', 'Solo Leveling', 'noir', 'protagoniste', 'calme', 'devenir le plus fort', ''],
  // ---- Fire Force
  ['Shinra Kusakabe', 'Fire Force', 'noir', 'protagoniste', 'joyeux', 'faire régner la justice', ''],
  ['Akitaru Obi', 'Fire Force', 'noir', 'mentor', 'sérieux', 'protéger l’humanité', ''],
  // ---- Gintama
  ['Gintoki Sakata', 'Gintama', 'gris', 'protagoniste', 'excentrique', 'survivre', ''],
  ['Kagura', 'Gintama', 'orange', 'secondaire', 'joyeux', 'survivre', ''],
]

const QUERY = `
query ($name: String) {
  Page(page: 1, perPage: 8) {
    characters(search: $name) {
      id
      name { full }
      image { large }
      media(perPage: 6, sort: POPULARITY_DESC) {
        edges { node { title { romaji english } } }
      }
    }
  }
}`

const fetchChar = async (name) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { name } }),
    })
    if (res.status === 429) {
      const wait = 3000 + attempt * 2500
      console.log(`  429, retry dans ${wait}ms...`)
      await new Promise((r) => setTimeout(r, wait))
      continue
    }
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`AniList ${res.status}: ${t.slice(0, 200)}`)
    }
    const json = await res.json()
    return json.data?.Page?.characters || []
  }
  throw new Error('429 persistant')
}

const run = async () => {
  const characters = []
  const animesOrder = []
  let failed = 0

  for (const [name, animeFr, hair, role, temp, objectif, rival] of ENTRIES) {
    const aliases = ANIME_ALIASES[animeFr]
    try {
      const results = await fetchChar(name)
      let pick = null
      for (const c of results) {
        const titles = (c.media?.edges || []).map((e) => [e.node.title?.romaji, e.node.title?.english].filter(Boolean))
        const titleList = titles.flat()
        if (matchesAnime(titleList, aliases)) { pick = c; break }
      }
      if (!pick && results.length > 0) {
        const titlesAll = results.flatMap((c) =>
          (c.media?.edges || []).flatMap((e) => [e.node.title?.romaji, e.node.title?.english].filter(Boolean))
        )
        if (matchesAnime(titlesAll, aliases)) pick = results[0]
      }
      if (!pick) pick = results[0]
      if (!pick) throw new Error('aucun résultat')
      if (!animesOrder.includes(animeFr)) animesOrder.push(animeFr)
      characters.push({
        id: pick.id,
        name: pick.name.full,
        anime: animeFr,
        image: pick.image?.large || '',
        hair,
        role,
        temp,
        objectif,
        rival,
      })
      console.log(`OK  ${name} -> ${pick.name.full} (${pick.image?.large ? 'img' : 'NO IMG'})`)
    } catch (e) {
      failed++
      console.error(`FAIL ${name}: ${e.message}`)
    }
    await new Promise((r) => setTimeout(r, 1100))
  }

  if (failed > 0) console.error(`\n${failed} échec(s)`)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ animes: animesOrder, characters }, null, 2))
  console.log(`\n${characters.length} personnages / ${animesOrder.length} anime -> ${OUT}`)
}

run()
