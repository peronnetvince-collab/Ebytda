# EBYTDA V31.1 — TRADING DESK • RESPONSIVE DUBAÏ NUIT

**Base réelle utilisée :** EBYTDA_Crypto_IA_V31_1_TRADINGVIEW_INTEGRE.zip, reprise complète, non reconstruite de zéro.

**Nouveauté uniquement UI :** responsive mobile/tablette/desktop + fond Dubaï de nuit discret provenant d'une illustration IA EBYTDA existante (crop skyline sans texte), fichier local `assets/dubai-night-ai.webp`, CSS isolé `responsive-dubai.css`. Les sources JS, Trading Desk et Netlify Functions V31.1 ne sont pas modifiées.

**Déploiement GitHub → Netlify :** décompresser puis mettre les fichiers DIRECTEMENT à la racine du dépôt (`index.html`, `styles.css`, `responsive-dubai.css`, `app.js`, `broker-connect.js`, `functions/`, `assets/`, `netlify.toml`). Publication `.` ; les fonctions sont dans `functions`. Aucun nouveau paramètre d’environnement.

**Trading Desk V31 préservé :** graphique TradingView intégré + ouverture externe, ordres de simulation PAPER, Day/Week, journal local. **Aucun ordre réel** (les fonctions live et auto restent verrouillées côté serveur). L'AutoPilot V30 existant reste simulé. Ne pas présenter l'authentification de démonstration comme une sécurité de production.

**Test :** `node --test tests/broker-core.test.js`; `node --check app.js && node --check broker-connect.js`.

---

# EBYTDA V31.1 — TRADING DESK • RESPONSIVE DUBAÏ NUIT

**Base réelle utilisée :** EBYTDA_Crypto_IA_V31_1_TRADINGVIEW_INTEGRE.zip, reprise complète, non reconstruite de zéro.

**Nouveauté uniquement UI :** responsive mobile/tablette/desktop + fond Dubaï de nuit discret provenant d'une illustration IA EBYTDA existante (crop skyline sans texte), fichier local `assets/dubai-night-ai.webp`, CSS isolé `responsive-dubai.css`. Les sources JS, Trading Desk et Netlify Functions V31.1 ne sont pas modifiées.

**Déploiement GitHub → Netlify :** décompresser puis mettre les fichiers DIRECTEMENT à la racine du dépôt (`index.html`, `styles.css`, `responsive-dubai.css`, `app.js`, `broker-connect.js`, `functions/`, `assets/`, `netlify.toml`). Publication `.` ; les fonctions sont dans `functions`. Aucun nouveau paramètre d’environnement.

**Trading Desk V31 préservé :** graphique TradingView intégré + ouverture externe, ordres de simulation PAPER, Day/Week, journal local. **Aucun ordre réel** (les fonctions live et auto restent verrouillées côté serveur). L'AutoPilot V30 existant reste simulé. Ne pas présenter l'authentification de démonstration comme une sécurité de production.

**Test :** `node --test tests/broker-core.test.js`; `node --check app.js && node --check broker-connect.js`.

---

# EBYTDA V31.1 — BROKER CONNECT + TRADINGVIEW • PAPER TEST / LIVE OFF

**Point de départ conservé :** archive EBYTDA_Crypto_IA_V30_FORCE_CORE.zip (17 septembre 2026).

## Ce qui est ajouté, sans supprimer le moteur V30

- Onglet **Trading Desk V31** dans le menu privé.
- Bouton « Ouvrir dans le Trading Desk » depuis la fiche IA de l'actif sélectionné.
- Reprise en lecture seule des dix actifs classés et de l'actif sélectionné du moteur V30.
- Trading **Day** (15 min–24 h) et **Week** (2–7 j) comme horizons du nouveau ticket V31.
- Ticket Spot Achat/Vente d'actifs détenus, montant 10 à 1 000 USDT (seuils d'essai), marché/limite simulé.
- Prévisualisation de la quantité et des frais estimés (proxy papier V30, 0,436666... % un côté).
- Simulation et journal indépendant V31 : stockage **local au navigateur** uniquement.
- Graphique TradingView intégré, chargé automatiquement à l'ouverture de l'onglet Trading Desk. Choix de la place graphique Binance / Bitget / Kraken / Coinbase, paire USDT et intervalle. Bouton **Ouvrir TradingView ↗** vers le graphique officiel dans un autre onglet. Le graphique tiers **ne transmet pas d'ordres**.
- Endpoints Netlify Functions en démonstration pour statut, prévisualisation, simulation. Les deux endpoints d'exécution réelle/automatique renvoient toujours 403.

**Le moteur V30, son AutoPilot, ses positions et son historique n'ont pas été remplacés.** `app.js` reçoit uniquement une passerelle de lecture ; `styles.css` et `functions/marketdata.js` sont conservés.

## DÉMARRAGE

### Démo immédiate — sans backend

Ouvrir `index.html` dans un navigateur ou le fichier `EBYTDA_V31_APERCU_AUTONOME.html` fourni séparément. La prévisualisation et le journal sont **simulés localement** ; le badge indique « TEST LOCAL • SANS SERVER ». Le widget TradingView demande une connexion Internet et peut être bloqué par les protections navigateur. Le bouton « Ouvrir TradingView ↗ » reste utilisable si l'intégration est bloquée. La place de cotation choisie pour le graphique ne constitue pas une connexion à un compte de trading.

Le code de connexion historique V30 **est une authentification FRONT-END DE DÉMONSTRATION**. Ne mettez pas de clés API, de données de compte sensibles ou de vrais ordres dans cette interface.

### Version Netlify — prévisualisation côté serveur

Importer le dossier racine de ce ZIP dans un dépôt GitHub ; configurer Netlify pour déployer le dépôt : répertoire de publication `.` et répertoire de fonctions `functions` via `netlify.toml`. Alternative : `netlify deploy --build --prod` après configuration CLI du site.

**Un simple drag & drop statique peut ne pas déployer les Netlify Functions.** Le statut montrera alors TEST LOCAL au lieu de SERVER TEST DISPONIBLE.

Endpoints :
- `GET /.netlify/functions/broker-status` → statut PAPER_ONLY.
- `POST /.netlify/functions/broker-preview` → prévisualisation sans ordre.
- `POST /.netlify/functions/broker-paper-order` → `SIMULATED_NOT_EXECUTED`, sans persistance serveur ni broker.
- `ANY /.netlify/functions/broker-live-order` → 403.
- `ANY /.netlify/functions/broker-auto-order` → 403.

### Tests automatisés

`node --test tests/broker-core.test.js`

## PAS DE TRADING RÉEL DANS LA V31

Les clés d'API ne sont ni collectées ni chargées : aucun broker n'est connecté. Le `LIVE` visible dans le moteur V30 signifie uniquement **données de marché**, jamais solde broker ou exécution. Le bouton d'ordre réel est désactivé et le serveur refuse tout ordre réel indépendamment de l'interface, des paramètres reçus ou des variables d'environnement.

Le SELL Spot désigne la vente de cryptoactifs déjà détenus. Aucun short, levier, marge ou dérivé n'est branché. Les niveaux stop et objectif sont **indicatifs**, aucun ordre de protection n'est réellement placé. Prix et frais sont des estimations et peuvent différer du futur broker. Un ordre de type LIMIT dans V31 est un ticket de simulation, pas un carnet d'ordres.

## POUR LE PASSAGE FUTUR AU RÉEL (NON INCLUS)

1. Choisir un broker accessible à la situation et aux produits souhaités, vérifier permissions et conditions.
2. Authentifier les utilisateurs **côté serveur**, retirer le mot de passe V30 du code public, gérer des sessions sûres.
3. Conserver les secrets broker uniquement côté serveur dans un coffre adapté, permissions trading limitées et retrait interdit.
4. Implémenter un adaptateur broker officiel distinct pour symboles/tailles de lot, soldes, frais, prévisualisation, envoi, annulation, ordres partiels et réconciliation.
5. Vérifier la fraîcheur des prix côté serveur via le broker ; ne **jamais** exécuter un ordre sur un prix ou score fourni uniquement par le navigateur.
6. Limiter exposition, pertes et nombre d'ordres ; bloquer les doublons sur identifiant idempotent persistant côté serveur ; kill switch.
7. Tester historique et sandbox broker lorsque disponible, puis de très petits ordres **manuellement confirmés** avant d'étudier un automate permanent côté serveur.

**Ne pas « activer » le réel en retirant simplement `disabled` ou en changeant une variable d'environnement.** La V31 n'a volontairement aucune implémentation de transmission d'ordres ni de gestion de soldes authentiques : il faudrait développer et auditer un nouveau module serveur.

## INVENTAIRE IMPORTANT

```
index.html                         V30 + nouvel onglet V31
app.js                             V30 original + lecture seule EBYTDA_V31_BRIDGE
styles.css                         IDENTIQUE V30
functions/marketdata.js            IDENTIQUE V30
assets/*                           IDENTIQUES V30
broker-connect.js                  V31.1 : interface V31 + intégration TradingView et ouverture externe
broker-connect.css                 NOUVEAU : CSS isolé
functions/_broker-core.js          NOUVEAU : contrôle strict, simulation
functions/broker-status.js         NOUVEAU
functions/broker-preview.js        NOUVEAU
functions/broker-paper-order.js    NOUVEAU
functions/broker-live-order.js     NOUVEAU : refus 403
functions/broker-auto-order.js     NOUVEAU : refus 403
tests/broker-core.test.js          NOUVEAU
```


## Correctif V31 — skyline Dubaï VISIBLE (19/09/2026)

La feuille `dubai-vivid-v2.css` est ajoutée **en dernier** dans `index.html` pour corriger le fond précédent devenu quasiment invisible sous des dégradés opaques. Elle pose directement l'image `assets/dubai-night-ai.webp` comme fond du hero et ajoute des bandes photographiques distinctes sur l'accueil et dans le Dashboard, sans placer de photo sur les cartes de données. Symboles BTC décoratifs. Aucun changement de l'algorithme ou des ordres.

### Déployer sur GitHub

Avec le ZIP de mise à jour : remplacer `index.html`, ajouter `dubai-vivid-v2.css` à la racine, vérifier que `assets/dubai-night-ai.webp` existe dans `assets/`. Conserver `styles.css`, `responsive-dubai.css`, `app.js`, les fonctions et tous les autres fichiers. Si la V31 initiale n'est pas encore déployée, prendre le ZIP COMPLET à la place.

Le CSS nouveau est référencé avec un paramètre de version distinct pour éviter de servir l'ancienne feuille en cache.
