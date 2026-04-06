// =============================================
// CONFIGURACIÓN FIREBASE
// =============================================
const firebaseConfig = {
  apiKey: "AIzaSyCrHNCVGF9kNpjhmjqMm5nmlF5aXHStPYg",
  authDomain: "prueba1-a0ad3.firebaseapp.com",
  projectId: "prueba1-a0ad3",
  storageBucket: "prueba1-a0ad3.firebasestorage.app",
  messagingSenderId: "885735073987",
  appId: "1:885735073987:web:1b54bd605f7b67ec445a76",
  measurementId: "G-THBB5HNVJL"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// =============================================
// ESTADO GLOBAL
// =============================================
let currentUser    = null;
let selectedNivel  = null;
let selectedNivelAjustes = null;
let rutasDisponibles = [];
let todosUsuarios  = [];
let chatActualId   = null;
let chatActualUser = null;
let mensajesListener = null;

// =============================================
// AUTH
// =============================================
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    document.getElementById('user-display').textContent = getNombre(user);
    showScreen('screen-inicio');
    loadRutaNames();
    escucharNoLeidos();
  } else {
    currentUser = null;
    showScreen('screen-login');
  }
});

function getNombre(user) {
  return user.displayName || user.email.split('@')[0];
}

function getInicial(nombre) {
  return nombre ? nombre.charAt(0).toUpperCase() : '?';
}

async function doLogin() {
  const email  = document.getElementById('login-email').value.trim();
  const pass   = document.getElementById('login-pass').value;
  const errEl  = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!email || !pass) {
    errEl.textContent = 'Completa correo y contraseña.';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    errEl.textContent = 'Credenciales incorrectas.';
    errEl.classList.remove('hidden');
  }
}

function doLogout() {
  if (mensajesListener) mensajesListener();
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
  const t = document.getElementById(id);
  t.style.display = 'flex';
  t.classList.add('active');
  if (id === 'screen-convocar') { resetForm(); loadRutaNames(); }
}

// =============================================
// RUTAS
// =============================================
async function loadRutaNames() {
  try {
    const snap = await db.collection('ruta_nombres').orderBy('nombre').get();
    rutasDisponibles = snap.docs.map(d => ({ id: d.id, nombre: d.data().nombre }));
    renderSelectRuta();
  } catch(e) { console.error(e); }
}

function renderSelectRuta() {
  const sel = document.getElementById('select-ruta');
  sel.innerHTML = '<option value="">— Selecciona ruta existente —</option>';
  rutasDisponibles.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.nombre; opt.textContent = r.nombre;
    sel.appendChild(opt);
  });
}

function toggleNuevaRuta() {
  document.getElementById('nueva-ruta-block').classList.toggle('hidden');
}

async function addNuevaRuta() {
  const input  = document.getElementById('nueva-ruta-input');
  const nombre = input.value.trim();
  if (!nombre) return;
  if (rutasDisponibles.find(r => r.nombre.toLowerCase() === nombre.toLowerCase())) {
    alert('Esa ruta ya existe.'); return;
  }
  try {
    const ref = await db.collection('ruta_nombres').add({ nombre });
    rutasDisponibles.push({ id: ref.id, nombre });
    renderSelectRuta();
    document.getElementById('select-ruta').value = nombre;
    input.value = '';
    document.getElementById('nueva-ruta-block').classList.add('hidden');
  } catch(e) { alert('Error: ' + e.message); }
}

function selectNivel(btn) {
  document.querySelectorAll('.nivel-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedNivel = btn.dataset.nivel;
}

async function convocarRuta() {
  const errEl = document.getElementById('conv-error');
  const okEl  = document.getElementById('conv-ok');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');

  const nombre   = document.getElementById('select-ruta').value;
  const hora     = document.getElementById('conv-hora').value;
  const fecha    = document.getElementById('conv-fecha').value;
  const lugarUrl = document.getElementById('conv-lugar-url').value.trim();
  const lugarDesc= document.getElementById('conv-lugar-desc').value.trim();
  const desc     = document.getElementById('conv-desc').value.trim();
  const nivel    = selectedNivel;

  if (!nombre)   { showError(errEl,'Selecciona o añade un nombre de ruta.'); return; }
  if (!hora)     { showError(errEl,'Indica la hora.'); return; }
  if (!fecha)    { showError(errEl,'Indica la fecha.'); return; }
  if (!lugarDesc){ showError(errEl,'Añade descripción del lugar.'); return; }
  if (!nivel)    { showError(errEl,'Selecciona el nivel.'); return; }

  const [y,m,d] = fecha.split('-');
  try {
    await db.collection('rutas').add({
      nombre, hora, fecha: `${d}/${m}/${y}`, fechaISO: fecha,
      lugarUrl, lugarDesc, descripcion: desc, nivel,
      convocadoPor: getNombre(currentUser),
      convocadoPorEmail: currentUser.email,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
    okEl.classList.remove('hidden');
    setTimeout(() => { okEl.classList.add('hidden'); resetForm(); }, 2500);
  } catch(e) { showError(errEl, 'Error: ' + e.message); }
}

function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }

function resetForm() {
  ['select-ruta','conv-hora','conv-fecha','conv-lugar-url','conv-lugar-desc','conv-desc']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.querySelectorAll('.nivel-btn').forEach(b => b.classList.remove('selected'));
  selectedNivel = null;
  document.getElementById('nueva-ruta-block').classList.add('hidden');
  document.getElementById('nueva-ruta-input').value = '';
  document.getElementById('conv-error').classList.add('hidden');
  document.getElementById('conv-ok').classList.add('hidden');
}

async function loadRutas() {
  const listEl  = document.getElementById('rutas-list');
  const emptyEl = document.getElementById('rutas-empty');
  listEl.innerHTML = '<p style="color:var(--text-muted);padding:20px">Cargando rutas...</p>';
  emptyEl.classList.add('hidden');
  try {
    const snap = await db.collection('rutas').orderBy('creadoEn','desc').get();
    if (snap.empty) { listEl.innerHTML=''; emptyEl.classList.remove('hidden'); return; }
    listEl.innerHTML = '<div class="rutas-grid"></div>';
    const grid = listEl.querySelector('.rutas-grid');
    snap.docs.forEach((doc,i) => {
      const r = doc.data();
      const card = document.createElement('div');
      card.className = 'ruta-card'; card.dataset.nivel = r.nivel;
      card.style.animationDelay = `${i*0.06}s`;
      const lugarHTML = r.lugarUrl
        ? `<span class="ruta-tag lugar">📍 <a href="${r.lugarUrl}" target="_blank">${r.lugarDesc}</a></span>`
        : `<span class="ruta-tag">📍 ${r.lugarDesc}</span>`;
      card.innerHTML = `
        <p class="ruta-convocado">Convocado por <span>@${r.convocadoPor}</span></p>
        <h3 class="ruta-nombre">${r.nombre}</h3>
        <div class="ruta-meta">
          <span class="ruta-tag">🕐 ${r.hora} · ${r.fecha}</span>${lugarHTML}
        </div>
        ${r.descripcion ? `<p class="ruta-desc">${r.descripcion}</p>` : ''}
        <span class="nivel-badge">${nivelLabel(r.nivel)}</span>`;
      grid.appendChild(card);
    });
  } catch(e) {
    listEl.innerHTML = `<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;
  }
}

function nivelLabel(nivel) {
  return { aprendiendo:'🐣 Aprendiendo', principiante:'🟢 Principiante',
           medio:'🟡 Medio', cañero:'🔥 Cañero' }[nivel] || nivel;
}

// =============================================
// CHATS 1A1
// =============================================

// Genera un ID de conversación único entre 2 usuarios (orden alfabético)
function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// Escucha en tiempo real cuántos mensajes no leídos hay en total
function escucharNoLeidos() {
  db.collection('chats')
    .where('participantes', 'array-contains', currentUser.uid)
    .onSnapshot(snap => {
      let total = 0;
      snap.docs.forEach(doc => {
        const data = doc.data();
        total += (data.noLeidos && data.noLeidos[currentUser.uid]) ? data.noLeidos[currentUser.uid] : 0;
      });
      const badge = document.getElementById('home-chat-badge');
      if (total > 0) {
        badge.textContent = total > 99 ? '99+' : total;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    });
}

async function loadChats() {
  const listEl  = document.getElementById('chats-list');
  const emptyEl = document.getElementById('chats-empty');
  listEl.innerHTML = '<p style="color:var(--text-muted);padding:20px">Cargando...</p>';
  emptyEl.classList.add('hidden');

  try {
    const snap = await db.collection('chats')
      .where('participantes', 'array-contains', currentUser.uid)
      .orderBy('ultimoMensajeAt', 'desc')
      .get();

    if (snap.empty) {
      listEl.innerHTML = ''; emptyEl.classList.remove('hidden'); return;
    }

    listEl.innerHTML = '';
    for (let i = 0; i < snap.docs.length; i++) {
      const chat = snap.docs[i].data();
      const chatId = snap.docs[i].id;
      // Obtener el otro participante
      const otroUid = chat.participantes.find(u => u !== currentUser.uid);
      const otroSnap = await db.collection('usuarios').doc(otroUid).get();
      const otro = otroSnap.exists ? otroSnap.data() : { nombre: otroUid, email: '' };

      const noLeidos = (chat.noLeidos && chat.noLeidos[currentUser.uid]) || 0;
      const hora = chat.ultimoMensajeAt
        ? formatHora(chat.ultimoMensajeAt.toDate())
        : '';

      const item = document.createElement('div');
      item.className = 'chat-item';
      item.style.animationDelay = `${i*0.05}s`;
      item.innerHTML = `
        <div class="chat-avatar">${getInicial(otro.nombre || otro.email)}</div>
        <div class="chat-info">
          <p class="chat-nombre">${otro.nombre || otro.email}</p>
          <p class="chat-preview">${chat.ultimoMensaje || 'Sin mensajes aún'}</p>
        </div>
        <div class="chat-meta">
          <span class="chat-time">${hora}</span>
          ${noLeidos > 0 ? `<span class="chat-unread">${noLeidos}</span>` : ''}
        </div>`;
      item.onclick = () => abrirConversacion(chatId, otroUid, otro);
      listEl.appendChild(item);
    }
  } catch(e) {
    listEl.innerHTML = `<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;
  }
}

// ---- NUEVO CHAT: cargar lista de usuarios ----
async function loadUsuarios() {
  const listEl  = document.getElementById('usuarios-list');
  const emptyEl = document.getElementById('usuarios-empty');
  listEl.innerHTML = '<p style="color:var(--text-muted);padding:16px 0">Cargando usuarios...</p>';
  emptyEl.classList.add('hidden');

  try {
    const snap = await db.collection('usuarios').get();
    todosUsuarios = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.uid !== currentUser.uid);

    renderUsuarios(todosUsuarios);
  } catch(e) {
    listEl.innerHTML = `<p style="color:#ff5e5e">Error: ${e.message}</p>`;
  }
}

function renderUsuarios(lista) {
  const listEl  = document.getElementById('usuarios-list');
  const emptyEl = document.getElementById('usuarios-empty');
  listEl.innerHTML = '';

  if (!lista.length) { emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');

  lista.forEach((u, i) => {
    const item = document.createElement('div');
    item.className = 'usuario-item';
    item.style.animationDelay = `${i*0.04}s`;
    item.innerHTML = `
      <div class="chat-avatar">${getInicial(u.nombre || u.email)}</div>
      <div class="usuario-info">
        <p class="usuario-nombre">${u.nombre || u.email.split('@')[0]}</p>
        <p class="usuario-email">${u.email}</p>
      </div>
      ${u.nivel ? `<span class="usuario-nivel">${nivelLabel(u.nivel)}</span>` : ''}`;
    item.onclick = () => iniciarChatCon(u);
    listEl.appendChild(item);
  });
}

function filtrarUsuarios() {
  const q = document.getElementById('buscar-usuario').value.toLowerCase();
  const filtrados = todosUsuarios.filter(u =>
    (u.nombre || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  );
  renderUsuarios(filtrados);
}

async function iniciarChatCon(otro) {
  const chatId = getChatId(currentUser.uid, otro.uid);
  // Crear doc de chat si no existe
  const ref = db.collection('chats').doc(chatId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      participantes: [currentUser.uid, otro.uid],
      ultimoMensaje: '',
      ultimoMensajeAt: firebase.firestore.FieldValue.serverTimestamp(),
      noLeidos: { [currentUser.uid]: 0, [otro.uid]: 0 }
    });
  }
  abrirConversacion(chatId, otro.uid, otro);
}

// ---- CONVERSACIÓN ----
async function abrirConversacion(chatId, otroUid, otroData) {
  chatActualId   = chatId;
  chatActualUser = { uid: otroUid, ...otroData };

  document.getElementById('conv-nombre-header').textContent = otroData.nombre || otroData.email;
  document.getElementById('conv-avatar').textContent = getInicial(otroData.nombre || otroData.email);

  showScreen('screen-conversacion');

  // Marcar como leído
  await db.collection('chats').doc(chatId).update({
    [`noLeidos.${currentUser.uid}`]: 0
  }).catch(() => {});

  // Cargar mensajes en tiempo real
  if (mensajesListener) mensajesListener();
  const container = document.getElementById('mensajes-container');
  container.innerHTML = '';

  mensajesListener = db.collection('chats').doc(chatId)
    .collection('mensajes')
    .orderBy('creadoEn', 'asc')
    .onSnapshot(snap => {
      renderMensajes(snap.docs, container);
      container.scrollTop = container.scrollHeight;
    });
}

function renderMensajes(docs, container) {
  container.innerHTML = '';
  let lastDay = '';

  docs.forEach(doc => {
    const m = doc.data();
    const esPropio = m.uid === currentUser.uid;
    const fecha = m.creadoEn ? m.creadoEn.toDate() : new Date();
    const dia = fecha.toLocaleDateString('es-ES', { day:'numeric', month:'long' });

    if (dia !== lastDay) {
      const sep = document.createElement('div');
      sep.className = 'msg-group-label'; sep.textContent = dia;
      container.appendChild(sep);
      lastDay = dia;
    }

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = esPropio ? 'flex-end' : 'flex-start';

    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${esPropio ? 'out' : 'in'}`;
    bubble.innerHTML = `${escapeHtml(m.texto)}<div class="msg-time">${formatHora(fecha)}</div>`;
    wrap.appendChild(bubble);
    container.appendChild(wrap);
  });
}

async function enviarMensaje() {
  const input = document.getElementById('msg-input');
  const texto = input.value.trim();
  if (!texto || !chatActualId) return;
  input.value = '';

  const mensaje = {
    texto,
    uid: currentUser.uid,
    nombre: getNombre(currentUser),
    creadoEn: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('chats').doc(chatActualId)
      .collection('mensajes').add(mensaje);

    // Actualizar resumen del chat e incrementar no leídos del otro
    await db.collection('chats').doc(chatActualId).update({
      ultimoMensaje: texto,
      ultimoMensajeAt: firebase.firestore.FieldValue.serverTimestamp(),
      [`noLeidos.${chatActualUser.uid}`]: firebase.firestore.FieldValue.increment(1)
    });
  } catch(e) {
    console.error('Error enviando mensaje:', e);
  }
}

function cerrarConversacion() {
  if (mensajesListener) { mensajesListener(); mensajesListener = null; }
  chatActualId = null; chatActualUser = null;
  showScreen('screen-chats');
  loadChats();
}

// =============================================
// AJUSTES
// =============================================
let perfilData = {};

async function loadAjustes() {
  if (!currentUser) return;
  document.getElementById('perfil-email-display').textContent = currentUser.email;

  try {
    const snap = await db.collection('usuarios').doc(currentUser.uid).get();
    if (snap.exists) {
      perfilData = snap.data();
      const nombre = perfilData.nombre || getNombre(currentUser);
      document.getElementById('aj-nombre').value = nombre;
      document.getElementById('aj-bio').value    = perfilData.bio || '';
      document.getElementById('perfil-nombre-display').textContent = nombre;
      document.getElementById('perfil-avatar-display').textContent = getInicial(nombre);
      document.getElementById('conv-avatar') && (document.getElementById('conv-avatar').textContent = getInicial(nombre));

      if (perfilData.nivel) {
        document.querySelectorAll('#screen-ajustes .nivel-btn').forEach(b => {
          b.classList.toggle('selected', b.dataset.nivel === perfilData.nivel);
        });
        selectedNivelAjustes = perfilData.nivel;
      }
    } else {
      document.getElementById('aj-nombre').value = getNombre(currentUser);
      document.getElementById('perfil-nombre-display').textContent = getNombre(currentUser);
      document.getElementById('perfil-avatar-display').textContent = getInicial(getNombre(currentUser));
    }
  } catch(e) { console.error(e); }
}

function selectNivelAj(btn) {
  document.querySelectorAll('#screen-ajustes .nivel-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedNivelAjustes = btn.dataset.nivel;
}

async function guardarPerfil() {
  const nombre    = document.getElementById('aj-nombre').value.trim();
  const bio       = document.getElementById('aj-bio').value.trim();
  const okEl      = document.getElementById('aj-ok');
  okEl.classList.add('hidden');

  if (!nombre) { alert('El nombre no puede estar vacío.'); return; }

  const nombreAnterior = getNombre(currentUser);

  try {
    const datos = {
      nombre, bio, email: currentUser.email, uid: currentUser.uid,
      ...(selectedNivelAjustes ? { nivel: selectedNivelAjustes } : {})
    };
    await db.collection('usuarios').doc(currentUser.uid).set(datos, { merge: true });
    await currentUser.updateProfile({ displayName: nombre });

    // Actualizar nombre en las rutas que convocó este usuario
    if (nombre !== nombreAnterior) {
      const rutasSnap = await db.collection('rutas')
        .where('convocadoPorEmail', '==', currentUser.email)
        .get();
      const batch = db.batch();
      rutasSnap.docs.forEach(doc => {
        batch.update(doc.ref, { convocadoPor: nombre });
      });
      if (!rutasSnap.empty) await batch.commit();
    }

    document.getElementById('user-display').textContent = nombre;
    document.getElementById('perfil-nombre-display').textContent = nombre;
    document.getElementById('perfil-avatar-display').textContent = getInicial(nombre);

    okEl.classList.remove('hidden');
    setTimeout(() => okEl.classList.add('hidden'), 2500);
  } catch(e) { alert('Error guardando perfil: ' + e.message); }
}

function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  btn.textContent = visible ? '👁️' : '🚫';
  btn.title = visible ? 'Mostrar contraseña' : 'Ocultar contraseña';
}

async function cambiarPassword() {
  const actual  = document.getElementById('aj-pass-actual').value;
  const nueva   = document.getElementById('aj-pass-nueva').value;
  const repite  = document.getElementById('aj-pass-repite').value;
  const okEl    = document.getElementById('aj-pass-ok');
  const errEl   = document.getElementById('aj-pass-err');
  okEl.classList.add('hidden'); errEl.classList.add('hidden');

  if (!actual) {
    errEl.textContent = 'Introduce tu contraseña actual.';
    errEl.classList.remove('hidden'); return;
  }
  if (nueva.length < 6) {
    errEl.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
    errEl.classList.remove('hidden'); return;
  }
  if (nueva !== repite) {
    errEl.textContent = 'Las contraseñas nuevas no coinciden.';
    errEl.classList.remove('hidden'); return;
  }
  if (actual === nueva) {
    errEl.textContent = 'La nueva contraseña debe ser diferente a la actual.';
    errEl.classList.remove('hidden'); return;
  }

  try {
    // Reautenticar con la contraseña actual antes de cambiarla
    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, actual);
    await currentUser.reauthenticateWithCredential(credential);
    await currentUser.updatePassword(nueva);

    document.getElementById('aj-pass-actual').value = '';
    document.getElementById('aj-pass-nueva').value  = '';
    document.getElementById('aj-pass-repite').value = '';
    okEl.classList.remove('hidden');
    setTimeout(() => okEl.classList.add('hidden'), 2500);
  } catch(e) {
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      errEl.textContent = 'La contraseña actual no es correcta.';
    } else if (e.code === 'auth/too-many-requests') {
      errEl.textContent = 'Demasiados intentos. Espera unos minutos.';
    } else {
      errEl.textContent = 'Error: ' + e.message;
    }
    errEl.classList.remove('hidden');
  }
}

// =============================================
// UTILIDADES
// =============================================
function formatHora(date) {
  const hoy = new Date();
  const esHoy = date.toDateString() === hoy.toDateString();
  if (esHoy) return date.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
  return date.toLocaleDateString('es-ES', { day:'numeric', month:'short' });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('screen-login').classList.contains('active')) doLogin();
  }
});
