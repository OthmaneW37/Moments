# 📱 Moments en app native (Android maintenant, iOS plus tard)

L'app tourne dans une coque native **Capacitor** : c'est ton code React,
empaqueté en vraie application installable (icône sur l'écran d'accueil,
plein écran, pas de barre de navigateur). Le backend est déployé en ligne
pour que l'app marche partout, sans ton PC allumé.

Deux grandes étapes : **(A) déployer le backend**, puis **(B) construire l'app Android**.

---

## A. Déployer le backend en ligne (Render, gratuit)

1. Va sur **https://render.com** et crée un compte (connecte ton GitHub).
2. **New + → Blueprint**.
3. Choisis le dépôt **`OthmaneW37/Moments`**. Render lit le fichier
   [`render.yaml`](render.yaml) et propose le service **moments-api**.
4. Clique **Apply**. Render installe les dépendances et lance l'API.
5. Au bout de ~2 min, tu obtiens une URL du type
   **`https://moments-api.onrender.com`**. Note-la.
6. Vérifie que ça répond : ouvre `https://<ton-url>/api/categories` dans le
   navigateur → tu dois voir une liste JSON.

> ⚠️ **Plan gratuit = stockage éphémère** : la base et les photos sont
> réinitialisées à chaque redéploiement ou mise en veille (~15 min sans
> trafic). Parfait pour tester. Pour garder les données : dans `render.yaml`,
> décommente le bloc `disk` + `MOMENTS_DATA_DIR` (nécessite un plan payant).
>
> La base démarre **vide** : crée ton compte directement depuis l'app.

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
