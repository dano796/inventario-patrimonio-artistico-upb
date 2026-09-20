import { Injectable, inject } from '@angular/core';
import { ArtworksService } from './artworks.service';

/**
 * Exportacion del inventario a Excel.
 *
 * Vivia dentro de ArtworkListComponent y ocupaba ~180 de sus lineas, mezclando
 * presentacion con generacion de archivos. exceljs y file-saver se cargan de
 * forma diferida: juntos pesan ~1.5 MB y solo hacen falta al exportar.
 */
@Injectable({
  providedIn: 'root',
})
export class ArtworkExportService {
  private artworksService = inject(ArtworksService);

  /**
   * Genera y descarga el .xlsx con todas las obras.
   * @returns numero de obras exportadas, o 0 si no habia ninguna.
   */
  async exportToExcel(): Promise<number> {
    // Importaciones dinámicas para reducir el tamaño del bundle inicial y evitar errores de exportación
    const ExcelJS = (await import('exceljs')).default;
    const fileSaverModule = await import('file-saver');
    const saveAs = fileSaverModule.saveAs || fileSaverModule.default;

    const allArtworks =
      await this.artworksService.getAllArtworksNoPagination();
    if (!allArtworks || allArtworks.length === 0) {
      return 0;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Obras');

    // Definir columnas
    worksheet.columns = [
      { header: 'NÚMERO DE INVENTARIO', key: 'id', width: 15 },
      { header: 'AUTOR', key: 'autor', width: 20 },
      { header: 'TÍTULO', key: 'titulo', width: 20 },
      { header: 'TÉCNICA', key: 'tecnica', width: 18 },
      { header: 'DIMENSIONES (cm)', key: 'dimension', width: 15 },
      { header: 'AÑO DE ELABORACIÓN', key: 'ano', width: 15 },
      { header: 'UBICACIÓN', key: 'ubicacion', width: 30 },
      { header: 'VALOR', key: 'valor', width: 15 },
      { header: 'OBSERVACIONES', key: 'observaciones', width: 30 },
      { header: 'RESPONSABLE', key: 'responsable', width: 20 },
      { header: 'IMAGEN 1', key: 'imagen1', width: 20 },
      { header: 'IMAGEN 2', key: 'imagen2', width: 20 },
      { header: 'IMAGEN 3', key: 'imagen3', width: 20 },
    ];

    // Agregar filas (sin imagen aún)
    allArtworks.forEach((obra: any, idx: number) => {
      const row = worksheet.addRow({
        id: obra.id,
        autor: obra.autor ?? '',
        titulo: obra.titulo ?? '',
        tecnica: obra.tecnica ?? '',
        dimension: obra.dimension ?? '',
        ano: obra.ano ?? '',
        ubicacion: obra.ubicacion ?? '',
        valor: obra.valor ? parseFloat(obra.valor) : '',
        observaciones: obra.observaciones ?? '',
        responsable: obra.responsable ?? '',
        imagen1: '',
        imagen2: '',
        imagen3: '',
      });
      // Estilos de fila
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
      // Aplicar formato de moneda sin decimales a la columna de valor
      const valorCell = row.getCell(8);
      if (obra.valor) {
        valorCell.numFmt = '"$"#,##0';
      }
      // Ajustar el alto de la fila para las imágenes
      worksheet.getRow(idx + 2).height = 90;
    });

    // Estilos de header
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = {
        name: 'Arial',
        size: 10,
        color: { argb: 'FF632523' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2DCDB' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Ajustar el alto del header
    worksheet.getRow(1).height = 60;

    // Descargar e insertar hasta 3 imágenes por obra
    for (let i = 0; i < allArtworks.length; i++) {
      const obra = allArtworks[i];
      if (obra.imagenes && obra.imagenes.length > 0) {
        for (let j = 0; j < Math.min(3, obra.imagenes.length); j++) {
          const img = obra.imagenes[j];
          if (img && img.url) {
            try {
              const imageUrl = img.url;
              const response = await fetch(imageUrl);
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const extension = imageUrl.split('.').pop()?.toLowerCase();
              let imageType: 'jpeg' | 'png' = 'jpeg';
              if (extension === 'png') imageType = 'png';
              const imageId = workbook.addImage({
                buffer: new Uint8Array(arrayBuffer) as any,
                extension: imageType,
              });
              // Obtener tamaño real de la imagen
              const imgBitmap = await createImageBitmap(blob);
              const maxCellWidthPx = 133;
              const maxCellHeightPx = 125;
              let drawWidth = imgBitmap.width;
              let drawHeight = imgBitmap.height;

              // Escalar proporcionalmente para que la imagen nunca exceda la altura disponible
              const targetRow = worksheet.getRow(i + 2);
              const defaultRowHeightPoints = 90;
              const existingHeightPoints = (targetRow.height ??
                defaultRowHeightPoints) as number;
              // Conversión aproximada: 1px ≈ 0.75pt
              const pxToPt = 0.75;
              const existingHeightPx = Math.floor(
                existingHeightPoints / pxToPt
              );
              const paddingPx = 24; // padding vertical conservador
              // No usar más altura que el máximo teórico
              const availableHeightPx = Math.max(
                1,
                Math.min(maxCellHeightPx, existingHeightPx - paddingPx)
              );

              const widthRatio = maxCellWidthPx / drawWidth;
              const heightRatio = availableHeightPx / drawHeight;
              const scale = Math.min(1, widthRatio, heightRatio);

              drawWidth = Math.round(drawWidth * scale);
              drawHeight = Math.round(drawHeight * scale);

              // Clamp de seguridad final
              if (drawWidth > maxCellWidthPx) drawWidth = maxCellWidthPx;
              if (drawHeight > availableHeightPx)
                drawHeight = availableHeightPx;

              worksheet.addImage(imageId, {
                tl: { col: 10 + j, row: i + 1 } as any,
                ext: { width: drawWidth, height: drawHeight },
                editAs: 'oneCell',
              });
            } catch (imgErr) {
              // Si falla la imagen, dejar celda vacía
            }
          }
        }
      }
    }

    // Descargar el archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, 'inventario-obras.xlsx');

    return allArtworks.length;
  }
}
