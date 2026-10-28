// zona-vacia.js — consume /api/zonas/{id}; sin localStorage ni archivos JSON estáticos

const zoneId = new URLSearchParams(window.location.search).get('id') || '4';

fetch(`/api/zonas/${zoneId}`)
  .then((response) => {
    if (!response.ok) throw new Error('Zona no encontrada');
    return response.json();
  })
  .then((zona) => {
    document.title = `${zona.nombre} sin planta | Sistema de riego`;
    const titleEl = document.querySelector('#empty-zone-title');
    if (titleEl) titleEl.textContent = zona.nombre;
    const nodeEl = document.querySelector('#empty-node-label');
    if (nodeEl && zona.nodo) {
      nodeEl.textContent = `${zona.nodo.nombre} ${zona.nodo.en_linea ? 'en línea' : 'desconectado'}`;
    }
    const btnAssign = document.querySelector('.empty-zone-card a.button--primary');
    if (btnAssign) {
      btnAssign.href = `asignar.html?id=${zona.id}`;
    }
  })
  .catch(() => {});