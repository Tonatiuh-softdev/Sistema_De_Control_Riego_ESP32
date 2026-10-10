# Sistema_De_Control_Riego_ESP32
Sistema de control de riego por medio de una red de 4 ESP32 conectados a una pagina web local.

## Panel de zonas

La primera pantalla implementada es el panel de zonas para escritorio, con los datos de ejemplo en `static/data/zonas.json`. Incluye el encabezado, resumen del sistema, cuatro tarjetas de zona, alertas y pie común. Las tarjetas y los enlaces de navegación ya apuntan a las rutas provisionales para las siguientes pantallas.

También está implementado el detalle de la Zona 2 (`zona.html?id=2`) con la ficha de Albahaca, gráficas SVG, métricas, historial y riego manual simulado. Las demás zonas de detalle permanecen provisionales; en particular, la Zona 4 conserva su variante sin planta para una etapa posterior.

### Ejecución local

No abrir `static/index.html` con doble clic: los módulos y `fetch` necesitan HTTP.

```text
cd static
python -m http.server 8000
```

Después visitar `http://localhost:8000` en el navegador. El uso de localhost solo corresponde al comando local de desarrollo; no está escrito en el código de la aplicación.

### Decisiones del mockup

- El nombre de la aplicación es **Sistema**, porque es el nombre consistente en el encabezado del mockup.
- En las tarjetas del panel la planta aparece una sola vez, junto con su foto. El detalle de zona será el lugar para la ficha completa.
- El subtítulo usa el estilo pequeño y secundario en todas las pantallas.
- Un nodo está “en línea” cuando reportó en el último ciclo esperado. Una zona sin lecturas mostrará “Sin lecturas todavía” en el detalle.
- Se usa punto decimal para México: por ejemplo, `3.70 V`.
- La gráfica de detalle ocupará todo el ancho disponible y sus etiquetas se adaptarán al tamaño de pantalla.
- No se muestran notas de validación de los mockups ni valores `undefined` o `null`; los datos faltantes se representan como `—`.
- El menú móvil tendrá separación suficiente y desplazamiento interno si la pantalla no alcanza.

### Responsive

El estilo parte de celular y agrega estos puntos de quiebre: `620px` para móvil amplio, `900px` para tableta y el diseño de escritorio desde `901px`. El panel de escritorio usa cuatro tarjetas de zona en una fila; tableta usa dos columnas y móvil una.
