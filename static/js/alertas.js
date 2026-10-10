const alertsList = document.querySelector('#alerts-list');

const createAlert = (title, detail, zoneId, kind) => {
  const article = document.createElement('article');
  article.className = `alert-item alert-item--${kind}`;
  const icon = document.createElement('span');
  icon.className = 'alert-item-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '!';
  const content = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = title;
  const description = document.createElement('p');
  description.textContent = detail;
  content.append(heading, description);
  const link = document.createElement('a');
  link.href = `zona.html?id=${zoneId}`;
  link.textContent = 'Ver zona →';
  article.append(icon, content, link);
  return article;
};

fetch('data/zonas.json')
  .then((response) => response.json())
  .then((data) => {
    data.zonas.forEach((zone) => {
      if (!zone.planta) return;
      if (zone.datoAnterior) {
        alertsList.append(createAlert(`Zona ${zone.id} · Nodo sin conexión`, `La última lectura de humedad fue de ${zone.humedad} % a las ${zone.lectura.replace('Última lectura · ', '')}.`, zone.id, 'offline'));
      } else if (zone.humedad < zone.rango[0]) {
        alertsList.append(createAlert(`Zona ${zone.id} · Humedad baja`, `${zone.planta} registra ${zone.humedad} %. El rango recomendado comienza en ${zone.rango[0]} %.`, zone.id, 'low'));
      } else if (zone.humedad > zone.rango[1]) {
        alertsList.append(createAlert(`Zona ${zone.id} · Humedad alta`, `${zone.planta} registra ${zone.humedad} %. El rango recomendado termina en ${zone.rango[1]} %.`, zone.id, 'high'));
      }
    });
    if (!alertsList.children.length) alertsList.textContent = 'No hay alertas activas.';
  })
  .catch(() => {
    alertsList.textContent = 'No se pudieron cargar las alertas.';
  });