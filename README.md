# EBYTDA V23 — MULTI-SOURCE AUTO

Version destinée à éviter qu'un rate-limit CoinGecko ou une clé Twelve absente ne bloque tout le moteur.

## Architecture données

- **CoinPaprika** = source principale du Top 200 mature. Aucun API key nécessaire pour le coeur de cette version.
- **CoinGecko** = fallback serveur uniquement si CoinPaprika échoue. Une clé Demo/Pro Netlify reste optionnelle et améliore ce secours.
- **Binance public market-data** = rafraîchissement rapide des prix des positions et bougies quand le symbole est disponible. Aucun API key requis.
- **Frankfurter** = conversion d'affichage USD/EUR. Aucun API key requis.
- Si toutes les sources d'univers échouent, le dernier snapshot valide peut être affiché pendant 1 h, mais **aucune nouvelle position AutoPilot n'est ouverte sur un snapshot stale**.

## AutoPilot papier

- 200 cryptos ayant au moins 2 ans de données
- multi-timeframe : 15 min, 30 min, 1 h, 6 h, 12 h, 24 h, 7 j, 30 j, 1 an
- 100 USDT par position, sans levier
- objectif de noyau : 3 positions ouvertes lorsqu'un marché LIVE valide est disponible
- maximum 15 positions
- jusqu'à 5 nouvelles positions par scan
- scan IA toutes les 15 min
- mark-to-market des positions toutes les 15 s via Binance quand disponible
- pas de stop-loss fixe / take-profit fixe ; sortie selon consensus IA, momentum, continuation, P&L et horizon

## Déploiement Netlify / GitHub

Remplacer à la racine :

- `index.html`
- `styles.css`
- `app.js`
- `assets/`
- `functions/`
- `netlify.toml`

Le dossier `functions/` doit contenir `marketdata.js`.

Variables Netlify **optionnelles** :

- `COINGECKO_DEMO_API_KEY`
- ou `COINGECKO_PRO_API_KEY`

Aucune clé n'est nécessaire pour CoinPaprika/Binance/Frankfurter dans cette version.

## Important

L'AutoPilot exécute des **ordres papier/simulés uniquement**. Aucun ordre réel n'est envoyé à un broker.
