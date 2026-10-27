/* Dashboard remoto sin SDK ni secretos administrativos. */
(() => {
  const cfg = window.TALLER_CONFIG || {};
  const configured = !cfg.publicDemo && Boolean(cfg.supabaseUrl && cfg.anonKey);
  let token = '', page = 1, total = 0, generation = 0, timer;
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const panel = el('dashboardPanel');
  panel.querySelector('.sub').textContent = configured ? 'Supabase · inicia sesión para consultar datos reales. La captura continúa en modo demo local.' : 'Datos ficticios y recepciones locales · Supabase sin configurar';
  const controls = document.createElement('div');
  controls.innerHTML = `<div id="remoteLogin" class="${configured ? '' : 'hidden'}"><form id="loginForm" class="grid"><div class="field"><label for="loginEmail">Correo de acceso</label><input id="loginEmail" type="email" autocomplete="username" required></div><div class="field"><label for="loginPassword">Contraseña</label><input id="loginPassword" type="password" autocomplete="current-password" required></div><button class="btn" type="submit">Iniciar sesión</button></form></div><button id="logout" class="btn light hidden">Cerrar sesión</button><div class="field"><label for="recordSearch">Buscar por folio, cliente, empresa o placas</label><input id="recordSearch" type="search" maxlength="120" placeholder="Buscar registros"></div><p id="dashboardStatus" role="status" aria-live="polite"></p><button id="retryDashboard" class="btn light hidden">Reintentar consulta</button>`;
  panel.insertBefore(controls, panel.querySelector('h2'));
  el('recent').insertAdjacentHTML('afterend', '<div class="actions"><button id="previousPage" class="btn light">Anterior</button><span id="pageLabel"></span><button id="nextPage" class="btn light">Siguiente</button></div><div id="usagePanel" class="hidden panel"></div><div id="recordDetail" class="hidden panel" aria-live="polite"></div>');

  async function api(path, body, method = 'POST') {
    const response = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}${path}`, {
      method, headers: { apikey: cfg.anonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(response.status === 401 ? 'Sesión vencida. Inicia sesión nuevamente.' : `Error de conexión o permisos (${response.status}).`);
    return response.status === 204 ? null : response.json();
  }
  function pagination() {
    el('pageLabel').textContent = `Página ${page} de ${Math.max(1, Math.ceil(total / 20))} · ${total} registros`;
    el('previousPage').disabled = page <= 1;
    el('nextPage').disabled = page * 20 >= total;
  }
  function demo() {
    const records = [...saved, ...fake].map((x, i) => ({ ...x, id: x.id || `DEMO-${i+1}`, receivedAt: x.receivedAt || (x.id?.startsWith('REC-') ? Number(x.id.slice(4)) : -i) }));
    const query = el('recordSearch').value.trim().toLocaleLowerCase('es');
    const filtered = records.filter(x => [x.id,x.name,x.company,x.plates].some(v => String(v || '').toLocaleLowerCase('es').includes(query))).sort((a,b) => b.receivedAt-a.receivedAt);
    total = filtered.length;
    page = Math.min(page, Math.max(1, Math.ceil(total / 20)));
    el('recent').innerHTML = filtered.slice((page-1)*20,page*20).map(x => `<div class="record"><div><b>${escape(x.name)}</b><small>${escape(x.id)} · ${escape(x.brand)} ${escape(x.model)} · ${escape(x.plates)}</small></div><span class="pill">${escape(x.qty || 1)} unidad(es)</span></div>`).join('') || '<p>Sin coincidencias.</p>';
    pagination();
  }
  async function load() {
    const run = ++generation;
    if (!configured) { demo(); return; }
    if (!token) { el('recent').textContent = 'Inicia sesión para consultar los registros.'; total=0; pagination(); return; }
    el('dashboardStatus').textContent = 'Cargando registros…';
    el('retryDashboard').classList.add('hidden');
    el('recent').setAttribute('aria-busy','true');
    el('previousPage').disabled = el('nextPage').disabled = true;
    try {
      const [result, stats] = await Promise.all([
        api('/rest/v1/rpc/dashboard_page',{page_number:page,search_text:el('recordSearch').value.trim()}),
        api('/rest/v1/rpc/dashboard_stats',{}),
      ]);
      if (run !== generation) return;
      total = result.total;
      if (page > 1 && (page-1)*20 >= total) { page=1; return load(); }
      el('recent').innerHTML = result.rows.map(x => `<div class="record"><div><b>${escape(x.full_name)}</b><small>${escape(x.folio)} · ${escape(x.company)} · ${escape(x.brand)} ${escape(x.model)} · ${escape(x.plates)} · ${escape(new Date(x.created_at).toLocaleString('es-MX'))}</small></div><button class="btn light" data-detail="${escape(x.id)}">Abrir expediente</button></div>`).join('') || '<p>Sin coincidencias.</p>';
      el('total').textContent=stats.total; el('fleets').textContent=stats.fleets; el('active').textContent=stats.active;
      el('photosMetric').textContent=stats.completed;
      el('photosMetric').nextElementSibling.textContent='Servicios finalizados';
      el('dashboardStatus').textContent=`Datos actualizados · ${stats.delivered} entregados`;
      pagination();
      await loadUsage();
    } catch (error) {
      if (run !== generation) return;
      el('dashboardStatus').textContent=error.message;
      el('recent').textContent='No fue posible obtener los registros.';
      el('retryDashboard').classList.remove('hidden');
    } finally { if(run===generation) el('recent').setAttribute('aria-busy','false'); }
  }
  async function detail(id) {
    const target=el('recordDetail'); target.classList.remove('hidden'); target.textContent='Cargando expediente y fotografías…';
    try {
      const rows=await api(`/rest/v1/receptions?id=eq.${encodeURIComponent(id)}&select=id,folio,status,service_requested,interior_notes,created_at,evidence_files(storage_path,media_type,captured_at)`,undefined,'GET');
      if(!rows.length) throw new Error('Expediente no disponible.');
      const row=rows[0];
      const images=await Promise.all(row.evidence_files.filter(x=>x.media_type.startsWith('image/')).map(async photo=> {
        const signed=await api(`/storage/v1/object/sign/vehicle-photos/${photo.storage_path.split('/').map(encodeURIComponent).join('/')}`,{expiresIn:120});
        const url = signed.signedURL || signed.signedUrl;
        if (!url?.startsWith('/object/sign/')) throw new Error('URL de fotografía inválida.');
        return `<img src="${escape(cfg.supabaseUrl.replace(/\/$/,'')+'/storage/v1'+url)}" alt="Evidencia del vehículo" loading="lazy">`;
      }));
      if(!token) return;
      target.innerHTML=`<h2>${escape(row.folio)}</h2><p>${escape(row.status)} · ${escape(row.service_requested)}</p><p>${escape(row.interior_notes)}</p><div class="photoPreview">${images.join('')}</div><p class="hint">Enlaces privados válidos durante dos minutos. Vuelve a abrir para renovarlos.</p>`;
    } catch(error) { target.textContent=error.message; }
  }
  const mb = bytes => `${(Number(bytes)/1000000).toFixed(1)} MB`;
  async function loadUsage() {
    const target=el('usagePanel');
    const sessionToken=token;
    try {
      const configs=await api('/rest/v1/usage_config?select=storage_quota_bytes,database_quota_bytes,alert_email,billed_storage_bytes,billed_reported_at',undefined,'GET');
      if(token!==sessionToken) return;
      if(!configs.length) {target.classList.add('hidden');return;}
      const states=await api('/rest/v1/usage_state?select=resource,used_bytes,quota_bytes,level,checked_at,object_count,missing_metadata',undefined,'GET');
      if(token!==sessionToken) return;
      const config=configs[0]; target.classList.remove('hidden');
      target.innerHTML=`<h2>Capacidad del proyecto · solo administración</h2><p class="hint">Storage y PostgreSQL tienen cuotas independientes. Incluye todos los talleres del proyecto.</p>${states.map(x=>`<div class="notice" ${x.level>=80?'role="alert"':''}><b>${x.resource==='storage'?'Fotografías actuales (metadatos del bucket)':'PostgreSQL actual (toda la base)'}</b><p>${mb(x.used_bytes)} / ${mb(x.quota_bytes)} · ${(100*x.used_bytes/x.quota_bytes).toFixed(1)}%</p><progress max="100" value="${Math.min(100,100*x.used_bytes/x.quota_bytes)}"></progress><p>${x.level ? `Alerta de capacidad: umbral ${x.level}%.` : 'Uso normal.'} ${x.level>=80?'Amplía la capacidad o revisa el consumo.':''}</p><small>Comprobado: ${escape(new Date(x.checked_at).toLocaleString('es-MX'))}${Date.now()-new Date(x.checked_at).getTime()>36*3600000?' · MEDICIÓN DESACTUALIZADA: revisar tarea programada':''}${x.resource==='storage'?` · ${x.object_count} objetos · ${x.missing_metadata} sin tamaño válido (medición parcial si es mayor a cero)`:''}</small></div>`).join('') || '<p>Pendiente de la primera comprobación programada.</p>'}<p>Storage facturable reportado: ${config.billed_storage_bytes===null?'No disponible':mb(config.billed_storage_bytes)} ${config.billed_reported_at?'· '+escape(new Date(config.billed_reported_at).toLocaleString('es-MX')):''}. Registro manual del reporte de Supabase; no se infiere de las fotografías.</p><form id="quotaForm" class="grid"><div class="field"><label>Cuota Storage (MB decimales)</label><input name="storage" type="number" min="1" step="any" required value="${config.storage_quota_bytes/1000000}"></div><div class="field"><label>Cuota PostgreSQL (MB decimales)</label><input name="database" type="number" min="1" step="any" required value="${config.database_quota_bytes/1000000}"></div><div class="field"><label>Correo de alertas</label><input name="email" type="email" required value="${escape(config.alert_email)}"></div><div class="field"><label>Storage facturable reportado (MB, opcional)</label><input name="billed" type="number" min="0" step="any" value="${config.billed_storage_bytes===null?'':config.billed_storage_bytes/1000000}"></div><button class="btn">Guardar configuración</button><p id="quotaStatus" role="status"></p></form>`;
      el('quotaForm').onsubmit=async event=> {
        event.preventDefault();const form=new FormData(event.target);
        try {
          await api('/rest/v1/usage_config?id=eq.true',{
            storage_quota_bytes:Math.round(Number(form.get('storage'))*1000000),database_quota_bytes:Math.round(Number(form.get('database'))*1000000),alert_email:form.get('email'),
            ...(form.get('billed')!==''?{billed_storage_bytes:Math.round(Number(form.get('billed'))*1000000),billed_reported_at:new Date().toISOString()}:{}),
          },'PATCH');
          el('quotaStatus').textContent='Guardado. Los umbrales se recalculan en la siguiente comprobación diaria.';
        }catch(error){el('quotaStatus').textContent=error.message;}
      };
    } catch(error) {if(token!==sessionToken) return;target.classList.remove('hidden');target.textContent=`Monitor no disponible: ${error.message}`;}
  }
  el('loginForm').onsubmit=async event=> {
    event.preventDefault(); el('dashboardStatus').textContent='Iniciando sesión…';
    try {
      const session=await api('/auth/v1/token?grant_type=password',{email:el('loginEmail').value,password:el('loginPassword').value});
      token=session.access_token;el('loginPassword').value='';el('remoteLogin').classList.add('hidden');el('logout').classList.remove('hidden');page=1;await load();
    }catch(error){el('dashboardStatus').textContent=error.message;}
  };
  el('logout').onclick=async()=> {
    const logoutRequest=api('/auth/v1/logout',{}).catch(()=>{});
    token='';generation++;el('usagePanel').replaceChildren();el('usagePanel').classList.add('hidden');el('recordDetail').replaceChildren();el('recordDetail').classList.add('hidden');
    ['total','fleets','active','photosMetric'].forEach(id=>el(id).textContent='—');
    el('logout').classList.add('hidden');el('remoteLogin').classList.remove('hidden');el('dashboardStatus').textContent='Sesión cerrada.';load();await logoutRequest;
  };
  el('recordSearch').oninput=()=>{clearTimeout(timer);generation++;timer=setTimeout(()=>{page=1;load();},300);};
  el('previousPage').onclick=()=>{page--;load();};el('nextPage').onclick=()=>{page++;load();};
  el('retryDashboard').onclick=load;
  el('recent').onclick=event=>{const button=event.target.closest('[data-detail]');if(button) detail(button.dataset.detail);};
  const original=window.renderDashboard;
  window.renderDashboard=()=>{if(!configured) original();load();};
  if(configured) ['total','fleets','active','photosMetric'].forEach(id=>el(id).textContent='—');
  load();
})();
