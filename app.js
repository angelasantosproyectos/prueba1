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
let currentUserData      = null; // datos Firestore del usuario logueado
let selectedNivel        = null;
let selectedNivelAjustes = null;
let selectedSexo         = null;
let rutasDisponibles     = [];
let rutasCache           = {}; // nombre -> datos ultima ruta para autocompletar
let todosUsuarios        = [];
let todosUsuariosBuscar  = [];
let colabSeleccionados   = [];  // colaboradores seleccionados al convocar
let colabBuscarTimeout   = null;
let chatActualId         = null;
let chatActualUser       = null;
let mensajesListener     = null;
let usernameTimeout      = null;
let buscarTimeout        = null;
let segTabActual         = 'siguiendo';
let solTabActual         = 'seguidores';
let editandoRutaId       = null;
let editandoEventoId     = null;
let perfilVistoPrevScreen= null;
let itinerarioItems      = [];

// Admin por email (angela.santos.estudios@gmail.com)
const ADMIN_EMAIL = 'angela.santos.estudios@gmail.com';
const ADMIN_UID   = 'r6BGICHeh6WZebH1DqIRVYgIhK42'; // fallback por UID

const SVG_OK   = `<svg viewBox="0 0 24 24" fill="none" stroke="#c8ff00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const SVG_ERR  = `<svg viewBox="0 0 24 24" fill="none" stroke="#ff5e5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const SVG_WAIT = `<svg viewBox="0 0 24 24" fill="none" stroke="#888899" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    const snap = await db.collection('usuarios').doc(user.uid).get().catch(()=>null);
    currentUserData = snap && snap.exists ? snap.data() : null;
    const dn = currentUserData?.username ? '@'+currentUserData.username : (user.displayName||user.email.split('@')[0]);
    document.getElementById('user-display').textContent = dn;
    const ud2=document.getElementById('user-display-rutas');if(ud2)ud2.textContent=dn;
    showScreen('screen-detalles');
    setTimeout(()=>actualizarBotonesCitas(currentUserData?.citasActivo||false),500);
    loadRutaNames();
    escucharNoLeidos();
    escucharSolicitudes();
    // Mostrar/ocultar Panel Admin en ajustes
    setTimeout(()=>{
      const adminWrap=document.getElementById('acc-admin-wrap');
      if(adminWrap)adminWrap.style.display=esAdmin()?'block':'none';
      // Tarjetas: visible solo si citasActivo
      actualizarBotonesCitas(currentUserData?.citasActivo||false);
    },400);
  } else {
    currentUser = null; currentUserData = null;
    showScreen('screen-login');
  }
});

function esAdmin() {
  if (!currentUser) return false;
  return currentUser.email === ADMIN_EMAIL || currentUser.uid === ADMIN_UID;
}
function getNombre(u){return u.displayName||u.email.split('@')[0];}
function getInicial(n){return n?n.charAt(0).toUpperCase():'?';}

// ═══════════════════════════════════════════
// LOGIN / LOGOUT
// ═══════════════════════════════════════════
async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-pass').value;
  const errEl=document.getElementById('login-error'); errEl.classList.add('hidden');
  if(!email||!pass){errEl.textContent='Completa correo y contraseña.';errEl.classList.remove('hidden');return;}
  try{await auth.signInWithEmailAndPassword(email,pass);}
  catch(e){errEl.textContent='Credenciales incorrectas.';errEl.classList.remove('hidden');}
}
function doLogout(){if(mensajesListener)mensajesListener();auth.signOut();}

// ═══════════════════════════════════════════
// REGISTRO
// ═══════════════════════════════════════════
let usernameValido=false;
function selectSexo(btn){document.querySelectorAll('.sexo-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');selectedSexo=btn.dataset.sexo;}

async function verificarUsername(){
  clearTimeout(usernameTimeout);
  const input=document.getElementById('reg-username');
  let raw=input.value.toLowerCase();
  raw=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/g,'');
  input.value=raw;
  const status=document.getElementById('username-status');const hint=document.getElementById('username-hint');
  usernameValido=false;status.innerHTML='';
  if(!raw){hint.textContent='';return;}
  if(raw.length<3){hint.textContent='Mínimo 3 caracteres';hint.style.color='var(--text-muted)';return;}
  status.innerHTML=SVG_WAIT;hint.textContent='Comprobando...';hint.style.color='var(--text-muted)';
  usernameTimeout=setTimeout(async()=>{
    try{
      const snap=await db.collection('usuarios').get();
      const existe=snap.docs.some(d=>(d.data().username||'').toLowerCase()===raw);
      if(!existe){status.innerHTML=SVG_OK;hint.textContent='@'+raw+' está disponible';hint.style.color='var(--accent)';usernameValido=true;}
      else{status.innerHTML=SVG_ERR;hint.textContent='@'+raw+' ya está en uso';hint.style.color='#ff5e5e';usernameValido=false;}
    }catch(e){status.innerHTML='';hint.textContent='Error al comprobar.';hint.style.color='#ff5e5e';usernameValido=true;}
  },700);
}

async function doRegistro(){
  let username=document.getElementById('reg-username').value.toLowerCase();
  username=username.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/g,'').trim();
  const email=document.getElementById('reg-email').value.trim();
  const diaStr=document.getElementById('reg-dia').value.trim();
  const mesStr=document.getElementById('reg-mes').value.trim();
  const anioStr=document.getElementById('reg-anio').value.trim();
  const prefijo=document.getElementById('reg-prefijo').value;
  const telNum=document.getElementById('reg-telefono').value.trim();
  const pass=document.getElementById('reg-pass').value;
  const pass2=document.getElementById('reg-pass2').value;
  const errEl=document.getElementById('reg-error');const okEl=document.getElementById('reg-ok');
  errEl.classList.add('hidden');okEl.classList.add('hidden');
  if(!username||username.length<3){errEl.textContent='El @usuario debe tener al menos 3 caracteres (letras, números y _).';errEl.classList.remove('hidden');return;}
  if(!usernameValido){errEl.textContent='El @usuario no está disponible. Escríbelo y espera el ✅.';errEl.classList.remove('hidden');return;}
  if(!email){errEl.textContent='Introduce tu correo electrónico.';errEl.classList.remove('hidden');return;}
  const dia=parseInt(diaStr,10),mes=parseInt(mesStr,10),anio=parseInt(anioStr,10);
  if(!diaStr||!mesStr||!anioStr||anioStr.length<4){errEl.textContent='Introduce la fecha de nacimiento completa.';errEl.classList.remove('hidden');return;}
  if(isNaN(dia)||dia<1||dia>31){errEl.textContent='Día inválido (1-31).';errEl.classList.remove('hidden');return;}
  if(isNaN(mes)||mes<1||mes>12){errEl.textContent='Mes inválido (1-12).';errEl.classList.remove('hidden');return;}
  const anioActual=new Date().getFullYear();
  if(isNaN(anio)||anio<1920||anio>anioActual){errEl.textContent='Año inválido.';errEl.classList.remove('hidden');return;}
  const fobj=new Date(anio,mes-1,dia);
  if(fobj.getDate()!==dia||fobj.getMonth()!==mes-1){errEl.textContent=`La fecha ${dia}/${mes}/${anio} no existe.`;errEl.classList.remove('hidden');return;}
  const hoy=new Date();let edad=hoy.getFullYear()-anio;
  if(hoy.getMonth()+1<mes||(hoy.getMonth()+1===mes&&hoy.getDate()<dia))edad--;
  if(edad<18){errEl.textContent='Debes tener al menos 18 años.';errEl.classList.remove('hidden');return;}
  if(!telNum||telNum.length<6){errEl.textContent='Teléfono inválido.';errEl.classList.remove('hidden');return;}
  if(!selectedSexo){errEl.textContent='Selecciona tu sexo.';errEl.classList.remove('hidden');return;}
  if(pass.length<6){errEl.textContent='La contraseña debe tener al menos 6 caracteres.';errEl.classList.remove('hidden');return;}
  if(pass!==pass2){errEl.textContent='Las contraseñas no coinciden.';errEl.classList.remove('hidden');return;}
  try{
    const snap=await db.collection('usuarios').get();
    if(snap.docs.some(d=>(d.data().username||'').toLowerCase()===username)){errEl.textContent='Ese @usuario ya está en uso.';errEl.classList.remove('hidden');usernameValido=false;document.getElementById('username-status').innerHTML=SVG_ERR;return;}
  }catch(e){}
  try{
    const cred=await auth.createUserWithEmailAndPassword(email,pass);
    const user=cred.user;
    await user.updateProfile({displayName:username});
    const rol=email===ADMIN_EMAIL?'admin':'usuario';
    await db.collection('usuarios').doc(user.uid).set({
      uid:user.uid,username,nombre:username,email,
      fechaNacimiento:`${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${anio}`,
      edad,telefono:prefijo+' '+telNum,sexo:selectedSexo,
      seguidores:[],siguiendo:[],rol,
      creadoEn:firebase.firestore.FieldValue.serverTimestamp()
    });
    okEl.classList.remove('hidden');
  }catch(e){
    let msg='Error al crear cuenta.';
    if(e.code==='auth/email-already-in-use')msg='Ese correo ya está registrado.';
    if(e.code==='auth/invalid-email')msg='El correo no tiene formato válido.';
    if(e.code==='auth/weak-password')msg='Contraseña demasiado débil.';
    errEl.textContent=msg;errEl.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════
// NAVEGACIÓN / UI
// ═══════════════════════════════════════════
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.display='';});
  const t=document.getElementById(id);
  if(!t){console.warn('Screen no encontrada:',id);return;}
  t.style.display='flex';t.classList.add('active');
  if(id==='screen-convocar'&&!editandoRutaId){resetForm();loadRutaNames();}
  if(id==='screen-eventos'){const b=document.getElementById('btn-crear-evento');if(b)b.style.display=esAdmin()?'inline-flex':'none';}
  // Bottom nav
  const nav=document.getElementById('bottom-nav');
  const esAuth=(id==='screen-login'||id==='screen-registro');
  if(nav)nav.style.display=(!esAuth&&currentUser)?'flex':'none';
  document.body.classList.toggle('has-bottom-nav',!esAuth&&!!currentUser);
  const tabMap={'screen-rutas':'rutas','screen-detalles':'detalles','screen-buscar':'buscar','screen-chats':'chats','screen-ajustes':'ajustes'};
  document.querySelectorAll('.bottom-nav-btn').forEach(b=>b.classList.remove('active'));
  if(tabMap[id]){const ab=document.getElementById('bnav-'+tabMap[id]);if(ab)ab.classList.add('active');}
}
function navTo(dest){
  document.querySelectorAll('.bottom-nav-btn').forEach(b=>b.classList.remove('active'));
  const ab=document.getElementById('bnav-'+dest);if(ab)ab.classList.add('active');
  switch(dest){
    case 'rutas':    showScreen('screen-rutas');break;
    case 'detalles': showScreen('screen-detalles');break;
    case 'buscar':   showScreen('screen-buscar');initBuscar();break;
    case 'chats':    showScreen('screen-chats');loadChats();break;
    case 'ajustes':  showScreen('screen-ajustes');loadAjustes();break;
  }
}
function togglePass(inputId,btn){
  const input=document.getElementById(inputId);const visible=input.type==='text';
  input.type=visible?'password':'text';
  const sh=btn.querySelector('.eye-show'),hi=btn.querySelector('.eye-hide');
  if(sh)sh.style.display=visible?'block':'none';
  if(hi)hi.style.display=visible?'none':'block';
}
function volverDesdeConvocar(){editandoRutaId=null;resetForm();showScreen('screen-rutas');}

// Acordeón de ajustes
function toggleAccordion(id,btn){
  const body=document.getElementById(id);
  const estaAbierto=!body.classList.contains('hidden');
  // Cerrar todos los acordeones
  document.querySelectorAll('.aj-accordion-body').forEach(b=>{b.classList.add('hidden');});
  document.querySelectorAll('.aj-chevron').forEach(c=>{c.textContent='▼';});
  // Si estaba cerrado, abrir este
  if(estaAbierto){return;} // ya estaba abierto → queda todo cerrado
  body.classList.remove('hidden');
  const chevron=btn.querySelector('.aj-chevron');
  if(chevron)chevron.textContent='▲';
}

// ═══════════════════════════════════════════
// RUTAS
// ═══════════════════════════════════════════
async function loadRutaNames(){
  try{
    const snap=await db.collection('ruta_nombres').orderBy('nombre').get();
    rutasDisponibles=snap.docs.map(d=>({id:d.id,nombre:d.data().nombre}));
    renderSelectRuta();
  }catch(e){console.error(e);}
}
function renderSelectRuta(){
  const sel=document.getElementById('select-ruta');const prev=sel.value;
  sel.innerHTML='<option value="">— Selecciona ruta existente —</option>';
  rutasDisponibles.forEach(r=>{const o=document.createElement('option');o.value=r.nombre;o.textContent=r.nombre;sel.appendChild(o);});
  if(prev)sel.value=prev;
}
function toggleNuevaRuta(){document.getElementById('nueva-ruta-block').classList.toggle('hidden');}
async function addNuevaRuta(){
  const input=document.getElementById('nueva-ruta-input');const nombre=input.value.trim();
  if(!nombre)return;
  if(rutasDisponibles.find(r=>r.nombre.toLowerCase()===nombre.toLowerCase())){alert('Ya existe.');return;}
  try{const ref=await db.collection('ruta_nombres').add({nombre});rutasDisponibles.push({id:ref.id,nombre});renderSelectRuta();document.getElementById('select-ruta').value=nombre;input.value='';document.getElementById('nueva-ruta-block').classList.add('hidden');}
  catch(e){alert('Error: '+e.message);}
}
function selectNivel(btn){
  document.querySelectorAll('#screen-convocar .nivel-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');selectedNivel=btn.dataset.nivel;
}

// Autocompletar campos al seleccionar ruta existente
async function autocompletarRuta(nombre){
  if(!nombre)return;
  // Buscar en cache o en Firestore la última ruta con ese nombre
  if(!rutasCache[nombre]){
    try{
      const snap=await db.collection('rutas').where('nombre','==',nombre).orderBy('creadoEn','desc').limit(1).get();
      if(!snap.empty)rutasCache[nombre]=snap.docs[0].data();
    }catch(e){
      // sin indice: buscar en cliente
      try{
        const snap=await db.collection('rutas').get();
        const match=snap.docs.map(d=>d.data()).filter(r=>r.nombre===nombre).sort((a,b)=>{
          const ta=a.creadoEn?.toDate?.()?.getTime()||0;
          const tb=b.creadoEn?.toDate?.()?.getTime()||0;
          return tb-ta;
        });
        if(match.length)rutasCache[nombre]=match[0];
      }catch(e2){}
    }
  }
  const r=rutasCache[nombre];
  if(!r)return;
  if(r.hora)document.getElementById('conv-hora').value=r.hora;
  if(r.fechaISO)document.getElementById('conv-fecha').value=r.fechaISO;
  if(r.lugarUrl)document.getElementById('conv-lugar-url').value=r.lugarUrl;
  if(r.lugarDesc)document.getElementById('conv-lugar-desc').value=r.lugarDesc;
  if(r.descripcion)document.getElementById('conv-desc').value=r.descripcion;
  if(r.nivel){
    selectedNivel=r.nivel;
    document.querySelectorAll('#screen-convocar .nivel-btn').forEach(b=>b.classList.toggle('selected',b.dataset.nivel===r.nivel));
  }
}

// Colaboradores
function buscarColaboradores(){
  clearTimeout(colabBuscarTimeout);
  const q=document.getElementById('colab-search').value.toLowerCase().replace(/^@/,'').trim();
  const res=document.getElementById('colab-results');
  if(!q){res.classList.add('hidden');res.innerHTML='';return;}
  colabBuscarTimeout=setTimeout(async()=>{
    if(!todosUsuarios.length){
      const snap=await db.collection('usuarios').get();
      todosUsuarios=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.uid!==currentUser.uid);
    }
    const filtrados=todosUsuarios.filter(u=>(u.username||'').toLowerCase().includes(q)&&!colabSeleccionados.find(c=>c.uid===u.uid));
    res.innerHTML='';
    if(!filtrados.length){res.innerHTML='<p style="color:var(--text-muted);padding:8px;font-size:0.85rem">Sin resultados</p>';res.classList.remove('hidden');return;}
    filtrados.slice(0,5).forEach(u=>{
      const item=document.createElement('div');item.className='colab-result-item';
      item.innerHTML=`<div class="chat-avatar" style="width:32px;height:32px;font-size:0.9rem">${getInicial(u.username||u.nombre)}</div><span>@${u.username||u.nombre}</span>`;
      item.onclick=()=>addColab(u);res.appendChild(item);
    });
    res.classList.remove('hidden');
  },300);
}
function addColab(u){
  if(colabSeleccionados.find(c=>c.uid===u.uid))return;
  colabSeleccionados.push(u);
  renderColabs();
  document.getElementById('colab-search').value='';
  document.getElementById('colab-results').classList.add('hidden');
}
function removeColab(uid){colabSeleccionados=colabSeleccionados.filter(c=>c.uid!==uid);renderColabs();}
function renderColabs(){
  const el=document.getElementById('colab-seleccionados');
  el.innerHTML=colabSeleccionados.map(u=>`
    <div class="colab-chip">
      <span>@${u.username||u.nombre}</span>
      <button onclick="removeColab('${u.uid}')" style="background:none;border:none;color:inherit;cursor:pointer;padding:0 2px;font-size:0.85rem">✕</button>
    </div>`).join('');
}

function hoyMedianoche(){const h=new Date();h.setHours(0,0,0,0);return h;}
function parseFechaRuta(f){
  if(!f)return null;
  if(f.includes('/')){{const[d,m,y]=f.split('/');return new Date(parseInt(y),parseInt(m)-1,parseInt(d));}}
  if(f.includes('-')){{const[y,m,d]=f.split('-');return new Date(parseInt(y),parseInt(m)-1,parseInt(d));}}
  return null;
}

async function convocarRuta(){
  const errEl=document.getElementById('conv-error');const okEl=document.getElementById('conv-ok');
  errEl.classList.add('hidden');okEl.classList.add('hidden');
  const nombre=document.getElementById('select-ruta').value;
  const hora=document.getElementById('conv-hora').value;
  const fechaISO=document.getElementById('conv-fecha').value;
  const lugarUrl=document.getElementById('conv-lugar-url').value.trim();
  const lugarDesc=document.getElementById('conv-lugar-desc').value.trim();
  const desc=document.getElementById('conv-desc').value.trim();
  const nivel=selectedNivel;
  if(!nombre){showError(errEl,'Selecciona o añade un nombre de ruta.');return;}
  if(!hora){showError(errEl,'Indica la hora.');return;}
  if(!fechaISO){showError(errEl,'Indica la fecha.');return;}
  if(!lugarDesc){showError(errEl,'Añade descripción del lugar.');return;}
  if(!nivel){showError(errEl,'Selecciona el nivel.');return;}
  const[y,m,d]=fechaISO.split('-');
  const fechaDisplay=`${d}/${m}/${y}`;
  const fechaTS=new Date(parseInt(y),parseInt(m)-1,parseInt(d)).getTime();
  const convocadoresUids=[currentUser.uid,...colabSeleccionados.map(c=>c.uid)];
  const convocadoresNombres=[getNombre(currentUser),...colabSeleccionados.map(c=>c.username||c.nombre)];
  const datos={nombre,hora,fecha:fechaDisplay,fechaISO,fechaTS,lugarUrl,lugarDesc,descripcion:desc,nivel,
    convocadoPor:convocadoresNombres.join(' y '),
    convocadoPorEmail:currentUser.email,
    convocadoPorUid:currentUser.uid,
    convocadoresUids,
    cancelada:false,motivoCancelacion:''
  };
  try{
    let rutaId;
    if(editandoRutaId){await db.collection('rutas').doc(editandoRutaId).update(datos);rutaId=editandoRutaId;}
    else{datos.asistentes=[];datos.creadoEn=firebase.firestore.FieldValue.serverTimestamp();const ref=await db.collection('rutas').add(datos);rutaId=ref.id;}

    // Enviar solicitud de colaboración a los colaboradores seleccionados
    for(const colab of colabSeleccionados){
      await db.collection('solicitudes').add({
        tipo:'colaboracion_ruta',
        deUid:currentUser.uid,
        deUsername:currentUserData?.username||getNombre(currentUser),
        paraUid:colab.uid,
        rutaId,
        rutaNombre:nombre,
        estado:'pendiente',
        creadoEn:firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    editandoRutaId=null;
    okEl.classList.remove('hidden');
    setTimeout(()=>{okEl.classList.add('hidden');resetForm();showScreen('screen-ver');loadRutas();},1200);
  }catch(e){showError(errEl,'Error: '+e.message);}
}
function showError(el,msg){el.textContent=msg;el.classList.remove('hidden');}
function resetForm(){
  editandoRutaId=null;colabSeleccionados=[];
  document.getElementById('convocar-titulo').textContent='CONVOCAR RUTA';
  document.getElementById('btn-convocar-submit').textContent='CONVOCAR RUTA';
  ['select-ruta','conv-hora','conv-fecha','conv-lugar-url','conv-lugar-desc','conv-desc','colab-search']
    .forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.querySelectorAll('#screen-convocar .nivel-btn').forEach(b=>b.classList.remove('selected'));
  selectedNivel=null;
  document.getElementById('nueva-ruta-block').classList.add('hidden');
  document.getElementById('nueva-ruta-input').value='';
  document.getElementById('colab-results').classList.add('hidden');
  renderColabs();
  document.getElementById('conv-error').classList.add('hidden');
  document.getElementById('conv-ok').classList.add('hidden');
}

async function editarRuta(id){
  const snap=await db.collection('rutas').doc(id).get();if(!snap.exists)return;
  const r=snap.data();editandoRutaId=id;
  await loadRutaNames();
  document.getElementById('convocar-titulo').textContent='EDITAR RUTA';
  document.getElementById('btn-convocar-submit').textContent='GUARDAR CAMBIOS';
  document.getElementById('select-ruta').value=r.nombre||'';
  document.getElementById('conv-hora').value=r.hora||'';
  document.getElementById('conv-fecha').value=r.fechaISO||'';
  document.getElementById('conv-lugar-url').value=r.lugarUrl||'';
  document.getElementById('conv-lugar-desc').value=r.lugarDesc||'';
  document.getElementById('conv-desc').value=r.descripcion||'';
  selectedNivel=r.nivel;
  document.querySelectorAll('#screen-convocar .nivel-btn').forEach(b=>b.classList.toggle('selected',b.dataset.nivel===r.nivel));
  colabSeleccionados=[];renderColabs();
  document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.display='';});
  const t=document.getElementById('screen-convocar');t.style.display='flex';t.classList.add('active');
}

async function cancelarRuta(id){
  const motivo=prompt('Motivo de cancelación (ej: por lluvia):');
  if(motivo===null)return;
  if(!motivo.trim()){alert('Debes indicar un motivo.');return;}
  try{
    await db.collection('rutas').doc(id).update({cancelada:true,motivoCancelacion:motivo.trim()});
    loadRutas();
  }catch(e){alert('Error: '+e.message);}
}
async function deshacerCancelacion(id){
  if(!confirm('¿Deshacer la cancelación y reactivar la ruta?'))return;
  try{
    await db.collection('rutas').doc(id).update({cancelada:false,motivoCancelacion:''});
    loadRutas();
  }catch(e){alert('Error: '+e.message);}
}

async function loadRutas(){
  const listEl=document.getElementById('rutas-list');const emptyEl=document.getElementById('rutas-empty');
  listEl.innerHTML='<p style="color:var(--text-muted);padding:20px">Cargando rutas...</p>';emptyEl.classList.add('hidden');
  try{
    const snap=await db.collection('rutas').get();
    if(snap.empty){listEl.innerHTML='';emptyEl.classList.remove('hidden');return;}
    const hoy=hoyMedianoche();
    const manana=new Date(hoy);manana.setDate(hoy.getDate()+1);
    const dow=hoy.getDay();
    const findeStart=new Date(hoy);findeStart.setDate(hoy.getDate()+(dow===0?0:dow===6?0:6-dow));
    const findeEnd=new Date(findeStart);findeEnd.setDate(findeStart.getDate()+(findeStart.getDay()===6?1:0));
    const grupos={hoy:[],manana:[],finde:[],otras:[],pasadas:[]};
    snap.docs.forEach(doc=>{
      const r={id:doc.id,...doc.data()};
      const f=parseFechaRuta(r.fecha||r.fechaISO);
      if(!f){grupos.otras.push(r);return;}
      if(f<hoy)grupos.pasadas.push(r);
      else if(f.getTime()===hoy.getTime())grupos.hoy.push(r);
      else if(f.getTime()===manana.getTime())grupos.manana.push(r);
      else if(f>=findeStart&&f<=findeEnd)grupos.finde.push(r);
      else grupos.otras.push(r);
    });
    const sortAsc=(a,b)=>(parseFechaRuta(a.fecha||a.fechaISO)||new Date(0)).getTime()-(parseFechaRuta(b.fecha||b.fechaISO)||new Date(0)).getTime();
    const sortDesc=(a,b)=>(parseFechaRuta(b.fecha||b.fechaISO)||new Date(0)).getTime()-(parseFechaRuta(a.fecha||a.fechaISO)||new Date(0)).getTime();
    grupos.hoy.sort(sortAsc);grupos.manana.sort(sortAsc);grupos.finde.sort(sortAsc);grupos.otras.sort(sortAsc);grupos.pasadas.sort(sortDesc);
    listEl.innerHTML='';
    const secciones=[
      {key:'hoy',label:'HOY',cls:'sec-hoy',pasada:false},
      {key:'manana',label:'MAÑANA',cls:'sec-manana',pasada:false},
      {key:'finde',label:'ESTE FIN DE SEMANA',cls:'sec-finde',pasada:false},
      {key:'otras',label:'OTRAS RUTAS PRÓXIMAS',cls:'sec-otras',pasada:false},
      {key:'pasadas',label:'FINALIZADAS',cls:'sec-pasadas',pasada:true},
    ];
    secciones.forEach(sec=>{
      if(!grupos[sec.key].length)return;
      const secDiv=document.createElement('div');secDiv.className='rutas-seccion';
      secDiv.innerHTML=`<div class="rutas-seccion-titulo ${sec.cls}"><span class="sec-dot"></span>${sec.label} <span style="opacity:0.5;font-size:0.75em">(${grupos[sec.key].length})</span></div>`;
      const grid=document.createElement('div');grid.className='rutas-grid';
      grupos[sec.key].forEach((r,i)=>{
        const pasada=sec.pasada;
        const cancelada=r.cancelada===true;
        const card=document.createElement('div');
        card.className='ruta-card'+(pasada?' pasada':'')+(cancelada?' cancelada':'');
        card.dataset.nivel=r.nivel||'';
        card.style.animationDelay=`${i*0.05}s`;
        const lugarHTML=r.lugarUrl?`<span class="ruta-tag lugar">📍 <a href="${r.lugarUrl}" target="_blank">${r.lugarDesc||''}</a></span>`:`<span class="ruta-tag">📍 ${r.lugarDesc||''}</span>`;
        const asistentes=Array.isArray(r.asistentes)?r.asistentes:[];
        const num=asistentes.length;const yaApuntado=asistentes.includes(currentUser.uid);
        const esConvocador=Array.isArray(r.convocadoresUids)?r.convocadoresUids.includes(currentUser.uid):(currentUser.uid===r.convocadoPorUid||currentUser.email===r.convocadoPorEmail);
        const puedoEditar=!pasada&&!cancelada&&(esConvocador||esAdmin());
        const puedoCancelar=!pasada&&!cancelada&&(esConvocador||esAdmin());
        const btnApuntar=(!pasada&&!cancelada)?`<button class="btn-apuntarse ${yaApuntado?'apuntado':'no-apuntado'}" onclick="toggleAsistencia('${r.id}',${yaApuntado})">${yaApuntado?'✓ Apuntado':'+ Apuntarme'}</button>`:'';
        const btnEditar=puedoEditar?`<button class="btn-editar-ruta" onclick="editarRuta('${r.id}')">✏️ Editar</button>`:'';
        const btnCancelar=puedoCancelar?`<button class="btn-editar-ruta" style="border-color:rgba(255,60,60,0.4);color:#ff5e5e" onclick="cancelarRuta('${r.id}')">✕ Cancelar</button>`:'';
        const btnDeshacer=(cancelada&&(esConvocador||esAdmin()))?`<button class="btn-deshacer-cancelar" onclick="deshacerCancelacion('${r.id}')">↩ Reactivar</button>`:'';
        const canceladaBadge=cancelada?`
          <div class="cancelada-overlay">
            <div class="cancelada-stamp">CANCELADA</div>
            ${r.motivoCancelacion?`<div class="cancelada-motivo-text">${r.motivoCancelacion}</div>`:''}
          </div>`:'';
        card.innerHTML=`
          ${canceladaBadge}
          <p class="ruta-convocado">Convocado por <span>@${r.convocadoPor||''}</span></p>
          <h3 class="ruta-nombre">${r.nombre||''}</h3>
          <div class="ruta-meta"><span class="ruta-tag">🕐 ${r.hora||''} · ${r.fecha||''}</span>${lugarHTML}</div>
          ${r.descripcion?`<p class="ruta-desc">${r.descripcion}</p>`:''}
          <span class="nivel-badge">${nivelLabel(r.nivel)}</span>
          <div class="ruta-footer">
            <div class="ruta-counter">🛼 <strong>${num}</strong> persona${num!==1?'s':''} acude${num!==1?'n':''}</div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${btnApuntar}${btnEditar}${btnCancelar}${btnDeshacer}</div>
          </div>`;
        grid.appendChild(card);
      });
      secDiv.appendChild(grid);listEl.appendChild(secDiv);
    });
    if(!listEl.innerHTML.trim())emptyEl.classList.remove('hidden');
  }catch(e){listEl.innerHTML=`<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;}
}

async function toggleAsistencia(id,yaApuntado){
  try{await db.collection('rutas').doc(id).update({asistentes:yaApuntado?firebase.firestore.FieldValue.arrayRemove(currentUser.uid):firebase.firestore.FieldValue.arrayUnion(currentUser.uid)});loadRutas();}
  catch(e){console.error(e);}
}
function nivelLabel(n){return{aprendiendo:'🐣 Aprendiendo',principiante:'🟢 Principiante',medio:'🟡 Medio',cañero:'🔥 Cañero'}[n]||n||'';}

// ═══════════════════════════════════════════
// SOLICITUDES
// ═══════════════════════════════════════════
function escucharSolicitudes(){
  db.collection('solicitudes').where('paraUid','==',currentUser.uid).where('estado','==','pendiente')
    .onSnapshot(snap=>{
      const badge=document.getElementById('home-sol-badge');
      if(snap.size>0){badge.textContent=snap.size>99?'99+':snap.size;badge.classList.remove('hidden');}
      else badge.classList.add('hidden');
    });
}

let solTabIndex=0;
async function loadSolicitudes(){solTabIndex=0;swipeSolTo(0);}

function swipeSolTo(idx){
  solTabIndex=idx;
  const track=document.getElementById('sol-swipe-track');
  if(track)track.style.transform=`translateX(-${idx*100}%)`;
  document.querySelectorAll('#sol-tabs-bar .seg-tab').forEach((t,i)=>t.classList.toggle('active',i===idx));
  renderSolPanel(idx);
}

const SOL_TIPOS=['solicitud_seguir','participar_ruta','colaboracion_ruta'];

async function renderSolPanel(idx){
  const listId=`sol-list-${idx}`;const emptyId=`sol-empty-${idx}`;
  const listEl=document.getElementById(listId);const emptyEl=document.getElementById(emptyId);
  if(!listEl)return;
  listEl.innerHTML='<p style="color:var(--text-muted);padding:20px">Cargando...</p>';emptyEl?.classList.add('hidden');
  try{
    const tipo=SOL_TIPOS[idx];
    const snap=await db.collection('solicitudes').where('paraUid','==',currentUser.uid).where('tipo','==',tipo).where('estado','==','pendiente').get();
    if(snap.empty){listEl.innerHTML='';emptyEl?.classList.remove('hidden');return;}
    listEl.innerHTML='';
    snap.docs.forEach((doc,i)=>{
      const s=doc.data();const sid=doc.id;
      const item=document.createElement('div');item.className='sol-item';item.style.animationDelay=`${i*0.04}s`;
      let texto='';
      if(tipo==='solicitud_seguir')texto=`<strong>@${s.deUsername}</strong> quiere seguirte`;
      else if(tipo==='participar_ruta')texto=`<strong>@${s.deUsername}</strong> quiere participar en <em>${s.rutaNombre}</em>`;
      else texto=`<strong>@${s.deUsername}</strong> te invita a colaborar en <em>${s.rutaNombre}</em>`;
      item.innerHTML=`
        <div class="chat-avatar">${getInicial(s.deUsername||'?')}</div>
        <div style="flex:1"><p style="font-size:0.9rem">${texto}</p></div>
        <div style="display:flex;gap:8px">
          <button class="btn-sol-aceptar" onclick="responderSolicitud('${sid}','aceptar',${idx})">✓</button>
          <button class="btn-sol-rechazar" onclick="responderSolicitud('${sid}','rechazar',${idx})">✕</button>
        </div>`;
      listEl.appendChild(item);
    });
  }catch(e){listEl.innerHTML=`<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;}
}

// Swipe táctil para solicitudes
(function initSwipeSol(){
  let sx=0,sy=0;
  document.addEventListener('DOMContentLoaded',()=>{
    const cont=document.getElementById('sol-swipe-container');
    if(!cont)return;
    cont.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
    cont.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-sx;const dy=e.changedTouches[0].clientY-sy;
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
        if(dx<0&&solTabIndex<2)swipeSolTo(solTabIndex+1);
        else if(dx>0&&solTabIndex>0)swipeSolTo(solTabIndex-1);
      }
    },{passive:true});
  });
})();

function switchSolTab(tab,btn){}

async function responderSolicitud(sid,accion,panelIdx=0){
  const snap=await db.collection('solicitudes').doc(sid).get();if(!snap.exists)return;
  const s=snap.data();
  await db.collection('solicitudes').doc(sid).update({estado:accion==='aceptar'?'aceptado':'rechazado'});
  if(accion==='aceptar'){
    if(s.tipo==='solicitud_seguir'){
      // Aceptar seguidor: actualizar seguidores/siguiendo
      await db.collection('usuarios').doc(currentUser.uid).update({seguidores:firebase.firestore.FieldValue.arrayUnion(s.deUid)});
      await db.collection('usuarios').doc(s.deUid).update({siguiendo:firebase.firestore.FieldValue.arrayUnion(currentUser.uid)});
    } else if(s.tipo==='colaboracion_ruta'&&s.rutaId){
      // Aceptar colaboración: añadir a convocadoresUids
      const rutaSnap=await db.collection('rutas').doc(s.rutaId).get();
      if(rutaSnap.exists){
        const r=rutaSnap.data();
        const nuevosUids=[...(r.convocadoresUids||[]),currentUser.uid];
        const nuevosNombres=r.convocadoPor+' y '+(currentUserData?.username||getNombre(currentUser));
        await db.collection('rutas').doc(s.rutaId).update({convocadoresUids:nuevosUids,convocadoPor:nuevosNombres});
      }
    }
  }
  renderSolPanel(panelIdx);
}

// ═══════════════════════════════════════════
// EVENTOS
// ═══════════════════════════════════════════
const EVENTO_COLORES=[
  {bg:'#111820',accent:'#c8ff00',border:'rgba(200,255,0,0.3)'},
  {bg:'#150f20',accent:'#b06aff',border:'rgba(176,106,255,0.3)'},
  {bg:'#0d1a10',accent:'#7ed321',border:'rgba(126,211,33,0.3)'},
  {bg:'#1a0f15',accent:'#ff5eb3',border:'rgba(255,94,179,0.3)'},
  {bg:'#0d1618',accent:'#00d4ff',border:'rgba(0,212,255,0.3)'},
  {bg:'#1a1108',accent:'#ff8c00',border:'rgba(255,140,0,0.3)'},
];

function formatFechaEvento(iso){
  if(!iso)return'';
  const[y,m,d]=iso.split('-');
  const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
}
function formatFechaEventoLarga(iso){
  if(!iso)return'';
  const[y,m,d]=iso.split('-');
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
}

function abrirCrearEvento(){
  editandoEventoId=null;itinerarioItems=[];
  document.getElementById('crear-evento-titulo').textContent='NUEVO EVENTO';
  document.getElementById('btn-ev-submit').textContent='PUBLICAR EVENTO';
  ['ev-nombre','ev-ciudad','ev-fecha-inicio','ev-fecha-fin','ev-desc'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('ev-error').classList.add('hidden');
  document.getElementById('ev-ok').classList.add('hidden');
  document.getElementById('itinerario-list').innerHTML='';
  showScreen('screen-crear-evento');
}
function getDiasEvento(){
  const inicio=document.getElementById('ev-fecha-inicio')?.value;
  const fin=document.getElementById('ev-fecha-fin')?.value;
  if(!inicio)return[];
  const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const dias=[];
  const d0=new Date(inicio);
  const d1=fin?new Date(fin):d0;
  const diasMax=14; let count=0;
  const cur=new Date(d0);
  while(cur<=d1&&count<diasMax){
    const label=`${cur.getDate()} ${meses[cur.getMonth()]}`;
    dias.push({iso:cur.toISOString().split('T')[0],label});
    cur.setDate(cur.getDate()+1);count++;
  }
  return dias;
}
function buildDiaOptions(valorActual){
  const dias=getDiasEvento();
  if(!dias.length)return`<option value="">—</option>`;
  return dias.map(d=>`<option value="${d.iso}" ${d.iso===valorActual?'selected':''}>${d.label}</option>`).join('');
}
function addItinerarioItem(dia='',hora='',lugar='',desc=''){
  const idx=itinerarioItems.length;itinerarioItems.push({dia,hora,lugar,desc});
  const bloque=document.createElement('div');bloque.className='itinerario-bloque';
  bloque.innerHTML=`
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select class="it-dia-select" style="flex:1;min-width:100px" onchange="itinerarioItems[${idx}].dia=this.value">
        ${buildDiaOptions(dia)}
      </select>
      <input type="time" class="it-hora-input" value="${hora}" placeholder="HH:MM" style="width:100px" oninput="itinerarioItems[${idx}].hora=this.value"/>
      <button class="btn-remove-it" onclick="removeItinerarioItem(${idx})">✕</button>
    </div>
    <input type="text" value="${lugar}" placeholder="Punto de encuentro" style="margin-top:6px" oninput="itinerarioItems[${idx}].lugar=this.value"/>
    <input type="text" value="${desc}" placeholder="Descripción de la actividad" style="margin-top:6px;font-size:0.85rem" oninput="itinerarioItems[${idx}].desc=this.value"/>`;
  document.getElementById('itinerario-list').appendChild(bloque);
}
function removeItinerarioItem(idx){
  itinerarioItems.splice(idx,1);
  const cont=document.getElementById('itinerario-list');cont.innerHTML='';
  const copy=[...itinerarioItems];itinerarioItems=[];
  copy.forEach(it=>addItinerarioItem(it.dia,it.hora,it.lugar,it.desc));
}
// Actualizar días al cambiar fechas
function onFechaEventoChange(){
  const cont=document.getElementById('itinerario-list');
  if(!cont)return;
  cont.innerHTML='';
  const copy=[...itinerarioItems];itinerarioItems=[];
  copy.forEach(it=>addItinerarioItem(it.dia,it.hora,it.lugar,it.desc));
}
async function guardarEvento(){
  const nombre=document.getElementById('ev-nombre').value.trim();
  const ciudad=document.getElementById('ev-ciudad').value.trim();
  const fechaInicio=document.getElementById('ev-fecha-inicio').value;
  const fechaFin=document.getElementById('ev-fecha-fin').value;
  const desc=document.getElementById('ev-desc').value.trim();
  const errEl=document.getElementById('ev-error');const okEl=document.getElementById('ev-ok');
  errEl.classList.add('hidden');okEl.classList.add('hidden');
  if(!nombre){showError(errEl,'Introduce el nombre del evento.');return;}
  if(!ciudad){showError(errEl,'Introduce la ciudad.');return;}
  if(!fechaInicio){showError(errEl,'Introduce la fecha de inicio.');return;}
  const itLimpio=itinerarioItems.filter(it=>it.lugar.trim()).map(it=>({dia:it.dia||'',hora:it.hora||'',lugar:it.lugar.trim(),desc:it.desc?.trim()||''}));
  const datos={nombre,ciudad,fechaInicio,fechaFin:fechaFin||fechaInicio,descripcion:desc,itinerario:itLimpio,
    creadoPor:getNombre(currentUser),creadoPorEmail:currentUser.email,creadoPorUid:currentUser.uid};
  try{
    if(editandoEventoId){await db.collection('eventos').doc(editandoEventoId).update(datos);}
    else{datos.creadoEn=firebase.firestore.FieldValue.serverTimestamp();await db.collection('eventos').add(datos);}
    editandoEventoId=null;
    okEl.classList.remove('hidden');
    setTimeout(()=>{okEl.classList.add('hidden');showScreen('screen-eventos');loadEventos();},1200);
  }catch(e){showError(errEl,'Error: '+e.message);}
}

// ── Renderizar itinerario de evento con separadores por día ──
function renderItinerarioEvento(itinerario, accentColor){
  if(!itinerario||!itinerario.length)return'';
  const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const grupos={};
  itinerario.forEach(it=>{const k=it.dia||'';if(!grupos[k])grupos[k]=[];grupos[k].push(it);});
  let html='<div class="itinerario-block">';
  html+=`<p class="itinerario-titulo" style="color:${accentColor}">📍 Itinerario</p>`;
  Object.keys(grupos).sort().forEach(dia=>{
    if(dia){
      const[y,m,d]=dia.split('-');
      const dow=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][new Date(dia).getDay()];
      html+=`<div class="itinerario-dia-sep" style="color:${accentColor}">${dow} ${parseInt(d)} ${meses[parseInt(m)-1]}</div>`;
    }
    grupos[dia].forEach(it=>{
      html+=`<div class="itinerario-item-display">
        <span class="it-hora" style="color:${accentColor}">${it.hora||''}</span>
        <div><span class="it-lugar" style="font-weight:600">${escapeHtml(it.lugar)}</span>
        ${it.desc?`<br><span style="font-size:0.8rem;opacity:0.7">${escapeHtml(it.desc)}</span>`:''}</div>
      </div>`;
    });
  });
  html+='</div>';return html;
}

async function loadEventos(){
  const listEl=document.getElementById('eventos-list');const emptyEl=document.getElementById('eventos-empty');
  listEl.innerHTML='<p style="color:var(--text-muted);padding:20px">Cargando eventos...</p>';emptyEl.classList.add('hidden');
  const btnCrear=document.getElementById('btn-crear-evento');
  if(btnCrear)btnCrear.style.display=esAdmin()?'inline-flex':'none';
  try{
    const snap=await db.collection('eventos').get();
    if(snap.empty){listEl.innerHTML='';emptyEl.classList.remove('hidden');return;}
    const docs=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.fechaInicio||'').localeCompare(b.fechaInicio||''));
    listEl.innerHTML='';
    docs.forEach((ev,i)=>{
      const col=EVENTO_COLORES[i%EVENTO_COLORES.length];
      // Construir fecha legible
      let fechaStr='';
      if(ev.fechaInicio&&ev.fechaFin&&ev.fechaFin!==ev.fechaInicio){
        const[yi,mi,di]=ev.fechaInicio.split('-');const[yf,mf,df]=ev.fechaFin.split('-');
        const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const diasInicio=parseInt(di),diasFin=parseInt(df);
        const dias=[];for(let x=diasInicio;x<=diasFin;x++)dias.push(x);
        if(dias.length<=4&&mi===mf)fechaStr=dias.join(', ')+' de '+meses[parseInt(mi)-1]+' '+yi;
        else fechaStr=`${formatFechaEvento(ev.fechaInicio)} – ${formatFechaEvento(ev.fechaFin)}`;
      }else if(ev.fechaInicio){fechaStr=formatFechaEventoLarga(ev.fechaInicio);}

      const detalleId='ev-det-'+ev.id;
      const itHTML=ev.itinerario&&ev.itinerario.length?renderItinerarioEvento(ev.itinerario,col.accent):'';
      const btnEditar=esAdmin()?`<button class="btn-editar-evento" onclick="editarEvento('${ev.id}')" style="border-color:${col.border};color:${col.accent};margin-top:12px">✏️ Editar evento</button>`:'';

      const card=document.createElement('div');
      card.className='evento-card-new';
      card.style.cssText=`background:${col.bg};border-color:${col.border};`;
      card.style.animationDelay=`${i*0.07}s`;
      card.innerHTML=`
        <div class="evento-header" onclick="toggleEventoDetalle('${detalleId}',this)">
          <div class="evento-header-info">
            <h3 class="evento-nombre" style="color:${col.accent}">${ev.nombre}</h3>
            <div class="evento-subtitulo">
              <span class="evento-tag-mini" style="color:${col.accent};border-color:${col.border}">📍 ${ev.ciudad}</span>
              <span class="evento-tag-mini" style="opacity:0.75">📅 ${fechaStr}</span>
            </div>
          </div>
          <span class="evento-chevron" style="color:${col.accent}">▼</span>
        </div>
        <div class="evento-detalle" id="${detalleId}" style="display:none">
          ${ev.descripcion?`<p class="evento-desc">${escapeHtml(ev.descripcion)}</p>`:''}
          ${itHTML}
          ${btnEditar}
        </div>`;
      listEl.appendChild(card);
    });
  }catch(e){listEl.innerHTML=`<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;}
}
function toggleEventoDetalle(id,headerEl){
  const det=document.getElementById(id);const chev=headerEl.querySelector('.evento-chevron');
  if(!det)return;const abierto=det.style.display!=='none';
  det.style.display=abierto?'none':'block';if(chev)chev.textContent=abierto?'▼':'▲';
}
async function editarEvento(id){
  const snap=await db.collection('eventos').doc(id).get();if(!snap.exists)return;
  const ev=snap.data();editandoEventoId=id;itinerarioItems=[];
  document.getElementById('crear-evento-titulo').textContent='EDITAR EVENTO';
  document.getElementById('btn-ev-submit').textContent='GUARDAR CAMBIOS';
  document.getElementById('ev-nombre').value=ev.nombre||'';
  document.getElementById('ev-ciudad').value=ev.ciudad||'';
  document.getElementById('ev-fecha-inicio').value=ev.fechaInicio||'';
  document.getElementById('ev-fecha-fin').value=ev.fechaFin||'';
  document.getElementById('ev-desc').value=ev.descripcion||'';
  document.getElementById('ev-error').classList.add('hidden');
  document.getElementById('ev-ok').classList.add('hidden');
  document.getElementById('itinerario-list').innerHTML='';
  (ev.itinerario||[]).forEach(it=>addItinerarioItem(it.dia||'',it.hora||'',it.lugar||'',it.desc||''));
  showScreen('screen-crear-evento');
}

// ═══════════════════════════════════════════
// SEGUIDORES
// ═══════════════════════════════════════════
let segTabIndex=0;
async function loadSeguidores(){segTabIndex=0;swipeSegTo(0);}

function swipeSegTo(idx){
  segTabIndex=idx;
  const track=document.getElementById('seg-swipe-track');
  if(track)track.style.transform=`translateX(-${idx*100}%)`;
  document.querySelectorAll('#seg-tabs-bar .seg-tab').forEach((t,i)=>t.classList.toggle('active',i===idx));
  renderSegPanel(idx);
}

async function renderSegPanel(idx){
  const panelId=`seg-panel-${idx}`;const listId=`seg-list-${idx}`;const emptyId=`seg-empty-${idx}`;
  const listEl=document.getElementById(listId);const emptyEl=document.getElementById(emptyId);
  if(!listEl)return;
  listEl.innerHTML='<p style="color:var(--text-muted);padding:20px">Cargando...</p>';emptyEl?.classList.add('hidden');
  try{
    const miSnap=await db.collection('usuarios').doc(currentUser.uid).get();
    const miData=miSnap.exists?miSnap.data():{seguidores:[],siguiendo:[]};
    const miSiguiendo=miData.siguiendo||[];
    const lista=idx===0?miSiguiendo:(miData.seguidores||[]);
    if(!lista.length){listEl.innerHTML='';emptyEl?.classList.remove('hidden');return;}
    listEl.innerHTML='';
    for(let i=0;i<lista.length;i++){
      const uid=lista[i];const uSnap=await db.collection('usuarios').doc(uid).get();
      const u=uSnap.exists?uSnap.data():{username:uid,nombre:uid};
      const yaSigo=miSiguiendo.includes(uid);
      const item=document.createElement('div');item.className='seg-user-item';item.style.animationDelay=`${i*0.04}s`;
      item.innerHTML=`
        <div class="chat-avatar">${getInicial(u.username||u.nombre||'?')}</div>
        <div class="seg-user-info">
          <p class="seg-username seg-user-nombre-link" onclick="verPerfilDesdeSeguidores('${uid}')" title="Ver perfil">@${u.username||u.nombre}</p>
          <p class="seg-realname">${(u.nombre&&u.nombre!==u.username)?u.nombre:''}</p>
        </div>
        <button class="btn-seguir ${yaSigo?'siguiendo':'no-siguiendo'}" onclick="toggleSeguir('${uid}',${yaSigo},this)">${yaSigo?'Siguiendo':'Seguir'}</button>`;
      listEl.appendChild(item);
    }
  }catch(e){listEl.innerHTML=`<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;}
}

// Swipe táctil para seguidores
(function initSwipeSeg(){
  let sx=0,sy=0;
  document.addEventListener('DOMContentLoaded',()=>{
    const cont=document.getElementById('seg-swipe-container');
    if(!cont)return;
    cont.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
    cont.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-sx;const dy=e.changedTouches[0].clientY-sy;
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
        if(dx<0&&segTabIndex<1)swipeSegTo(segTabIndex+1);
        else if(dx>0&&segTabIndex>0)swipeSegTo(segTabIndex-1);
      }
    },{passive:true});
  });
})();

async function verPerfilDesdeSeguidores(uid){
  perfilVistoPrevScreen='screen-seguidores';
  const snap=await db.collection('usuarios').doc(uid).get();
  const u=snap.exists?snap.data():{uid,nombre:uid};
  await verPerfilUsuario({uid,...u});
}

// Alias para compatibilidad
function switchSegTab(tab,btn){}

// ── Buscador en tiempo real en Seguidores ──
let segSearchTimeout=null;
async function buscarEnSeguidores(){
  clearTimeout(segSearchTimeout);
  const q=document.getElementById('seg-search-input')?.value.trim().toLowerCase().replace(/^@/,'');
  const panelIdx=segTabIndex||0;
  if(!q){renderSegPanel(panelIdx);return;}
  segSearchTimeout=setTimeout(async()=>{
    const listId=`seg-list-${panelIdx}`;
    const listEl=document.getElementById(listId);
    if(!listEl)return;
    listEl.innerHTML='';
    const miSnap=await db.collection('usuarios').doc(currentUser.uid).get();
    const miData=miSnap.exists?miSnap.data():{siguiendo:[],seguidores:[]};
    const miSiguiendo=miData.siguiendo||[];
    const lista=panelIdx===0?miSiguiendo:(miData.seguidores||[]);
    const resultados=[];
    for(const uid of lista){
      const uSnap=await db.collection('usuarios').doc(uid).get();
      const u=uSnap.exists?uSnap.data():{username:uid,nombre:uid};
      if((u.username||'').toLowerCase().includes(q)||(u.nombre||'').toLowerCase().includes(q)){
        resultados.push({uid,u});
      }
    }
    if(!resultados.length){listEl.innerHTML='<p style="color:var(--text-muted);padding:16px">Sin resultados</p>';return;}
    resultados.forEach(({uid,u},i)=>{
      const yaSigo=miSiguiendo.includes(uid);
      const item=document.createElement('div');item.className='seg-user-item';item.style.animationDelay=`${i*0.04}s`;
      item.innerHTML=`
        <div class="chat-avatar" style="cursor:pointer" onclick="verPerfilDesdeSeguidores('${uid}')">${getInicial(u.username||u.nombre||'?')}</div>
        <div class="seg-user-info" style="cursor:pointer" onclick="verPerfilDesdeSeguidores('${uid}')">
          <p class="seg-username seg-user-nombre-link">@${u.username||u.nombre}</p>
          <p class="seg-realname">${(u.nombre&&u.nombre!==u.username)?u.nombre:''}</p>
        </div>
        <button class="btn-seguir ${yaSigo?'siguiendo':'no-siguiendo'}" onclick="toggleSeguir('${uid}',${yaSigo},this)">${yaSigo?'Siguiendo':'Seguir'}</button>`;
      listEl.appendChild(item);
    });
  },250);
}
async function toggleSeguir(targetUid,yaSigo,btn){
  const miRef=db.collection('usuarios').doc(currentUser.uid);
  const elRef=db.collection('usuarios').doc(targetUid);
  try{
    if(yaSigo){
      await miRef.update({siguiendo:firebase.firestore.FieldValue.arrayRemove(targetUid)});
      await elRef.update({seguidores:firebase.firestore.FieldValue.arrayRemove(currentUser.uid)});
      btn.textContent='Seguir';btn.className='btn-seguir no-siguiendo';btn.onclick=()=>toggleSeguir(targetUid,false,btn);
    }else{
      // Enviar solicitud de seguidor
      await db.collection('solicitudes').add({
        tipo:'solicitud_seguir',deUid:currentUser.uid,
        deUsername:currentUserData?.username||getNombre(currentUser),
        paraUid:targetUid,estado:'pendiente',
        creadoEn:firebase.firestore.FieldValue.serverTimestamp()
      });
      btn.textContent='Pendiente';btn.className='btn-seguir siguiendo';btn.disabled=true;
    }
  }catch(e){console.error(e);}
}

// ═══════════════════════════════════════════
// TARJETAS USUARIOS
// ═══════════════════════════════════════════
const CAMPOS_MATCH=['hobby','musica','animal','color','estudios','sexo'];
function getCheckboxValues(prefijo,vals){
  if(Array.isArray(vals))return vals;
  if(typeof vals==='string'&&vals)return[vals];
  return[];
}
function calcularScore(yo,otro){
  if(!yo||!otro)return 0;
  let score=0;
  CAMPOS_MATCH.forEach(k=>{if(yo[k]&&otro[k]&&(yo[k]).toString().toLowerCase()===(otro[k]).toString().toLowerCase())score++;});
  // Busco / me gustan / estado como arrays
  const yoBusco=getCheckboxValues('',yo.relacionBusco||yo.busco);
  const otroBusco=getCheckboxValues('',otro.relacionBusco||otro.busco);
  if(yoBusco.some(v=>otroBusco.includes(v)))score++;
  return score;
}
function perfilCompleto(u){return u&&u.descripcion&&u.edad&&u.sexo;}

// ═══ TARJETAS SWIPER ═══════════════════════════
let swiperUsuarios=[];
let swiperIdx=0;

async function loadTarjetas(){
  const emEl=document.getElementById('tarjetas-empty');
  const stack=document.getElementById('swiper-stack');
  if(!stack)return;
  stack.innerHTML='';emEl?.classList.add('hidden');
  try{
    const[miSnap,allSnap]=await Promise.all([
      db.collection('usuarios').doc(currentUser.uid).get(),
      db.collection('usuarios').get()
    ]);
    const yo=miSnap.exists?miSnap.data():null;
    if(!perfilCompleto(yo)){
      emEl?.classList.remove('hidden');
      if(emEl)emEl.innerHTML='¡Completa tu perfil para ver tarjetas!<br><small>Necesitas: descripción, edad y sexo.</small><br><br><button class="btn-primary" style="max-width:220px;margin-top:12px" onclick="showScreen('screen-ajustes');loadAjustes()">IR A AJUSTES</button>';
      return;
    }
    // Filtrar usuarios con citas activas y perfil completo, excluir ya valorados
    const yaValorados=new Set((yo.swipes||[]).map(s=>s.uid));
    let usuarios=allSnap.docs.map(d=>({uid:d.id,...d.data()}))
      .filter(u=>u.uid!==currentUser.uid&&perfilCompleto(u)&&u.citasActivo&&!yaValorados.has(u.uid));
    usuarios=usuarios.map(u=>({...u,_score:calcularScore(yo,u)})).sort((a,b)=>b._score-a._score);
    if(!usuarios.length){
      emEl?.classList.remove('hidden');
      if(emEl)emEl.innerHTML='¡Has visto todas las tarjetas! Vuelve más tarde 🛼';
      return;
    }
    swiperUsuarios=usuarios;swiperIdx=0;
    renderSwiperStack();
    initSwiperGestures();
  }catch(e){
    stack.innerHTML=`<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;
  }
}

function renderSwiperStack(){
  const stack=document.getElementById('swiper-stack');
  if(!stack)return;
  stack.innerHTML='';
  // Mostrar hasta 3 cartas apiladas
  const visible=swiperUsuarios.slice(swiperIdx,swiperIdx+3);
  if(!visible.length){
    document.getElementById('tarjetas-empty')?.classList.remove('hidden');
    document.getElementById('tarjetas-empty').innerHTML='¡Has visto todas las tarjetas! 🛼';
    return;
  }
  [...visible].reverse().forEach((u,vi)=>{
    const posClass=vi===2?'is-top':vi===1?'is-below':'is-below2';
    const card=document.createElement('div');
    card.className=`swiper-card ${posClass}`;
    if(vi===2) card.dataset.uid=u.uid;
    const stars='★'.repeat(Math.min(u._score,5))+'☆'.repeat(Math.max(0,5-u._score));
    const estado=Array.isArray(u.relacionEstado)?u.relacionEstado.join(', '):(u.relacionEstado||'');
    const busco=Array.isArray(u.relacionBusco)?u.relacionBusco.join(', '):(u.relacionBusco||'');
    const gustan=Array.isArray(u.gustanMe)?u.gustanMe.join(', '):(u.gustanMe||'');
    card.innerHTML=`
      <div class="swipe-lbl swipe-lbl-like">LIKE ♥</div>
      <div class="swipe-lbl swipe-lbl-nope">NOPE ✕</div>
      <div class="swipe-lbl swipe-lbl-super">💘 SUPER</div>
      <div class="tarjeta-avatar">${getInicial(u.username||u.nombre||'?')}</div>
      <div class="tarjeta-username">@${u.username||u.nombre||''}</div>
      <div class="tarjeta-edad">${u.edad||'?'} años · ${u.sexo||''}</div>
      ${u._score>0?`<div class="tarjeta-score">${stars}</div>`:''}
      <hr class="tarjeta-sep"/>
      <p class="tarjeta-desc">${u.descripcion||''}</p>
      <div class="tarjeta-tags">
        ${busco?`<span class="tarjeta-tag">${busco}</span>`:''}
        ${estado?`<span class="tarjeta-tag">${estado}</span>`:''}
        ${gustan?`<span class="tarjeta-tag">Le gustan: ${gustan}</span>`:''}
      </div>`;
    stack.appendChild(card);
  });
}

function initSwiperGestures(){
  const stack=document.getElementById('swiper-stack');
  if(!stack)return;
  // Clonar para limpiar listeners previos
  const ns=stack.cloneNode(true);stack.parentNode.replaceChild(ns,stack);
  const s=document.getElementById('swiper-stack');

  const getTop=()=>s.querySelector('.swiper-card.is-top');
  let startX=0,startY=0,dragging=false,cdx=0,cdy=0;

  const onStart=e=>{
    const c=getTop();if(!c)return;
    dragging=true;cdx=0;cdy=0;
    const pt=e.touches?e.touches[0]:e;
    startX=pt.clientX;startY=pt.clientY;
    c.style.transition='none';
    if(e.cancelable)e.preventDefault();
  };
  const onMove=e=>{
    if(!dragging)return;
    const c=getTop();if(!c)return;
    const pt=e.touches?e.touches[0]:e;
    cdx=pt.clientX-startX;cdy=pt.clientY-startY;
    const rot=cdx*0.07;
    c.style.transform=`translateX(${cdx}px) translateY(${cdy}px) rotate(${rot}deg)`;
    c.classList.remove('sw-right','sw-left','sw-down');
    if(Math.abs(cdx)>Math.abs(cdy)){
      if(cdx>30)c.classList.add('sw-right');
      else if(cdx<-30)c.classList.add('sw-left');
    } else if(cdy>30) c.classList.add('sw-down');
    if(e.cancelable)e.preventDefault();
  };
  const onEnd=()=>{
    if(!dragging)return;dragging=false;
    const c=getTop();if(!c)return;
    const T=70;
    c.style.transition='transform 0.35s ease';
    if(Math.abs(cdx)>Math.abs(cdy)&&Math.abs(cdx)>T){
      animarSwipe(c,cdx>0?'like':'nope');
    } else if(cdy>T){
      animarSwipe(c,'super');
    } else {
      // reset
      c.style.transform='';c.classList.remove('sw-right','sw-left','sw-down');
    }
  };

  s.addEventListener('mousedown',onStart);
  window.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onEnd);
  s.addEventListener('touchstart',onStart,{passive:false});
  s.addEventListener('touchmove',onMove,{passive:false});
  s.addEventListener('touchend',onEnd,{passive:true});
}

function animarSwipe(card,tipo){
  card.style.transition='transform 0.4s ease';
  if(tipo==='like')   card.style.transform='translateX(160%) rotate(20deg)';
  else if(tipo==='nope') card.style.transform='translateX(-160%) rotate(-20deg)';
  else               card.style.transform='translateY(160%)';
  setTimeout(()=>registrarSwipe(card.dataset.uid,tipo),420);
}

function swipeAccion(tipo){
  const card=document.getElementById('swiper-stack')?.querySelector('.swiper-card.is-top');
  if(!card){return;}
  animarSwipe(card,tipo);
}

async function registrarSwipe(uid,tipo){
  if(!uid)return;
  swiperIdx++;
  try{
    await db.collection('usuarios').doc(currentUser.uid).update({
      swipes:firebase.firestore.FieldValue.arrayUnion({uid,tipo,fecha:new Date().toISOString()})
    });
  }catch(e){console.error('swipe save error:',e);}
  renderSwiperStack();
  initSwiperGestures();
}

// Chat directo desde tarjeta (carga usuario y abre conversación)
async function abrirChatConUid(uid){
  const snap=await db.collection('usuarios').doc(uid).get();
  const u=snap.exists?{uid,...snap.data()}:{uid,nombre:uid};
  await iniciarChatCon(u);
}

// ═══════════════════════════════════════════
// PERFIL USUARIO (desde chat)
// ═══════════════════════════════════════════
async function verPerfilUsuario(userData){
  if(!userData||!userData.uid)return;
  // Guardar la pantalla activa para poder volver a ella
  const screenActiva=document.querySelector('.screen.active');
  perfilVistoPrevScreen=screenActiva?.id||'screen-detalles';
  const snap=await db.collection('usuarios').doc(userData.uid).get();
  const u=snap.exists?snap.data():userData;
  const miSnap=await db.collection('usuarios').doc(currentUser.uid).get();
  const miData=miSnap.exists?miSnap.data():{siguiendo:[]};
  const yaSigo=(miData.siguiendo||[]).includes(userData.uid);
  document.getElementById('pu-avatar').textContent=getInicial(u.username||u.nombre||'?');
  document.getElementById('pu-username').textContent='@'+(u.username||u.nombre||'?');
  document.getElementById('pu-edad').textContent=u.edad?`${u.edad} años · ${u.sexo||''}`:u.sexo||'';
  document.getElementById('pu-desc').textContent=u.descripcion||u.bio||'Sin descripción aún.';
  const btn=document.getElementById('pu-btn-seguir');
  btn.textContent=yaSigo?'Siguiendo':'Seguir';btn.className='btn-seguir '+(yaSigo?'siguiendo':'no-siguiendo');
  btn.dataset.targetUid=userData.uid;btn.dataset.yaSigo=yaSigo?'1':'0';
  const tags=document.getElementById('pu-tags');tags.innerHTML='';
  const estado=Array.isArray(u.relacionEstado)?u.relacionEstado.join(', '):(u.relacionEstado||'');
  const busco=Array.isArray(u.relacionBusco)?u.relacionBusco.join(', '):(u.relacionBusco||'');
  [busco,estado,u.hobby,u.musica].filter(Boolean).forEach(t=>{const sp=document.createElement('span');sp.className='tarjeta-tag';sp.textContent=t;tags.appendChild(sp);});
  const seguidores=(u.seguidores||[]).length;const siguiendo=(u.siguiendo||[]).length;
  document.getElementById('pu-stats').innerHTML=`
    <div class="perfil-u-stat"><strong>${seguidores}</strong><span>Seguidores</span></div>
    <div class="perfil-u-stat"><strong>${siguiendo}</strong><span>Siguiendo</span></div>`;
  // Cargar estado de bloqueo
  const miBloqueados=(await db.collection('usuarios').doc(currentUser.uid).get()).data()?.bloqueados||[];
  const estaBloqueado=miBloqueados.includes(userData.uid);
  const btnB=document.getElementById('pu-btn-bloquear');
  if(btnB){
    btnB.dataset.targetUid=userData.uid;
    btnB.dataset.targetUsername=u.username||u.nombre||userData.uid;
    btnB.dataset.bloqueado=estaBloqueado?'1':'0';
    btnB.textContent=estaBloqueado?'✅ Desbloqueado (tap para desbloquear)':'🚫 Bloquear';
    btnB.style.display=userData.uid!==currentUser.uid?'inline-flex':'none';
  }
  showScreen('screen-perfil-usuario');
}
async function toggleSeguirPerfil(){
  const btn=document.getElementById('pu-btn-seguir');
  const targetUid=btn.dataset.targetUid;const yaSigo=btn.dataset.yaSigo==='1';
  await toggleSeguir(targetUid,yaSigo,btn);btn.dataset.yaSigo=yaSigo?'0':'1';
}
function cerrarPerfilUsuario(){showScreen(perfilVistoPrevScreen||'screen-chats');}

// ═══════════════════════════════════════════
// BUSCAR
// ═══════════════════════════════════════════
async function initBuscar(){
  document.getElementById('buscar-rt-input').value='';document.getElementById('buscar-results').innerHTML='';
  document.getElementById('buscar-empty').classList.add('hidden');document.getElementById('buscar-inicial').classList.remove('hidden');
  document.getElementById('buscar-clear').classList.add('hidden');
  try{const snap=await db.collection('usuarios').get();todosUsuariosBuscar=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.uid!==currentUser.uid);}
  catch(e){console.error(e);}
}
function buscarTiempoReal(){
  clearTimeout(buscarTimeout);
  const q=document.getElementById('buscar-rt-input').value.trim().toLowerCase().replace(/^@/,'');
  document.getElementById('buscar-clear').classList.toggle('hidden',!q);
  if(!q){document.getElementById('buscar-results').innerHTML='';document.getElementById('buscar-empty').classList.add('hidden');document.getElementById('buscar-inicial').classList.remove('hidden');return;}
  document.getElementById('buscar-inicial').classList.add('hidden');
  buscarTimeout=setTimeout(async()=>{
    const res=todosUsuariosBuscar.filter(u=>(u.username||'').toLowerCase().includes(q));
    await renderBuscarResultados(res);
  },180);
}
async function renderBuscarResultados(lista){
  const el=document.getElementById('buscar-results');const emptyEl=document.getElementById('buscar-empty');
  el.innerHTML='';if(!lista.length){emptyEl.classList.remove('hidden');return;}emptyEl.classList.add('hidden');
  const miSnap=await db.collection('usuarios').doc(currentUser.uid).get();
  const miSiguiendo=(miSnap.exists?miSnap.data().siguiendo:[])||[];
  lista.forEach((u,i)=>{
    const yaSigo=miSiguiendo.includes(u.uid);
    const card=document.createElement('div');card.className='buscar-user-card';card.style.animationDelay=`${i*0.04}s`;
    card.innerHTML=`
      <div class="chat-avatar" style="flex-shrink:0">${getInicial(u.username||u.nombre||'?')}</div>
      <div class="buscar-user-info"><p class="buscar-username">@${u.username||u.nombre}</p><p class="buscar-realname">${(u.nombre&&u.nombre!==u.username)?u.nombre:''}</p></div>
      <div style="display:flex;align-items:center;gap:8px">
        ${u.nivel?`<span class="buscar-nivel-tag">${nivelLabel(u.nivel)}</span>`:''}
        <button class="btn-seguir ${yaSigo?'siguiendo':'no-siguiendo'}" style="font-size:0.78rem;padding:5px 14px" onclick="toggleSeguirBuscar('${u.uid}',this)">${yaSigo?'Siguiendo':'Seguir'}</button>
        <button class="btn-chat-mini" onclick="abrirChatConUid('${u.uid}')">💬</button>
      </div>`;
    el.appendChild(card);
  });
}
async function toggleSeguirBuscar(uid,btn){await toggleSeguir(uid,btn.classList.contains('siguiendo'),btn);}
function limpiarBuscar(){document.getElementById('buscar-rt-input').value='';buscarTiempoReal();document.getElementById('buscar-rt-input').focus();}

// ═══════════════════════════════════════════
// CHATS
// ═══════════════════════════════════════════
function getChatId(a,b){return[a,b].sort().join('_');}
function escucharNoLeidos(){
  db.collection('chats').where('participantes','array-contains',currentUser.uid).onSnapshot(snap=>{
    let total=0;snap.docs.forEach(d=>{const x=d.data();total+=(x.noLeidos&&x.noLeidos[currentUser.uid])||0;});
    const badge=document.getElementById('home-chat-badge');
    if(total>0){badge.textContent=total>99?'99+':total;badge.classList.remove('hidden');}else badge.classList.add('hidden');
  });
}
async function loadChats(){
  const listEl=document.getElementById('chats-list');const emptyEl=document.getElementById('chats-empty');
  listEl.innerHTML='<p style="color:var(--text-muted);padding:20px">Cargando...</p>';emptyEl.classList.add('hidden');
  try{
    const snap=await db.collection('chats').where('participantes','array-contains',currentUser.uid).get();
    let docs=snap.docs.filter(d=>{const p=d.data().participantes;return Array.isArray(p)&&p.length===2&&p.every(x=>x&&x.trim()!=='');});
    docs.sort((a,b)=>{const va=a.data().ultimoMensajeAt?.toDate?.()?.getTime()||0;const vb=b.data().ultimoMensajeAt?.toDate?.()?.getTime()||0;return vb-va;});
    if(!docs.length){listEl.innerHTML='';emptyEl.classList.remove('hidden');return;}
    listEl.innerHTML='';
    for(let i=0;i<docs.length;i++){
      const chat=docs[i].data();const chatId=docs[i].id;
      const otroUid=chat.participantes.find(u=>u!==currentUser.uid);if(!otroUid)continue;
      const oSnap=await db.collection('usuarios').doc(otroUid).get();
      const otro=oSnap.exists?oSnap.data():{nombre:otroUid,email:otroUid};
      const noLeidos=(chat.noLeidos&&chat.noLeidos[currentUser.uid])||0;
      const hora=chat.ultimoMensajeAt?.toDate?formatHora(chat.ultimoMensajeAt.toDate()):'';
      const nombre=otro.username?'@'+otro.username:(otro.nombre||otro.email);
      const item=document.createElement('div');item.className='chat-item';item.style.animationDelay=`${i*0.05}s`;
      item.innerHTML=`
        <div class="chat-avatar">${getInicial(otro.username||otro.nombre||otro.email)}</div>
        <div class="chat-info"><p class="chat-nombre">${nombre}</p><p class="chat-preview">${chat.ultimoMensaje||'Sin mensajes aún'}</p></div>
        <div class="chat-meta"><span class="chat-time">${hora}</span>${noLeidos>0?`<span class="chat-unread">${noLeidos}</span>`:''}</div>`;
      item.onclick=()=>abrirConversacion(chatId,otroUid,otro);listEl.appendChild(item);
    }
  }catch(e){listEl.innerHTML=`<p style="color:#ff5e5e;padding:20px">Error: ${e.message}</p>`;}
}
async function loadUsuarios(){
  const listEl=document.getElementById('usuarios-list');const emptyEl=document.getElementById('usuarios-empty');
  listEl.innerHTML='<p style="color:var(--text-muted);padding:16px 0">Cargando...</p>';emptyEl.classList.add('hidden');
  try{const snap=await db.collection('usuarios').get();todosUsuarios=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.uid!==currentUser.uid);renderUsuarios(todosUsuarios);}
  catch(e){listEl.innerHTML=`<p style="color:#ff5e5e">Error: ${e.message}</p>`;}
}
function renderUsuarios(lista){
  const listEl=document.getElementById('usuarios-list');const emptyEl=document.getElementById('usuarios-empty');
  listEl.innerHTML='';if(!lista.length){emptyEl.classList.remove('hidden');return;}emptyEl.classList.add('hidden');
  lista.forEach((u,i)=>{
    const item=document.createElement('div');item.className='usuario-item';item.style.animationDelay=`${i*0.04}s`;
    const nombre=u.username?'@'+u.username:(u.nombre||u.email.split('@')[0]);
    item.innerHTML=`<div class="chat-avatar">${getInicial(u.username||u.nombre||u.email)}</div><div class="usuario-info"><p class="usuario-nombre">${nombre}</p></div>${u.nivel?`<span class="usuario-nivel">${nivelLabel(u.nivel)}</span>`:''}`;
    item.onclick=()=>iniciarChatCon(u);listEl.appendChild(item);
  });
}
function filtrarUsuarios(){
  const q=document.getElementById('buscar-usuario').value.toLowerCase().replace(/^@/,'');
  renderUsuarios(todosUsuarios.filter(u=>(u.username||'').toLowerCase().includes(q)||(u.nombre||'').toLowerCase().includes(q)));
}
async function iniciarChatCon(otro){
  const chatId=getChatId(currentUser.uid,otro.uid);
  const ref=db.collection('chats').doc(chatId);const snap=await ref.get();
  if(!snap.exists)await ref.set({participantes:[currentUser.uid,otro.uid],ultimoMensaje:'',ultimoMensajeAt:firebase.firestore.FieldValue.serverTimestamp(),noLeidos:{[currentUser.uid]:0,[otro.uid]:0}});
  abrirConversacion(chatId,otro.uid,otro);
}
async function abrirConversacion(chatId,otroUid,otroData){
  chatActualId=chatId;chatActualUser={uid:otroUid,...otroData};
  const nombre=otroData.username?'@'+otroData.username:(otroData.nombre||otroData.email);
  document.getElementById('conv-nombre-header').textContent=nombre;
  document.getElementById('conv-avatar').textContent=getInicial(otroData.username||otroData.nombre||otroData.email);
  showScreen('screen-conversacion');
  try{
    const ref=db.collection('chats').doc(chatId);const snap=await ref.get();
    if(!snap.exists){await ref.set({participantes:[currentUser.uid,otroUid],ultimoMensaje:'',ultimoMensajeAt:firebase.firestore.FieldValue.serverTimestamp(),noLeidos:{[currentUser.uid]:0,[otroUid]:0}});}
    else{
      const data=snap.data();const fixes={};
      if(!data.noLeidos)fixes.noLeidos={[currentUser.uid]:0,[otroUid]:0};
      if(!data.ultimoMensajeAt||typeof data.ultimoMensajeAt==='string')fixes.ultimoMensajeAt=firebase.firestore.FieldValue.serverTimestamp();
      if(Object.keys(fixes).length)await ref.update(fixes);
      await ref.update({[`noLeidos.${currentUser.uid}`]:0});
    }
  }catch(e){console.error(e);}
  if(mensajesListener)mensajesListener();
  const container=document.getElementById('mensajes-container');container.innerHTML='';
  mensajesListener=db.collection('chats').doc(chatId).collection('mensajes').orderBy('creadoEn','asc').onSnapshot(snap=>{
    renderMensajes(snap.docs,container);
    const main=document.getElementById('conv-main');setTimeout(()=>{if(main)main.scrollTop=main.scrollHeight;},60);
  });
}
function renderMensajes(docs,container){
  container.innerHTML='';let lastDay='';
  docs.forEach(doc=>{
    const m=doc.data();const esPropio=m.uid===currentUser.uid;
    const fecha=m.creadoEn?m.creadoEn.toDate():new Date();
    const dia=fecha.toLocaleDateString('es-ES',{day:'numeric',month:'long'});
    if(dia!==lastDay){const sep=document.createElement('div');sep.className='msg-group-label';sep.textContent=dia;container.appendChild(sep);lastDay=dia;}
    const wrap=document.createElement('div');wrap.className=`msg-wrap ${esPropio?'out':'in'}`;
    const bubble=document.createElement('div');bubble.className=`msg-bubble ${esPropio?'out':'in'}`;
    bubble.innerHTML=escapeHtml(m.texto);
    const time=document.createElement('div');time.className='msg-time';time.textContent=formatHora(fecha);
    wrap.appendChild(bubble);wrap.appendChild(time);container.appendChild(wrap);
  });
}
async function enviarMensaje(){
  const input=document.getElementById('msg-input');const texto=input.value.trim();
  if(!texto||!chatActualId)return;input.value='';
  try{
    await db.collection('chats').doc(chatActualId).collection('mensajes').add({texto,uid:currentUser.uid,nombre:getNombre(currentUser),creadoEn:firebase.firestore.FieldValue.serverTimestamp()});
    await db.collection('chats').doc(chatActualId).update({ultimoMensaje:texto,ultimoMensajeAt:firebase.firestore.FieldValue.serverTimestamp(),[`noLeidos.${chatActualUser.uid}`]:firebase.firestore.FieldValue.increment(1)});
  }catch(e){console.error(e);}
}
function cerrarConversacion(){
  if(mensajesListener){mensajesListener();mensajesListener=null;}
  chatActualId=null;chatActualUser=null;showScreen('screen-chats');loadChats();
}

// ═══════════════════════════════════════════
// AJUSTES
// ═══════════════════════════════════════════
function getChecked(ids){return ids.filter(id=>document.getElementById(id)?.checked).map(id=>document.getElementById(id).value);}
function setChecked(ids,valores){
  const arr=Array.isArray(valores)?valores:(valores?[valores]:[]);
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.checked=arr.includes(el.value);});
}

async function loadAjustes(){
  if(!currentUser)return;
  document.getElementById('perfil-email-display').textContent=currentUser.email;
  ['aj-pass-actual','aj-pass-nueva','aj-pass-repite'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  // Sincronizar toggle de tema
  const temaSaved=localStorage.getItem('rutaskate_tema');
  const toggleTema=document.getElementById('toggle-tema');
  if(toggleTema)toggleTema.checked=(temaSaved==='claro');
  try{
    const snap=await db.collection('usuarios').doc(currentUser.uid).get();
    if(snap.exists){
      const d=snap.data();
      const nombre=d.nombre||getNombre(currentUser);
      document.getElementById('aj-nombre').value=nombre;
      document.getElementById('aj-bio').value=d.bio||d.descripcion||'';
      setVal('aj-edad',d.edad||'');
      setSelectVal('aj-sexo',d.sexo||'');
      setVal('aj-telefono-display',d.telefono||'');
      // Stats seguidores/siguiendo
      const statsEl=document.getElementById('aj-perfil-stats');
      if(statsEl){
        const seg=(d.seguidores||[]).length,sig=(d.siguiendo||[]).length;
        statsEl.innerHTML=`<span style="font-size:0.78rem;color:var(--text-muted)"><strong style="color:var(--text)">${seg}</strong> seguidores</span><span style="font-size:0.78rem;color:var(--text-muted);margin-left:12px"><strong style="color:var(--text)">${sig}</strong> siguiendo</span>`;
      }
      document.getElementById('perfil-nombre-display').textContent='@'+(d.username||nombre);
      document.getElementById('perfil-avatar-display').textContent=getInicial(d.username||nombre);
      if(d.nivel){document.querySelectorAll('#screen-ajustes .nivel-btn').forEach(b=>b.classList.toggle('selected',b.dataset.nivel===d.nivel));selectedNivelAjustes=d.nivel;}
      // Datos personales
      // aj-descripcion es alias de aj-bio en datos personales (ambos muestran bio)
      setVal('aj-descripcion',d.descripcion||d.bio||'');
      setVal('aj-hobby',d.hobby||'');setVal('aj-musica',d.musica||'');setVal('aj-animal',d.animal||'');
      setVal('aj-color',d.color);setVal('aj-estudios',d.estudios);
      // Checkboxes múltiple
      setChecked(['ec-soltero','ec-pareja','ec-casado','ec-divorciado','ec-hijos','ec-sinhijos'],d.relacionEstado||[]);
      setChecked(['mg-hombres','mg-mujeres','mg-ambos','mg-otros'],d.gustanMe||[]);
      setChecked(['bq-amistad','bq-amor','bq-rollo','bq-surja','bq-gente'],d.relacionBusco||[]);
    }else{
      const n=getNombre(currentUser);
      document.getElementById('aj-nombre').value=n;
      document.getElementById('perfil-nombre-display').textContent=n;
      document.getElementById('perfil-avatar-display').textContent=getInicial(n);
    }
  }catch(e){console.error(e);}
}
function setVal(id,val){const el=document.getElementById(id);if(el)el.value=val||'';}
function setSelectVal(id,val){const el=document.getElementById(id);if(el&&val)el.value=val;}
function selectNivelAj(btn){document.querySelectorAll('#screen-ajustes .nivel-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');selectedNivelAjustes=btn.dataset.nivel;}
function getVal(id){const el=document.getElementById(id);return el?el.value.trim():'';}

async function guardarPerfil(){
  const nombre=document.getElementById('aj-nombre').value.trim();
  const bio=document.getElementById('aj-bio').value.trim();
  const edadP=parseInt(document.getElementById('aj-edad')?.value||'0',10)||0;
  const sexoP=document.getElementById('aj-sexo')?.value||'';
  const okEl=document.getElementById('aj-ok');okEl.classList.add('hidden');
  if(!nombre){alert('El nombre no puede estar vacío.');return;}
  const nombreAnterior=getNombre(currentUser);
  try{
    const datos={nombre,bio,descripcion:bio,email:currentUser.email,uid:currentUser.uid,...(selectedNivelAjustes?{nivel:selectedNivelAjustes}:{}),...(edadP>=18?{edad:edadP}:{}),...(sexoP?{sexo:sexoP}:{})};
    await db.collection('usuarios').doc(currentUser.uid).set(datos,{merge:true});
    await currentUser.updateProfile({displayName:nombre});
    if(nombre!==nombreAnterior){
      const rutasSnap=await db.collection('rutas').where('convocadoPorEmail','==',currentUser.email).get();
      const batch=db.batch();rutasSnap.docs.forEach(doc=>batch.update(doc.ref,{convocadoPor:nombre}));
      if(!rutasSnap.empty)await batch.commit();
    }
    document.getElementById('user-display').textContent=nombre;
    document.getElementById('perfil-nombre-display').textContent=nombre;
    document.getElementById('perfil-avatar-display').textContent=getInicial(nombre);
    okEl.classList.remove('hidden');setTimeout(()=>okEl.classList.add('hidden'),2500);
  }catch(e){alert('Error: '+e.message);}
}

async function guardarDatosPersonales(){
  const okEl=document.getElementById('aj-datos-ok');okEl.classList.add('hidden');
  const citasActivo=document.getElementById('toggle-citas')?.checked||false;
  const estadoCivil=getChecked(['ec-soltero','ec-pareja','ec-casado','ec-divorciado','ec-hijos','ec-sinhijos']);
  const meGustan=getChecked(['mg-hombres','mg-mujeres','mg-ambos','mg-otros']);
  const busco=getChecked(['bq-amistad','bq-amor','bq-rollo','bq-surja','bq-gente']);
  const datos={
    citasActivo,
    hobby:getVal('aj-hobby'),musica:getVal('aj-musica'),animal:getVal('aj-animal'),
    color:getVal('aj-color'),estudios:getVal('aj-estudios'),
    relacionEstado:estadoCivil,gustanMe:meGustan,relacionBusco:busco,
  };
  try{
    await db.collection('usuarios').doc(currentUser.uid).set(datos,{merge:true});
    currentUserData={...currentUserData,...datos};
    okEl.classList.remove('hidden');setTimeout(()=>okEl.classList.add('hidden'),2500);
  }catch(e){alert('Error guardando datos: '+e.message);}
}

async function cambiarPassword(){
  const actual=document.getElementById('aj-pass-actual').value;
  const nueva=document.getElementById('aj-pass-nueva').value;
  const repite=document.getElementById('aj-pass-repite').value;
  const okEl=document.getElementById('aj-pass-ok');const errEl=document.getElementById('aj-pass-err');
  okEl.classList.add('hidden');errEl.classList.add('hidden');
  if(!actual){errEl.textContent='Introduce tu contraseña actual.';errEl.classList.remove('hidden');return;}
  if(nueva.length<6){errEl.textContent='Mínimo 6 caracteres.';errEl.classList.remove('hidden');return;}
  if(nueva!==repite){errEl.textContent='Las contraseñas no coinciden.';errEl.classList.remove('hidden');return;}
  if(actual===nueva){errEl.textContent='La nueva debe ser diferente.';errEl.classList.remove('hidden');return;}
  try{
    const credential=firebase.auth.EmailAuthProvider.credential(currentUser.email,actual);
    await currentUser.reauthenticateWithCredential(credential);
    await currentUser.updatePassword(nueva);
    ['aj-pass-actual','aj-pass-nueva','aj-pass-repite'].forEach(id=>document.getElementById(id).value='');
    okEl.classList.remove('hidden');setTimeout(()=>okEl.classList.add('hidden'),2500);
  }catch(e){
    errEl.textContent=(e.code==='auth/wrong-password'||e.code==='auth/invalid-credential')?'Contraseña actual incorrecta.':(e.code==='auth/too-many-requests'?'Demasiados intentos.':'Error: '+e.message);
    errEl.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
function formatHora(date){
  const hoy=new Date();
  if(date.toDateString()===hoy.toDateString())return date.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  return date.toLocaleDateString('es-ES',{day:'numeric',month:'short'});
}
function escapeHtml(str){return(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
// ─── APARIENCIA / TEMA ───
function aplicarTema(claro){
  if(claro){
    document.body.classList.add('tema-claro');
  } else {
    document.body.classList.remove('tema-claro');
  }
  localStorage.setItem('rutaskate_tema', claro?'claro':'oscuro');
  const toggle=document.getElementById('toggle-tema');
  if(toggle)toggle.checked=claro;
}
function cambiarTema(claro){
  aplicarTema(claro);
}
// Aplicar tema guardado al cargar
(function(){
  const tema=localStorage.getItem('rutaskate_tema');
  if(tema==='claro')aplicarTema(true);
})();

// ─── EXPLICACIÓN ESTRELLAS (FAQ inline) ───
// Las estrellas de compatibilidad (★☆) en Tarjetas comparan tu perfil con el de otra persona.
// Cada campo que coincide suma 1 estrella: hobby, música, animal favorito, color favorito,
// estudios, sexo y qué buscas. Máximo 5 estrellas mostradas.
// Ejemplo: si los dos buscáis "amistad" y tenéis el mismo hobby → 2 estrellas.

document.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  if(document.getElementById('screen-login').classList.contains('active'))doLogin();
  if(document.getElementById('screen-registro').classList.contains('active'))doRegistro();
});

// ═══════════════════════════════════════════
// SWITCH CITAS
// ═══════════════════════════════════════════
function toggleCitasMode(activo){
  const fields=document.getElementById('citas-fields');
  if(fields)fields.style.display=activo?'block':'none';
  actualizarBotonesCitas(activo);
}
function actualizarBotonesCitas(activo){
  // Botón tarjetas en Detalles
  ['btn-tarjetas-detalles','btn-tarjetas-grid','btn-matches-grid'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.display=activo?'':'none';
  });
}

// ═══════════════════════════════════════════
// PANEL ADMIN
// ═══════════════════════════════════════════
async function loadPanelAdmin(){
  if(!esAdmin())return;
  try{
    const[usersSnap,rutasSnap,bloqueosSnap]=await Promise.all([
      db.collection('usuarios').get(),
      db.collection('rutas').get(),
      db.collection('bloqueos').get()
    ]);

    // KPIs
    const kpi=document.getElementById('admin-kpi-wrap');
    if(kpi){
      kpi.innerHTML=`
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:1.6rem;font-weight:700;color:var(--accent)">${usersSnap.size}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Usuarios</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:1.6rem;font-weight:700;color:var(--accent)">${rutasSnap.size}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Rutas</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:1.6rem;font-weight:700;color:var(--accent)">${bloqueosSnap.size}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Bloqueos</div>
        </div>`;
    }

    // Actividad últimos 7 días
    const hoy=new Date();hoy.setHours(0,0,0,0);
    const hace7=new Date(hoy);hace7.setDate(hace7.getDate()-6);
    const registrosPorDia={};
    usersSnap.docs.forEach(d=>{
      const u=d.data();
      if(u.creadoEn?.toDate){
        const dia=u.creadoEn.toDate().toLocaleDateString('es-ES');
        registrosPorDia[dia]=(registrosPorDia[dia]||0)+1;
      }
    });

    const ul=document.getElementById('admin-users-list');
    if(ul){
      ul.innerHTML='';
      usersSnap.docs.forEach(d=>{
        const u=d.data();
        const reg=u.creadoEn?.toDate?u.creadoEn.toDate().toLocaleDateString('es-ES'):'—';
        const div=document.createElement('div');
        div.style.cssText='padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem';
        div.innerHTML=`<strong>@${u.username||u.nombre||'—'}</strong> <span style="opacity:0.5;font-size:0.72rem">${u.rol||'usuario'}</span><br>
          <span style="color:var(--text-muted)">${u.email} · Registro: ${reg}</span>
          ${u.citasActivo?'<span style="color:var(--accent);font-size:0.72rem;margin-left:8px">💘 Citas ON</span>':''}`;
        ul.appendChild(div);
      });
    }

    const bl=document.getElementById('admin-bloqueos-list');
    if(bl){
      bl.innerHTML='';
      if(bloqueosSnap.empty){bl.innerHTML='<p style="color:var(--text-muted);font-size:0.85rem">Sin bloqueos registrados</p>';}
      bloqueosSnap.docs.forEach(d=>{
        const b=d.data();
        const fecha=b.fecha?.toDate?b.fecha.toDate().toLocaleDateString('es-ES'):'—';
        const div=document.createElement('div');
        div.style.cssText='padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem';
        div.innerHTML=`<span style="color:#ff5e5e">@${b.deEmail||b.deUid}</span> bloqueó a <strong>@${b.paraUsername||b.paraUid}</strong> · ${fecha}`;
        bl.appendChild(div);
      });
    }

    const rl=document.getElementById('admin-rutas-list');
    if(rl){
      rl.innerHTML='';
      const rutas=rutasSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.fechaTS-a.fechaTS);
      rutas.forEach(r=>{
        const div=document.createElement('div');
        div.style.cssText='padding:7px 0;border-bottom:1px solid var(--border);font-size:0.85rem';
        div.innerHTML=`<strong>${r.nombre}</strong> · ${r.fecha||''} · @${r.convocadoPor||''}
          ${r.cancelada?'<span style="color:#ff5e5e"> [CANCELADA]</span>':''}`;
        rl.appendChild(div);
      });
    }

    const al=document.getElementById('admin-actividad-list');
    if(al){
      al.innerHTML='';
      if(!Object.keys(registrosPorDia).length){al.innerHTML='<p style="color:var(--text-muted);font-size:0.85rem">Sin registros recientes</p>';}
      Object.entries(registrosPorDia).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,7).forEach(([dia,n])=>{
        const div=document.createElement('div');
        div.style.cssText='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem';
        div.innerHTML=`<span>${dia}</span><strong>${n} registro${n!==1?'s':''}</strong>`;
        al.appendChild(div);
      });
    }
  }catch(e){console.error('Panel admin error:',e);}
}

// ═══════════════════════════════════════════
// BLOQUEAR USUARIO
// ═══════════════════════════════════════════
async function bloquearUsuario(targetUid,targetUsername){
  try{
    // Bloquear
    await db.collection('usuarios').doc(currentUser.uid).update({
      bloqueados:firebase.firestore.FieldValue.arrayUnion(targetUid)
    });
    // Dejar de seguirse mutuamente
    await db.collection('usuarios').doc(currentUser.uid).update({
      siguiendo:firebase.firestore.FieldValue.arrayRemove(targetUid)
    });
    await db.collection('usuarios').doc(targetUid).update({
      seguidores:firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
      siguiendo:firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    });
    await db.collection('usuarios').doc(currentUser.uid).update({
      seguidores:firebase.firestore.FieldValue.arrayRemove(targetUid)
    });
    // Registrar bloqueo
    await db.collection('bloqueos').add({
      deUid:currentUser.uid,deEmail:currentUser.email,
      paraUid:targetUid,paraUsername:targetUsername,
      fecha:firebase.firestore.FieldValue.serverTimestamp()
    });
    if(chatActualUser&&chatActualUser.uid===targetUid)cerrarConversacion();
  }catch(e){alert('Error al bloquear: '+e.message);}
}
async function desbloquearUsuario(targetUid,targetUsername){
  if(!confirm(`¿Desbloquear a @${targetUsername}?`))return;
  try{
    await db.collection('usuarios').doc(currentUser.uid).update({
      bloqueados:firebase.firestore.FieldValue.arrayRemove(targetUid)
    });
    alert(`@${targetUsername} desbloqueado.`);
  }catch(e){alert('Error: '+e.message);}
}


// ── Bloquear/desbloquear desde la pantalla de perfil ──
async function toggleBloquearPerfil(){
  const btn=document.getElementById('pu-btn-bloquear');
  if(!btn)return;
  const targetUid=btn.dataset.targetUid;
  const targetUsername=btn.dataset.targetUsername;
  const estaBloqueado=btn.dataset.bloqueado==='1';
  if(estaBloqueado){
    await desbloquearUsuario(targetUid,targetUsername);
    btn.textContent='🚫 Bloquear';btn.dataset.bloqueado='0';
  } else {
    if(!confirm(`¿Bloquear a @${targetUsername}?\nDejarás de seguiros mutuamente y no podrá enviarte mensajes.`))return;
    await bloquearUsuario(targetUid,targetUsername);
    btn.textContent='✅ Desbloqueado (tap para desbloquear)';btn.dataset.bloqueado='1';
  }
}

// ═══════════════════════════════════════════
// CARGAR AJUSTES: sincronizar citas y nuevos campos
// ═══════════════════════════════════════════
// Extender el loadAjustes original para cargar citasActivo y checkboxes
const _origLoadAjustes = loadAjustes;
loadAjustes = async function(){
  await _origLoadAjustes();
  // Leer datos frescos para campos extra
  if(!currentUser)return;
  try{
    const snap=await db.collection('usuarios').doc(currentUser.uid).get();
    if(!snap.exists)return;
    const d=snap.data();
    // Citas switch
    const citasEl=document.getElementById('toggle-citas');
    const cA=!!(d.citasActivo);
    if(citasEl){citasEl.checked=cA;toggleCitasMode(cA);}
    // Checkboxes
    if(typeof setChecked==='function'){
      setChecked(['ec-soltero','ec-pareja','ec-casado','ec-divorciado','ec-hijos','ec-sinhijos'],d.relacionEstado||[]);
      setChecked(['mg-hombres','mg-mujeres','mg-ambos','mg-otros'],d.gustanMe||[]);
      setChecked(['bq-amistad','bq-amor','bq-rollo','bq-surja','bq-gente'],d.relacionBusco||[]);
    }
    // Admin panel
    const adminWrap=document.getElementById('acc-admin-wrap');
    if(adminWrap)adminWrap.style.display=esAdmin()?'block':'none';
  }catch(e){console.error('loadAjustes extra:',e);}
};

// Función setChecked si no existe
if(typeof setChecked==='undefined'){
  window.setChecked=function(ids,valores){
    const arr=Array.isArray(valores)?valores:(valores?[valores]:[]);
    ids.forEach(id=>{const el=document.getElementById(id);if(el)el.checked=arr.includes(el.value);});
  };
}
if(typeof getChecked==='undefined'){
  window.getChecked=function(ids){return ids.filter(id=>document.getElementById(id)?.checked).map(id=>document.getElementById(id).value);};
}
