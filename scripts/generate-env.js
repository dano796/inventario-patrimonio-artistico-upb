/**
 * Genera src/environments/environment*.ts a partir de variables de entorno.
 *
 * Fuentes, en orden de prioridad:
 *   1. Variables de entorno reales del proceso (Netlify, CI)
 *   2. Archivo .env en la raíz del proyecto (desarrollo local, no versionado)
 *
 * Se ejecuta automáticamente vía los scripts `prestart` / `prebuild` de npm.
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");

// --- 1. Cargar .env si existe (sin dependencias externas) ---
function loadDotEnv() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Quitar comillas envolventes si las hay
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Las variables reales del proceso tienen prioridad sobre .env
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

// --- 2. Validar ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const missing = [];
if (!supabaseUrl) missing.push("SUPABASE_URL");
if (!supabaseKey) missing.push("SUPABASE_KEY");

if (missing.length > 0) {
  console.error(
    `\n[generate-env] ERROR: faltan variables de entorno: ${missing.join(", ")}\n\n` +
      `  Desarrollo local: copia .env.example a .env y completa los valores.\n` +
      `  Netlify/CI: definelas en la configuracion del sitio.\n\n` +
      `  Los valores estan en el dashboard de Supabase:\n` +
      `  Project Settings -> API -> Project URL y anon/public key.\n`
  );
  process.exit(1);
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl)) {
  console.warn(
    `[generate-env] AVISO: SUPABASE_URL no tiene el formato esperado ` +
      `(https://<project-ref>.supabase.co): ${supabaseUrl}`
  );
}

// La anon key es un JWT publico; la service_role key NUNCA debe ir en el cliente.
try {
  const payload = JSON.parse(
    Buffer.from(supabaseKey.split(".")[1] || "", "base64").toString("utf8")
  );
  if (payload.role === "service_role") {
    console.error(
      `\n[generate-env] ERROR: SUPABASE_KEY es una service_role key.\n` +
        `  Esa clave da acceso total a la base de datos y NO puede incluirse\n` +
        `  en un bundle de navegador. Usa la anon/publishable key.\n`
    );
    process.exit(1);
  }
} catch {
  // No es un JWT clasico (p.ej. las nuevas publishable keys sb_publishable_...) - se acepta.
}

// --- 3. Escribir ---
const render = (isProduction) => `// ARCHIVO GENERADO - no editar a mano.
// Lo produce scripts/generate-env.js a partir de .env o de las variables de entorno.
export const environment = {
  production: ${isProduction},
  SUPABASE_URL: ${JSON.stringify(supabaseUrl.replace(/\/$/, ""))},
  SUPABASE_KEY: ${JSON.stringify(supabaseKey)},
};
`;

// environment.ts es el archivo de produccion; angular.json lo reemplaza
// por environment.development.ts en la configuracion de desarrollo.
fs.writeFileSync(
  path.join(rootDir, "src/environments/environment.ts"),
  render(true)
);
fs.writeFileSync(
  path.join(rootDir, "src/environments/environment.development.ts"),
  render(false)
);

console.log("[generate-env] archivos de entorno generados correctamente");
