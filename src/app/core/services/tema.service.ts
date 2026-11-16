import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { guardarAlmacen, leerAlmacen } from '../../shared/utils/almacen';

export type Tema = 'claro' | 'oscuro';
export const CLAVE_TEMA = 'tema';

@Injectable({ providedIn: 'root' })
export class TemaService {
  private documento = inject(DOCUMENT);
  private actual = signal<Tema>(this.inicial());
  readonly tema = this.actual.asReadonly();

  constructor() {
    this.aplicar(this.actual());
  }

  alternar(): void {
    this.establecer(this.actual() === 'oscuro' ? 'claro' : 'oscuro');
  }

  establecer(tema: Tema): void {
    this.actual.set(tema);
    this.aplicar(tema);
    guardarAlmacen(CLAVE_TEMA, tema);
  }

  private inicial(): Tema {
    const guardado = leerAlmacen(CLAVE_TEMA);
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
    const vista = this.documento.defaultView;
    return vista?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }

  private aplicar(tema: Tema): void {
    this.documento.documentElement.setAttribute('data-theme', tema);
  }
}
