// =====================================================================
// Biblioteca Colegio Secundario San Carlos — Frontend
// Conectado a la API REST del backend Node (ver carpeta /server).
// Frontend y API se sirven desde el mismo servidor, por eso es relativa.
// =====================================================================
const API_BASE = '/api';
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

// ---------- Estado de sesión ----------
let authToken = null;
let currentUser = null; // {id, username, nombre_completo, rol, turno, estado}

// ---------- Estado de datos (poblado desde la API) ----------
let books = [];
let members = [];
let loans = [];
let sanciones = [];
let usuarios = [];
let dashboardResumen = null;

let loanFilterEstado = 'todos';
let detallePrestamoId = null;
let memberFilterTipo = 'todos';
let memberFilterVinculo = 'todos';
let memberFilterEstado = 'todos';
let bookFilterGenero = 'todos';
let bookFilterCategoria = 'todos';
let bookFilterDisponibilidad = 'todos';
let activeSancionFilter = 'todos';
let selectedMemberType = 'alumno';
let editingMemberId = null;
let editingBookId = null;
let detalleLibroId = null;
let selectedEsSocio = true;
let loanPersonType = 'socio';
let loanModalidad = 'domicilio';
let ultimoReporte = {tipo: null, data: null};

// ---------------------------------------------------------------------
// Autenticación (Módulo 8) y arranque de sesión
// ---------------------------------------------------------------------
async function doLogin(evt){
  if(evt) evt.preventDefault();
  const username = document.getElementById('f-login-user').value.trim();
  const password = document.getElementById('f-login-pass').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  if(!username || !password){
    errorEl.textContent = 'Ingresá usuario y contraseña';
    return;
  }

  const btn = document.getElementById('loginBtn');
  if(btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Ingresando…';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password}),
    });
    const data = await res.json().catch(() => null);

    if(!res.ok){
      errorEl.textContent = (data && data.error) || 'Usuario o contraseña incorrectos';
      return;
    }

    try {
      if(document.getElementById('f-login-remember').checked) localStorage.setItem('lib_remember_user', username);
      else localStorage.removeItem('lib_remember_user');
    } catch(e){}

    authToken = data.token;
    currentUser = data.usuario;
    sessionStorage.setItem('lib_token', authToken);
    sessionStorage.setItem('lib_user', JSON.stringify(currentUser));
    await showApp();
  } catch (err){
    errorEl.textContent = 'No se pudo conectar con el servidor. ¿Está corriendo el backend?';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ingresar';
  }
}

function togglePassword(){
  const input = document.getElementById('f-login-pass');
  const btn = document.getElementById('passToggleBtn');
  const mostrar = input.type === 'password';
  input.type = mostrar ? 'text' : 'password';
  btn.classList.toggle('on', mostrar);
  btn.title = mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña';
  btn.setAttribute('aria-label', btn.title);
}

function cargarUsuarioRecordado(){
  let user = null;
  try { user = localStorage.getItem('lib_remember_user'); } catch(e){}
  if(user){
    document.getElementById('f-login-user').value = user;
    document.getElementById('f-login-remember').checked = true;
  }
}

function doLogout(evt){
  if(evt) evt.preventDefault();
  authToken = null;
  currentUser = null;
  sessionStorage.removeItem('lib_token');
  sessionStorage.removeItem('lib_user');
  document.getElementById('f-login-user').value = '';
  document.getElementById('f-login-pass').value = '';
  cargarUsuarioRecordado();
  document.getElementById('appContent').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

async function showApp(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
  aplicarVisibilidadPorRol();
  actualizarInfoUsuario();
  await cargarDatosIniciales();
}

function checkSession(){
  const token = sessionStorage.getItem('lib_token');
  const userRaw = sessionStorage.getItem('lib_user');
  if(token && userRaw){
    authToken = token;
    try { currentUser = JSON.parse(userRaw); } catch(e){ currentUser = null; }
    if(currentUser){
      showApp();
      return;
    }
  }
  document.getElementById('loginScreen').style.display = 'flex';
}

// ---------- Tema claro / oscuro ----------
function toggleTheme(){
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  setTheme(dark ? 'light' : 'dark');
}
function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('biblioteca_theme', theme); } catch(e){}
  const btn = document.getElementById('themeToggleBtn');
  if(btn){
    btn.innerHTML = theme === 'dark'
      ? '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>';
    btn.title = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  }
}
function initTheme(){
  const saved = (() => { try { return localStorage.getItem('biblioteca_theme'); } catch(e){ return null; } })();
  setTheme(saved === 'dark' ? 'dark' : 'light');
}

// Permite iniciar sesión presionando Enter
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  cargarUsuarioRecordado();
  ['f-login-user', 'f-login-pass'].forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.addEventListener('keydown', (e) => { if(e.key === 'Enter') doLogin(e); });
    }
  });
  if(!SpeechRecognitionAPI){
    document.querySelectorAll('.mic-btn:not(.cam-btn)').forEach(btn => btn.hidden = true);
  }
  if(typeof ZXing === 'undefined' || !navigator.mediaDevices){
    document.querySelectorAll('.cam-btn, #modalBookScanBtn').forEach(btn => btn.hidden = true);
  }
});

// ---------- Búsqueda por voz (Web Speech API) ----------
function buscarPorVoz(inputId, alTerminar){
  if(!SpeechRecognitionAPI){
    showToast('Tu navegador no soporta búsqueda por voz. Probá con Chrome o Edge.', 'danger');
    return;
  }

  const input = document.getElementById(inputId);
  const btn = document.getElementById(`${inputId}MicBtn`);
  if(!input) return;

  const reconocimiento = new SpeechRecognitionAPI();
  reconocimiento.lang = 'es-AR';
  reconocimiento.interimResults = false;
  reconocimiento.maxAlternatives = 1;

  reconocimiento.onstart = () => { if(btn) btn.classList.add('listening'); };
  reconocimiento.onend = () => { if(btn) btn.classList.remove('listening'); };
  reconocimiento.onerror = (e) => {
    if(btn) btn.classList.remove('listening');
    if(e.error === 'not-allowed' || e.error === 'service-not-allowed'){
      showToast('Necesitás dar permiso de micrófono para buscar por voz', 'danger');
    } else if(e.error !== 'no-speech' && e.error !== 'aborted'){
      showToast('No se pudo usar el micrófono', 'danger');
    }
  };
  reconocimiento.onresult = (e) => {
    input.value = e.results[0][0].transcript;
    if(typeof alTerminar === 'function') alTerminar();
  };

  reconocimiento.start();
}

// ---------- Panel dinámico por rol (Módulo 9) ----------
function rolLabel(rol){
  return {ADMIN: 'Administrador', BIBLIOTECARIO: 'Bibliotecaria', ENCARGADO: 'Encargado/a'}[rol] || rol;
}

function actualizarInfoUsuario(){
  const el = document.getElementById('currentUserInfo');
  if(el && currentUser){
    el.textContent = `${currentUser.nombre_completo} · ${rolLabel(currentUser.rol)} · Turno ${currentUser.turno}`;
  }
}

function aplicarVisibilidadPorRol(){
  document.querySelectorAll('[data-roles]').forEach(el => {
    const roles = el.getAttribute('data-roles').split(',');
    el.style.display = (currentUser && roles.includes(currentUser.rol)) ? '' : 'none';
  });
}

// ---------------------------------------------------------------------
// Cliente HTTP genérico hacia la API
// ---------------------------------------------------------------------
async function apiFetch(path, options = {}){
  const headers = Object.assign({'Content-Type': 'application/json'}, options.headers || {});
  if(authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, Object.assign({}, options, {headers}));
  } catch (err){
    showToast('No se pudo conectar con el servidor', 'danger');
    throw err;
  }

  let data = null;
  try { data = await res.json(); } catch(e){ data = null; }

  if(res.status === 401){
    showToast('Tu sesión expiró. Iniciá sesión nuevamente.', 'danger');
    doLogout();
    throw new Error('No autorizado');
  }
  if(!res.ok){
    const msg = (data && data.error) ? data.error : 'Ocurrió un error inesperado';
    showToast(msg, 'danger');
    throw new Error(msg);
  }
  return data;
}

async function cargarDatosIniciales(){
  try {
    const tareas = [
      apiFetch('/libros').then(d => { books = d; }),
      apiFetch('/socios').then(d => { members = d; }),
      apiFetch('/prestamos').then(d => { loans = d; }),
      apiFetch('/dashboard/resumen').then(d => { dashboardResumen = d; }),
    ];
    if(currentUser && ['ADMIN', 'BIBLIOTECARIO'].includes(currentUser.rol)){
      tareas.push(apiFetch('/sanciones').then(d => { sanciones = d; }));
    }
    if(currentUser && currentUser.rol === 'ADMIN'){
      tareas.push(apiFetch('/usuarios').then(d => { usuarios = d; }));
    }
    await Promise.all(tareas);
    renderAll();
  } catch(err){
    console.error(err);
  }
}

// ---------- Toasts ----------
function showToast(message, type){
  type = type || 'info';
  const icons = {success:'✓', info:'ℹ', danger:'✕'};
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ---------- Fechas & Utilidades ----------
function todayISO(){ return new Date().toISOString().slice(0,10); }
function daysBetween(a, b){ return Math.round((new Date(b) - new Date(a)) / 86400000); }
function formatDate(iso){
  if(!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  return `${String(d.getDate()).padStart(2,'0')} ${meses[d.getMonth()]}`;
}

function statusOf(loan){
  if(loan.estado === 'perdido') return 'overdue';
  if(loan.estado === 'devuelto') return 'returned';
  if(loan.estado === 'atrasado') return 'overdue';
  const diff = daysBetween(todayISO(), loan.fecha_estimada_devolucion);
  if(diff < 0) return 'overdue';
  if(diff <= 3) return 'due-soon';
  return 'on-time';
}

function statusLabel(s, loan){
  if(loan.estado === 'perdido') return 'Perdido';
  if(s === 'returned') return 'Devuelto';
  if(s === 'overdue'){
    const d = Math.abs(daysBetween(todayISO(), loan.fecha_estimada_devolucion));
    return `${d}d tarde`;
  }
  if(s === 'due-soon') return 'Por vencer';
  return 'Activo';
}

function tipoLabel(tipo){ return tipo === 'maestro' ? 'Profesor' : 'Alumno'; }
function esSocioLabel(m){ return m.es_socio ? 'Socio' : 'No socio'; }
function estadoPlanLabel(estado){
  return {al_dia: 'Al día', suspendido: 'Suspendido', bloqueado: 'Bloqueado'}[estado] || estado;
}
function estadoPlanEdgeClass(estado){
  return {al_dia: 'on-time', suspendido: 'due-soon', bloqueado: 'overdue'}[estado] || 'on-time';
}
function estadoEjemplarLabel(estado){
  return {disponible: 'Disponible', prestado: 'Prestado', 'dañado': 'Dañado', perdido: 'Perdido'}[estado] || estado;
}
function ejemplarChipClass(estado){
  return {disponible: 'on-time', prestado: 'returned', 'dañado': 'due-soon', perdido: 'overdue'}[estado] || 'returned';
}
function stockAlertInfo(b){
  const disp = b.ejemplares_disponibles;
  const total = b.cantidad_ejemplares || 0;
  if(disp <= 0) return {label: 'Sin stock', cls: 'overdue'};
  if(disp === 1 || (total > 0 && disp / total <= 0.25)) return {label: 'Últimos ejemplares', cls: 'due-soon'};
  return {label: 'Disponible', cls: 'on-time'};
}
function estadoDevueltoLabel(estado){
  return {buen_estado: 'Buen estado', dano_menor: 'Daño menor', dano_mayor: 'Daño mayor', perdida: 'Pérdida'}[estado] || (estado || '—');
}

// ---------- Navegación ----------
function switchTab(tabId, evt){
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const boton = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
  if(boton) boton.classList.add('active');

  const select = document.getElementById('mobileNavSelect');
  if(select) select.value = tabId;

  const target = document.getElementById(`tab-${tabId}`);
  if(target) target.classList.add('active');
  renderAll();
}

// ---------- Modales ----------
function openModal(id){
  document.getElementById(id).classList.add('open');
  if(id === 'modalLoan'){
    document.getElementById('f-loan-book-search').value = '';
    document.getElementById('f-loan-book').value = '';
    document.getElementById('f-loan-member-search').value = '';
    document.getElementById('f-loan-member').value = '';
    document.getElementById('loanBookOptions').classList.remove('open');
    document.getElementById('loanMemberOptions').classList.remove('open');
    setLoanModalidad('domicilio');
    setLoanPersonType('socio');
    document.getElementById('f-loan-start').value = todayISO();
  }
  if(id === 'modalMember'){
    editingMemberId = null;
    document.getElementById('modalMemberTitle').textContent = 'Registrar Nuevo Socio';
    document.getElementById('modalMemberSaveBtn').textContent = 'Guardar Socio';
    document.querySelectorAll('#modalMember input').forEach(i => i.value = '');
    document.getElementById('f-member-dni').disabled = false;
    setMemberType('alumno');
    setEsSocio(true);
  }
  if(id === 'modalBook'){
    editingBookId = null;
    document.getElementById('modalBookTitle').textContent = 'Añadir Nuevo Libro';
    document.getElementById('modalBookSaveBtn').textContent = 'Guardar Libro';
    document.querySelectorAll('#modalBook input').forEach(i => i.value = '');
    document.getElementById('f-book-copies').value = 1;
    document.getElementById('bookCopiesField').style.display = '';
  }
}
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

// ---------- Confirmación (reemplaza confirm() nativo) ----------
function confirmDialog(mensaje, opciones = {}){
  const { titulo = '¿Confirmás?', textoAceptar = 'Confirmar', textoCancelar = 'Cancelar' } = opciones;
  return new Promise((resolve) => {
    document.getElementById('confirmTitle').textContent = titulo;
    document.getElementById('confirmMessage').textContent = mensaje;
    const acceptBtn = document.getElementById('confirmAcceptBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    acceptBtn.textContent = textoAceptar;
    cancelBtn.textContent = textoCancelar;

    const terminar = (resultado) => {
      closeModal('modalConfirm');
      acceptBtn.removeEventListener('click', onAceptar);
      cancelBtn.removeEventListener('click', onCancelar);
      resolve(resultado);
    };
    const onAceptar = () => terminar(true);
    const onCancelar = () => terminar(false);

    acceptBtn.addEventListener('click', onAceptar);
    cancelBtn.addEventListener('click', onCancelar);
    openModal('modalConfirm');
  });
}

// ---------- Buscador de Libro (Préstamos) ----------
function renderLoanBookOptions(){
  const term = document.getElementById('f-loan-book-search').value.trim().toLowerCase();
  const list = document.getElementById('loanBookOptions');
  const disponibles = books.filter(b => b.ejemplares_disponibles > 0);
  const filtrados = term
    ? disponibles.filter(b => b.titulo.toLowerCase().includes(term) || b.autor.toLowerCase().includes(term))
    : disponibles;

  list.innerHTML = filtrados.length
    ? filtrados.slice(0, 40).map(b => {
        const alerta = stockAlertInfo(b);
        const marca = alerta.cls === 'due-soon' ? ` · <span class="txt-warn">${alerta.label}</span>` : '';
        return `
        <div class="search-opt" onmousedown="selectLoanBook(${b.id})">
          <strong>${b.titulo}</strong>
          <span>${b.autor} · ${b.ejemplares_disponibles} disponible(s)${marca}</span>
        </div>`;
      }).join('')
    : '<div class="search-opt empty">Sin libros disponibles que coincidan</div>';
  list.classList.add('open');
}
function selectLoanBook(id){
  const b = books.find(x => x.id === id);
  if(!b) return;
  document.getElementById('f-loan-book').value = id;
  document.getElementById('f-loan-book-search').value = `${b.titulo} (${b.autor})`;
  document.getElementById('loanBookOptions').classList.remove('open');
  const alerta = stockAlertInfo(b);
  if(alerta.cls === 'due-soon'){
    showToast(`Atención: quedan pocos ejemplares de "${b.titulo}" (${b.ejemplares_disponibles} disponible/s)`, 'info');
  }
}

// ---------- Modalidad del préstamo (Domicilio / Sala de lectura) ----------
function setLoanModalidad(modalidad){
  loanModalidad = modalidad;
  document.getElementById('loanModalidadBtn-domicilio').classList.toggle('active', modalidad === 'domicilio');
  document.getElementById('loanModalidadBtn-sala').classList.toggle('active', modalidad === 'sala');
  document.getElementById('f-loan-dias').value = modalidad === 'domicilio' ? 14 : 1;
  document.getElementById('loanModalidadHint').textContent = modalidad === 'domicilio'
    ? 'Sólo socios al día pueden llevarse libros a domicilio.'
    : 'Se lee en la biblioteca; no hace falta ser socio, pero el plan debe estar al día.';
}
function modalidadLabel(m){ return m === 'sala' ? 'Leer en biblioteca' : 'A domicilio'; }

// ---------- Tipo de persona a la que se presta (Socio / Alumno / Profesor) ----------
function setLoanPersonType(tipo){
  loanPersonType = tipo;
  ['socio', 'alumno', 'maestro'].forEach(t => {
    document.getElementById(`loanTypeBtn-${t}`).classList.toggle('active', t === tipo);
  });
  document.getElementById('f-loan-member').value = '';
  document.getElementById('f-loan-member-search').value = '';
  renderLoanMemberOptions();
}

// ---------- Buscador de Persona (Socio / Alumno / Profesor) ----------
function renderLoanMemberOptions(){
  const term = document.getElementById('f-loan-member-search').value.trim().toLowerCase();
  const list = document.getElementById('loanMemberOptions');

  const pool = loanPersonType === 'socio'
    ? members.filter(m => m.es_socio)
    : members.filter(m => (m.tipo || 'alumno') === loanPersonType);

  const filtrados = term
    ? pool.filter(m => m.nombre_completo.toLowerCase().includes(term) || (m.dni || '').includes(term))
    : pool;

  const etiquetaVacia = loanPersonType === 'socio' ? 'socios' : (loanPersonType === 'maestro' ? 'profesores' : 'alumnos');

  list.innerHTML = filtrados.length
    ? filtrados.slice(0, 40).map(m => {
        const bloqueado = m.estado_plan !== 'al_dia';
        return `
        <div class="search-opt ${bloqueado ? 'search-opt-blocked' : ''}" onmousedown="selectLoanMember(${m.id}, ${bloqueado})">
          <strong>${m.nombre_completo}</strong>
          <span>DNI ${m.dni} · ${tipoLabel(m.tipo)} · ${m.es_socio ? 'Socio' : 'No socio'}${bloqueado ? ' · ' + estadoPlanLabel(m.estado_plan) : ''}</span>
        </div>`;
      }).join('')
    : `<div class="search-opt empty">No hay ${etiquetaVacia} que coincidan</div>`;
  list.classList.add('open');
}
function selectLoanMember(id, bloqueado){
  if(bloqueado){
    showToast('Esta persona no está al día y no puede recibir préstamos', 'danger');
    return;
  }
  const m = members.find(x => x.id === id);
  if(!m) return;
  document.getElementById('f-loan-member').value = id;
  document.getElementById('f-loan-member-search').value = `${m.nombre_completo} (DNI ${m.dni})`;
  document.getElementById('loanMemberOptions').classList.remove('open');
}
document.addEventListener('click', (e) => {
  if(!e.target.closest('.search-select')){
    document.querySelectorAll('.search-select-list.open').forEach(l => l.classList.remove('open'));
  }
});

// ---------- Tipo de Socio (Alumno / Maestro) ----------
function setMemberType(tipo){
  selectedMemberType = tipo;
  document.getElementById('typeBtn-alumno').classList.toggle('active', tipo === 'alumno');
  document.getElementById('typeBtn-maestro').classList.toggle('active', tipo === 'maestro');
  document.getElementById('field-member-extra-alumno').style.display = tipo === 'alumno' ? 'flex' : 'none';
  document.getElementById('field-member-division').style.display = tipo === 'alumno' ? 'flex' : 'none';
  document.getElementById('field-member-extra-maestro').style.display = tipo === 'maestro' ? 'flex' : 'none';
}

// ---------- Vínculo: Socio (paga cuota) / No socio ----------
function setEsSocio(esSocio){
  selectedEsSocio = esSocio;
  document.getElementById('socioBtn-si').classList.toggle('active', esSocio);
  document.getElementById('socioBtn-no').classList.toggle('active', !esSocio);
}

// ---------------------------------------------------------------------
// Préstamos y Devoluciones (Módulo 3)
// ---------------------------------------------------------------------
async function saveLoan(evt){
  if(evt) evt.preventDefault();
  const libroId = document.getElementById('f-loan-book').value;
  const socioId = document.getElementById('f-loan-member').value;
  const inicio = document.getElementById('f-loan-start').value;
  const dias = parseInt(document.getElementById('f-loan-dias').value, 10);

  if(!libroId || !socioId || !dias || dias < 1){
    showToast('Elegí un libro, una persona y la cantidad de días de préstamo', 'danger');
    return;
  }

  const libro = books.find(b => b.id === Number(libroId));
  const persona = members.find(m => m.id === Number(socioId));

  if(loanModalidad === 'domicilio' && persona && !persona.es_socio){
    showToast('Esta persona no es socia: sólo puede llevarse el libro para leer en la biblioteca', 'danger');
    return;
  }
  if(loanModalidad === 'domicilio' && libro && libro.ejemplares_disponibles === 1 && currentUser.rol !== 'ADMIN'){
    showToast('Este es el último ejemplar disponible: sólo un administrador puede autorizar llevarlo a domicilio', 'danger');
    return;
  }
  if(loanModalidad === 'domicilio' && libro && libro.ejemplares_disponibles === 2){
    const seguir = await confirmDialog(
      `Quedan pocos ejemplares de "${libro.titulo}" (2 disponibles). ¿Confirmás el préstamo a domicilio igual?`,
      {titulo: 'Pocos ejemplares disponibles', textoAceptar: 'Prestar igual'}
    );
    if(!seguir) return;
  }

  try {
    await apiFetch('/prestamos', {
      method: 'POST',
      body: JSON.stringify({
        libro_id: Number(libroId), socio_id: Number(socioId),
        fecha_prestamo: inicio, dias_prestamo: dias, modalidad: loanModalidad,
      }),
    });
    closeModal('modalLoan');
    showToast('Préstamo registrado correctamente', 'success');
    await cargarDatosIniciales();
  } catch(err){ /* apiFetch ya mostró el error */ }
}

function abrirDevolucion(prestamoId){
  document.getElementById('f-devolucion-prestamo-id').value = prestamoId;
  document.getElementById('f-devolucion-estado').value = 'buen_estado';
  document.getElementById('f-devolucion-obs').value = '';
  openModal('modalDevolucion');
}

async function confirmarDevolucion(evt){
  if(evt) evt.preventDefault();
  const id = document.getElementById('f-devolucion-prestamo-id').value;
  const estado = document.getElementById('f-devolucion-estado').value;
  const obs = document.getElementById('f-devolucion-obs').value.trim();

  try {
    await apiFetch(`/prestamos/${id}/devolver`, {
      method: 'PUT',
      body: JSON.stringify({estado_libro_devuelto: estado, observaciones: obs}),
    });
    closeModal('modalDevolucion');
    showToast(estado === 'perdida' ? 'Pérdida registrada y sanción generada' : 'Devolución registrada', 'success');
    await cargarDatosIniciales();
  } catch(err){}
}

async function reabrirPrestamo(id){
  try {
    await apiFetch(`/prestamos/${id}/reabrir`, {method: 'PUT'});
    showToast('Préstamo reabierto', 'info');
    await cargarDatosIniciales();
  } catch(err){}
}

async function deleteLoan(id){
  const ok = await confirmDialog('¿Eliminar este préstamo? Esta acción no se puede deshacer.', {titulo: 'Eliminar préstamo', textoAceptar: 'Eliminar'});
  if(!ok) return;
  try {
    await apiFetch(`/prestamos/${id}`, {method: 'DELETE'});
    showToast('Préstamo eliminado', 'danger');
    await cargarDatosIniciales();
  } catch(err){}
}

// ---------------------------------------------------------------------
// Escáner de código de barras (ISBN) con autocompletado
// ---------------------------------------------------------------------
let zxingReader = null;

function abrirEscaner(onCodigoDetectado){
  if(typeof ZXing === 'undefined'){
    showToast('No se pudo cargar el lector de códigos de barras', 'danger');
    return;
  }
  document.getElementById('escanerEstado').textContent = 'Iniciando cámara...';
  openModal('modalEscaner');

  zxingReader = new ZXing.BrowserMultiFormatReader();
  zxingReader
    .decodeFromVideoDevice(null, 'escanerVideo', (result, err) => {
      document.getElementById('escanerEstado').textContent = 'Buscando código de barras...';
      if(result){
        const isbn = result.getText().replace(/[^0-9Xx]/g, '');
        cerrarEscanerISBN();
        onCodigoDetectado(isbn);
      }
      // err se dispara en cada cuadro sin código visible; no es un error real, se ignora.
    })
    .catch((err) => {
      showToast('No se pudo acceder a la cámara: ' + (err && err.message ? err.message : 'permiso denegado'), 'danger');
      cerrarEscanerISBN();
    });
}

function abrirEscanerISBN(){
  abrirEscaner(procesarISBNEscaneado);
}

function abrirEscanerParaPrestamo(){
  abrirEscaner(buscarLibroEscaneadoParaPrestamo);
}

function buscarLibroEscaneadoParaPrestamo(isbn){
  const libro = books.find(b => b.isbn && b.isbn.replace(/[^0-9Xx]/g, '') === isbn);
  if(!libro){
    showToast('No encontramos ningún libro con ese ISBN en el catálogo', 'danger');
    return;
  }
  if(libro.ejemplares_disponibles <= 0){
    showToast(`"${libro.titulo}" no tiene ejemplares disponibles ahora mismo`, 'danger');
    return;
  }
  selectLoanBook(libro.id);
  showToast(`Libro encontrado: ${libro.titulo}`, 'success');
}

function cerrarEscanerISBN(){
  if(zxingReader){
    zxingReader.reset();
    zxingReader = null;
  }
  closeModal('modalEscaner');
}

async function procesarISBNEscaneado(isbn){
  document.getElementById('f-book-isbn').value = isbn;
  showToast(`Código leído: ${isbn}. Buscando datos del libro...`, 'info');

  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
    if(!res.ok){
      showToast('No encontramos datos para ese ISBN — completá el resto a mano', 'info');
      return;
    }
    const libro = await res.json();

    if(libro.title) document.getElementById('f-book-title').value = libro.title;
    if(libro.publishers && libro.publishers.length){
      document.getElementById('f-book-editorial').value = libro.publishers[0];
    }
    if(libro.publish_date){
      const anio = libro.publish_date.match(/\d{4}/);
      if(anio) document.getElementById('f-book-anio').value = anio[0];
    }

    // El autor no viene directo: hay que seguir edición → obra → autor.
    let clavesAutores = (libro.authors || []).map(a => a.key).filter(Boolean);
    if(!clavesAutores.length && libro.works && libro.works.length){
      const obraRes = await fetch(`https://openlibrary.org${libro.works[0].key}.json`);
      if(obraRes.ok){
        const obra = await obraRes.json();
        clavesAutores = (obra.authors || []).map(a => a.author && a.author.key).filter(Boolean);
      }
    }
    if(clavesAutores.length){
      const nombres = await Promise.all(clavesAutores.map(async (key) => {
        const r = await fetch(`https://openlibrary.org${key}.json`);
        if(!r.ok) return null;
        const a = await r.json();
        return a.name;
      }));
      const autor = nombres.filter(Boolean).join(', ');
      if(autor) document.getElementById('f-book-author').value = autor;
    } else if(libro.by_statement){
      document.getElementById('f-book-author').value = libro.by_statement;
    }

    showToast('Datos del libro completados automáticamente', 'success');
  } catch(err){
    showToast('No se pudo consultar la base de libros — completá a mano', 'info');
  }
}

// ---------------------------------------------------------------------
// Libros y Ejemplares (Módulos 1 y 4)
// ---------------------------------------------------------------------
async function saveBook(evt){
  if(evt) evt.preventDefault();
  const titulo = document.getElementById('f-book-title').value.trim();
  const autor = document.getElementById('f-book-author').value.trim();
  const editorial = document.getElementById('f-book-editorial').value.trim();
  const edicion = document.getElementById('f-book-edicion').value.trim();
  const anio = document.getElementById('f-book-anio').value;
  const genero = document.getElementById('f-book-genre').value.trim();
  const categoria = document.getElementById('f-book-categoria').value.trim();
  const isbn = document.getElementById('f-book-isbn').value.trim();
  const ubicacion = document.getElementById('f-book-ubicacion').value.trim();
  const cantidad = parseInt(document.getElementById('f-book-copies').value) || 1;

  if(!titulo){ showToast('Ingresá al menos el título del libro', 'danger'); return; }

  const datosComunes = {
    titulo, autor, editorial, edicion,
    anio_publicacion: anio ? Number(anio) : null,
    genero, categoria, isbn, ubicacion_fisica: ubicacion,
  };

  try {
    if(editingBookId){
      await apiFetch(`/libros/${editingBookId}`, {
        method: 'PUT', body: JSON.stringify(datosComunes),
      });
      showToast('Libro actualizado', 'success');
    } else {
      await apiFetch('/libros', {
        method: 'POST',
        body: JSON.stringify(Object.assign({}, datosComunes, {cantidad_ejemplares: cantidad})),
      });
      showToast('Libro añadido al catálogo', 'success');
    }
    closeModal('modalBook');
    document.querySelectorAll('#modalBook input').forEach(i => i.value = '');
    document.getElementById('f-book-copies').value = 1;
    editingBookId = null;
    await cargarDatosIniciales();
  } catch(err){}
}

async function deleteBook(id){
  const ok = await confirmDialog('¿Eliminar este libro del catálogo?', {titulo: 'Eliminar libro', textoAceptar: 'Eliminar'});
  if(!ok) return;
  try {
    await apiFetch(`/libros/${id}`, {method: 'DELETE'});
    showToast('Libro eliminado del catálogo', 'danger');
    await cargarDatosIniciales();
  } catch(err){}
}

async function ciclarEstadoEjemplar(ejemplarId, estadoActual){
  if(estadoActual === 'prestado'){
    showToast('Este ejemplar está prestado; no se puede cambiar su estado', 'info');
    return;
  }
  const siguiente = {disponible: 'dañado', 'dañado': 'perdido', perdido: 'disponible'}[estadoActual] || 'disponible';
  try {
    await apiFetch(`/libros/ejemplares/${ejemplarId}/estado`, {
      method: 'PUT', body: JSON.stringify({estado: siguiente}),
    });
    showToast(`Ejemplar marcado como ${estadoEjemplarLabel(siguiente)}`, 'info');
    await cargarDatosIniciales();
  } catch(err){}
}

// ---------------------------------------------------------------------
// Socios (Módulo 2)
// ---------------------------------------------------------------------
async function saveMember(evt){
  if(evt) evt.preventDefault();
  const nombre = document.getElementById('f-member-name').value.trim();
  const dni = document.getElementById('f-member-dni').value.trim();
  const phone = document.getElementById('f-member-phone').value.trim();
  const email = document.getElementById('f-member-email').value.trim();
  const tipo = selectedMemberType;
  const course = document.getElementById('f-member-course').value.trim();
  const division = document.getElementById('f-member-division').value.trim();
  const subject = document.getElementById('f-member-subject').value.trim();

  if(!nombre || !dni){ showToast('Ingresá nombre y DNI de la persona', 'danger'); return; }

  const payload = {
    nombre_completo: nombre, dni, telefono: phone, email,
    tipo, curso: course, division, materia: subject,
    es_socio: selectedEsSocio,
  };

  try {
    if(editingMemberId){
      await apiFetch(`/socios/${editingMemberId}`, {method: 'PUT', body: JSON.stringify(payload)});
      showToast('Socio actualizado correctamente', 'success');
    } else {
      await apiFetch('/socios', {method: 'POST', body: JSON.stringify(payload)});
      showToast(`${tipoLabel(tipo)} ${selectedEsSocio ? 'socio' : 'no socio'} registrado correctamente`, 'success');
    }
    closeModal('modalMember');
    document.querySelectorAll('#modalMember input').forEach(i => i.value = '');
    document.getElementById('f-member-dni').disabled = false;
    editingMemberId = null;
    setMemberType('alumno');
    setEsSocio(true);
    await cargarDatosIniciales();
  } catch(err){}
}

async function deleteMember(id){
  const ok = await confirmDialog('¿Eliminar este socio?', {titulo: 'Eliminar socio', textoAceptar: 'Eliminar'});
  if(!ok) return;
  try {
    await apiFetch(`/socios/${id}`, {method: 'DELETE'});
    showToast('Socio eliminado', 'danger');
    await cargarDatosIniciales();
  } catch(err){}
}

async function toggleBloqueoSocio(id, estadoPlanActual){
  const nuevoEstado = estadoPlanActual === 'bloqueado' ? 'al_dia' : 'bloqueado';
  try {
    await apiFetch(`/socios/${id}`, {method: 'PUT', body: JSON.stringify({estado_plan: nuevoEstado})});
    showToast(nuevoEstado === 'bloqueado' ? 'Socio bloqueado' : 'Socio desbloqueado', 'info');
    await cargarDatosIniciales();
  } catch(err){}
}

// ---------------------------------------------------------------------
// Sanciones (Módulo 5)
// ---------------------------------------------------------------------
function setSancionFilter(key, btn){
  activeSancionFilter = key;
  document.querySelectorAll('#sancionFilters .filter').forEach(f => f.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderSanciones();
}

async function pagarSancion(id){
  try {
    await apiFetch(`/sanciones/${id}/pagar`, {method: 'PUT'});
    showToast('Sanción marcada como pagada', 'success');
    await cargarDatosIniciales();
  } catch(err){}
}

// ---------------------------------------------------------------------
// Reportes (Módulo 6)
// ---------------------------------------------------------------------
async function generarReporte(evt){
  if(evt) evt.preventDefault();
  const tipo = document.getElementById('f-reporte-tipo').value;
  const desde = document.getElementById('f-reporte-desde').value;
  const hasta = document.getElementById('f-reporte-hasta').value;

  const params = new URLSearchParams();
  if(desde) params.set('desde', desde);
  if(hasta) params.set('hasta', hasta);

  try {
    const data = await apiFetch(`/reportes/${tipo}?${params.toString()}`);
    ultimoReporte = {tipo, data};
    renderReporte(tipo, data);
  } catch(err){}
}

const REPORTE_TIPO_LABEL = {
  'prestados-actualmente': 'Préstamos actuales (todo lo prestado)',
  'vencidos': 'Préstamos vencidos',
  'socios-atrasados': 'Socios con atrasos',
  'mas-solicitados': 'Libros más solicitados',
  'danos-perdidas': 'Daños y pérdidas',
  'ingresos-multas': 'Ingresos por multas',
};

function filaTablaReporte(tipo, item, i){
  if(tipo === 'vencidos' || tipo === 'prestados-actualmente'){
    return `<tr><td>${i}</td><td>${item.libro_titulo || '—'}</td><td>${item.socio_nombre || '—'}</td><td class="mono">${item.codigo}</td><td>${formatDate(item.fecha_estimada_devolucion)}</td><td>${item.estado === 'atrasado' ? 'Atrasado' : 'Activo'}</td></tr>`;
  }
  if(tipo === 'danos-perdidas'){
    return `<tr><td>${i}</td><td>${item.libro_titulo || '—'}</td><td>${item.socio_nombre || '—'}</td><td class="mono">${item.codigo}</td><td>${formatDate(item.fecha_real_devolucion)}</td><td>${estadoDevueltoLabel(item.estado_libro_devuelto)}</td></tr>`;
  }
  if(tipo === 'socios-atrasados'){
    return `<tr><td>${i}</td><td>${item.nombre_completo}</td><td class="mono">${item.dni}</td><td>${estadoPlanLabel(item.estado_plan)}</td></tr>`;
  }
  if(tipo === 'mas-solicitados'){
    return `<tr><td>${i}</td><td>${item.titulo}</td><td>${item.autor}</td><td class="mono">${item.total_prestamos}</td></tr>`;
  }
  if(tipo === 'ingresos-multas'){
    return `<tr><td>${i}</td><td>${item.socio_nombre || 'Socio eliminado'}</td><td>${item.tipo === 'atraso' ? 'Multa por atraso' : 'Reposición por pérdida'}</td><td class="mono">$${Number(item.monto_total).toFixed(2)}</td></tr>`;
  }
  return '';
}

const REPORTE_COLUMNAS = {
  'prestados-actualmente': ['#', 'Libro', 'Socio', 'Código', 'Vencimiento', 'Estado'],
  'vencidos': ['#', 'Libro', 'Socio', 'Código', 'Vencimiento', 'Estado'],
  'danos-perdidas': ['#', 'Libro', 'Socio', 'Código', 'Devuelto', 'Estado del libro'],
  'socios-atrasados': ['#', 'Nombre', 'DNI', 'Estado'],
  'mas-solicitados': ['#', 'Libro', 'Autor', 'Préstamos'],
  'ingresos-multas': ['#', 'Socio', 'Tipo', 'Monto'],
};

function descargarReportePDF(){
  const {tipo, data} = ultimoReporte;
  const lista = tipo === 'ingresos-multas' ? (data ? data.detalle : null) : data;

  if(!tipo || !lista || !lista.length){
    showToast('Generá un reporte con resultados primero', 'danger');
    return;
  }

  const desde = document.getElementById('f-reporte-desde').value;
  const hasta = document.getElementById('f-reporte-hasta').value;
  const rango = (desde || hasta)
    ? `Rango: ${desde ? formatDate(desde) : 'inicio'} — ${hasta ? formatDate(hasta) : 'hoy'}`
    : 'Rango: todas las fechas';

  const printTitle = document.getElementById('reportePrintTitle');
  printTitle.querySelector('h2').textContent = REPORTE_TIPO_LABEL[tipo] || 'Reporte';
  let subtitulo = `${rango} · ${lista.length} resultado${lista.length === 1 ? '' : 's'} · Generado el ${formatDate(todayISO())} por ${currentUser.nombre_completo}`;
  if(tipo === 'ingresos-multas'){
    subtitulo = `Total recaudado: $${Number(data.total_recaudado).toFixed(2)} · ${subtitulo}`;
  }
  printTitle.querySelector('p').textContent = subtitulo;

  const columnas = REPORTE_COLUMNAS[tipo];
  const filas = lista.map((item, idx) => filaTablaReporte(tipo, item, idx + 1)).join('');
  document.getElementById('reportePrintTable').innerHTML = `
    <table>
      <thead><tr>${columnas.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${filas}</tbody>
    </table>
  `;

  window.print();
}

function renderReporte(tipo, data){
  const resumen = document.getElementById('reporteResumen');
  const resultados = document.getElementById('reporteResultados');
  const head = document.getElementById('reporteResultadosHead');
  resumen.style.display = 'none';
  resumen.innerHTML = '';

  const columnas = REPORTE_COLUMNAS[tipo].slice(1); // sin la columna "#" (no hace falta en pantalla)
  head.innerHTML = `<tr>${columnas.map(c => `<th>${c}</th>`).join('')}</tr>`;
  const colspan = columnas.length;

  if(tipo === 'vencidos' || tipo === 'prestados-actualmente'){
    resultados.innerHTML = data.length ? data.map(p => {
      const s = statusOf(p);
      return `
      <tr onclick="verDetallePrestamo(${p.id})">
        <td><strong>${p.libro_titulo || 'Libro eliminado'}</strong></td>
        <td>${p.socio_nombre || '—'}</td>
        <td class="mono">${p.codigo}</td>
        <td>${formatDate(p.fecha_estimada_devolucion)}</td>
        <td><span class="status-chip ${s}">${statusLabel(s, p)}</span></td>
      </tr>`;
    }).join('') : `<tr><td colspan="${colspan}" class="empty-state-cell">Sin resultados para el rango elegido.</td></tr>`;

  } else if(tipo === 'danos-perdidas'){
    resultados.innerHTML = data.length ? data.map(p => `
      <tr onclick="verDetallePrestamo(${p.id})">
        <td><strong>${p.libro_titulo || 'Libro eliminado'}</strong></td>
        <td>${p.socio_nombre || '—'}</td>
        <td class="mono">${p.codigo}</td>
        <td>${formatDate(p.fecha_real_devolucion)}</td>
        <td>${estadoDevueltoLabel(p.estado_libro_devuelto)}</td>
      </tr>
    `).join('') : `<tr><td colspan="${colspan}" class="empty-state-cell">Sin resultados para el rango elegido.</td></tr>`;

  } else if(tipo === 'socios-atrasados'){
    resultados.innerHTML = data.length ? data.map(s => `
      <tr onclick="verDetalleSocio(${s.id})">
        <td><strong>${s.nombre_completo}</strong></td>
        <td class="mono">${s.dni}</td>
        <td><span class="status-chip overdue">${estadoPlanLabel(s.estado_plan)}</span></td>
      </tr>
    `).join('') : `<tr><td colspan="${colspan}" class="empty-state-cell">No hay socios con atrasos.</td></tr>`;

  } else if(tipo === 'mas-solicitados'){
    resultados.innerHTML = data.length ? data.map(r => `
      <tr onclick="verDetalleLibro(${r.libro_id})">
        <td><strong>${r.titulo}</strong></td>
        <td>${r.autor}</td>
        <td class="mono">${r.total_prestamos}</td>
      </tr>
    `).join('') : `<tr><td colspan="${colspan}" class="empty-state-cell">Sin préstamos en el rango elegido.</td></tr>`;

  } else if(tipo === 'ingresos-multas'){
    resumen.style.display = 'grid';
    resumen.innerHTML = `
      <div class="dash-card glass">
        <div class="num mono" style="color:var(--green);">$${Number(data.total_recaudado).toFixed(2)}</div>
        <div class="lbl">Total Recaudado</div>
      </div>
      <div class="dash-card glass">
        <div class="num mono" style="color:var(--ink);">${data.cantidad_sanciones}</div>
        <div class="lbl">Sanciones Pagadas</div>
      </div>
    `;
    resultados.innerHTML = data.detalle.length ? data.detalle.map(s => `
      <tr onclick="verDetalleSocio(${s.socio_id})">
        <td><strong>${s.socio_nombre || 'Socio eliminado'}</strong></td>
        <td>${s.tipo === 'atraso' ? 'Multa por atraso' : 'Reposición por pérdida'}</td>
        <td class="mono">$${Number(s.monto_total).toFixed(2)}</td>
      </tr>
    `).join('') : `<tr><td colspan="${colspan}" class="empty-state-cell">Sin ingresos en el rango elegido.</td></tr>`;
  }
}

// ---------------------------------------------------------------------
// Usuarios y Permisos (Módulo 7)
// ---------------------------------------------------------------------
async function saveUsuario(evt){
  if(evt) evt.preventDefault();
  const username = document.getElementById('f-usuario-username').value.trim();
  const password = document.getElementById('f-usuario-password').value;
  const nombre = document.getElementById('f-usuario-nombre').value.trim();
  const rol = document.getElementById('f-usuario-rol').value;
  const turno = document.getElementById('f-usuario-turno').value;

  if(!username || !password || !nombre){
    showToast('Completá usuario, contraseña y nombre completo', 'danger');
    return;
  }

  try {
    await apiFetch('/usuarios', {
      method: 'POST',
      body: JSON.stringify({username, password, nombre_completo: nombre, rol, turno}),
    });
    closeModal('modalUsuario');
    document.querySelectorAll('#modalUsuario input').forEach(i => i.value = '');
    showToast('Usuario creado correctamente', 'success');
    await cargarDatosIniciales();
  } catch(err){}
}

async function toggleEstadoUsuario(id, estadoActual){
  const nuevo = estadoActual === 'activo' ? 'inactivo' : 'activo';
  try {
    await apiFetch(`/usuarios/${id}/estado`, {method: 'PUT', body: JSON.stringify({estado: nuevo})});
    showToast(nuevo === 'activo' ? 'Usuario activado' : 'Usuario desactivado', 'info');
    await cargarDatosIniciales();
  } catch(err){}
}

// ---------------------------------------------------------------------
// Renders / Renderizado
// ---------------------------------------------------------------------
function renderHomeHeader(){
  const fecha = new Date().toLocaleDateString('es-AR', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
  document.getElementById('homeFecha').textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1);
}

function renderHomeStats(){
  if(dashboardResumen){
    document.getElementById('dashActiveLoans').textContent = dashboardResumen.prestamos_activos;
    document.getElementById('dashOverdueLoans').textContent = dashboardResumen.prestamos_vencidos;
    document.getElementById('dashTotalBooks').textContent = dashboardResumen.total_libros;
    document.getElementById('dashTotalMembers').textContent = dashboardResumen.total_socios;
  }

  const hoy = todayISO();
  const abiertos = loans.filter(l => l.estado === 'activo' || l.estado === 'atrasado');
  const prestadosHoy = loans.filter(l => l.fecha_prestamo === hoy).length;
  const vencenSemana = abiertos.filter(l => {
    const d = daysBetween(hoy, l.fecha_estimada_devolucion);
    return d >= 0 && d <= 7;
  }).length;
  const ejemplaresDisp = books.reduce((acc, b) => acc + (b.ejemplares_disponibles || 0), 0);
  const sociosPagos = members.filter(m => m.es_socio).length;

  document.getElementById('dashActiveSub').textContent = `${prestadosHoy} hoy`;
  document.getElementById('dashOverdueSub').textContent = `${vencenSemana} por vencer`;
  document.getElementById('dashBooksSub').textContent = `${ejemplaresDisp} en estante`;
  document.getElementById('dashMembersSub').textContent = `${sociosPagos} socios`;
}

function fechaCorta(iso){
  if(!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function filasOVacio(tbody, filas, columnas, textoVacio){
  const el = document.getElementById(tbody);
  if(!el) return;
  el.innerHTML = filas.length
    ? filas.join('')
    : `<tr class="grid-empty"><td colspan="${columnas}">${textoVacio}</td></tr>`;
}

function renderHomeTables(){
  const ultimosSocios = [...members].sort((a, b) => b.id - a.id).slice(0, 6);
  filasOVacio('homeLastMembers', ultimosSocios.map(m => `
    <tr>
      <td class="num-cell">${m.id}</td>
      <td class="mono">${m.dni || ''}</td>
      <td>${m.nombre_completo}</td>
      <td>${tipoLabel(m.tipo)}</td>
      <td>${esSocioLabel(m)}</td>
    </tr>`), 5, 'No hay personas registradas.');

  const ultimosLibros = [...books].sort((a, b) => b.id - a.id).slice(0, 6);
  filasOVacio('homeLastBooks', ultimosLibros.map(b => `
    <tr>
      <td class="num-cell">${b.id}</td>
      <td class="mono">${b.isbn || ''}</td>
      <td>${b.titulo}</td>
      <td>${b.autor || ''}</td>
      <td class="num-cell">${b.ejemplares_disponibles}/${b.cantidad_ejemplares}</td>
    </tr>`), 5, 'No hay libros cargados.');

  const ultimosPrestamos = [...loans]
    .sort((a, b) => (b.fecha_prestamo > a.fecha_prestamo ? 1 : b.fecha_prestamo < a.fecha_prestamo ? -1 : b.id - a.id))
    .slice(0, 6);
  filasOVacio('homeLastLoans', ultimosPrestamos.map(l => {
    const st = statusOf(l);
    return `
    <tr onclick="verDetallePrestamo(${l.id})">
      <td class="mono">${fechaCorta(l.fecha_prestamo)}</td>
      <td>${l.libro_titulo || ''}</td>
      <td>${l.socio_nombre || ''}</td>
      <td class="mono">${fechaCorta(l.fecha_estimada_devolucion)}</td>
      <td><span class="grid-state ${st}">${statusLabel(st, l)}</span></td>
    </tr>`;
  }), 5, 'No hay préstamos registrados.');

  const ultimasDevoluciones = loans
    .filter(l => l.fecha_real_devolucion)
    .sort((a, b) => (b.fecha_real_devolucion > a.fecha_real_devolucion ? 1 : b.fecha_real_devolucion < a.fecha_real_devolucion ? -1 : b.id - a.id))
    .slice(0, 6);
  filasOVacio('homeLastReturns', ultimasDevoluciones.map(l => `
    <tr onclick="verDetallePrestamo(${l.id})">
      <td class="mono">${fechaCorta(l.fecha_real_devolucion)}</td>
      <td>${l.libro_titulo || ''}</td>
      <td>${l.socio_nombre || ''}</td>
      <td>${estadoDevueltoLabel(l.estado_libro_devuelto)}</td>
    </tr>`), 4, 'Todavía no hubo devoluciones.');
}

function renderHomeChart(){
  const cont = document.getElementById('homeChart');
  if(!cont) return;
  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth();
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const mesesLargos = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const cuenta = new Array(12).fill(0);
  loans.forEach(l => {
    if(l.fecha_prestamo && Number(l.fecha_prestamo.slice(0, 4)) === anio){
      cuenta[Number(l.fecha_prestamo.slice(5, 7)) - 1]++;
    }
  });
  const max = Math.max(...cuenta, 1);
  const mesMax = cuenta.indexOf(Math.max(...cuenta));
  document.getElementById('homeChartYear').textContent = `Año ${anio} · ${cuenta.reduce((a, b) => a + b, 0)} préstamos`;

  cont.innerHTML = cuenta.map((n, i) => {
    const etiqueta = (n > 0 && (i === mesMax || i === mesActual)) ? `<span class="bar-val">${n}</span>` : '';
    const tip = `${mesesLargos[i]}: ${n} préstamo${n === 1 ? '' : 's'}`;
    return `
    <div class="bar-col${i === mesActual ? ' current' : ''}" data-tip="${tip}">
      <div class="bar-area">${etiqueta}<div class="bar" style="height:${(n / max) * 88}%"></div></div>
      <span class="bar-lbl">${meses[i]}</span>
    </div>`;
  }).join('');
}

function renderHome(){
  renderHomeHeader();
  renderHomeStats();
  renderHomeTables();
  renderHomeChart();
}

function applyLoanFilters(){
  loanFilterEstado = document.getElementById('loanFilterEstado').value;
  renderLoans();
}

function resetLoanFilters(){
  loanFilterEstado = 'todos';
  document.getElementById('loanFilterEstado').value = 'todos';
  document.getElementById('loanSearch').value = '';
  renderLoans();
}

function renderLoans(){
  const query = (document.getElementById('loanSearch')?.value || '').toLowerCase();
  let list = loans.slice();

  if(loanFilterEstado !== 'todos') list = list.filter(l => statusOf(l) === loanFilterEstado);
  if(query){
    list = list.filter(l =>
      (l.libro_titulo || '').toLowerCase().includes(query) ||
      (l.socio_nombre || '').toLowerCase().includes(query)
    );
  }

  const container = document.getElementById('loansList');
  if(!container) return;
  if(!list.length){
    container.innerHTML = '<tr><td colspan="4" class="empty-state-cell">No se encontraron préstamos.</td></tr>';
    return;
  }

  container.innerHTML = list.map(l => {
    const s = statusOf(l);
    return `
    <tr onclick="verDetallePrestamo(${l.id})">
      <td><strong>${l.libro_titulo || '—'}</strong></td>
      <td>${l.socio_nombre || '—'}</td>
      <td>${formatDate(l.fecha_estimada_devolucion)}</td>
      <td><span class="status-chip ${s}">${statusLabel(s, l)}</span></td>
    </tr>`;
  }).join('');
}

// ---------- Modal de detalle de préstamo ----------
function verDetallePrestamo(id){
  const l = loans.find(x => x.id === id);
  if(!l) return;
  detallePrestamoId = id;
  const s = statusOf(l);
  const yaCerrado = l.estado === 'devuelto' || l.estado === 'perdido';

  document.getElementById('detallePrestamoLibro').textContent = l.libro_titulo || '—';
  document.getElementById('detallePrestamoCodigo').textContent = l.codigo || '—';
  document.getElementById('detallePrestamoModalidad').textContent = modalidadLabel(l.modalidad);
  document.getElementById('detallePrestamoEjemplar').textContent = l.numero_ejemplar ? `#${l.numero_ejemplar}` : '—';
  document.getElementById('detallePrestamoSocio').textContent = l.socio_nombre || '—';
  document.getElementById('detallePrestamoDni').textContent = l.socio_dni || '—';
  document.getElementById('detallePrestamoFechaInicio').textContent = formatDate(l.fecha_prestamo);
  document.getElementById('detallePrestamoFechaEstimada').textContent = formatDate(l.fecha_estimada_devolucion);
  document.getElementById('detallePrestamoEstado').innerHTML = `<span class="status-chip ${s}">${statusLabel(s, l)}</span>`;

  const fechaRealRow = document.getElementById('detallePrestamoFechaRealRow');
  if(l.fecha_real_devolucion){
    fechaRealRow.style.display = 'flex';
    document.getElementById('detallePrestamoFechaReal').textContent = formatDate(l.fecha_real_devolucion);
  } else {
    fechaRealRow.style.display = 'none';
  }

  const estadoLibroRow = document.getElementById('detallePrestamoEstadoLibroRow');
  if(l.estado_libro_devuelto){
    estadoLibroRow.style.display = 'flex';
    document.getElementById('detallePrestamoEstadoLibro').textContent = estadoDevueltoLabel(l.estado_libro_devuelto);
  } else {
    estadoLibroRow.style.display = 'none';
  }

  const obsRow = document.getElementById('detallePrestamoObsRow');
  if(l.observaciones){
    obsRow.style.display = 'flex';
    document.getElementById('detallePrestamoObs').textContent = l.observaciones;
  } else {
    obsRow.style.display = 'none';
  }

  const toggleBtn = document.getElementById('detallePrestamoToggleBtn');
  toggleBtn.textContent = yaCerrado ? 'Reabrir' : 'Devolver';

  document.getElementById('detallePrestamoRenovarBtn').style.display = l.estado === 'activo' ? '' : 'none';

  openModal('modalPrestamoDetalle');
}

async function renovarPrestamoDesdeDetalle(){
  const l = loans.find(x => x.id === detallePrestamoId);
  if(!l) return;

  const sugerido = l.modalidad === 'sala' ? 1 : 14;
  const dias = parseInt(prompt('¿Cuántos días más de préstamo?', sugerido), 10);
  if(!dias || dias < 1) return;

  try {
    await apiFetch(`/prestamos/${l.id}/renovar`, {method: 'PUT', body: JSON.stringify({dias})});
    showToast(`Préstamo renovado por ${dias} día${dias === 1 ? '' : 's'} más`, 'success');
    await cargarDatosIniciales();
    verDetallePrestamo(l.id);
  } catch(err){}
}

function toggleDevolucionDesdeDetalle(){
  const l = loans.find(x => x.id === detallePrestamoId);
  if(!l) return;
  closeModal('modalPrestamoDetalle');
  const yaCerrado = l.estado === 'devuelto' || l.estado === 'perdido';
  if(yaCerrado) reabrirPrestamo(l.id);
  else abrirDevolucion(l.id);
}

function eliminarPrestamoDesdeDetalle(){
  const id = detallePrestamoId;
  closeModal('modalPrestamoDetalle');
  deleteLoan(id);
}

function generosDisponibles(){
  const set = new Set(books.map(b => b.genero).filter(Boolean));
  return Array.from(set).sort();
}

function categoriasDisponibles(){
  const set = new Set(books.map(b => b.categoria).filter(Boolean));
  return Array.from(set).sort();
}

function renderBookFilterOptions(){
  const generoSel = document.getElementById('bookFilterGenero');
  const categoriaSel = document.getElementById('bookFilterCategoria');
  if(!generoSel || !categoriaSel) return;

  const opciones = (valores) => ['<option value="todos">Todos</option>']
    .concat(valores.map(v => `<option value="${v.replace(/"/g, '&quot;')}">${v}</option>`)).join('');

  generoSel.innerHTML = opciones(generosDisponibles());
  categoriaSel.innerHTML = opciones(categoriasDisponibles());
  generoSel.value = bookFilterGenero;
  categoriaSel.value = bookFilterCategoria;
}

function applyBookFilters(){
  bookFilterGenero = document.getElementById('bookFilterGenero').value;
  bookFilterCategoria = document.getElementById('bookFilterCategoria').value;
  bookFilterDisponibilidad = document.getElementById('bookFilterDisponibilidad').value;
  renderBooks();
}

function resetBookFilters(){
  bookFilterGenero = 'todos';
  bookFilterCategoria = 'todos';
  bookFilterDisponibilidad = 'todos';
  document.getElementById('bookSearch').value = '';
  renderBooks();
}

function renderBooks(){
  renderBookFilterOptions();
  const query = (document.getElementById('bookSearch')?.value || '').toLowerCase();
  let list = books.filter(b =>
    (b.titulo || '').toLowerCase().includes(query) ||
    (b.autor || '').toLowerCase().includes(query) ||
    (b.isbn || '').includes(query) ||
    (b.categoria || '').toLowerCase().includes(query)
  );
  if(bookFilterGenero !== 'todos') list = list.filter(b => b.genero === bookFilterGenero);
  if(bookFilterCategoria !== 'todos') list = list.filter(b => b.categoria === bookFilterCategoria);
  if(bookFilterDisponibilidad !== 'todos'){
    list = list.filter(b => {
      const cls = stockAlertInfo(b).cls;
      if(bookFilterDisponibilidad === 'disponible') return cls === 'on-time';
      if(bookFilterDisponibilidad === 'ultimos') return cls === 'due-soon';
      if(bookFilterDisponibilidad === 'sin-stock') return cls === 'overdue';
      return true;
    });
  }

  const container = document.getElementById('booksList');
  if(!container) return;
  if(!list.length){
    container.innerHTML = '<tr><td colspan="4" class="empty-state-cell">No hay libros registrados en el catálogo.</td></tr>';
    return;
  }

  container.innerHTML = list.map(b => {
    const alerta = stockAlertInfo(b);
    return `
    <tr onclick="verDetalleLibro(${b.id})">
      <td><strong>${b.titulo}</strong></td>
      <td>${b.autor || 'Desconocido'}</td>
      <td>${b.categoria || b.genero || '—'}</td>
      <td><span class="status-chip ${alerta.cls}">${b.ejemplares_disponibles}/${b.cantidad_ejemplares} · ${alerta.label}</span></td>
    </tr>`;
  }).join('');
}

// ---------- Modal de detalle de libro ----------
function verDetalleLibro(id){
  const b = books.find(x => x.id === id);
  if(!b) return;
  detalleLibroId = id;

  document.getElementById('detalleLibroTitulo').textContent = b.titulo;
  document.getElementById('detalleLibroAutor').textContent = b.autor || 'Desconocido';
  document.getElementById('detalleLibroEditorial').textContent = b.editorial || '—';
  document.getElementById('detalleLibroEdicion').textContent = b.edicion || '—';
  document.getElementById('detalleLibroAnio').textContent = b.anio_publicacion || '—';
  document.getElementById('detalleLibroGenero').textContent = b.genero || '—';
  document.getElementById('detalleLibroCategoria').textContent = b.categoria || '—';
  document.getElementById('detalleLibroIsbn').textContent = b.isbn || 'Sin ISBN';
  document.getElementById('detalleLibroUbicacion').textContent = b.ubicacion_fisica || '—';
  document.getElementById('detalleLibroPrecio').textContent = b.precio_reposicion ? `$${b.precio_reposicion}` : '—';

  document.getElementById('detalleLibroEjemplares').innerHTML = (b.ejemplares || []).map(e =>
    `<span class="status-chip ${ejemplarChipClass(e.estado)}" style="cursor:${e.estado === 'prestado' ? 'default' : 'pointer'};" title="Ejemplar #${e.numero_ejemplar}: ${estadoEjemplarLabel(e.estado)}${e.estado === 'prestado' ? '' : ' (click para cambiar estado)'}" onclick="ciclarEstadoEjemplar(${e.id}, '${e.estado}')">#${e.numero_ejemplar} ${estadoEjemplarLabel(e.estado)}</span>`
  ).join('');

  openModal('modalLibroDetalle');
}

function editarLibroDesdeDetalle(){
  const b = books.find(x => x.id === detalleLibroId);
  if(!b) return;
  closeModal('modalLibroDetalle');
  openModal('modalBook');

  editingBookId = b.id;
  document.getElementById('modalBookTitle').textContent = 'Editar Libro';
  document.getElementById('modalBookSaveBtn').textContent = 'Guardar Cambios';
  document.getElementById('bookCopiesField').style.display = 'none';

  document.getElementById('f-book-title').value = b.titulo || '';
  document.getElementById('f-book-author').value = b.autor || '';
  document.getElementById('f-book-editorial').value = b.editorial || '';
  document.getElementById('f-book-edicion').value = b.edicion || '';
  document.getElementById('f-book-anio').value = b.anio_publicacion || '';
  document.getElementById('f-book-genre').value = b.genero || '';
  document.getElementById('f-book-categoria').value = b.categoria || '';
  document.getElementById('f-book-isbn').value = b.isbn || '';
  document.getElementById('f-book-ubicacion').value = b.ubicacion_fisica || '';
}

async function agregarEjemplaresDesdeDetalle(){
  const b = books.find(x => x.id === detalleLibroId);
  if(!b) return;
  const cantidad = parseInt(prompt('¿Cuántos ejemplares nuevos querés agregar?', '1'), 10);
  if(!cantidad || cantidad < 1) return;

  try {
    await apiFetch(`/libros/${b.id}/ejemplares`, {
      method: 'POST', body: JSON.stringify({cantidad}),
    });
    showToast('Ejemplares agregados', 'success');
    await cargarDatosIniciales();
    verDetalleLibro(b.id);
  } catch(err){}
}

function eliminarLibroDesdeDetalle(){
  const id = detalleLibroId;
  closeModal('modalLibroDetalle');
  deleteBook(id);
}

function applyMemberFilters(){
  memberFilterTipo = document.getElementById('memberFilterTipo').value;
  memberFilterVinculo = document.getElementById('memberFilterVinculo').value;
  memberFilterEstado = document.getElementById('memberFilterEstado').value;
  renderMembers();
}

function resetMemberFilters(){
  document.getElementById('memberFilterTipo').value = 'todos';
  document.getElementById('memberFilterVinculo').value = 'todos';
  document.getElementById('memberFilterEstado').value = 'todos';
  document.getElementById('memberSearch').value = '';
  applyMemberFilters();
}

function renderMembers(){
  const query = (document.getElementById('memberSearch')?.value || '').toLowerCase();
  let list = members.filter(m =>
    (m.nombre_completo || '').toLowerCase().includes(query) ||
    (m.dni || '').includes(query) ||
    (m.email || '').toLowerCase().includes(query)
  );
  if(memberFilterTipo !== 'todos') list = list.filter(m => (m.tipo || 'alumno') === memberFilterTipo);
  if(memberFilterVinculo === 'socio') list = list.filter(m => m.es_socio);
  else if(memberFilterVinculo === 'no-socio') list = list.filter(m => !m.es_socio);
  if(memberFilterEstado !== 'todos') list = list.filter(m => m.es_socio && m.estado_plan === memberFilterEstado);

  const container = document.getElementById('membersList');
  if(!container) return;
  if(!list.length){
    container.innerHTML = '<tr><td colspan="4" class="empty-state-cell">No se encontraron socios registrados.</td></tr>';
    return;
  }

  container.innerHTML = list.map(m => {
    const tipo = m.tipo || 'alumno';
    return `
    <tr onclick="verDetalleSocio(${m.id})">
      <td><strong>${m.nombre_completo}</strong></td>
      <td>${tipoLabel(tipo)}</td>
      <td><span class="badge ${m.es_socio ? 'badge-socio' : 'badge-no-socio'}">${esSocioLabel(m)}</span></td>
      <td>${m.es_socio ? `<span class="status-chip ${estadoPlanEdgeClass(m.estado_plan)}">${estadoPlanLabel(m.estado_plan)}</span>` : '—'}</td>
    </tr>`;
  }).join('');
}

// ---------- Modal de detalle de socio ----------
let detalleSocioId = null;

function verDetalleSocio(id){
  const m = members.find(x => x.id === id);
  if(!m) return;
  detalleSocioId = id;
  const tipo = m.tipo || 'alumno';

  document.getElementById('detalleSocioNombre').textContent = m.nombre_completo;
  document.getElementById('detalleSocioDni').textContent = m.dni;
  document.getElementById('detalleSocioTelefono').textContent = m.telefono || 'S/N';
  document.getElementById('detalleSocioEmail').textContent = m.email || 'Sin correo';
  document.getElementById('detalleSocioTipo').textContent = tipoLabel(tipo);
  document.getElementById('detalleSocioVinculo').textContent = esSocioLabel(m);

  document.getElementById('detalleSocioExtraLabel').textContent = tipo === 'maestro' ? 'Materia' : 'Curso';
  document.getElementById('detalleSocioExtra').textContent = tipo === 'maestro'
    ? (m.materia || '—')
    : `${m.curso || '—'}${m.division ? ' "' + m.division + '"' : ''}`;

  const estadoRow = document.getElementById('detalleSocioEstadoRow');
  const toggleBtn = document.getElementById('detalleSocioToggleBtn');
  if(m.es_socio){
    estadoRow.style.display = 'flex';
    document.getElementById('detalleSocioEstado').textContent = estadoPlanLabel(m.estado_plan);
    toggleBtn.style.display = '';
    toggleBtn.textContent = m.estado_plan === 'bloqueado' ? 'Desbloquear' : 'Bloquear';
  } else {
    estadoRow.style.display = 'none';
    toggleBtn.style.display = 'none';
  }

  openModal('modalSocioDetalle');
}

function editarSocioDesdeDetalle(){
  const m = members.find(x => x.id === detalleSocioId);
  if(!m) return;
  closeModal('modalSocioDetalle');
  openModal('modalMember');

  editingMemberId = m.id;
  document.getElementById('modalMemberTitle').textContent = 'Editar Socio';
  document.getElementById('modalMemberSaveBtn').textContent = 'Guardar Cambios';

  document.getElementById('f-member-name').value = m.nombre_completo || '';
  document.getElementById('f-member-dni').value = m.dni || '';
  document.getElementById('f-member-dni').disabled = true;
  document.getElementById('f-member-phone').value = m.telefono || '';
  document.getElementById('f-member-email').value = m.email || '';
  document.getElementById('f-member-course').value = m.curso || '';
  document.getElementById('f-member-division').value = m.division || '';
  document.getElementById('f-member-subject').value = m.materia || '';

  setMemberType(m.tipo || 'alumno');
  setEsSocio(!!m.es_socio);
}

function toggleBloqueoDesdeDetalle(){
  const m = members.find(x => x.id === detalleSocioId);
  if(!m) return;
  closeModal('modalSocioDetalle');
  toggleBloqueoSocio(m.id, m.estado_plan);
}

function eliminarSocioDesdeDetalle(){
  const id = detalleSocioId;
  closeModal('modalSocioDetalle');
  deleteMember(id);
}

function renderSanciones(){
  const container = document.getElementById('sancionesList');
  if(!container) return;

  let list = sanciones.slice();
  if(activeSancionFilter !== 'todos') list = list.filter(s => s.estado_pago === activeSancionFilter);

  if(!list.length){
    container.innerHTML = '<div class="empty-state glass">No hay sanciones registradas.</div>';
    return;
  }

  container.innerHTML = list.map(s => `
    <div class="ticket glass ${s.estado_pago === 'pagado' ? 'is-returned' : ''}">
      <div class="edge ${s.estado_pago === 'pagado' ? 'returned' : 'overdue'}"></div>
      <div class="ticket-main">
        <div class="title">${s.socio_nombre || 'Socio eliminado'}</div>
        <div class="sub">${s.tipo === 'atraso' ? `Atraso de ${s.dias_atraso} día(s) · Préstamo ${s.prestamo_codigo || ''}` : `Reposición por pérdida · Préstamo ${s.prestamo_codigo || ''}`}</div>
        <span class="badge">$${Number(s.monto_total).toFixed(2)}</span>
      </div>
      <div class="ticket-stub">
        <span class="status-chip ${s.estado_pago === 'pagado' ? 'returned' : 'overdue'}">${s.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
        ${s.estado_pago === 'pendiente' ? `<button class="action-link" onclick="pagarSancion(${s.id})">Marcar pagado</button>` : ''}
      </div>
    </div>
  `).join('');
}

function renderUsuarios(){
  const container = document.getElementById('usuariosList');
  if(!container) return;

  const query = (document.getElementById('usuarioSearch')?.value || '').toLowerCase();
  const list = usuarios.filter(u =>
    (u.nombre_completo || '').toLowerCase().includes(query) ||
    (u.username || '').toLowerCase().includes(query)
  );

  if(!list.length){
    container.innerHTML = '<div class="empty-state glass">No hay usuarios registrados.</div>';
    return;
  }

  container.innerHTML = list.map(u => `
    <div class="ticket glass ${u.estado === 'inactivo' ? 'is-returned' : ''}">
      <div class="edge ${u.estado === 'activo' ? 'on-time' : 'returned'}"></div>
      <div class="ticket-main">
        <div class="title">${u.nombre_completo}</div>
        <div class="sub">Usuario: ${u.username} · Turno: ${u.turno}</div>
        <span class="badge">${rolLabel(u.rol)}</span>
      </div>
      <div class="ticket-stub">
        <span class="status-chip ${u.estado === 'activo' ? 'on-time' : 'returned'}">${u.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>
        <button class="action-link" onclick="toggleEstadoUsuario(${u.id}, '${u.estado}')">${u.estado === 'activo' ? 'Desactivar' : 'Activar'}</button>
      </div>
    </div>
  `).join('');
}

function renderAll(){
  renderHome();
  renderLoans();
  renderBooks();
  renderMembers();
  renderSanciones();
  renderUsuarios();
}

checkSession();