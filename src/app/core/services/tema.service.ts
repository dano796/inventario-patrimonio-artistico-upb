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
    const siguiente: Tema = this.actual() === 'oscuro' ? 'claro' : 'oscuro';
    this.actual.set(siguiente);
    this.aplicar(siguiente);
    guardarAlmacen(CLAVE_TEMA, siguiente);
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
