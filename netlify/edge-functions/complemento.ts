/**
 * El complemento vive dentro de un iframe de Excel en la web y necesita
 * office.js de la CDN de Microsoft, cosas que la CSP general de public/_headers
 * prohíbe. Aquí se relaja esa misma CSP solo para /complemento, en vez de
 * mantener una segunda copia que se desincronice de la primera.
 */
const OFFICE = 'https://appsforoffice.microsoft.com';

const ANCESTROS = [
  'https://*.officeapps.live.com',
  'https://*.office.com',
  'https://*.office365.com',
  'https://*.sharepoint.com',
  'https://*.microsoft365.com',
  'https://*.cloud.microsoft',
].join(' ');

export function permitirOffice(csp: string): string {
  return csp
    .split(';')
    .map((directiva) => directiva.trim())
    .filter(Boolean)
    .map((directiva) => {
      const [nombre] = directiva.split(/\s+/);
      if (nombre === 'frame-ancestors') return `frame-ancestors ${ANCESTROS}`;
      if (nombre === 'script-src' || nombre === 'connect-src') return `${directiva} ${OFFICE}`;
      return directiva;
    })
    .join('; ');
}

export default async (_peticion: Request, contexto: { next(): Promise<Response> }): Promise<Response> => {
  const respuesta = await contexto.next();
  const csp = respuesta.headers.get('content-security-policy');
  const cabeceras = new Headers(respuesta.headers);
  cabeceras.delete('x-frame-options');
  if (csp) cabeceras.set('content-security-policy', permitirOffice(csp));
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers: cabeceras });
};

export const config = { path: ['/complemento', '/complemento/*'] };
