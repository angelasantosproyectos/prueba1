// =============================================
// CONFIGURACIÓN FIREBASE
// =============================================
// ⚠️ Reemplaza estos valores con los de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =============================================
// ESTADO GLOBAL
// =============================================
let currentUser = null;
let selectedNivel = null;
let rutasDisponibles = []; // Lista de nombres de rutas

// =============================================
// AUTH: observador de sesión
// =============================================
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    const nombre = user.email.split('@')[0];
    document.getElementById('user-display').textContent = nombre;
    showScreen('screen-inicio');
    loadRutaNames();
  } else {
    currentUser = null;
    showScreen('screen-login');
  }
});

// =============================================
// LOGIN / LOGOUT
// =============================================
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  errEl.classList.add('hidden');

  if (!email || !pass) {
    errEl.textContent = 'Completa correo y contraseña.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    errEl.textContent = 'Credenciales incorrectas. Prueba con asantoshbst@gmail.com / abc123';
    errEl.classList.remove('hidden');
  }
}

function doLogout() {
  auth.signOut();
}

// =============================================
// NAVEGACIÓN
// =============================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const target = document.getElementById(id);
  target.style.display = 'flex';
  target.classList.add('active');

  // Resetear form al volver a convocar
  if (id === 'screen-convocar') {
    resetForm();
    loadRutaNames();
  }
}

// =============================================
// CARGAR NOMBRES DE RUTAS (para el desplegable)
// =============================================
async function loadRutaNames() {
  try {
    const snap = await db.collection('ruta_nombres').orderBy('nombre').get();
    rutasDisponibles = snap.docs.map(d => ({ id: d.id, nombre: d.data().nombre }));
    renderSelectRuta();
  } catch (e) {
    console.error('Error cargando nombres de ruta:', e);
  }
}

function renderSelectRuta() {
  const sel = document.getElementById('select-ruta');
  sel.innerHTML = '<option value="">— Selecciona ruta existente —</option>';
  rutasDisponibles.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.nombre;
    opt.textContent = r.nombre;
    sel.appendChild(opt);
  });
}

// =============================================
// NUEVA RUTA (añadir al desplegable y a Firestore)
// =============================================
function toggleNuevaRuta() {
  const block = document.getElementById('nueva-ruta-block');
  block.classList.toggle('hidden');
}

async function addNuevaRuta() {
  const input = document.getElementById('nueva-ruta-input');
  const nombre = input.value.trim();
  if (!nombre) return;

  // Comprobar duplicado local
  if (rutasDisponibles.find(r => r.nombre.toLowerCase() === nombre.toLowerCase())) {
    alert('Esa ruta ya existe en la lista.');
    return;
  }

  try {
    const docRef = await db.collection('ruta_nombres').add({ nombre });
    rutasDisponibles.push({ id: docRef.id, nombre });
    renderSelectRuta();

    // Seleccionarla automáticamente
    document.getElementById('select-ruta').value = nombre;

    input.value = '';
    document.getElementById('nueva-ruta-block').classList.add('hidden');
  } catch (e) {
    alert('Error al añadir la ruta: ' + e.message);
  }
}

// =============================================
// NIVEL
// =============================================
function selectNivel(btn) {
  document.querySelectorAll('.nivel-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedNivel = btn.dataset.nivel;
}

// =============================================
// CONVOCAR RUTA
// =============================================
async function convocarRuta() {
  const errEl = document.getElementById('conv-error');
  const okEl = document.getElementById('conv-ok');
  errEl.classList.add('hidden');
  okEl.classList.add('hidden');

  const nombre = document.getElementById('select-ruta').value;
  const hora = document.getElementById('conv-hora').value;
  const fecha = document.getElementById('conv-fecha').value;
  const lugarUrl = document.getElementById('conv-lugar-url').value.trim();
  const lugarDesc = document.getElementById('conv-lugar-desc').value.trim();
  const desc = document.getElementById('conv-desc').value.trim();
  const nivel = selectedNivel;

  if (!nombre) { showError(errEl, 'Selecciona o añade un nombre de ruta.'); return; }
  if (!hora) { showError(errEl, 'Indica la hora.'); return; }
  if (!fecha) { showError(errEl, 'Indica la fecha.'); return; }
  if (!lugarDesc) { showError(errEl, 'Añade una descripción del lugar.'); return; }
  if (!nivel) { showError(errEl, 'Selecciona el nivel de la ruta.'); return; }

  // Formatear fecha para mostrar: DD/MM/YYYY
  const [y, m, d] = fecha.split('-');
  const fechaDisplay = `${d}/${m}/${y}`;

  try {
    await db.collection('rutas').add({
      nombre,
      hora,
      fecha: fechaDisplay,
      fechaISO: fecha,
      lugarUrl,
      lugarDesc,
      descripcion: desc,
      nivel,
      convocadoPor: currentUser.email.split('@')[0],
      convocadoPorEmail: currentUser.email,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });

    okEl.classList.remove('hidden');
    setTimeout(() => {
      okEl.classList.add('hidden');
      resetForm();
    }, 2500);
  } catch (e) {
    showError(errEl, 'Error al guardar: ' + e.message);
  }
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function resetForm() {
  document.getElementById('select-ruta').value = '';
  document.getElementById('conv-hora').value = '';
  document.getElementById('conv-fecha').value = '';
  document.getElementById('conv-lugar-url').value = '';
  document.getElementById('conv-lugar-desc').value = '';
  document.getElementById('conv-desc').value = '';
  document.querySelectorAll('.nivel-btn').forEach(b => b.classList.remove('selected'));
  selectedNivel = null;
  document.getElementById('nueva-ruta-block').classList.add('hidden');
  document.getElementById('nueva-ruta-input').value = '';
  document.getElementById('conv-error').classList.add('hidden');
  document.getElementById('conv-ok').classList.add('hidden');
}

// =============================================
// VER RUTAS
// =============================================
async function loadRutas() {
  const listEl = document.getElementById('rutas-list');
  const emptyEl = document.getElementById('rutas-empty');
  listEl.innerHTML = '<p style="color:var(--text-muted);padding:20px">Cargando rutas...</p>';
  emptyEl.classList.add('hidden');

  try {
    const snap = await db.collection('rutas').orderBy('creadoEn', 'desc').get();

    if (snap.empty) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    listEl.innerHTML = '<div class="rutas-grid"></div>';
    const grid = listEl.querySelector('.rutas-grid');

    snap.docs.forEach((doc, i) => {
      const r = doc.data();
      const card = document.createElement('div');
      card.className = 'ruta-card';
      card.dataset.nivel = r.nivel;
      card.style.animationDelay = `${i * 0.06}s`;

      const lugarHTML = r.lugarUrl
        ? `<span class="ruta-tag lugar">📍 <a href="${r.lugarUrl}" target="_blank">${r.lugarDesc}</a></span>`
        : `<span class="ruta-tag">📍 ${r.lugarDesc}</span>`;

      card.innerHTML = `
        <p class="ruta-convocado">Convocado por <span>@${r.convocadoPor}</span></p>
        <h3 class="ruta-nombre">${r.nombre}</h3>
        <div class="ruta-meta">
          <span class="ruta-tag">🕐 ${r.hora} · ${r.fecha}</span>
          ${lugarHTML}
        </div>
        ${r.descripcion ? `<p class="ruta-desc">${r.descripcion}</p>` : ''}
        <span class="nivel-badge">${nivelLabel(r.nivel)}</span>
      `;
      grid.appendChild(card);
    });

  } catch (e) {
    listEl.innerHTML = `<p style="color:#ff5e5e;padding:20px">Error cargando rutas: ${e.message}</p>`;
  }
}

function nivelLabel(nivel) {
  const map = {
    aprendiendo: '🐣 Aprendiendo',
    principiante: '🟢 Principiante',
    medio: '🟡 Medio',
    cañero: '🔥 Cañero'
  };
  return map[nivel] || nivel;
}

// =============================================
// LOGIN ON ENTER
// =============================================
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const ls = document.getElementById('screen-login');
    if (ls.classList.contains('active')) doLogin();
  }
});
