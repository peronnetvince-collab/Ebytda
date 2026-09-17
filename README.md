# EBYTDA Crypto IA V5 — AutoPilot 300

Cette version conserve la charte, le logo et l’organisation visuelle de la V4, avec un moteur de **paper-trading automatique**.

## Ce qui change
- Univers porté à **300 cryptos** via CoinGecko (2 pages, 250 + 50)
- Scan complet toutes les **15 minutes**
- À chaque scan : **Top 3 FOMO = 3 décisions IA**
- AutoPilot simulé : jusqu’à **10 positions simultanées**
- **100 USDC de marge par position**
- Capital initial : **3 000 USDC**
- Exemple : 10 positions x 100 USDC = 1 000 USDC engagés, environ 2 000 USDC libres avant P&L
- Levier virtuel **1× à 5×**, choisi par Risk Engine selon IA / FOMO / Quant / régime / volatilité
- Stop loss automatique
- TP1 automatique avec sécurisation de 50 %
- TP2 automatique
- Sortie automatique à horizon
- Sortie IA anticipée en cas de forte détérioration des scores
- Alerte navigateur 15 minutes avant la fenêtre de sortie
- Historique des décisions Top 3 et des positions clôturées
- Capital total et capital disponible recalculés avec P&L net
- Conversion d’affichage : USDC / EUR / OR (OR via PAXG comme proxy d’1 once troy)

## Frais simulés
La V5 utilise un **proxy moyen configurable** pour le coût aller-retour :
- Bitget Futures taker : 0,06 % par côté -> 0,12 % A/R
- eToro crypto CFD : 1 % à l’ouverture + 1 % à la fermeture -> 2,00 % A/R
- XTB : pas de taux crypto universel fixe ; proxy conservateur 0,50 % pour représenter spread/conversion potentielle dans le simulateur
- Moyenne utilisée : **(0,12 + 2,00 + 0,50) / 3 = 0,8733 % A/R**

Ce proxy ne remplace pas les frais réels : spreads, funding, swaps, conversion, statut client et instrument peuvent changer le coût réel.

## Important
**Aucun ordre réel n’est envoyé à un broker dans cette V5.**
L’AutoPilot est un simulateur/paper-trading. Pour exécuter de vrais ordres, il faudra un backend privé, des clés API chiffrées, des permissions broker limitées et des garde-fous de risque côté serveur.

## Espace personnel
- Login : `admin@ebytda.local`
- Mot de passe démo : `EBYTDA-ADMIN-2026`

## Déploiement GitHub / Netlify
Remplacer :
- `index.html`
- `styles.css`
- `app.js`
- le dossier `assets/`

Conserver les fichiers existants de configuration Netlify, domaine et redirects.
