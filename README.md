# TALLER OS Â· Demo pÃºblica

DemostraciÃ³n ficticia de recepciÃ³n digital. No ingresar datos personales reales.
Sin conexiÃ³n a Supabase, claves administrativas, backend ni fotografÃ­as reales incluidas.
La captura pÃºblica usa memoria; las imÃ¡genes elegidas se procesan en el navegador y
la transferencia entre pantallas se elimina al abrir la revisiÃ³n. Si se abandona antes,
el dato temporal permanece hasta cerrar esa pestaÃ±a. No es almacenamiento de producciÃ³n.
Identidad y aceptaciÃ³n son simuladas; la constancia demo no acredita un contrato.

## Publicar

Crear un repositorio vacÃ­o en la cuenta petra3destudio-ship-it y subir Ãºnicamente el
CONTENIDO de esta carpeta, incluyendo sus archivos ocultos. No subir el workspace completo.
En Settings > Pages seleccionar Deploy from a branch, main y / (root).
index.html es la portada; recepcion.html?vista=cliente abre la revisiÃ³n ficticia.
GitHub Actions verifica archivos permitidos y configuraciÃ³n despuÃ©s de cada push/PR;
no sustituye la revisiÃ³n previa ni bloquea por sÃ­ mismo la subida o Pages.

## Comprobar antes de subir

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Test-PublicDemo.ps1 -RootPath .

No agregar fotos, datos exportados, credenciales ni configuraciones locales.
El cÃ³digo y la demo son pÃºblicos si el repositorio se publica con visibilidad pÃºblica.