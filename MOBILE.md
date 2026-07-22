# 📱 Moments en app native (Android maintenant, iOS plus tard)

L'app tourne dans une coque native **Capacitor** : c'est ton code React,
empaqueté en vraie application installable (icône sur l'écran d'accueil,
plein écran, pas de barre de navigateur). Le backend est déployé en ligne
pour que l'app marche partout, sans ton PC allumé.

Deux grandes étapes : **(A) déployer le backend**, puis **(B) construire l'app Android**.

---

Le backend a un [`Dockerfile`](backend/Dockerfile) : il se déploie sur
n'importe quelle plateforme (Fly.io, Railway, Koyeb, Render…). Choisis-en une.

> ⚠️ **Stockage éphémère** (vrai sur tous les plans gratuits) : la base et les
> photos sont réinitialisées quand le serveur redémarre / se met en veille.
> Parfait pour tester. La base démarre **vide** → crée ton compte dans l'app.
> Pour rendre les données permanentes, voir « Persistance » plus bas.

### Option 1 — Fly.io (Dockerfile, recommandé)

Le point crucial : **lance la commande depuis le dossier `backend/`**, pas la
racine du repo (sinon Fly ne trouve pas le Dockerfile → « Could not find a
Dockerfile »).

```bash
cd backend
fly launch            # détecte le Dockerfile, génère fly.toml. Réponds "No" au déploiement immédiat.
fly secrets set MOMENTS_SECRET=$(openssl rand -hex 32)   # sessions stables
fly deploy
```

À la fin, `fly deploy` (ou `fly open`) te donne l'URL, du type
**`https://moments-xxxx.fly.dev`**. Note-la.

### Option 2 — Railway

1. **railway.app** → New Project → Deploy from GitHub → dépôt **Moments**.
2. Dans le service : **Settings → Root Directory = `backend`**
   (Railway détecte alors le Dockerfile).
3. **Variables** : ajoute `MOMENTS_SECRET` (une longue chaîne aléatoire).
4. **Settings → Networking → Generate Domain** pour obtenir l'URL publique.

### Option 3 — Render (Blueprint)

New + → Blueprint → dépôt **Moments** → Render lit [`render.yaml`](render.yaml)
→ Apply. (Render peut demander une carte pour vérifier le compte, même en
gratuit.)

### Vérifie que ça marche

Ouvre `https://<ton-url>/api/categories` dans le navigateur → tu dois voir une
liste JSON. C'est bon, ton backend est en ligne. 🎉

---

## B. Construire l'app Android (depuis ton PC Windows)

### Prérequis (une seule fois)
- **Android Studio** : https://developer.android.com/studio
  (installe aussi le SDK Android et un JDK — Android Studio le fait tout seul).

### Étapes

```bash
cd frontend

# 1. Indique à l'app où est le backend déployé
#    Crée le fichier .env.production (voir .env.example) :
#    VITE_API_URL=https://moments-api.onrender.com

# 2. Build web + copie dans le projet Android
npm run build
npx cap sync android

# 3. Ouvre le projet dans Android Studio
npx cap open android
```

Dans **Android Studio** :
- Branche ton téléphone en USB (avec le **débogage USB** activé dans les
  options développeur), **ou** lance un émulateur.
- Clique le bouton **▶ Run**. L'app s'installe et se lance sur le téléphone.

Pour générer un **APK** à installer/partager sans câble :
- Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
- Android Studio affiche un lien « locate » → récupère `app-debug.apk`,
  envoie-le sur ton téléphone et installe-le (autorise les « sources
  inconnues »).

> À chaque changement du code React : `npm run build && npx cap sync android`,
> puis relance depuis Android Studio.

---

## C. iPhone (plus tard, sur un Mac)

Capacitor iOS **exige un Mac + Xcode** (impossible depuis Windows seul).
Le jour où tu as accès à un Mac :

```bash
cd frontend
npm install @capacitor/ios
npx cap add ios
npm run build && npx cap sync ios
npx cap open ios     # ouvre Xcode → Run sur ton iPhone
```

(Installer sur un vrai iPhone demande un compte Apple Developer — gratuit
pour tester sur ton propre appareil.)

---

## Notes

- **Appareil photo** : le bouton `+` ouvre le sélecteur natif (photo/vidéo).
  Pour une expérience caméra 100 % native, on pourra ajouter le plugin
  `@capacitor/camera` plus tard.
- **Icône de l'app** : par défaut c'est l'icône Capacitor. Pour mettre le
  logo Moments : `npm i -D @capacitor/assets`, place un PNG 1024×1024 dans
  `frontend/assets/icon.png`, puis `npx @capacitor/assets generate --android`.
- **Liens de partage** (`/s/<token>`) : ils s'ouvrent dans un navigateur et
  nécessitent que le *frontend* soit aussi hébergé en ligne. Optionnel —
  tu peux héberger `frontend/dist` sur Render (Static Site) ou Netlify et
  renseigner `VITE_PUBLIC_URL` dans `.env.production`.
- **Persistance des données** (garder base + photos entre redémarrages) :
  le backend écrit dans le dossier `MOMENTS_DATA_DIR` (défaut : racine de
  l'app). Monte un volume et pointe cette variable dessus :
  - **Fly.io** : `fly volumes create data --size 1`, puis dans `fly.toml`
    ajoute `[mounts] source="data" destination="/data"` et
    `[env] MOMENTS_DATA_DIR="/data"`.
  - **Railway** : ajoute un Volume monté sur `/data` + variable
    `MOMENTS_DATA_DIR=/data`.
