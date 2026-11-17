<div align="center">

<img src="public/logo.svg" alt="Logo de Patrimonio Artístico UPB" width="72"/>

# Patrimonio Artístico UPB

**Inventario del patrimonio artístico de la Universidad Pontificia Bolivariana**

Catálogo público de obras, panel de administración y sincronización con el Excel oficial

[Sitio web](https://inventario-patrimonio-artistico-upb.netlify.app/) · [Descripción](#descripción)

<br/>

<img src=".github/readme/galeria.png" alt="Galería de obras en vista Mosaico, con buscador, filtros y selector de vista" width="100%"/>

<sub>Galería: el catálogo público, con búsqueda por título, filtros y tres vistas (Galería, Mosaico y Tabla).</sub>

</div>

---

## Descripción

Patrimonio Artístico UPB es la aplicación web con la que la universidad cataloga su colección de obras de arte. Cualquier visitante puede consultar el catálogo; las cuentas institucionales con rol de administrador gestionan el inventario completo.

| Pantalla | Funcionalidad |
|---|---|
| **Galería** | Consultar el catálogo, buscar por título y filtrar por autor o técnica (y, para administradores, por ubicación y responsable). |
| **Ficha de obra** | Ver los datos de una obra y sus imágenes, y editarla o eliminarla (administradores). |
| **Resumen** | Conocer el estado del inventario: valor estimado, composición de la colección y fichas incompletas. |
| **Mapa** | Ubicar las obras por bloque y por lugar en el campus de Laureles. |
| **Sincronización** | Comparar el Excel oficial con el inventario web, revisar las diferencias y aplicarlas en las dos copias. |

La ubicación, el valor, el bloque asignado y el responsable de cada obra son datos restringidos que solo ven los administradores. El inicio de sesión es exclusivamente con la cuenta institucional de Microsoft.

<p align="center">
  <img src=".github/readme/ficha.png" alt="Ficha de la obra Medellín desde mi balcón, con su imagen, técnica, dimensión, año y descripción" width="100%"/>
  <br/><sub>Ficha de obra: datos públicos de la obra y visor de imágenes.</sub>
</p>

<p align="center">
  <img src=".github/readme/resumen.png" alt="Resumen con cifras del inventario, gráficas de técnicas, artistas y épocas, y completitud de las fichas por campo" width="100%"/>
  <br/><sub>Resumen: cifras del inventario y completitud de las fichas; "Revisar" abre la galería con las obras a las que les falta ese dato.</sub>
</p>

<p align="center">
  <img src=".github/readme/mapa.png" alt="Mapa 3D del campus en tema oscuro con los bloques coloreados según su número de obras y el panel de bloques con los lugares de uno de ellos" width="100%"/>
  <br/><sub>Mapa: cada bloque del campus con su número de obras; al elegirlo se despliegan sus lugares y las obras de cada uno.</sub>
</p>

<p align="center">
  <img src=".github/readme/sincronizacion.png" alt="Revisión de la sincronización: cada campo enfrenta el valor del Excel y el de la base, con la dirección del cambio, junto al resumen de la ejecución" width="100%"/>
  <br/><sub>Sincronización: cada diferencia enfrenta el valor del Excel y el de la base; nada se escribe hasta aprobar la revisión.</sub>
</p>

> [!NOTE]
> Las capturas de Resumen, Mapa y Sincronización usan datos de ejemplo.

La sincronización también funciona como complemento de Excel (`/complemento`), que trabaja sobre el libro abierto con los permisos de edición de quien lo usa.

<div align="center">
<br/>
<sub>Construido con Angular, Supabase y MapLibre. Mapas: © OpenStreetMap contributors, © CARTO</sub>
</div>
