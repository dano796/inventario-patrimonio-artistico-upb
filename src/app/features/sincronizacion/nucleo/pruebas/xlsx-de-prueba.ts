import { strToU8, zipSync } from 'fflate';

export interface CeldaDePrueba {
  ref: string;
  texto?: string;
  numero?: number;
  formula?: string;
  valorFormula?: string | number;
  imagen?: string;
  error?: string;
}

export interface OpcionesXlsx {
  nombreHoja?: string;
  celdas: CeldaDePrueba[];
  combinadas?: string[];
  medios?: Record<string, Uint8Array>;
}

const NS =
  'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const NS_RELS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
const NS_RD = 'xmlns="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata"';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function crearXlsxDePrueba({
  nombreHoja = 'Inventario Obras',
  celdas,
  combinadas = [],
  medios = {},
}: OpcionesXlsx): Uint8Array {
  const textos: string[] = [];
  const imagenes: string[] = [];
  const filas = new Map<number, string[]>();

  for (const c of celdas) {
    const fila = Number(/\d+$/.exec(c.ref)![0]);
    let xml: string;
    if (c.formula !== undefined) {
      const v = c.valorFormula;
      const tipo = typeof v === 'string' ? ' t="str"' : '';
      xml = `<c r="${c.ref}"${tipo}><f>${esc(c.formula)}</f>${v === undefined ? '' : `<v>${esc(String(v))}</v>`}</c>`;
    } else if (c.imagen !== undefined) {
      imagenes.push(c.imagen);
      xml = `<c r="${c.ref}" t="e" vm="${imagenes.length}"><v>#VALUE!</v></c>`;
    } else if (c.texto !== undefined) {
      textos.push(c.texto);
      xml = `<c r="${c.ref}" t="s"><v>${textos.length - 1}</v></c>`;
    } else if (c.error !== undefined) {
      xml = `<c r="${c.ref}" t="e"><v>${esc(c.error)}</v></c>`;
    } else {
      xml = `<c r="${c.ref}"><v>${c.numero}</v></c>`;
    }
    filas.set(fila, [...(filas.get(fila) ?? []), xml]);
  }

  const datosHoja = [...filas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([f, cs]) => `<row r="${f}">${cs.join('')}</row>`)
    .join('');
  const merges = combinadas.length
    ? `<mergeCells count="${combinadas.length}">${combinadas.map((r) => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>`
    : '';

  const archivos: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0"?><workbook ${NS}><sheets><sheet name="Otra" sheetId="1" r:id="rId1"/><sheet name="${esc(nombreHoja)}" sheetId="2" r:id="rId2"/></sheets></workbook>`
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0"?><Relationships ${NS_RELS}><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet2.xml"/></Relationships>`
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<?xml version="1.0"?><worksheet ${NS}><sheetData><row r="1"><c r="A1"><v>999</v></c></row></sheetData></worksheet>`
    ),
    'xl/worksheets/sheet2.xml': strToU8(
      `<?xml version="1.0"?><worksheet ${NS}><sheetData>${datosHoja}</sheetData>${merges}</worksheet>`
    ),
    'xl/sharedStrings.xml': strToU8(
      `<?xml version="1.0"?><sst ${NS}>${textos.map((t) => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join('')}</sst>`
    ),
  };

  if (imagenes.length) {
    const n = imagenes.map((_, i) => i);
    archivos['xl/metadata.xml'] = strToU8(
      `<?xml version="1.0"?><metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xlrd="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata"><metadataTypes count="1"><metadataType name="XLRICHVALUE"/></metadataTypes><futureMetadata name="XLRICHVALUE" count="${n.length}">${n.map((i) => `<bk><extLst><ext uri="{3e2802c4-a4d2-4d8b-9148-e3be6c30e623}"><xlrd:rvb i="${i}"/></ext></extLst></bk>`).join('')}</futureMetadata><valueMetadata count="${n.length}">${n.map((i) => `<bk><rc t="1" v="${i}"/></bk>`).join('')}</valueMetadata></metadata>`
    );
    archivos['xl/richData/rdrichvaluestructure.xml'] = strToU8(
      `<?xml version="1.0"?><rvStructures ${NS_RD} count="1"><s t="_localImage"><k n="_rvRel:LocalImageIdentifier" t="i"/><k n="CalcOrigin" t="i"/></s></rvStructures>`
    );
    archivos['xl/richData/rdrichvalue.xml'] = strToU8(
      `<?xml version="1.0"?><rvData ${NS_RD} count="${n.length}">${n.map((i) => `<rv s="0"><v>${i}</v><v>5</v></rv>`).join('')}</rvData>`
    );
    archivos['xl/richData/richValueRel.xml'] = strToU8(
      `<?xml version="1.0"?><richValueRels xmlns="http://schemas.microsoft.com/office/spreadsheetml/2022/richvaluerel" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${n.map((i) => `<rel r:id="rId${i + 1}"/>`).join('')}</richValueRels>`
    );
    archivos['xl/richData/_rels/richValueRel.xml.rels'] = strToU8(
      `<?xml version="1.0"?><Relationships ${NS_RELS}>${imagenes.map((nombre, i) => `<Relationship Id="rId${i + 1}" Type="image" Target="../media/${nombre}"/>`).join('')}</Relationships>`
    );
  }
  for (const [nombre, datos] of Object.entries(medios)) {
    archivos[`xl/media/${nombre}`] = datos;
  }
  return zipSync(archivos);
}
