const zoneId = new URLSearchParams(window.location.search).get('id');

fetch('data/zonas.json')
  .then((response) => response.json())
  .then((data) => {
    const zone = data.zonas.find((item) => String(item.id) === zoneId && !item.planta);
    if (!zone) return;
    document.title = `Zona ${zone.id} sin planta | Sistema de riego`;
    document.querySelector('#empty-zone-title').textContent = `Zona ${zone.id}`;
    document.querySelector('#empty-node-label').textContent = zone.nodo;
  });