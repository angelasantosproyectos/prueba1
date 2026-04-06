// ═══════════════════════════════════════════
// FIREBASE CONFIG
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════
let currentUser          = null;
let selectedNivel        = null;
let selectedNivelAjustes = null;
let selectedSexo         = null;
let rutasDisponibles     = [];
let todosUsuarios        = [];
let chatActualId         = null;
let chatActualUser       = null;
let mensajesListener     = null;
let usernameTimeout      = null;
let buscarTimeout        = null;
let todosUsuariosBuscar  = [];

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════
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

// ── LOGIN ────────────────────────────────
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!email || !pass) { errEl.textContent = 'Completa correo y contraseña.'; errEl.classList.remove('hidden'); return; }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    errEl.textContent = 'Credenciales incorrectas.'; errEl.classList.remove('hidden');
  }
}

function doLogout() {
  if (mensajesListener) mensajesListener();
  auth.signOut();
}

// ── REGISTRO ─────────────────────────────
let usernameValido = false;

function selectSexo(btn) {
  document.querySelectorAll('.sexo-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedSexo = btn.dataset.sexo;
}

async function verificarUsername() {
  clearTimeout(usernameTimeout);
  const raw    = document.getElementById('reg-username').value.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
  const status = document.getElementById('username-status');
  const hint   = document.getElementById('username-hint');
  usernameValido = false;

  document.getElementById('reg-username').value = raw;

  if (!raw || raw.length < 3) {
    status.textContent = '';
    hint.textContent = raw ? 'Mínimo 3 caracteres' : '';
    hint.style.color = 'var(--text-muted)';
    return;
  }

  status.textContent = '⏳';
  hint.textContent = 'Comprobando disponibilidad...';
  hint.style.color = 'var(--text-muted)';

  usernameTimeout = setTimeout(async () => {
    try {
      const snap = await db.collection('usuarios').where('username', '==', raw).get();
      if (snap.empty) {
        status.textContent = '✅';
        hint.textContent = '@' + raw + ' está disponible';
        hint.style.color = 'var(--accent)';
        usernameValido = true;
      } else {
        status.textContent = '❌';
        hint.textContent = '@' + raw + ' ya está en uso';
        hint.style.color = '#ff5e5e';
        usernameValido = false;
      }
    } catch(e) { status.textContent = ''; hint.textContent = ''; }
  }, 500);
}

async function doRegistro() {
  const username  = document.getElementById('reg-username').value.trim().toLowerCase();
  const email     = document.getElementById('reg-email').value.trim();
  const dia       = document.getElementById('reg-dia').value.trim();
  const mes       = document.getElementById('reg-mes').value.trim();
  const anio      = document.getElementById('reg-anio').value.trim();
  const telefono  = document.getElementById('reg-telefono').value.trim();
  const pass      = document.getElementById('reg-pass').value;
  const pass2     = document.getElementById('reg-pass2').value;
  const errEl     = document.getElementById('reg-error');
  const okEl      = document.getElementById('reg-ok');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');

  // Validaciones
  if (!username || username.length < 3) { errEl.textContent = 'El nombre de usuario debe tener al menos 3 caracteres.'; errEl.classList.remove('hidden'); return; }
  if (!usernameValido)                   { errEl.textContent = 'El nombre de usuario no está disponible o no lo has comprobado.'; errEl.classList.remove('hidden'); return; }
  if (!email)                            { errEl.textContent = 'Introduce tu correo electrónico.'; errEl.classList.remove('hidden'); return; }
  if (!dia || !mes || !anio || anio.length < 4) { errEl.textContent = 'Introduce una fecha de nacimiento válida (DD / MM / AAAA).'; errEl.classList.remove('hidden'); return; }
  if (!telefono)                         { errEl.textContent = 'Introduce tu número de teléfono.'; errEl.classList.remove('hidden'); return; }
  if (!selectedSexo)                     { errEl.textContent = 'Selecciona tu sexo.'; errEl.classList.remove('hidden'); return; }
  if (pass.length < 6)                   { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; errEl.classList.remove('hidden'); return; }
  if (pass !== pass2)                    { errEl.textContent = 'Las contraseñas no coinciden.'; errEl.classList.remove('hidden'); return; }

  try {
    // Crear usuario en Auth
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    const user = cred.user;

    // Nombre para mostrar = username
    await user.updateProfile({ displayName: username });

    // Guardar en Firestore
    await db.collection('usuarios').doc(user.uid).set({
      uid: user.uid,
      username,
      nombre: username,
      email,
      fechaNacimiento: `${dia.padStart(2,'0')}/${mes.padStart(2,'0')}/${anio}`,
      telefono,
      sexo: selectedSexo,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });

    okEl.classList.remove('hidden');
    // El onAuthStateChanged lo lleva a inicio automáticamente
  } catch(e) {
    let msg = 'Error al crear cuenta.';
    if (e.code === 'auth/email-already-in-use') msg = 'Ese correo ya está registrado.';
    if (e.code === 'auth/invalid-email')        msg = 'El correo no tiene un formato válido.';
    if (e.code === 'auth/weak-password')        msg = 'La contraseña es demasiado débil.';
    errEl.textContent = msg; errEl.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active'); s.style.display = '';
  });
  const t = document.getElementById(id);
  t.style.display = 'flex'; t.classList.add('active');
  if (id === 'screen-convocar') { resetForm(); loadRutaNames(); }
}

function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  btn.textContent = visible ? '👁️' : '🚫';
}

// ═══════════════════════════════════════════
// RUTAS
// ═══════════════════════════════════════════
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
    opt.value = r.nombre; opt.textContent = r.nombre; sel.appendChild(opt);
  });
}

function toggleNuevaRuta() { document.getElementById('nueva-ruta-block').classList.toggle('hidden'); }

async function addNuevaRuta() {
  const input  = document.getElementById('nueva-ruta-input');
  const nombre = input.value.trim();
  if (!nombre) return;
  if (rutasDisponibles.find(r => r.nombre.toLowerCase() === nombre.toLowerCase())) { alert('Esa ruta ya existe.'); return; }
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
  document.querySelectorAll('#screen-convocar .nivel-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected'); selectedNivel = btn.dataset.nivel;
}

async function convocarRuta() {
  const errEl = document.getElementById('conv-error');
  const okEl  = document.getElementById('conv-ok');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');

  const nombre    = document.getElementById('select-ruta').value;
  const hora      = document.getElementById('conv-hora').value;
  const fecha     = document.getElementById('conv-fecha').value;
  const lugarUrl  = document.getElementById('conv-lugar-url').value.trim();
  const lugarDesc = document.getElementById('conv-lugar-desc').value.trim();
  const desc      = document.getElementById('conv-desc').value.trim();
  const nivel     = selectedNivel;

  if (!nombre)    { showError(errEl,'Selecciona o añade un nombre de ruta.'); return; }
  if (!hora)      { showError(errEl,'Indica la hora.'); return; }
  if (!fecha)     { showError(errEl,'Indica la fecha.'); return; }
  if (!lugarDesc) { showError(errEl,'Añade descripción del lugar.'); return; }
  if (!nivel)     { showError(errEl,'Selecciona el nivel.'); return; }

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
  } catch(e) { showError(errEl,'Error: ' + e.message); }
}

function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }

function resetForm() {
  ['select-ruta','conv-hora','conv-fecha','conv-lugar-url','conv-lugar-desc','conv-desc']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.querySelectorAll('#screen-convocar .nivel-btn').forEach(b => b.classList.remove('selected'));
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
        <div class="ruta-meta"><span class="ruta-tag">🕐 ${r.hora} · ${r.fecha}</span>${lugarHTML}</div>
        ${r.descripcion ? `<p class="ruta-desc">${r.descripcion}</p>` : ''}
        <span class="nivel-badge">${nivelLabel(r.nivel)}</span>`;
      grid.appendChild(card);
    });
  } catch(e) {
    listEl.innerHTML = `<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;
  }
}

function nivelLabel(nivel) {
  return { aprendiendo:'🐣 Aprendiendo', principiante:'🟢 Principiante', medio:'🟡 Medio', cañero:'🔥 Cañero' }[nivel] || nivel;
}

// ═══════════════════════════════════════════
// BUSCAR USUARIOS (tiempo real)
// ═══════════════════════════════════════════
async function initBuscar() {
  document.getElementById('buscar-rt-input').value = '';
  document.getElementById('buscar-results').innerHTML = '';
  document.getElementById('buscar-empty').classList.add('hidden');
  document.getElementById('buscar-inicial').classList.remove('hidden');
  document.getElementById('buscar-clear').classList.add('hidden');

  // Precarga todos los usuarios en memoria
  try {
    const snap = await db.collection('usuarios').get();
    todosUsuariosBuscar = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.uid !== currentUser.uid);
  } catch(e) { console.error(e); }
}

function buscarTiempoReal() {
  clearTimeout(buscarTimeout);
  const q = document.getElementById('buscar-rt-input').value.trim().toLowerCase();
  const clearBtn = document.getElementById('buscar-clear');

  clearBtn.classList.toggle('hidden', !q);

  if (!q) {
    document.getElementById('buscar-results').innerHTML = '';
    document.getElementById('buscar-empty').classList.add('hidden');
    document.getElementById('buscar-inicial').classList.remove('hidden');
    return;
  }
  document.getElementById('buscar-inicial').classList.add('hidden');

  buscarTimeout = setTimeout(() => {
    const resultados = todosUsuariosBuscar.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.nombre   || '').toLowerCase().includes(q)
    );
    renderBuscarResultados(resultados);
  }, 180);
}

function renderBuscarResultados(lista) {
  const el      = document.getElementById('buscar-results');
  const emptyEl = document.getElementById('buscar-empty');
  el.innerHTML  = '';

  if (!lista.length) { emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');

  lista.forEach((u, i) => {
    const card = document.createElement('div');
    card.className = 'buscar-user-card';
    card.style.animationDelay = `${i * 0.04}s`;
    card.innerHTML = `
      <div class="chat-avatar" style="flex-shrink:0">${getInicial(u.username || u.nombre || u.email)}</div>
      <div class="buscar-user-info">
        <p class="buscar-username">@${u.username || u.nombre}</p>
        <p class="buscar-realname">${u.nombre !== u.username ? u.nombre : u.email}</p>
      </div>
      <div class="buscar-user-meta">
        ${u.nivel ? `<span class="buscar-nivel-tag">${nivelLabel(u.nivel)}</span>` : ''}
        <button class="btn-chat-mini" onclick="abrirChatDesdeResultado('${u.uid}')">💬 Chat</button>
      </div>`;
    el.appendChild(card);
  });
}

async function abrirChatDesdeResultado(uid) {
  const u = todosUsuariosBuscar.find(x => x.uid === uid);
  if (!u) return;
  await iniciarChatCon(u);
}

function limpiarBuscar() {
  document.getElementById('buscar-rt-input').value = '';
  buscarTiempoReal();
  document.getElementById('buscar-rt-input').focus();
}

// ═══════════════════════════════════════════
// CHATS 1A1
// ═══════════════════════════════════════════
function getChatId(uid1, uid2) { return [uid1, uid2].sort().join('_'); }

function escucharNoLeidos() {
  db.collection('chats')
    .where('participantes', 'array-contains', currentUser.uid)
    .onSnapshot(snap => {
      let total = 0;
      snap.docs.forEach(doc => {
        const d = doc.data();
        total += (d.noLeidos && d.noLeidos[currentUser.uid]) ? d.noLeidos[currentUser.uid] : 0;
      });
      const badge = document.getElementById('home-chat-badge');
      if (total > 0) { badge.textContent = total > 99 ? '99+' : total; badge.classList.remove('hidden'); }
      else             badge.classList.add('hidden');
    });
}

async function loadChats() {
  const listEl  = document.getElementById('chats-list');
  const emptyEl = document.getElementById('chats-empty');
  listEl.innerHTML = '<p style="color:var(--text-muted);padding:20px">Cargando...</p>';
  emptyEl.classList.add('hidden');

  try {
    const snap = await db.collection('chats')
      .where('participantes', 'array-contains', currentUser.uid).get();

    let docs = snap.docs.filter(d => {
      const p = d.data().participantes;
      return Array.isArray(p) && p.length === 2 && p.every(x => x && x.trim() !== '');
    });
    docs.sort((a,b) => {
      const va = a.data().ultimoMensajeAt && a.data().ultimoMensajeAt.toDate ? a.data().ultimoMensajeAt.toDate().getTime() : 0;
      const vb = b.data().ultimoMensajeAt && b.data().ultimoMensajeAt.toDate ? b.data().ultimoMensajeAt.toDate().getTime() : 0;
      return vb - va;
    });

    if (!docs.length) { listEl.innerHTML=''; emptyEl.classList.remove('hidden'); return; }
    listEl.innerHTML = '';

    for (let i=0; i<docs.length; i++) {
      const chat   = docs[i].data();
      const chatId = docs[i].id;
      const otroUid = chat.participantes.find(u => u !== currentUser.uid);
      if (!otroUid) continue;
      const otroSnap = await db.collection('usuarios').doc(otroUid).get();
      const otro = otroSnap.exists ? otroSnap.data() : { nombre: otroUid, email: otroUid };

      const noLeidos = (chat.noLeidos && chat.noLeidos[currentUser.uid]) || 0;
      const hora = chat.ultimoMensajeAt && chat.ultimoMensajeAt.toDate ? formatHora(chat.ultimoMensajeAt.toDate()) : '';

      const item = document.createElement('div');
      item.className = 'chat-item'; item.style.animationDelay = `${i*0.05}s`;
      const nombreMostrar = otro.username ? '@' + otro.username : (otro.nombre || otro.email);
      item.innerHTML = `
        <div class="chat-avatar">${getInicial(otro.username || otro.nombre || otro.email)}</div>
        <div class="chat-info">
          <p class="chat-nombre">${nombreMostrar}</p>
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

async function loadUsuarios() {
  const listEl  = document.getElementById('usuarios-list');
  const emptyEl = document.getElementById('usuarios-empty');
  listEl.innerHTML = '<p style="color:var(--text-muted);padding:16px 0">Cargando usuarios...</p>';
  emptyEl.classList.add('hidden');
  try {
    const snap = await db.collection('usuarios').get();
    todosUsuarios = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== currentUser.uid);
    renderUsuarios(todosUsuarios);
  } catch(e) { listEl.innerHTML = `<p style="color:#ff5e5e">Error: ${e.message}</p>`; }
}

function renderUsuarios(lista) {
  const listEl  = document.getElementById('usuarios-list');
  const emptyEl = document.getElementById('usuarios-empty');
  listEl.innerHTML = '';
  if (!lista.length) { emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');
  lista.forEach((u,i) => {
    const item = document.createElement('div');
    item.className = 'usuario-item'; item.style.animationDelay = `${i*0.04}s`;
    const nombreMostrar = u.username ? '@' + u.username : (u.nombre || u.email.split('@')[0]);
    item.innerHTML = `
      <div class="chat-avatar">${getInicial(u.username || u.nombre || u.email)}</div>
      <div class="usuario-info">
        <p class="usuario-nombre">${nombreMostrar}</p>
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
    (u.username || '').toLowerCase().includes(q) ||
    (u.nombre   || '').toLowerCase().includes(q) ||
    (u.email    || '').toLowerCase().includes(q)
  );
  renderUsuarios(filtrados);
}

async function iniciarChatCon(otro) {
  const chatId = getChatId(currentUser.uid, otro.uid);
  const ref    = db.collection('chats').doc(chatId);
  const snap   = await ref.get();
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

// ── CONVERSACIÓN ─────────────────────────
async function abrirConversacion(chatId, otroUid, otroData) {
  chatActualId   = chatId;
  chatActualUser = { uid: otroUid, ...otroData };

  const nombreHeader = otroData.username ? '@' + otroData.username : (otroData.nombre || otroData.email);
  document.getElementById('conv-nombre-header').textContent = nombreHeader;
  document.getElementById('conv-avatar').textContent = getInicial(otroData.username || otroData.nombre || otroData.email);

  showScreen('screen-conversacion');

  try {
    const ref  = db.collection('chats').doc(chatId);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        participantes: [currentUser.uid, otroUid],
        ultimoMensaje: '', ultimoMensajeAt: firebase.firestore.FieldValue.serverTimestamp(),
        noLeidos: { [currentUser.uid]: 0, [otroUid]: 0 }
      });
    } else {
      const data = snap.data();
      const fixes = {};
      if (!data.noLeidos) fixes.noLeidos = { [currentUser.uid]: 0, [otroUid]: 0 };
      if (data.ultimoMensaje === undefined) fixes.ultimoMensaje = '';
      if (!data.ultimoMensajeAt || typeof data.ultimoMensajeAt === 'string')
        fixes.ultimoMensajeAt = firebase.firestore.FieldValue.serverTimestamp();
      if (Object.keys(fixes).length) await ref.update(fixes);
      await ref.update({ [`noLeidos.${currentUser.uid}`]: 0 });
    }
  } catch(e) { console.error('Error preparando chat:', e); }

  if (mensajesListener) mensajesListener();
  const container = document.getElementById('mensajes-container');
  container.innerHTML = '';

  mensajesListener = db.collection('chats').doc(chatId)
    .collection('mensajes').orderBy('creadoEn','asc')
    .onSnapshot(snap => {
      renderMensajes(snap.docs, container);
      // Scroll al fondo
      const main = document.getElementById('conv-main');
      setTimeout(() => { if(main) main.scrollTop = main.scrollHeight; }, 60);
    });
}

function renderMensajes(docs, container) {
  container.innerHTML = '';
  let lastDay   = '';
  let lastUid   = '';

  docs.forEach(doc => {
    const m       = doc.data();
    const esPropio = m.uid === currentUser.uid;
    const fecha    = m.creadoEn ? m.creadoEn.toDate() : new Date();
    const dia      = fecha.toLocaleDateString('es-ES', { day:'numeric', month:'long' });

    // Separador de día
    if (dia !== lastDay) {
      const sep = document.createElement('div');
      sep.className = 'msg-group-label'; sep.textContent = dia;
      container.appendChild(sep);
      lastDay = dia; lastUid = '';
    }

    const wrap = document.createElement('div');
    wrap.className = `msg-wrap ${esPropio ? 'out' : 'in'}`;

    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${esPropio ? 'out' : 'in'}`;
    bubble.innerHTML = escapeHtml(m.texto);

    const time = document.createElement('div');
    time.className = 'msg-time'; time.textContent = formatHora(fecha);

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    container.appendChild(wrap);
    lastUid = m.uid;
  });
}

async function enviarMensaje() {
  const input = document.getElementById('msg-input');
  const texto = input.value.trim();
  if (!texto || !chatActualId) return;
  input.value = '';

  try {
    await db.collection('chats').doc(chatActualId).collection('mensajes').add({
      texto, uid: currentUser.uid, nombre: getNombre(currentUser),
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('chats').doc(chatActualId).update({
      ultimoMensaje: texto,
      ultimoMensajeAt: firebase.firestore.FieldValue.serverTimestamp(),
      [`noLeidos.${chatActualUser.uid}`]: firebase.firestore.FieldValue.increment(1)
    });
  } catch(e) { console.error('Error enviando mensaje:', e); }
}

function cerrarConversacion() {
  if (mensajesListener) { mensajesListener(); mensajesListener = null; }
  chatActualId = null; chatActualUser = null;
  showScreen('screen-chats'); loadChats();
}

// ═══════════════════════════════════════════
// AJUSTES
// ═══════════════════════════════════════════
async function loadAjustes() {
  if (!currentUser) return;
  document.getElementById('perfil-email-display').textContent = currentUser.email;
  try {
    const snap = await db.collection('usuarios').doc(currentUser.uid).get();
    if (snap.exists) {
      const d      = snap.data();
      const nombre = d.nombre || getNombre(currentUser);
      document.getElementById('aj-nombre').value = nombre;
      document.getElementById('aj-bio').value    = d.bio || '';
      document.getElementById('perfil-nombre-display').textContent = nombre;
      document.getElementById('perfil-avatar-display').textContent = getInicial(nombre);
      if (d.nivel) {
        document.querySelectorAll('#screen-ajustes .nivel-btn').forEach(b => b.classList.toggle('selected', b.dataset.nivel === d.nivel));
        selectedNivelAjustes = d.nivel;
      }
    } else {
      const n = getNombre(currentUser);
      document.getElementById('aj-nombre').value = n;
      document.getElementById('perfil-nombre-display').textContent = n;
      document.getElementById('perfil-avatar-display').textContent = getInicial(n);
    }
  } catch(e) { console.error(e); }
}

function selectNivelAj(btn) {
  document.querySelectorAll('#screen-ajustes .nivel-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected'); selectedNivelAjustes = btn.dataset.nivel;
}

async function guardarPerfil() {
  const nombre = document.getElementById('aj-nombre').value.trim();
  const bio    = document.getElementById('aj-bio').value.trim();
  const okEl   = document.getElementById('aj-ok');
  okEl.classList.add('hidden');
  if (!nombre) { alert('El nombre no puede estar vacío.'); return; }
  const nombreAnterior = getNombre(currentUser);
  try {
    await db.collection('usuarios').doc(currentUser.uid).set(
      { nombre, bio, email: currentUser.email, uid: currentUser.uid, ...(selectedNivelAjustes ? { nivel: selectedNivelAjustes } : {}) },
      { merge: true }
    );
    await currentUser.updateProfile({ displayName: nombre });
    if (nombre !== nombreAnterior) {
      const rutasSnap = await db.collection('rutas').where('convocadoPorEmail','==',currentUser.email).get();
      const batch = db.batch();
      rutasSnap.docs.forEach(doc => batch.update(doc.ref, { convocadoPor: nombre }));
      if (!rutasSnap.empty) await batch.commit();
    }
    document.getElementById('user-display').textContent = nombre;
    document.getElementById('perfil-nombre-display').textContent = nombre;
    document.getElementById('perfil-avatar-display').textContent = getInicial(nombre);
    okEl.classList.remove('hidden');
    setTimeout(() => okEl.classList.add('hidden'), 2500);
  } catch(e) { alert('Error guardando perfil: ' + e.message); }
}

async function cambiarPassword() {
  const actual  = document.getElementById('aj-pass-actual').value;
  const nueva   = document.getElementById('aj-pass-nueva').value;
  const repite  = document.getElementById('aj-pass-repite').value;
  const okEl    = document.getElementById('aj-pass-ok');
  const errEl   = document.getElementById('aj-pass-err');
  okEl.classList.add('hidden'); errEl.classList.add('hidden');

  if (!actual)        { errEl.textContent = 'Introduce tu contraseña actual.'; errEl.classList.remove('hidden'); return; }
  if (nueva.length<6) { errEl.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.'; errEl.classList.remove('hidden'); return; }
  if (nueva !== repite){ errEl.textContent = 'Las contraseñas nuevas no coinciden.'; errEl.classList.remove('hidden'); return; }
  if (actual === nueva){ errEl.textContent = 'La nueva contraseña debe ser diferente.'; errEl.classList.remove('hidden'); return; }

  try {
    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, actual);
    await currentUser.reauthenticateWithCredential(credential);
    await currentUser.updatePassword(nueva);
    ['aj-pass-actual','aj-pass-nueva','aj-pass-repite'].forEach(id => document.getElementById(id).value = '');
    okEl.classList.remove('hidden');
    setTimeout(() => okEl.classList.add('hidden'), 2500);
  } catch(e) {
    errEl.textContent = (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential')
      ? 'La contraseña actual no es correcta.'
      : (e.code === 'auth/too-many-requests' ? 'Demasiados intentos. Espera unos minutos.' : 'Error: ' + e.message);
    errEl.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════
function formatHora(date) {
  const hoy = new Date();
  if (date.toDateString() === hoy.toDateString())
    return date.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
  return date.toLocaleDateString('es-ES', { day:'numeric', month:'short' });
}

function escapeHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
         .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('screen-login').classList.contains('active'))   doLogin();
  if (document.getElementById('screen-registro').classList.contains('active')) doRegistro();
});
