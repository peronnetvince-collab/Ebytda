# EBYTDA V26 — DIRECT SYNC

Correctif prioritaire des HTTP 502.

Le flux principal ne dépend plus de la Function Netlify :
- CoinPaprika DIRECT navigateur : univers Top 200 par market cap avec ≥ 2 ans (`first_data_at`).
- Binance DIRECT navigateur : prix rapides toutes les 15 s et bougies multi-timeframe.
- Netlify `functions/marketdata.js` n'est plus qu'un secours.
- Cross-check CoinPaprika/Binance avant qu'un actif soit éligible à l'AutoPilot.
- AutoPilot paper trading : 100 USDT par position, sans levier.
