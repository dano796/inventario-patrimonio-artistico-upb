/** En una ventana privada o con el almacenamiento bloqueado, localStorage y sessionStorage lanzan. */
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

export function leerSesion(clave: string): string | null {
  try {
    return sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function guardarSesion(clave: string, valor: string): void {
  try {
    sessionStorage.setItem(clave, valor);
  } catch {
    return;
  }
}

export function borrarSesion(clave: string): void {
  try {
    sessionStorage.removeItem(clave);
  } catch {
    return;
  }
}
