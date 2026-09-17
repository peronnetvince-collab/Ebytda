# EBYTDA Crypto IA V9 — RealSim Cumulative 300

Simulation cumulative de portefeuille sur les 300 plus grosses capitalisations CoinGecko.

## Logique automatique
- scan de décision toutes les 15 minutes
- suivi des prix des positions ouvertes toutes les 60 secondes
- au minimum le meilleur candidat disponible du cycle est ouvert si les sécurités du moteur sont validées et qu'une place est libre
- positions additionnelles uniquement sur consensus plus fort
- maximum 10 positions simultanées
- 100 USDC de marge par ordre
- LONG et SHORT
- levier IA 1x à 5x
- stop volatilité, TP1, TP2, sortie IA et horizon avec prolongation jusqu'à 5 jours

## Capital cumulatif
Aucun reset automatique en V9.
Capital total = 3 000 USDC + P&L réalisé des positions clôturées + P&L latent des positions ouvertes.
À chaque clôture, la marge est libérée et le gain/perte net nourrit immédiatement le capital disponible.

## Important
Cette version reste du paper trading. Elle n'envoie aucun ordre réel aux brokers.
