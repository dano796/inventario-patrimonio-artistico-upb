/** En una ventana privada o con el almacenamiento bloqueado, localStorage lanza. */
export function leerAlmacen(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function guardarAlmacen(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    return;
  }
}

export function borrarAlmacen(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    return;
  }
}
