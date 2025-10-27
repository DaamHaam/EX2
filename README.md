# diff-belgique-tp

Application React (Vite) en français pour suivre le jeu des différences Belgique vs France. Elle fonctionne hors-ligne, s’installe en PWA et synchronise les points via Supabase Realtime.

## Prérequis

- Node.js 18+
- npm 9+

## Installation & scripts

```bash
npm install
npm run dev     # lance Vite en mode développement
npm run build   # construit la version de production
npm run preview # prévisualise la build (nécessaire pour tester la PWA)
```

> Astuce : `npm run preview` démarre un serveur statique avec le service worker actif. Utilisez-le pour vérifier le mode hors-ligne.

## Fonctionnalités principales

- **Tableau de score en direct** : boutons tactiles `+1` / `-1`, appui long pour ajouter un commentaire (prérempli à « Correction » pour les retraits), mise à jour optimiste immédiate.
- **Historique** : liste antéchronologique (commentaire + horodatage local), suppression d’une ligne ou annulation du dernier point de chaque enfant.
- **Supabase** : lecture/écriture sur `games`, `players`, `points` et vue `scores`. Realtime écoute `public.points` pour propager les changements des autres appareils.
- **Mode hors-ligne** :
  - Cache IndexedDB pour joueurs / scores / 200 derniers points.
  - File FIFO de mutations : si une écriture Supabase échoue (offline), elle est stockée et rejouée automatiquement au retour du réseau.
  - Bannière d’état indiquant la connexion et la vidange de la file.
- **PWA** : manifest + service worker « offline-first », stratégie `network-first` pour les pages, `stale-while-revalidate` pour `/assets/**`, détection d’une nouvelle version avec bouton « Actualiser ».

## Changer de partie

Le code de partie par défaut est `BELGFR`. Pour en utiliser un autre :

1. Modifiez la constante `GAME_CODE` dans `src/App.jsx`.
2. Ajustez éventuellement la liste `DEFAULT_PLAYERS` (mêmes prénoms qu’en base, initialisés à 4 points).
3. Déployez la base correspondante (RLS désactivée, ne jamais exposer la clé `service_role`).

## File hors-ligne

- Les mutations sont stockées dans l’IndexedDB `diff-belgique-tp`, store `mutations`.
- L’événement `online` déclenche `flush()` ; en cas d’échec réseau, la file reste en place jusqu’à la prochaine tentative.
- L’UI affiche le nombre d’actions en attente et la mention « Synchronisation en cours… » pendant la vidange.

## Tests manuels suggérés

1. Ouvrir deux navigateurs sur la même URL, ajouter un point : l’autre met à jour le score instantanément (Supabase Realtime).
2. Couper la connexion, ajouter / retirer des points : l’UI réagit tout de suite. Rallumer le réseau : la bannière indique la synchronisation, les données se mettent à jour.
3. Lancer `npm run preview`, installer la PWA, forcer la mise à jour lorsque la bannière « Nouvelle version disponible » apparaît.
