[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RootPath)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RootPath).Path
$manifestPath = Join-Path $root '.publicdemo-manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Falta el manifiesto de archivos públicos.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$allowed = @($manifest.files)
if ($allowed.Count -eq 0) { throw 'La lista de archivos públicos está vacía.' }
$failures = [Collections.Generic.List[string]]::new()
$rootPrefix = $root.TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
$files = @(Get-ChildItem -LiteralPath $root -File -Force -Recurse | Where-Object {
  $_.FullName.Substring($rootPrefix.Length).Replace('\','/') -notmatch '^\.git/'
})
# No se imprimen coincidencias ni valores: solo rutas y tipos de hallazgo.
$rules = [ordered]@{
  'Clave privada' = '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
  'Token Supabase secreto' = 'sb_secret_[A-Za-z0-9_-]{16,}'
  'JWT incrustado' = 'eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}'
  'Token GitHub' = '(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})'
  'Clave AWS' = '(?:AKIA|ASIA)[A-Z0-9]{16}'
  'Clave de proveedor' = '(?:re_[A-Za-z0-9]{24,}|sk_(?:live|test)_[A-Za-z0-9]{20,})'
  'Imagen incrustada no revisada' = 'data:image/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/]{80,}'
  'Correo no reservado para ejemplos' = '\b[A-Za-z0-9._%+-]+@(?!(?:example\.(?:com|org|net)|example\.invalid|localhost)\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'
  'Secreto asignado' = '(?im)^\s*(?:SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|MONITOR_CRON_SECRET|DATABASE_URL|PGPASSWORD|GITHUB_TOKEN|SMTP_PASSWORD)\s*=\s*\S+'
}
foreach ($file in $files) {
  $relative = $file.FullName.Substring($rootPrefix.Length).Replace('\','/')
  if ($relative -in @('assets/social/og-taller-os-v1.webp','assets/social/og-taller-os-v1.jpg')) {
    $expected = if ($manifest.approvedImages) { $manifest.approvedImages.PSObject.Properties[$relative].Value } else { '' }
    if ($relative -notin $allowed -or $expected -notmatch '^[a-fA-F0-9]{64}$' -or $file.Length -gt 250KB -or (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne $expected) {
      $failures.Add("Imagen promocional no aprobada o modificada: $relative")
    }
    continue
  }
  if ($relative -match '(?i)(^|/)(\.env[^/]*|config\.local\.js|private-data|customer-data|uploads|photos|evidence|documents|exports|backups|credentials|secrets)(/|$)|\.(pem|key|p12|pfx|csv|xlsx?|pdf|docx?|ods|jpe?g|png|webp|hei[cf]|avif|gif|tiff?|dng|raw|dump|backup|sqlite\d*|db|har|zip|log)$') {
    $failures.Add("Archivo privado prohibido: $relative"); continue
  }
  if ($relative -notin $allowed) { $failures.Add("Archivo no autorizado: $relative"); continue }
  if ($file.Length -gt 2MB) { $failures.Add("Archivo demasiado grande: $relative"); continue }
  $content = [IO.File]::ReadAllText($file.FullName)
  foreach ($rule in $rules.GetEnumerator()) {
    if ([regex]::IsMatch($content, $rule.Value)) { $failures.Add("$($rule.Key): $relative") }
  }
}
foreach ($path in $allowed) {
  if ($path -match '(^/|^[A-Za-z]:|(^|/)\.\.(/|$)|\\)') { $failures.Add('Ruta inválida en manifiesto'); continue }
  if (-not (Test-Path -LiteralPath (Join-Path $root $path) -PathType Leaf)) { $failures.Add("Falta archivo requerido: $path") }
}
$config = [IO.File]::ReadAllText((Join-Path $root 'config.js'))
if ($config -notmatch '^\s*// PUBLIC DEMO\r?\nwindow\.TALLER_CONFIG = Object\.freeze\(\{ supabaseUrl: '''', anonKey: '''', publicDemo: true \}\);\s*$') {
  $failures.Add('config.js debe contener exclusivamente configuración pública vacía y publicDemo=true')
}
if ($failures.Count) { throw ('Publicación bloqueada:' + [Environment]::NewLine + ($failures -join [Environment]::NewLine)) }
Write-Output "PASS: $($files.Count) archivos públicos revisados; configuración vacía; sin patrones de secretos detectados."
