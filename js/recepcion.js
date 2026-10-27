(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fixture = {
    folio:'REC-DEMO-2048',name:'Andrea Martínez · ejemplo',vehicle:'Mazda 3 · Sedán · 2024',plates:'DEMO-2048',
    odometer:'45,200 km',fuel:'1/2 tanque',service:'Servicio preventivo: cambio de aceite y filtros, revisión de frenos y diagnóstico general.',
    budget:2850,delivery:'2026-10-30T18:00',inventory:'1 llave con control\nTarjeta de circulación presentada (no se conserva copia)\nLlanta de refacción y herramienta',
    notes:'Interior con desgaste normal de uso. No se reciben objetos de valor. Se documentan dos daños previos.',
    damages:[{x:170,y:78,title:'Rayón · costado izquierdo',description:'Rayón superficial de aproximadamente 5 cm, documentado antes del servicio.',color:'#e50914'},
      {x:470,y:205,title:'Golpe · esquina posterior',description:'Pequeño golpe en defensa posterior. Sin reparación incluida en este presupuesto.',color:'#0057b8'}],
  };
  let draft=structuredClone(fixture), snapshot=null,version=0,state='draft',verified=false,acceptedAt=null,correction='';
  let photos=[], photoGeneration=0,localCroquis=null;
  const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const illustration = label => 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350"><rect width="600" height="350" fill="#edf3fc"/><path d="M85 225L110 164L192 150L240 99H375L433 152L500 170L523 222V252H85Z" fill="white" stroke="#0057b8" stroke-width="5"/><path d="M217 150L253 112H365L408 151Z" fill="#c5dbf7"/><circle cx="170" cy="248" r="34" fill="#101820"/><circle cx="440" cy="248" r="34" fill="#101820"/><text x="35" y="47" font-family="sans-serif" font-size="22" fill="#101820">${label}</text><text x="35" y="315" font-family="sans-serif" font-size="16" fill="#526174">ILUSTRACIÓN FICTICIA · NO ES EVIDENCIA REAL</text></svg>`);
  const demoPhotos=['Frente','Costado izquierdo','Defensa posterior'].map(label=>({label,src:illustration(label)}));
  const form=$('draftForm');
  function fillDraft() {
    ['service','budget','delivery','inventory','notes'].forEach(name=>form.elements[name].value=draft[name]);
  }
  // Solo datos locales; no se publican ni se consideran un expediente guardado.
  if(location.hash==='#local') {
    try {
      const local=JSON.parse(sessionStorage.getItem('talleros.reviewDraft')||'null');
      sessionStorage.removeItem('talleros.reviewDraft');
      if(local) {
        draft={...draft,folio:String(local.id||'REC-LOCAL'),name:String(local.name||''),vehicle:[local.brand,local.model,local.year].filter(Boolean).join(' · '),plates:String(local.plates||'Pendientes'),
          odometer:`${local.odo||'N/D'} km`,fuel:String(local.fuel||''),service:String(local.service||draft.service),inventory:String(local.inventory||'Inventario pendiente de completar'),notes:String(local.inside||''),budget:Number(local.budget)||0,delivery:local.delivery||draft.delivery,
          damages:Array.isArray(local.marks)?local.marks.slice(0,100).map((m,i)=>({x:Math.max(100,Math.min(500,Number(m.x)||100)),y:Math.max(60,Math.min(240,(Number(m.y)||0)*300/430)),title:`Hallazgo ${i+1}: ${String(m.type)}`,description:String(local.damage||'Sin descripción. Revisar antes de confirmar.'),color:'#e50914'})):[]};
        // Preservar las coordenadas originales y su esquema de vistas múltiples.
        if(Array.isArray(local.marks)&&local.marks.length) {
          localCroquis=local.marks.slice(0,100).map((m,i)=>({x:Math.max(0,Math.min(600,Number(m.x)||0)),y:Math.max(0,Math.min(430,Number(m.y)||0)),title:`Hallazgo ${i+1}: ${String(m.type)}`,description:String(local.damage||'Sin descripción adicional.'),color:'#e50914'}));
          draft.damages=localCroquis;
        }
        if(Array.isArray(local.photos))photos=local.photos.slice(0,12).filter(photo=>typeof photo.src==='string'&&photo.src.startsWith('data:image/jpeg;base64,')).map((photo,i)=>({src:photo.src,label:`Fotografía de recepción ${i+1}`}));
        $('globalStatus').textContent='Vista local: no es un enlace privado y no se ha guardado en Supabase. Los datos se conservarán solo durante esta revisión.';
      }
    }catch { $('globalStatus').textContent='No fue posible recuperar el borrador local. Se muestra la recepción ficticia.'; }
  }
  fillDraft();
  function mode(client) {
    $('staffPanel').hidden=client;$('clientPanel').hidden=!client;
    $('staffMode').setAttribute('aria-pressed',String(!client));$('clientMode').setAttribute('aria-pressed',String(client));
    if(client&&!snapshot) prepare();
    if(client) $('clientPanel').querySelector('h1').focus({preventScroll:true});
  }
  $('clientPanel').querySelector('h1').tabIndex=-1;
  function updateButton() {
    const checked=[...$('consentFields').querySelectorAll('input')].every(input=>input.checked);
    $('acceptButton').disabled=state!=='review'||!verified||!checked;
  }
  function prepare() {
    if(state==='accepted') return false;
    if(!form.reportValidity()) return false;
    const fields=new FormData(form);
    ['service','inventory','notes','delivery'].forEach(name=>draft[name]=String(fields.get(name)).trim());
    if(!draft.service||!draft.inventory||!draft.delivery) return false;
    draft.budget=Number(fields.get('budget'));
    snapshot=structuredClone({...draft,photos:photos.length?photos:location.hash==='#local'?[]:demoPhotos,contractVersion:'demo-v1',privacyVersion:'demo-v1'});
    version++;state='review';verified=false;
    $('acceptForm').reset();$('correctionForm').reset();$('consentFields').disabled=false;
    $('verificationStatus').textContent='Identidad sin verificar.';$('acceptStatus').textContent='';$('correctionStatus').textContent='';
    $('certificateSection').hidden=true;$('correctionSummary').hidden=true;
    render();return true;
  }
  function render() {
    $('folioLabel').textContent=snapshot.folio;$('versionLabel').textContent=`Versión ${version} · ${snapshot.contractVersion}`;
    $('stateLabel').textContent=state==='accepted'?'Aceptación simulada · versión bloqueada':state==='correction'?'Corrección solicitada · aceptación detenida':'Pendiente de revisión · modo demo';
    const fields=[['Cliente',snapshot.name],['Vehículo',snapshot.vehicle],['Placas',snapshot.plates],['Kilometraje',snapshot.odometer],['Combustible',snapshot.fuel]];
    $('vehicleData').innerHTML=fields.map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('');
    $('serviceText').textContent=snapshot.service;$('budgetText').textContent=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(snapshot.budget);
    // El datetime-local representa hora civil de Ciudad de México; evitar reinterpretarla como hora del dispositivo.
    $('deliveryText').textContent=snapshot.delivery.replace('T',' · ')+' · Ciudad de México';
    $('inventoryText').textContent=snapshot.inventory;$('notesText').textContent=snapshot.notes||'Sin observaciones adicionales.';
    $('photoGallery').innerHTML=snapshot.photos.map((photo,i)=>`<button type="button" data-photo="${i}" aria-label="Ampliar ${escape(photo.label)}"><img src="${escape(photo.src)}" alt="${escape(photo.label)}" loading="lazy"><span>${escape(photo.label)}</span></button>`).join('')||'<p>No hay fotografías en esta revisión local.</p>';
    if(localCroquis) {
      $('reviewCar').setAttribute('viewBox','0 0 600 430');
      $('reviewCar').setAttribute('aria-label','Croquis original de recepción: lateral, superior, frontal y trasera');
      $('reviewCar').querySelector('g').innerHTML='<text x="40" y="27" stroke="none" fill="#526174" font-size="15">LATERAL</text><path d="M62 155L78 118L148 107L185 72H360L415 112L495 121L530 154L529 187H60Z"/><path d="M157 107L200 81H351L395 113Z"/><circle cx="149" cy="185" r="34"/><circle cx="446" cy="185" r="34"/><text x="40" y="249" stroke="none" fill="#526174" font-size="15">SUPERIOR</text><rect x="45" y="260" width="230" height="137" rx="56"/><rect x="105" y="270" width="95" height="118" rx="19"/><text x="345" y="249" stroke="none" fill="#526174" font-size="15">FRONTAL / TRASERA</text><rect x="341" y="270" width="214" height="59" rx="20"/><rect x="341" y="345" width="214" height="54" rx="20"/>';
    }
    $('reviewMarks').innerHTML=snapshot.damages.map((damage,i)=>`<circle cx="${damage.x}" cy="${damage.y}" r="13" fill="${damage.color}" stroke="white" stroke-width="4"/><text x="${damage.x}" y="${damage.y+4}" text-anchor="middle" fill="white" font-size="12" aria-hidden="true">${i+1}</text>`).join('');
    $('damageButtons').innerHTML=snapshot.damages.map((damage,i)=>`<button type="button" data-damage="${i}" aria-pressed="false">${i+1}. ${escape(damage.title)}</button>`).join('')||'<p>No hay marcas registradas en este esquema.</p>';
    $('damageInfo').textContent='Selecciona un daño para ver su descripción.';
    updateButton();
  }
  form.onsubmit=event=>{event.preventDefault();if(prepare())mode(true);};
  $('clientMode').onclick=()=>{if(snapshot)mode(true);else if(prepare())mode(true);};
  $('staffMode').onclick=()=>mode(false);
  $('photoInput').onchange=async event=> {
    const run=++photoGeneration;
    const files=[...event.target.files];
    if(files.length>8||files.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)) {
      $('photoStatus').textContent='Selecciona hasta 8 imágenes JPEG, PNG o WebP de máximo 5 MB cada una. Se conserva la selección anterior.';event.target.value='';return;
    }
    $('prepareButton').disabled=true;$('clientMode').disabled=true;$('photoStatus').textContent='Preparando fotografías…';
    try {
      const next=await Promise.all(files.map(async (file,i)=> {
        const bitmap=await createImageBitmap(file);
        const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
        const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
        canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
        return {label:`Foto local ${i+1}`,src:canvas.toDataURL('image/jpeg',0.8)};
      }));
      if(run!==photoGeneration) return;
      photos=next;$('photoStatus').textContent=`${photos.length} fotografía(s) listas para una nueva revisión. No se subieron al servidor.`;
    }catch {if(run===photoGeneration)$('photoStatus').textContent='No se pudo procesar una imagen. Se conservan las fotografías anteriores.';}
    finally {if(run===photoGeneration){$('prepareButton').disabled=false;$('clientMode').disabled=false;}}
  };
  $('photoGallery').onclick=event=> {
    const button=event.target.closest('[data-photo]');if(!button)return;
    const photo=snapshot.photos[Number(button.dataset.photo)];$('largePhoto').src=photo.src;$('largePhoto').alt=photo.label;$('largeCaption').textContent=photo.label;$('photoDialog').showModal();
  };
  $('closePhoto').onclick=()=>$('photoDialog').close();
  function selectDamage(index) {
    const damage=snapshot.damages[index];if(!damage)return;
    $('damageInfo').textContent=`${damage.title}: ${damage.description}`;
    document.querySelectorAll('[data-damage]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.damage)===index)));
  }
  $('damageButtons').onclick=event=>{const button=event.target.closest('[data-damage]');if(button)selectDamage(Number(button.dataset.damage));};
  $('reviewCar').onclick=event=> {
    const point=$('reviewCar').createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const matrix=$('reviewCar').getScreenCTM();if(!matrix)return;
    const at=point.matrixTransform(matrix.inverse());const index=snapshot.damages.findIndex(d=>Math.hypot(d.x-at.x,d.y-at.y)<24);
    if(index>=0)selectDamage(index);
  };
  $('correctionForm').onsubmit=event=> {
    event.preventDefault();if(state!=='review')return;
    correction=$('correctionText').value.trim();if(correction.length<10)return;
    state='correction';verified=false;$('consentFields').disabled=true;
    $('correctionStatus').textContent='Solicitud registrada solo en esta demo. El recepcionista debe preparar otra versión.';
    $('correctionSummary').textContent=`Corrección solicitada sobre v${version}: ${correction}`;$('correctionSummary').hidden=false;
    $('verificationStatus').textContent='Se requiere una nueva versión antes de continuar.';$('verifyDemo').disabled=true;
    render();
  };
  $('verifyDemo').onclick=()=> {
    if(state!=='review')return;
    verified=true;$('verificationStatus').textContent='Verificación SIMULADA completada. No acredita identidad real.';updateButton();
  };
  $('acceptForm').onchange=updateButton;
  $('acceptForm').onsubmit=event=> {
    event.preventDefault();updateButton();if($('acceptButton').disabled)return;
    state='accepted';acceptedAt=new Date().toISOString();
    $('consentFields').disabled=true;$('verifyDemo').disabled=true;
    [...form.elements,...$('correctionForm').elements].forEach(input=>input.disabled=true);
    $('certificateText').textContent=`${snapshot.folio} · versión ${version} · ${new Date(acceptedAt).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})} (Ciudad de México). Mecanismo: simulación local. Las tres confirmaciones se marcaron antes del cierre de esta versión.`;
    $('certificateSection').hidden=false;$('acceptStatus').textContent='Versión cerrada en esta pestaña. La constancia demo está disponible abajo.';
    render();$('certificateSection').scrollIntoView({behavior:'smooth',block:'start'});
  };
  $('printCertificate').onclick=()=> {
    if(state!=='accepted')return;
    document.querySelectorAll('details').forEach(details=>details.open=true);window.print();
  };
  function exampleUrl() {
    if(!['http:','https:'].includes(location.protocol)) {
      $('globalStatus').textContent='Para compartir el ejemplo, publícalo primero en un hosting HTTPS. Un archivo local no es un enlace privado.';return null;
    }
    return new URL('recepcion.html?vista=cliente',location.href).href;
  }
  $('shareDemo').onclick=()=> {const url=exampleUrl();if(url)window.open(`https://wa.me/?text=${encodeURIComponent('Ejemplo ficticio de Recepción Digital Interactiva de TALLER OS (sin datos de clientes): '+url)}`,'_blank','noopener,noreferrer');};
  $('emailDemo').onclick=()=>{const url=exampleUrl();if(url)location.href=`mailto:?subject=${encodeURIComponent('Ejemplo ficticio · TALLER OS')}&body=${encodeURIComponent('Demostración sin datos reales: '+url)}`;};
  // Cada versión nueva exige volver a revisar los tres consentimientos y la simulación.
  form.addEventListener('submit',()=>{if(state==='review')$('verifyDemo').disabled=false;});
  if(new URLSearchParams(location.search).get('vista')==='cliente'&&prepare())mode(true);
})();
