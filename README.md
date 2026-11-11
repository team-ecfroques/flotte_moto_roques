# Flotte motos Roques

Site de gestion des motos en HTML, CSS et JavaScript, avec Firebase Realtime Database et déploiement sur GitHub Pages.

## Organisation

| Emplacement | Contenu |
| --- | --- |
| `public/index.html` | Page du site |
| `public/assets/css/` | Styles, dont la présentation mobile |
| `public/assets/js/` | Interface, validation, stockage et synchronisation Firebase |
| `public/assets/js/firebase-config.js` | Configuration Web publique Firebase |
| `firebase/database.rules.json` | Règles à publier dans la console Firebase |
| `tests/` | Tests de validation, stockage et connexion |
| `scripts/prepare-pages.mjs` | Préparation des fichiers publics pour GitHub Pages |
| `scripts/serve.py` | Serveur local sans cache, avec compatibilité des anciens chemins |
| `.github/workflows/pages.yml` | Tests et déploiement automatiques |

`dist/` est généré par la préparation du site et exclu de Git. Il ne faut pas le pousser manuellement. Les captures de référence et les anciennes règles inutilisées ont été retirées.

## Lancer le site

Prérequis : Node.js 20 ou plus récent et Python 3. Aucune dépendance npm à installer ; le SDK Firebase est chargé depuis le CDN Google.

```bash
npm start
```

Ouvrir http://localhost:8080 sur le Mac. Le serveur expose uniquement le dossier `public/`, désactive le cache HTTP et redirige les anciens chemins `/js/…` et `/styles.css` vers les ressources actuelles. Garder le terminal ouvert ; Ctrl+C arrête le serveur. Après une modification de la commande de lancement, arrêter l'ancien serveur puis relancer `npm start`.

Pour un accès limité au Mac :

```bash
npm run start:local
```

Pour tester sur iPhone, connecter les deux appareils au même Wi-Fi et ouvrir `http://ADRESSE-IP-DU-MAC:8080` dans Safari. L'adresse du Mac se trouve dans Réglages Système → Wi-Fi → Détails → TCP/IP. `localhost` sur l'iPhone désigne l'iPhone lui-même. Garder le Mac éveillé et autoriser les connexions entrantes à Python si le pare-feu le demande. Aucune redirection de port sur la box n'est nécessaire.

## Firebase

La configuration est dans `public/assets/js/firebase-config.js`. Pour changer de projet, remplacer ses valeurs, notamment `databaseURL`.

Dans la console Firebase : ouvrir Realtime Database → Règles, coller le contenu de `firebase/database.rules.json`, puis publier. Ces règles ne sont pas appliquées automatiquement par GitHub Pages.

La version actuelle fonctionne **sans comptes**. Toute personne peut consulter, ajouter, modifier et supprimer les motos et les pannes, y compris directement via l'API Firebase. Les accès sont ouverts uniquement sur `/motos`, `/faultTypes` et `/hiddenFaultTypes`. La structure, les statuts et les kilométrages restent validés. L'authentification et l'isolation entre flottes seront ajoutées dans une version ultérieure.

La configuration Web Firebase, y compris son `apiKey`, est publique et nécessaire au site. Ne jamais ajouter au dépôt de clé privée de compte de service, mot de passe, jeton GitHub ou export de données réelles. Le `.gitignore` exclut les noms de fichiers sensibles courants ; vérifier aussi le contenu des nouveaux fichiers. Les fichiers d'un dépôt GitHub public restent consultables même lorsqu'ils ne sont pas déployés sur Pages.

Si `apiKey` est vide, le site utilise le mode local de démonstration. Les données restent alors propres au navigateur. Les données locales ne sont pas transférées automatiquement dans Firebase.

## Utiliser la flotte

- Ajouter une moto avec son immatriculation, son kilométrage et, facultativement, son modèle et le kilométrage de la dernière révision.
- Changer le statut avec les voyants : disponible, réparation à prévoir ou indisponible.
- En réparation, choisir une panne ou en ajouter une nouvelle. La liste est triée par ordre alphabétique.
- Gérer les pannes sous le formulaire : retirer une panne du catalogue conserve les pannes déjà associées aux motos. Pour la rétablir, l'ajouter à nouveau depuis le choix de réparation.
- Modifier une moto ou la supprimer après confirmation. L'immatriculation reste son identifiant : pour la corriger, supprimer puis recréer la fiche.

Les actions attendent la connexion et la réception des données. Hors connexion, les nouveaux changements sont désactivés. Une écriture déjà engagée attend sa confirmation ; ne pas fermer l'onglet pendant l'enregistrement. Une modification concurrente complète du formulaire suit la règle du dernier enregistrement. Aucun historique ni sauvegarde automatique n'est intégré.

## Vérifier et préparer

```bash
npm test
npm run build
```

Les 17 tests vérifient la validation des données, la persistance locale, le chargement complet des flux Firebase, les versions des ressources publiées et les réponses HTTP du serveur local, y compris les anciens chemins. Ils ne remplacent pas une vérification des règles sur la vraie base Firebase.

La préparation crée `dist/` avec une liste explicite de neuf fichiers du site et un marqueur `.nojekyll`. Aucun fichier de règles, README, test ou export n'est copié dans le site publié. Un identifiant calculé à partir du contenu est ajouté aux URL du CSS et de tous les modules JavaScript, y compris leurs imports. Il change automatiquement quand une source change, pour empêcher le mélange de versions après déploiement.

Au premier chargement, la flotte attend les motos, les pannes personnalisées et les pannes retirées du catalogue avant de s'afficher. L'interface distingue ce chargement d'une flotte vide ou d'une perte de réseau. Si un module ne peut pas être chargé, un message et un bouton d'actualisation sont affichés. Le fichier `bootstrap.js` assure ce démarrage.

## Déployer sur GitHub Pages

1. Créer un dépôt GitHub propre à ce projet, sur la branche `main`.
2. Pousser les sources de ce dossier, notamment `public/`, `scripts/`, `tests/`, `package.json` et `.github/workflows/pages.yml`.
3. Dans le dépôt, ouvrir Settings → Pages → Build and deployment et choisir **GitHub Actions** comme source.
4. Le workflow lance les tests, prépare `dist/` puis publie le site. L'URL apparaît dans Pages et dans le résultat du déploiement.

Les chemins relatifs fonctionnent à la racine ou sous `https://VOTRE-COMPTE.github.io/NOM-DU-DEPOT/`. Aucun serveur Python n'est nécessaire en production. Avec l'envoi manuel de fichiers sur GitHub, le `.gitignore` n'applique pas automatiquement ses exclusions : sélectionner les sources, pas `dist/` ni les fichiers locaux.

Après déploiement, vérifier sur deux appareils l'ajout d'une moto, la synchronisation des voyants, les pannes personnalisées et le rechargement des données.
