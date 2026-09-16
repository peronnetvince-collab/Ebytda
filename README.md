# EBYTDA V15 — Quant + Top 3 FOMO IA

## Aperçu
- Univers : Top 100 cryptos par capitalisation boursière (CoinGecko)
- Scanner ÉCO : 1 h
- Scanner FOCUS automatique : 30 min uniquement quand le marché accélère / devient volatil
- Top 10 Algo : LONG / SHORT, score, cycle, entrée, stop, TP1/TP2, R/R
- Top 3 FOMO IA : timing d'entrée, horizon de sortie, plan d'exit, commentaire détaillé
- Ordres : confirmation manuelle après exécution sur eToro/XTB, synchro horaire, alerte de sortie persistante
- Wallet : capital initial 1 000 €, P&L latent/réalisé, historique

## Variables Netlify nécessaires
- OPENAI_API_KEY
- EBYTDA_AI_MODEL
- ADMIN_USERNAME
- ADMIN_PASSWORD
- SESSION_SECRET
- COINGECKO_API_KEY (optionnel)

Les secrets doivent être définis dans Netlify > Environment variables et disponibles pour Functions.
Ne jamais placer les clés dans index.html ou GitHub.

## Mode aperçu local
Ouvrir index.html.
Login : admin
Mot de passe : ebytda-demo
Le mode aperçu simule les données et ne consomme pas de clé OpenAI.

## Déploiement
Décompresser le ZIP à la racine du dépôt GitHub puis pousser les fichiers.
Netlify détectera netlify.toml et les Functions.

## Track Record multi-cycles
Pour les 10 candidats, EBYTDA récupère au maximum une fois par 24 h l'historique disponible et calcule 90J / 180J / 1A / 2A lorsque CoinGecko fournit assez de profondeur. Le cache navigateur évite de reconsommer ces historiques à chaque refresh.

## Cadence adaptative V15.1
- Temps calme : scan marché automatique toutes les 60 minutes.
- Marché en accélération/volatilité : passage automatique en FOCUS 30 minutes.
- Retour au calme : après 2 scans calmes consécutifs, retour automatique au mode ÉCO 1 h.
- 01:00–08:00 : aucun appel automatique marché/IA/ordres.
- Les boutons Actualiser restent utilisables manuellement pendant la plage 01:00–08:00.

## Broker — V15.2
Le bouton « Brancher le broker » propose uniquement des liens vers les pages officielles :
- Bitget
- XTB
- eToro

Aucun broker n'est privilégié dans l'interface. La connexion API réelle n'est pas activée à ce stade.

## Coût du scan Top 100
Le Top 100 tient dans une seule requête `/coins/markets`, donc le scan principal consomme 1 appel CoinGecko par cycle automatique ou actualisation manuelle.
