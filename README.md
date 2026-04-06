# RutaSkate — Instrucciones de configuración

## 1. Configura Firebase

Abre `app.js` y reemplaza el bloque `firebaseConfig` con los datos de tu proyecto:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Puedes encontrar estos datos en Firebase Console → Configuración del proyecto → Tus apps.

---

## 2. Activa Authentication

En Firebase Console:
- Ve a **Authentication → Comenzar**
- Activa el proveedor **Correo electrónico/contraseña**
- Crea el usuario de prueba: `asantoshbst@gmail.com` / `abc123`

---

## 3. Crea las colecciones en Firestore

Crea la base de datos Firestore en modo **prueba** (o producción con reglas).

Las colecciones se crean automáticamente al usar la app:
- `rutas` — cada ruta convocada
- `ruta_nombres` — los nombres de ruta disponibles en el desplegable

**Reglas de Firestore (para desarrollo):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 4. Sube los archivos

Sube `index.html`, `style.css` y `app.js` a Vercel o Firebase Hosting tal como están.

---

## Estructura de una ruta en Firestore

```json
{
  "nombre": "Ruta Torrejonera",
  "hora": "19:30",
  "fecha": "06/04/2026",
  "fechaISO": "2026-04-06",
  "lugarUrl": "https://...",
  "lugarDesc": "Skate park Torrejón de Ardoz",
  "descripcion": "Apto para todos los públicos",
  "nivel": "principiante",
  "convocadoPor": "asantoshbst",
  "convocadoPorEmail": "asantoshbst@gmail.com",
  "creadoEn": [timestamp]
}
```
