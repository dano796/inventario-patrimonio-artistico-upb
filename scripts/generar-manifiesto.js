/**
 * Escribe dist/front/browser/complemento/manifest.xml, el archivo que se sube
 * en Excel con «Cargar mi complemento». Las URL del manifiesto tienen que ser
 * absolutas y apuntar al despliegue que se va a usar, así que se generan
 * después del build con las variables que pone Netlify:
 *
 *   CONTEXT=production -> URL (dominio principal del sitio)
 *   cualquier otro     -> DEPLOY_PRIME_URL (deploy preview o rama)
 *   fuera de Netlify   -> https://localhost:4200
 *
 * Se ejecuta automáticamente vía el script `postbuild` de npm.
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");

/** No cambiar: Excel identifica el complemento por este Id. */
const ID = "47edde0b-e1b7-496f-9ec1-946650992b6b";

const base = (
  (process.env.CONTEXT === "production" ? process.env.URL : process.env.DEPLOY_PRIME_URL) ||
  "https://localhost:4200"
).replace(/\/$/, "");

const entorno = fs.readFileSync(path.join(rootDir, "src/environments/environment.ts"), "utf8");
const supabase = /SUPABASE_URL:\s*"([^"]+)"/.exec(entorno)?.[1];
if (!supabase) {
  console.error("[generar-manifiesto] ERROR: no se encontró SUPABASE_URL en src/environments/environment.ts");
  process.exit(1);
}

const escapar = (texto) => texto.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const url = (ruta) => escapar(`${base}${ruta}`);

const iconos = `<Icon>
                  <bt:Image size="16" resid="Icono.16"/>
                  <bt:Image size="32" resid="Icono.32"/>
                  <bt:Image size="80" resid="Icono.80"/>
                </Icon>`;

const manifiesto = `<?xml version="1.0" encoding="UTF-8"?>
<!-- ARCHIVO GENERADO por scripts/generar-manifiesto.js para ${escapar(base)} -->
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
           xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
           xsi:type="TaskPaneApp">
  <Id>${ID}</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>Inventario Patrimonio Artístico UPB</ProviderName>
  <DefaultLocale>es-ES</DefaultLocale>
  <DisplayName DefaultValue="Inventario UPB"/>
  <Description DefaultValue="Sincroniza la hoja oficial con el inventario web de patrimonio artístico."/>
  <IconUrl DefaultValue="${url("/complemento/icono-32.png")}"/>
  <HighResolutionIconUrl DefaultValue="${url("/complemento/icono-64.png")}"/>
  <SupportUrl DefaultValue="${url("/")}"/>
  <AppDomains>
    <AppDomain>https://login.microsoftonline.com</AppDomain>
    <AppDomain>${escapar(supabase)}</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Workbook"/>
  </Hosts>
  <Requirements>
    <Sets DefaultMinVersion="1.1">
      <Set Name="ExcelApi" MinVersion="1.1"/>
      <Set Name="DialogApi" MinVersion="1.1"/>
    </Sets>
  </Requirements>
  <DefaultSettings>
    <SourceLocation DefaultValue="${url("/complemento")}"/>
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Workbook">
        <DesktopFormFactor>
          <FunctionFile resid="Panel.Url"/>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabHome">
              <Group id="InventarioUPB.Grupo">
                <Label resid="Grupo.Etiqueta"/>
                ${iconos}
                <Control xsi:type="Button" id="InventarioUPB.Sincronizar">
                  <Label resid="Boton.Etiqueta"/>
                  <Supertip>
                    <Title resid="Boton.Etiqueta"/>
                    <Description resid="Boton.Descripcion"/>
                  </Supertip>
                  ${iconos}
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>InventarioUPB</TaskpaneId>
                    <SourceLocation resid="Panel.Url"/>
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
        <bt:Image id="Icono.16" DefaultValue="${url("/complemento/icono-16.png")}"/>
        <bt:Image id="Icono.32" DefaultValue="${url("/complemento/icono-32.png")}"/>
        <bt:Image id="Icono.80" DefaultValue="${url("/complemento/icono-80.png")}"/>
      </bt:Images>
      <bt:Urls>
        <bt:Url id="Panel.Url" DefaultValue="${url("/complemento")}"/>
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="Grupo.Etiqueta" DefaultValue="Inventario UPB"/>
        <bt:String id="Boton.Etiqueta" DefaultValue="Sincronizar"/>
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="Boton.Descripcion" DefaultValue="Compara la hoja con el inventario web y aplica los cambios en las dos."/>
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
`;

const destino = path.join(rootDir, "dist/front/browser/complemento/manifest.xml");
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, manifiesto);
console.log(`[generar-manifiesto] manifiesto para ${base}`);
