const PAGINA = 1000;

/** PostgREST corta cada respuesta en max-rows: se pide por páginas hasta que una llega vacía. */
export async function leerPorPaginas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; ) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw error;
    if (!data?.length) return filas;
    filas.push(...data);
    desde += data.length;
  }
}
