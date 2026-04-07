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
let todosUsuariosBuscar  = [];
let chatActualId         = null;
let chatActualUser       = null;
let mensajesListener     = null;
let usernameTimeout      = null;
let buscarTimeout        = null;
let segTabActual         = 'siguiendo';

// IDs de admins (añadir UIDs aquí)
const ADMINS = ['r6BGICHeh6WZebH1DqIRVYgIhK42'];

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

function getNombre(u) { return u.displayName || u.email.split('@')[0]; }
function getInicial(n) { return n ? n.charAt(0).toUpperCase() : '?'; }
function esAdmin() { return currentUser && ADMINS.includes(currentUser.uid); }

// ── LOGIN ────────────────────────────────
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!email || !pass) { errEl.textContent='Completa correo y contraseña.'; errEl.classList.remove('hidden'); return; }
  try { await auth.signInWithEmailAndPassword(email, pass); }
  catch(e) { errEl.textContent='Credenciales incorrectas.'; errEl.classList.remove('hidden'); }
}

function doLogout() {
  if (mensajesListener) mensajesListener();
  auth.signOut();
}

// ── REGISTRO ─────────────────────────────
let usernameValido = false;

const SVG_OK   = `<svg viewBox="0 0 24 24" fill="none" stroke="#c8ff00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const SVG_ERR  = `<svg viewBox="0 0 24 24" fill="none" stroke="#ff5e5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const SVG_WAIT = `<svg viewBox="0 0 24 24" fill="none" stroke="#888899" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

function selectSexo(btn) {
  document.querySelectorAll('.sexo-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected'); selectedSexo = btn.dataset.sexo;
}

async function verificarUsername() {
  clearTimeout(usernameTimeout);
  const input = document.getElementById('reg-username');
  const raw   = input.value.toLowerCase().replace(/[^a-z0-9._]/g,'');
  input.value = raw;
  const status = document.getElementById('username-status');
  const hint   = document.getElementById('username-hint');
  usernameValido = false;
  status.innerHTML = '';
  if (!raw)             { hint.textContent=''; return; }
  if (raw.length < 3)   { hint.textContent='Mínimo 3 caracteres'; hint.style.color='var(--text-muted)'; return; }
  status.innerHTML = SVG_WAIT;
  hint.textContent = 'Comprobando...'; hint.style.color='var(--text-muted)';
  usernameTimeout = setTimeout(async () => {
    try {
      // Busca en todos los docs de usuarios si alguno tiene ese username
      const snap = await db.collection('usuarios').get();
      const existe = snap.docs.some(d => (d.data().username||'').toLowerCase() === raw);
      if (!existe) {
        status.innerHTML=SVG_OK; hint.textContent='@'+raw+' está disponible'; hint.style.color='var(--accent)'; usernameValido=true;
      } else {
        status.innerHTML=SVG_ERR; hint.textContent='@'+raw+' ya está en uso'; hint.style.color='#ff5e5e'; usernameValido=false;
      }
    } catch(e) {
      console.error(e); status.innerHTML=''; hint.textContent='Error al comprobar.'; hint.style.color='#ff5e5e';
    }
  }, 700);
}

async function doRegistro() {
  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const email    = document.getElementById('reg-email').value.trim();
  const diaStr   = document.getElementById('reg-dia').value.trim();
  const mesStr   = document.getElementById('reg-mes').value.trim();
  const anioStr  = document.getElementById('reg-anio').value.trim();
  const prefijo  = document.getElementById('reg-prefijo').value;
  const telNum   = document.getElementById('reg-telefono').value.trim();
  const pass     = document.getElementById('reg-pass').value;
  const pass2    = document.getElementById('reg-pass2').value;
  const errEl    = document.getElementById('reg-error');
  const okEl     = document.getElementById('reg-ok');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');

  if (!username || username.length<3) { errEl.textContent='El nombre de usuario debe tener al menos 3 caracteres.'; errEl.classList.remove('hidden'); return; }
  if (!usernameValido)                { errEl.textContent='El usuario no está disponible o no se ha comprobado aún.'; errEl.classList.remove('hidden'); return; }
  if (!email)                         { errEl.textContent='Introduce tu correo electrónico.'; errEl.classList.remove('hidden'); return; }

  const dia=parseInt(diaStr,10), mes=parseInt(mesStr,10), anio=parseInt(anioStr,10);
  if (!diaStr||!mesStr||!anioStr||anioStr.length<4) { errEl.textContent='Introduce la fecha completa.'; errEl.classList.remove('hidden'); return; }
  if (isNaN(dia)||dia<1||dia>31)   { errEl.textContent='Día inválido (1-31).'; errEl.classList.remove('hidden'); return; }
  if (isNaN(mes)||mes<1||mes>12)   { errEl.textContent='Mes inválido (1-12).'; errEl.classList.remove('hidden'); return; }
  if (isNaN(anio)||anio<1920||anio>new Date().getFullYear()) { errEl.textContent='Año inválido.'; errEl.classList.remove('hidden'); return; }
  const fobj=new Date(anio,mes-1,dia);
  if (fobj.getDate()!==dia||fobj.getMonth()!==mes-1) { errEl.textContent=`La fecha ${dia}/${mes}/${anio} no existe.`; errEl.classList.remove('hidden'); return; }
  if (!telNum||telNum.length<6)    { errEl.textContent='Teléfono inválido.'; errEl.classList.remove('hidden'); return; }
  if (!selectedSexo)               { errEl.textContent='Selecciona tu sexo.'; errEl.classList.remove('hidden'); return; }
  if (pass.length<6)               { errEl.textContent='La contraseña debe tener al menos 6 caracteres.'; errEl.classList.remove('hidden'); return; }
  if (pass!==pass2)                { errEl.textContent='Las contraseñas no coinciden.'; errEl.classList.remove('hidden'); return; }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    const user = cred.user;
    await user.updateProfile({ displayName: username });
    await db.collection('usuarios').doc(user.uid).set({
      uid: user.uid, username, nombre: username, email,
      fechaNacimiento: `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${anio}`,
      telefono: prefijo+' '+telNum, sexo: selectedSexo,
      seguidores: [], siguiendo: [],
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
    okEl.classList.remove('hidden');
  } catch(e) {
    let msg='Error al crear cuenta.';
    if (e.code==='auth/email-already-in-use') msg='Ese correo ya está registrado.';
    if (e.code==='auth/invalid-email')        msg='El correo no tiene formato válido.';
    if (e.code==='auth/weak-password')        msg='Contraseña demasiado débil.';
    errEl.textContent=msg; errEl.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>{ s.classList.remove('active'); s.style.display=''; });
  const t=document.getElementById(id); t.style.display='flex'; t.classList.add('active');
  if (id==='screen-convocar') { resetForm(); loadRutaNames(); }
}

function togglePass(inputId, btn) {
  const input=document.getElementById(inputId);
  const visible=input.type==='text';
  input.type=visible?'password':'text';
  btn.querySelector('.eye-show').style.display=visible?'block':'none';
  btn.querySelector('.eye-hide').style.display=visible?'none':'block';
}

// ═══════════════════════════════════════════
// RUTAS
// ═══════════════════════════════════════════
async function loadRutaNames() {
  try {
    const snap=await db.collection('ruta_nombres').orderBy('nombre').get();
    rutasDisponibles=snap.docs.map(d=>({id:d.id,nombre:d.data().nombre}));
    renderSelectRuta();
  } catch(e){console.error(e);}
}
function renderSelectRuta() {
  const sel=document.getElementById('select-ruta');
  sel.innerHTML='<option value="">— Selecciona ruta existente —</option>';
  rutasDisponibles.forEach(r=>{ const o=document.createElement('option'); o.value=r.nombre; o.textContent=r.nombre; sel.appendChild(o); });
}
function toggleNuevaRuta() { document.getElementById('nueva-ruta-block').classList.toggle('hidden'); }
async function addNuevaRuta() {
  const input=document.getElementById('nueva-ruta-input'); const nombre=input.value.trim();
  if (!nombre) return;
  if (rutasDisponibles.find(r=>r.nombre.toLowerCase()===nombre.toLowerCase())) { alert('Ya existe.'); return; }
  try {
    const ref=await db.collection('ruta_nombres').add({nombre});
    rutasDisponibles.push({id:ref.id,nombre}); renderSelectRuta();
    document.getElementById('select-ruta').value=nombre; input.value='';
    document.getElementById('nueva-ruta-block').classList.add('hidden');
  } catch(e){alert('Error: '+e.message);}
}
function selectNivel(btn) {
  document.querySelectorAll('#screen-convocar .nivel-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected'); selectedNivel=btn.dataset.nivel;
}

// Fecha de hoy a medianoche para comparar
function hoyMedianoche() {
  const h=new Date(); h.setHours(0,0,0,0); return h;
}
// Convierte "DD/MM/YYYY" a Date
function parseFechaRuta(f) {
  if (!f) return null;
  const [d,m,y]=f.split('/'); return new Date(parseInt(y),parseInt(m)-1,parseInt(d));
}

async function convocarRuta() {
  const errEl=document.getElementById('conv-error'); const okEl=document.getElementById('conv-ok');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  const nombre   =document.getElementById('select-ruta').value;
  const hora     =document.getElementById('conv-hora').value;
  const fecha    =document.getElementById('conv-fecha').value;
  const lugarUrl =document.getElementById('conv-lugar-url').value.trim();
  const lugarDesc=document.getElementById('conv-lugar-desc').value.trim();
  const desc     =document.getElementById('conv-desc').value.trim();
  const nivel    =selectedNivel;
  const editandoId=document.getElementById('editando-ruta-id').value;

  if (!nombre)    { showError(errEl,'Selecciona o añade un nombre de ruta.'); return; }
  if (!hora)      { showError(errEl,'Indica la hora.'); return; }
  if (!fecha)     { showError(errEl,'Indica la fecha.'); return; }
  if (!lugarDesc) { showError(errEl,'Añade descripción del lugar.'); return; }
  if (!nivel)     { showError(errEl,'Selecciona el nivel.'); return; }

  const [y,m,d]=fecha.split('-');
  const datos={
    nombre, hora, fecha:`${d}/${m}/${y}`, fechaISO:fecha,
    lugarUrl, lugarDesc, descripcion:desc, nivel,
    convocadoPor:getNombre(currentUser), convocadoPorEmail:currentUser.email,
    convocadoPorUid:currentUser.uid
  };

  try {
    if (editandoId) {
      await db.collection('rutas').doc(editandoId).update(datos);
    } else {
      datos.asistentes=[]; datos.numAsistentes=0;
      datos.creadoEn=firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('rutas').add(datos);
    }
    okEl.classList.remove('hidden');
    setTimeout(()=>{ okEl.classList.add('hidden'); resetForm(); showScreen('screen-ver'); loadRutas(); }, 1500);
  } catch(e){showError(errEl,'Error: '+e.message);}
}

function showError(el,msg) { el.textContent=msg; el.classList.remove('hidden'); }

function resetForm() {
  ['select-ruta','conv-hora','conv-fecha','conv-lugar-url','conv-lugar-desc','conv-desc']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.querySelectorAll('#screen-convocar .nivel-btn').forEach(b=>b.classList.remove('selected'));
  selectedNivel=null;
  document.getElementById('nueva-ruta-block').classList.add('hidden');
  document.getElementById('nueva-ruta-input').value='';
  document.getElementById('conv-error').classList.add('hidden');
  document.getElementById('conv-ok').classList.add('hidden');
  document.getElementById('editando-ruta-id').value='';
  document.getElementById('convocar-titulo').textContent='CONVOCAR RUTA';
  document.getElementById('btn-convocar-submit').textContent='CONVOCAR RUTA';
}

function editarRuta(id, datos) {
  resetForm();
  document.getElementById('editando-ruta-id').value=id;
  document.getElementById('convocar-titulo').textContent='EDITAR RUTA';
  document.getElementById('btn-convocar-submit').textContent='GUARDAR CAMBIOS';
  // Rellenar campos
  document.getElementById('select-ruta').value=datos.nombre;
  document.getElementById('conv-hora').value=datos.hora;
  document.getElementById('conv-fecha').value=datos.fechaISO||'';
  document.getElementById('conv-lugar-url').value=datos.lugarUrl||'';
  document.getElementById('conv-lugar-desc').value=datos.lugarDesc||'';
  document.getElementById('conv-desc').value=datos.descripcion||'';
  selectedNivel=datos.nivel;
  document.querySelectorAll('#screen-convocar .nivel-btn').forEach(b=>{
    b.classList.toggle('selected', b.dataset.nivel===datos.nivel);
  });
  showScreen('screen-convocar');
}

async function loadRutas() {
  const listEl=document.getElementById('rutas-list'); const emptyEl=document.getElementById('rutas-empty');
  listEl.innerHTML='<p style="color:var(--text-muted);padding:20px">Cargando rutas...</p>'; emptyEl.classList.add('hidden');
  try {
    const snap=await db.collection('rutas').orderBy('creadoEn','desc').get();
    if (snap.empty) { listEl.innerHTML=''; emptyEl.classList.remove('hidden'); return; }
    listEl.innerHTML='<div class="rutas-grid"></div>';
    const grid=listEl.querySelector('.rutas-grid');
    const hoy=hoyMedianoche();

    snap.docs.forEach((doc,i)=>{
      const r=doc.data(); const id=doc.id;
      const fechaRuta=parseFechaRuta(r.fecha);
      const pasada=fechaRuta && fechaRuta<hoy;

      const card=document.createElement('div');
      card.className='ruta-card'+(pasada?' pasada':'');
      card.dataset.nivel=r.nivel;
      card.style.animationDelay=`${i*0.06}s`;

      const lugarHTML=r.lugarUrl
        ?`<span class="ruta-tag lugar">📍 <a href="${r.lugarUrl}" target="_blank">${r.lugarDesc}</a></span>`
        :`<span class="ruta-tag">📍 ${r.lugarDesc}</span>`;

      const asistentes=r.asistentes||[];
      const numAsistentes=asistentes.length;
      const yaApuntado=asistentes.includes(currentUser.uid);

      const puedoEditar = !pasada && (
        currentUser.uid===r.convocadoPorUid ||
        currentUser.email===r.convocadoPorEmail ||
        esAdmin()
      );

      // Botón apuntarse (solo si no pasada)
      const btnApuntarHTML=!pasada ? `
        <button class="btn-apuntarse ${yaApuntado?'apuntado':'no-apuntado'}" data-id="${id}" onclick="toggleAsistencia('${id}',${yaApuntado})">
          ${yaApuntado?'✓ Apuntado':'+ Apuntarme'}
        </button>` : '';

      const btnEditarHTML=puedoEditar
        ?`<button class="btn-editar-ruta" onclick='editarRuta("${id}",${JSON.stringify({nombre:r.nombre,hora:r.hora,fechaISO:r.fechaISO||'',lugarUrl:r.lugarUrl||'',lugarDesc:r.lugarDesc||'',descripcion:r.descripcion||'',nivel:r.nivel})})'>✏️ Editar</button>`
        :'';

      card.innerHTML=`
        <p class="ruta-convocado">Convocado por <span>@${r.convocadoPor}</span></p>
        <h3 class="ruta-nombre">${r.nombre}</h3>
        <div class="ruta-meta">
          <span class="ruta-tag">🕐 ${r.hora} · ${r.fecha}</span>${lugarHTML}
        </div>
        ${r.descripcion?`<p class="ruta-desc">${r.descripcion}</p>`:''}
        <span class="nivel-badge">${nivelLabel(r.nivel)}</span>
        <div class="ruta-footer">
          <div class="ruta-counter">
            <span>🛼</span><strong>${numAsistentes}</strong> persona${numAsistentes!==1?'s':''} acude${numAsistentes!==1?'n':''}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${btnApuntarHTML}${btnEditarHTML}
          </div>
        </div>`;
      grid.appendChild(card);
    });
  } catch(e) {
    listEl.innerHTML=`<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;
  }
}

async function toggleAsistencia(rutaId, yaApuntado) {
  const ref=db.collection('rutas').doc(rutaId);
  try {
    if (yaApuntado) {
      await ref.update({ asistentes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
    } else {
      await ref.update({ asistentes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
    }
    loadRutas();
  } catch(e){console.error(e);}
}

function nivelLabel(n) {
  return {aprendiendo:'🐣 Aprendiendo',principiante:'🟢 Principiante',medio:'🟡 Medio',cañero:'🔥 Cañero'}[n]||n;
}

// ═══════════════════════════════════════════
// SEGUIDORES
// ═══════════════════════════════════════════
async function loadSeguidores() {
  segTabActual='siguiendo';
  document.querySelectorAll('.seg-tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  await renderSegTab();
}

function switchSegTab(tab, btn) {
  segTabActual=tab;
  document.querySelectorAll('.seg-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  renderSegTab();
}

async function renderSegTab() {
  const listEl=document.getElementById('seg-list'); const emptyEl=document.getElementById('seg-empty');
  listEl.innerHTML='<p style="color:var(--text-muted);padding:20px">Cargando...</p>'; emptyEl.classList.add('hidden');
  try {
    // Obtener mis datos (seguidores/siguiendo)
    const miSnap=await db.collection('usuarios').doc(currentUser.uid).get();
    const miData=miSnap.exists?miSnap.data():{seguidores:[],siguiendo:[]};
    const miSiguiendo=miData.siguiendo||[];
    const misSeguidores=miData.seguidores||[];

    const lista=segTabActual==='siguiendo'?miSiguiendo:misSeguidores;
    if (!lista.length) { listEl.innerHTML=''; emptyEl.classList.remove('hidden'); return; }

    listEl.innerHTML='';
    for (let i=0;i<lista.length;i++) {
      const uid=lista[i];
      const uSnap=await db.collection('usuarios').doc(uid).get();
      const u=uSnap.exists?uSnap.data():{username:uid,nombre:uid};
      const yaSigo=miSiguiendo.includes(uid);
      const item=document.createElement('div');
      item.className='seg-user-item'; item.style.animationDelay=`${i*0.04}s`;
      item.innerHTML=`
        <div class="chat-avatar">${getInicial(u.username||u.nombre||'?')}</div>
        <div class="seg-user-info">
          <p class="seg-username">@${u.username||u.nombre}</p>
          <p class="seg-realname">${u.nombre!==u.username?u.nombre:''}</p>
        </div>
        <button class="btn-seguir ${yaSigo?'siguiendo':'no-siguiendo'}" onclick="toggleSeguir('${uid}',${yaSigo},this)">
          ${yaSigo?'Siguiendo':'Seguir'}
        </button>`;
      listEl.appendChild(item);
    }
  } catch(e){listEl.innerHTML=`<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;}
}

async function toggleSeguir(targetUid, yaSigo, btn) {
  const miRef  =db.collection('usuarios').doc(currentUser.uid);
  const elRef  =db.collection('usuarios').doc(targetUid);
  try {
    if (yaSigo) {
      await miRef.update({siguiendo:firebase.firestore.FieldValue.arrayRemove(targetUid)});
      await elRef.update({seguidores:firebase.firestore.FieldValue.arrayRemove(currentUser.uid)});
      btn.textContent='Seguir'; btn.className='btn-seguir no-siguiendo';
      btn.onclick=()=>toggleSeguir(targetUid,false,btn);
    } else {
      await miRef.update({siguiendo:firebase.firestore.FieldValue.arrayUnion(targetUid)});
      await elRef.update({seguidores:firebase.firestore.FieldValue.arrayUnion(currentUser.uid)});
      btn.textContent='Siguiendo'; btn.className='btn-seguir siguiendo';
      btn.onclick=()=>toggleSeguir(targetUid,true,btn);
    }
  } catch(e){console.error(e);}
}

// ═══════════════════════════════════════════
// BUSCAR USUARIOS (tiempo real, solo @usuario)
// ═══════════════════════════════════════════
async function initBuscar() {
  document.getElementById('buscar-rt-input').value='';
  document.getElementById('buscar-results').innerHTML='';
  document.getElementById('buscar-empty').classList.add('hidden');
  document.getElementById('buscar-inicial').classList.remove('hidden');
  document.getElementById('buscar-clear').classList.add('hidden');
  try {
    const snap=await db.collection('usuarios').get();
    todosUsuariosBuscar=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.uid!==currentUser.uid);
  } catch(e){console.error(e);}
}

function buscarTiempoReal() {
  clearTimeout(buscarTimeout);
  const q=document.getElementById('buscar-rt-input').value.trim().toLowerCase().replace(/^@/,'');
  document.getElementById('buscar-clear').classList.toggle('hidden',!q);
  if (!q) {
    document.getElementById('buscar-results').innerHTML='';
    document.getElementById('buscar-empty').classList.add('hidden');
    document.getElementById('buscar-inicial').classList.remove('hidden');
    return;
  }
  document.getElementById('buscar-inicial').classList.add('hidden');
  buscarTimeout=setTimeout(()=>{
    // Solo busca por username (no correo)
    const res=todosUsuariosBuscar.filter(u=>(u.username||'').toLowerCase().includes(q));
    renderBuscarResultados(res);
  },180);
}

async function renderBuscarResultados(lista) {
  const el=document.getElementById('buscar-results'); const emptyEl=document.getElementById('buscar-empty');
  el.innerHTML='';
  if (!lista.length) { emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');

  // Obtener a quién sigo
  const miSnap=await db.collection('usuarios').doc(currentUser.uid).get();
  const miSiguiendo=(miSnap.exists?miSnap.data().siguiendo:[])||[];

  lista.forEach((u,i)=>{
    const yaSigo=miSiguiendo.includes(u.uid);
    const card=document.createElement('div');
    card.className='buscar-user-card'; card.style.animationDelay=`${i*0.04}s`;
    card.innerHTML=`
      <div class="chat-avatar" style="flex-shrink:0">${getInicial(u.username||u.nombre||'?')}</div>
      <div class="buscar-user-info">
        <p class="buscar-username">@${u.username||u.nombre}</p>
        <p class="buscar-realname">${u.nombre!==u.username&&u.nombre?u.nombre:''}</p>
      </div>
      <div class="buscar-user-meta" style="display:flex;align-items:center;gap:8px">
        ${u.nivel?`<span class="buscar-nivel-tag">${nivelLabel(u.nivel)}</span>`:''}
        <button class="btn-seguir ${yaSigo?'siguiendo':'no-siguiendo'}" style="font-size:0.78rem;padding:5px 14px"
          onclick="toggleSeguirBuscar('${u.uid}',this)">
          ${yaSigo?'Siguiendo':'Seguir'}
        </button>
        <button class="btn-chat-mini" onclick="abrirChatDesdeResultado('${u.uid}')">💬</button>
      </div>`;
    el.appendChild(card);
  });
}

async function toggleSeguirBuscar(targetUid, btn) {
  const yaSigo=btn.classList.contains('siguiendo');
  await toggleSeguir(targetUid, yaSigo, btn);
}

async function abrirChatDesdeResultado(uid) {
  const u=todosUsuariosBuscar.find(x=>x.uid===uid);
  if (!u) return;
  await iniciarChatCon(u);
}

function limpiarBuscar() {
  document.getElementById('buscar-rt-input').value=''; buscarTiempoReal();
  document.getElementById('buscar-rt-input').focus();
}

// ═══════════════════════════════════════════
// CHATS 1A1
// ═══════════════════════════════════════════
function getChatId(a,b){return [a,b].sort().join('_');}

function escucharNoLeidos() {
  db.collection('chats').where('participantes','array-contains',currentUser.uid)
    .onSnapshot(snap=>{
      let total=0;
      snap.docs.forEach(d=>{ const x=d.data(); total+=(x.noLeidos&&x.noLeidos[currentUser.uid])||0; });
      const badge=document.getElementById('home-chat-badge');
      if(total>0){badge.textContent=total>99?'99+':total;badge.classList.remove('hidden');}
      else badge.classList.add('hidden');
    });
}

async function loadChats() {
  const listEl=document.getElementById('chats-list'); const emptyEl=document.getElementById('chats-empty');
  listEl.innerHTML='<p style="color:var(--text-muted);padding:20px">Cargando...</p>'; emptyEl.classList.add('hidden');
  try {
    const snap=await db.collection('chats').where('participantes','array-contains',currentUser.uid).get();
    let docs=snap.docs.filter(d=>{ const p=d.data().participantes; return Array.isArray(p)&&p.length===2&&p.every(x=>x&&x.trim()!==''); });
    docs.sort((a,b)=>{
      const va=a.data().ultimoMensajeAt&&a.data().ultimoMensajeAt.toDate?a.data().ultimoMensajeAt.toDate().getTime():0;
      const vb=b.data().ultimoMensajeAt&&b.data().ultimoMensajeAt.toDate?b.data().ultimoMensajeAt.toDate().getTime():0;
      return vb-va;
    });
    if (!docs.length){listEl.innerHTML='';emptyEl.classList.remove('hidden');return;}
    listEl.innerHTML='';
    for (let i=0;i<docs.length;i++){
      const chat=docs[i].data(); const chatId=docs[i].id;
      const otroUid=chat.participantes.find(u=>u!==currentUser.uid); if(!otroUid) continue;
      const oSnap=await db.collection('usuarios').doc(otroUid).get();
      const otro=oSnap.exists?oSnap.data():{nombre:otroUid,email:otroUid};
      const noLeidos=(chat.noLeidos&&chat.noLeidos[currentUser.uid])||0;
      const hora=chat.ultimoMensajeAt&&chat.ultimoMensajeAt.toDate?formatHora(chat.ultimoMensajeAt.toDate()):'';
      const nombre=otro.username?'@'+otro.username:(otro.nombre||otro.email);
      const item=document.createElement('div');
      item.className='chat-item'; item.style.animationDelay=`${i*0.05}s`;
      item.innerHTML=`
        <div class="chat-avatar">${getInicial(otro.username||otro.nombre||otro.email)}</div>
        <div class="chat-info"><p class="chat-nombre">${nombre}</p><p class="chat-preview">${chat.ultimoMensaje||'Sin mensajes aún'}</p></div>
        <div class="chat-meta"><span class="chat-time">${hora}</span>${noLeidos>0?`<span class="chat-unread">${noLeidos}</span>`:''}</div>`;
      item.onclick=()=>abrirConversacion(chatId,otroUid,otro);
      listEl.appendChild(item);
    }
  } catch(e){listEl.innerHTML=`<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;}
}

async function loadUsuarios() {
  const listEl=document.getElementById('usuarios-list'); const emptyEl=document.getElementById('usuarios-empty');
  listEl.innerHTML='<p style="color:var(--text-muted);padding:16px 0">Cargando...</p>'; emptyEl.classList.add('hidden');
  try {
    const snap=await db.collection('usuarios').get();
    todosUsuarios=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.uid!==currentUser.uid);
    renderUsuarios(todosUsuarios);
  } catch(e){listEl.innerHTML=`<p style="color:#ff5e5e">Error: ${e.message}</p>`;}
}

function renderUsuarios(lista) {
  const listEl=document.getElementById('usuarios-list'); const emptyEl=document.getElementById('usuarios-empty');
  listEl.innerHTML=''; if (!lista.length){emptyEl.classList.remove('hidden');return;} emptyEl.classList.add('hidden');
  lista.forEach((u,i)=>{
    const item=document.createElement('div'); item.className='usuario-item'; item.style.animationDelay=`${i*0.04}s`;
    const nombre=u.username?'@'+u.username:(u.nombre||u.email.split('@')[0]);
    item.innerHTML=`
      <div class="chat-avatar">${getInicial(u.username||u.nombre||u.email)}</div>
      <div class="usuario-info"><p class="usuario-nombre">${nombre}</p></div>
      ${u.nivel?`<span class="usuario-nivel">${nivelLabel(u.nivel)}</span>`:''}`;
    item.onclick=()=>iniciarChatCon(u); listEl.appendChild(item);
  });
}

function filtrarUsuarios() {
  const q=document.getElementById('buscar-usuario').value.toLowerCase().replace(/^@/,'');
  renderUsuarios(todosUsuarios.filter(u=>(u.username||'').toLowerCase().includes(q)||(u.nombre||'').toLowerCase().includes(q)));
}

async function iniciarChatCon(otro) {
  const chatId=getChatId(currentUser.uid,otro.uid);
  const ref=db.collection('chats').doc(chatId); const snap=await ref.get();
  if (!snap.exists) await ref.set({participantes:[currentUser.uid,otro.uid],ultimoMensaje:'',ultimoMensajeAt:firebase.firestore.FieldValue.serverTimestamp(),noLeidos:{[currentUser.uid]:0,[otro.uid]:0}});
  abrirConversacion(chatId,otro.uid,otro);
}

async function abrirConversacion(chatId,otroUid,otroData) {
  chatActualId=chatId; chatActualUser={uid:otroUid,...otroData};
  const nombre=otroData.username?'@'+otroData.username:(otroData.nombre||otroData.email);
  document.getElementById('conv-nombre-header').textContent=nombre;
  document.getElementById('conv-avatar').textContent=getInicial(otroData.username||otroData.nombre||otroData.email);
  showScreen('screen-conversacion');
  try {
    const ref=db.collection('chats').doc(chatId); const snap=await ref.get();
    if (!snap.exists) {
      await ref.set({participantes:[currentUser.uid,otroUid],ultimoMensaje:'',ultimoMensajeAt:firebase.firestore.FieldValue.serverTimestamp(),noLeidos:{[currentUser.uid]:0,[otroUid]:0}});
    } else {
      const data=snap.data(); const fixes={};
      if (!data.noLeidos) fixes.noLeidos={[currentUser.uid]:0,[otroUid]:0};
      if (!data.ultimoMensajeAt||typeof data.ultimoMensajeAt==='string') fixes.ultimoMensajeAt=firebase.firestore.FieldValue.serverTimestamp();
      if (Object.keys(fixes).length) await ref.update(fixes);
      await ref.update({[`noLeidos.${currentUser.uid}`]:0});
    }
  } catch(e){console.error(e);}
  if (mensajesListener) mensajesListener();
  const container=document.getElementById('mensajes-container'); container.innerHTML='';
  mensajesListener=db.collection('chats').doc(chatId).collection('mensajes').orderBy('creadoEn','asc').onSnapshot(snap=>{
    renderMensajes(snap.docs,container);
    const main=document.getElementById('conv-main');
    setTimeout(()=>{ if(main) main.scrollTop=main.scrollHeight; },60);
  });
}

function renderMensajes(docs,container) {
  container.innerHTML=''; let lastDay='';
  docs.forEach(doc=>{
    const m=doc.data(); const esPropio=m.uid===currentUser.uid;
    const fecha=m.creadoEn?m.creadoEn.toDate():new Date();
    const dia=fecha.toLocaleDateString('es-ES',{day:'numeric',month:'long'});
    if (dia!==lastDay) {
      const sep=document.createElement('div'); sep.className='msg-group-label'; sep.textContent=dia;
      container.appendChild(sep); lastDay=dia;
    }
    const wrap=document.createElement('div'); wrap.className=`msg-wrap ${esPropio?'out':'in'}`;
    const bubble=document.createElement('div'); bubble.className=`msg-bubble ${esPropio?'out':'in'}`;
    bubble.innerHTML=escapeHtml(m.texto);
    const time=document.createElement('div'); time.className='msg-time'; time.textContent=formatHora(fecha);
    wrap.appendChild(bubble); wrap.appendChild(time); container.appendChild(wrap);
  });
}

async function enviarMensaje() {
  const input=document.getElementById('msg-input'); const texto=input.value.trim();
  if (!texto||!chatActualId) return; input.value='';
  try {
    await db.collection('chats').doc(chatActualId).collection('mensajes').add({texto,uid:currentUser.uid,nombre:getNombre(currentUser),creadoEn:firebase.firestore.FieldValue.serverTimestamp()});
    await db.collection('chats').doc(chatActualId).update({ultimoMensaje:texto,ultimoMensajeAt:firebase.firestore.FieldValue.serverTimestamp(),[`noLeidos.${chatActualUser.uid}`]:firebase.firestore.FieldValue.increment(1)});
  } catch(e){console.error(e);}
}

function cerrarConversacion() {
  if (mensajesListener){mensajesListener();mensajesListener=null;}
  chatActualId=null; chatActualUser=null;
  showScreen('screen-chats'); loadChats();
}

// ═══════════════════════════════════════════
// AJUSTES
// ═══════════════════════════════════════════
async function loadAjustes() {
  if (!currentUser) return;
  document.getElementById('perfil-email-display').textContent=currentUser.email;
  try {
    const snap=await db.collection('usuarios').doc(currentUser.uid).get();
    if (snap.exists) {
      const d=snap.data(); const nombre=d.nombre||getNombre(currentUser);
      document.getElementById('aj-nombre').value=nombre;
      document.getElementById('aj-bio').value=d.bio||'';
      document.getElementById('perfil-nombre-display').textContent=nombre;
      document.getElementById('perfil-avatar-display').textContent=getInicial(nombre);
      if (d.nivel) {
        document.querySelectorAll('#screen-ajustes .nivel-btn').forEach(b=>b.classList.toggle('selected',b.dataset.nivel===d.nivel));
        selectedNivelAjustes=d.nivel;
      }
    } else {
      const n=getNombre(currentUser);
      document.getElementById('aj-nombre').value=n;
      document.getElementById('perfil-nombre-display').textContent=n;
      document.getElementById('perfil-avatar-display').textContent=getInicial(n);
    }
  } catch(e){console.error(e);}
}

function selectNivelAj(btn) {
  document.querySelectorAll('#screen-ajustes .nivel-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected'); selectedNivelAjustes=btn.dataset.nivel;
}

async function guardarPerfil() {
  const nombre=document.getElementById('aj-nombre').value.trim();
  const bio=document.getElementById('aj-bio').value.trim();
  const okEl=document.getElementById('aj-ok'); okEl.classList.add('hidden');
  if (!nombre){alert('El nombre no puede estar vacío.');return;}
  const nombreAnterior=getNombre(currentUser);
  try {
    await db.collection('usuarios').doc(currentUser.uid).set({nombre,bio,email:currentUser.email,uid:currentUser.uid,...(selectedNivelAjustes?{nivel:selectedNivelAjustes}:{})},{merge:true});
    await currentUser.updateProfile({displayName:nombre});
    if (nombre!==nombreAnterior) {
      const rutasSnap=await db.collection('rutas').where('convocadoPorEmail','==',currentUser.email).get();
      const batch=db.batch(); rutasSnap.docs.forEach(doc=>batch.update(doc.ref,{convocadoPor:nombre}));
      if (!rutasSnap.empty) await batch.commit();
    }
    document.getElementById('user-display').textContent=nombre;
    document.getElementById('perfil-nombre-display').textContent=nombre;
    document.getElementById('perfil-avatar-display').textContent=getInicial(nombre);
    okEl.classList.remove('hidden'); setTimeout(()=>okEl.classList.add('hidden'),2500);
  } catch(e){alert('Error: '+e.message);}
}

async function cambiarPassword() {
  const actual=document.getElementById('aj-pass-actual').value;
  const nueva=document.getElementById('aj-pass-nueva').value;
  const repite=document.getElementById('aj-pass-repite').value;
  const okEl=document.getElementById('aj-pass-ok'); const errEl=document.getElementById('aj-pass-err');
  okEl.classList.add('hidden'); errEl.classList.add('hidden');
  if (!actual){errEl.textContent='Introduce tu contraseña actual.';errEl.classList.remove('hidden');return;}
  if (nueva.length<6){errEl.textContent='Mínimo 6 caracteres.';errEl.classList.remove('hidden');return;}
  if (nueva!==repite){errEl.textContent='Las contraseñas no coinciden.';errEl.classList.remove('hidden');return;}
  if (actual===nueva){errEl.textContent='La nueva debe ser diferente.';errEl.classList.remove('hidden');return;}
  try {
    const credential=firebase.auth.EmailAuthProvider.credential(currentUser.email,actual);
    await currentUser.reauthenticateWithCredential(credential);
    await currentUser.updatePassword(nueva);
    ['aj-pass-actual','aj-pass-nueva','aj-pass-repite'].forEach(id=>document.getElementById(id).value='');
    okEl.classList.remove('hidden'); setTimeout(()=>okEl.classList.add('hidden'),2500);
  } catch(e){
    errEl.textContent=(e.code==='auth/wrong-password'||e.code==='auth/invalid-credential')?'Contraseña actual incorrecta.':(e.code==='auth/too-many-requests'?'Demasiados intentos.':'Error: '+e.message);
    errEl.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════
function formatHora(date) {
  const hoy=new Date();
  if (date.toDateString()===hoy.toDateString()) return date.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  return date.toLocaleDateString('es-ES',{day:'numeric',month:'short'});
}
function escapeHtml(str){
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
document.addEventListener('keydown',e=>{
  if (e.key!=='Enter') return;
  if (document.getElementById('screen-login').classList.contains('active'))    doLogin();
  if (document.getElementById('screen-registro').classList.contains('active')) doRegistro();
});
