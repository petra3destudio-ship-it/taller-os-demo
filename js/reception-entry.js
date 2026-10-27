(() => {
  if (window.TALLER_CONFIG?.publicDemo) {
    const notice=document.createElement('p');notice.className='notice';
    notice.textContent='DEMO PÚBLICA · Usa únicamente información ficticia. Sin conexión a Supabase. Las recepciones no se guardan de forma permanente; las fotos se usan solo en tu navegador.';
    document.querySelector('main').prepend(notice);
  }
  const section=document.createElement('div');section.className='grid';
  section.innerHTML='<div class="field"><label for="receptionBudget">Presupuesto estimado (MXN)</label><input id="receptionBudget" type="number" min="0" step="0.01" placeholder="0.00"></div><div class="field"><label for="receptionDelivery">Entrega estimada (Ciudad de México)</label><input id="receptionDelivery" type="datetime-local"></div><div class="field span2"><label for="receptionInventory">Inventario recibido</label><textarea id="receptionInventory" placeholder="Llaves, documentos presentados, herramienta y pertenencias"></textarea></div>';
  document.querySelector('#capturePanel .actions').before(section);
  const originalCurrent=window.current;
  window.current=()=>({...originalCurrent(),budget:document.getElementById('receptionBudget').value,delivery:document.getElementById('receptionDelivery').value,inventory:document.getElementById('receptionInventory').value});
  document.querySelector('[data-tab="pdf"]').textContent='Ficha PDF · herramienta anterior';
  const saveButton=document.querySelector('#capturePanel button[onclick="save()"]');
  saveButton.textContent='Guardar demo y revisar recepción digital';
  window.openDigitalReception=async record=>{
    saveButton.disabled=true;
    document.getElementById('saveMsg').textContent='Preparando revisión local y fotografías…';
    try {
      const photos=await Promise.all(photoUrls.map(async (url,index)=>{
        const blob=await (await fetch(url)).blob();const bitmap=await createImageBitmap(blob);
        const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');
        canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
        canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
        return {src:canvas.toDataURL('image/jpeg',0.75),label:`Fotografía de recepción ${index+1}`};
      }));
      sessionStorage.setItem('talleros.reviewDraft',JSON.stringify({...record,photos}));
      location.assign('recepcion.html#local');
    }catch {
      document.getElementById('saveMsg').textContent='La recepción quedó guardada en la demo, pero no se pudo preparar la revisión local. Mantén esta pestaña abierta para conservar las fotos y reduce su cantidad o tamaño antes de reintentar.';
    }finally{saveButton.disabled=false;}
  };
})();
