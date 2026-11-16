export function iniciales(nombre: string | null): string {
  const palabras = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return '?';
  return palabras
    .slice(0, 2)
    .map((p) => p[0].toLocaleUpperCase('es'))
    .join('');
}

export const etiquetaRol = (esAdmin: boolean) => (esAdmin ? 'Administrador' : 'Consulta');
