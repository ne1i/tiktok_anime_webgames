# L'Imposteur Anime

Deux jeux multijoueurs en ligne sur personnages d'anime.

## 🕵️ L'Imposteur

Un joueur (ou plus) a un personnage d'un anime, les autres ont un personnage d'un autre anime (ou du même), mais proche en apparence/caractéristiques. Chacun donne des indices, puis on vote pour démasquer l'imposteur. Deux variantes : personnages tirés automatiquement, ou l'hôte choisit lui-même les deux personnages (il devient arbitre et ne joue pas).

## 💰 Enchères

Chaque joueur a 20€. Le créateur choisit **une anime** parmi Dragon Ball Z, JoJo, One Piece et Naruto (les rosters y sont étoffés). Un personnage est proposé, on enchérit **au tour par tour** : à ton tour, tu mises le montant que tu veux ou tu passes (obligatoire de miser 1€ au minimum pour lancer). Si tu n'as pas assez pour surenchérir, tu ne peux que passer. La partie s'arrête quand tout le monde a 4 combattants ou n'a plus d'argent. Puis on débat, on vote (y compris pour sa propre équipe), et la meilleure équipe de combat gagne.

## Lancer

```bash
npm install
npm start        # ou : node server.js
```

Le serveur affiche les URLs (locale + réseau). Le port se règle avec `PORT=8080 npm start`.

## Reconstruire le dataset

Les personnages, leurs traits et leur force (`power`) sont dans `data/characters.json` (généré via l'API AniList). Pour régénérer :

```bash
npm run build-data
node scripts/expand-roster.mjs   # ajoute les persos manquants + power
```

## Tests

```bash
node test-game.mjs              # flux imposteur complet
node test-extended.mjs          # modes et cas limites imposteur
node test-replay.mjs            # rejouer + nombre de tours
node test-hostmode.mjs          # mode hôte arbitre
node test-encheres.mjs          # mode enchères (tour par tour)
node test-browser.mjs           # E2E navigateur imposteur
node test-browser-encheres.mjs  # E2E navigateur enchères
```