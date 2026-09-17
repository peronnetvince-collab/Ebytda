# EBYTDA Crypto IA V24 — CoinLore + Binance Engine

Correctif du Data Engine V23 : l’appel global CoinPaprika /tickers pouvait devenir trop lourd pour une Function Netlify et provoquer un HTTP 502.

## Architecture
- CoinLore : univers market-cap, 3 pages de 100 maximum.
- CoinLore coin/info : vérification réelle de l’ancienneté (premier prix >= 730 jours), mise en cache.
- Binance public market-data : prix positions + fenêtres 15m / 30m / 1h / 6h / 12h / 7j.
- Binance daily klines : validation MTF 14j / 30j / 200j / 1an sur les meilleurs candidats et positions ouvertes.
- AutoPilot n’ouvre aucun ordre tant que le MTF long du candidat n’est pas validé.
- Aucun CoinGecko / CoinPaprika / Twelve Data requis pour le fonctionnement principal.

## Netlify
Le dossier `functions/` doit contenir uniquement `marketdata.js`. Le `netlify.toml` pointe vers `functions`.

## Important
Paper trading uniquement. Aucun ordre réel n’est envoyé à un broker.
