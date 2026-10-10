const zoneGrid = document.querySelector('#zones-grid');

const formatTime = (value) => new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(new Date(value));

const formatDate = (value) => new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date(value));

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const createRange = (zone) => {
  const range = createElement('div', 'humidity-range');
  const track = createElement('div', 'range-track');
  const safeRange = createElement('div', 'range-safe');
  const marker = createElement('span', 'range-marker');
  const [minimum, maximum] = zone.rango;
  const position = Math.max(0, Math.min(100, zone.humedad));
  safeRange.style.left = `${minimum}%`;
  safeRange.style.width = `${maximum - minimum}%`;
  marker.style.left = `${position}%`;
  marker.setAttribute('aria-label', `Humedad actual: ${zone.humedad} por ciento`);
  track.append(safeRange, marker);
  range.append(track, createElement('p', 'range-caption', `Rango de planta ${minimum}–${maximum} %`));
  return range;
};

const createZoneCard = (zone) => {
  const card = createElement('article', `zone-card${zone.datoAnterior ? ' zone-card--offline' : ''}`);
  const link = createElement('a', 'zone-link');
  const detailPath = zone.planta ? 'zona.html' : 'zona-vacia.html';
  link.href = `${detailPath}?id=${zone.id}`;
  link.setAttribute('aria-label', `Ver zona ${zone.id}${zone.planta ? `, ${zone.planta}` : ''}`);
  link.append(createElement('span', '', `Zona ${zone.id}`), createElement('span', 'arrow', '↗'));
  card.append(link);

  if (zone.imagen) {
    const image = document.createElement('img');
    image.className = 'zone-image';
    image.src = zone.imagen;
    image.alt = zone.alt;
    image.width = 360;
    image.height = 220;
    image.loading = 'lazy';
    card.append(image);
  } else {
    const emptyImage = createElement('div', 'zone-image zone-image--empty');
    emptyImage.setAttribute('aria-hidden', 'true');
    const plantIcon = document.createElement('img');
    plantIcon.className = 'plant-icon';
    plantIcon.src = 'assets/plant-empty.svg';
    plantIcon.alt = '';
    emptyImage.append(plantIcon);
    card.append(emptyImage);
  }

  const content = createElement('div', 'zone-content');
  const heading = createElement('h3', '', zone.planta || 'Sin planta asignada');
  content.append(heading);

  if (zone.planta) {
    content.append(createElement('p', `zone-state zone-state--${zone.estado.toLowerCase().replace(' ', '-')}`, zone.datoAnterior ? 'Dato anterior' : zone.estado));
    content.append(createElement('p', 'metric-label', 'Humedad del suelo'));
    content.append(createElement('p', 'humidity-value', `${zone.humedad} %`));
    content.append(createRange(zone));
  } else {
    content.append(createElement('p', 'empty-copy', 'Asigna una planta para consultar su rango de humedad.'));
    const assign = createElement('a', 'button button--secondary', 'Asignar planta');
    assign.href = `asignar.html?id=${zone.id}`;
    content.append(assign);
  }

  const details = createElement('div', 'zone-details');
  details.append(
    createElement('p', '', zone.nodo),
    createElement('p', '', zone.lectura),
    createElement('p', '', `Último riego · ${zone.riego.replace('Último riego · ', '')}`),
  );
  const footer = createElement('div', 'zone-footer');
  footer.append(createElement('span', zone.alerta === 'Sin alertas' ? 'no-alert' : 'active-alert', zone.alerta));
  const viewLink = createElement('a', 'view-link', 'Ver zona →');
  viewLink.href = `${detailPath}?id=${zone.id}`;
  footer.append(viewLink);
  details.append(footer);
  content.append(details);
  card.append(content);
  return card;
};

const getZoneAlerts = (zone) => {
  if (!zone.planta) return [];
  if (zone.datoAnterior) return [`Zona ${zone.id}: nodo sin conexión`];
  if (zone.humedad < zone.rango[0]) return [`Zona ${zone.id}: humedad baja (${zone.humedad} %)`];
  if (zone.humedad > zone.rango[1]) return [`Zona ${zone.id}: humedad alta (${zone.humedad} %)`];
  return [];
};

const render = (data) => {
  document.querySelector('#tank-value').textContent = data.tanque.estado;
  document.querySelector('#tank-detail').textContent = data.tanque.detalle;
  const activeAlerts = data.zonas.flatMap(getZoneAlerts);
  const offlineZones = data.zonas.filter((zone) => zone.datoAnterior);
  document.querySelector('#alerts-value').textContent = activeAlerts.length;
  document.querySelector('#alerts-detail').textContent = activeAlerts.length ? activeAlerts.map((alert) => alert.split(':')[0]).join(' y ') : 'Sin alertas';
  document.querySelector('#nodes-value').textContent = `${data.zonas.length - offlineZones.length} de ${data.zonas.length}`;
  document.querySelector('#nodes-detail').textContent = offlineZones.length ? 'Nodo 3 desconectado' : 'Todos conectados';
  document.querySelector('#updated-value').textContent = formatTime(data.ultimaActualizacion);
  document.querySelector('#updated-detail').textContent = formatDate(data.ultimaActualizacion);
  document.querySelector('#footer-updated').textContent = `Última actualización · ${formatTime(data.ultimaActualizacion)}`;
  data.zonas.forEach((zone) => zoneGrid.append(createZoneCard(zone)));
  if (activeAlerts.length) {
    const messages = document.querySelector('#alert-messages');
    activeAlerts.slice(0, 2).forEach((alert) => {
      const message = createElement('p', '', `${alert}.`);
      messages.append(message);
    });
    if (activeAlerts.length > 2) {
      messages.append(createElement('p', '', `Hay ${activeAlerts.length - 2} aviso${activeAlerts.length - 2 === 1 ? '' : 's'} más.`));
    }
    document.querySelector('#alert-banner').hidden = false;
  }
};

const applyAssignments = (data) => {
  const assignments = JSON.parse(localStorage.getItem('zoneAssignments') || '{}');
  Object.entries(assignments).forEach(([zoneId, plantName]) => {
    const target = data.zonas.find((zone) => String(zone.id) === zoneId);
    const source = data.zonas.find((zone) => zone.planta === plantName)
      || data.plantasDisponibles.find((plant) => plant.planta === plantName);
    if (!target || !source) return;
    Object.assign(target, {
      planta: source.planta,
      estado: 'En rango',
      humedad: source.humedad ?? Math.round((source.rango[0] + source.rango[1]) / 2),
      rango: source.rango,
      imagen: source.imagen,
      alt: source.alt,
      alerta: 'Sin alertas',
    });
  });
  return data;
};

fetch('data/zonas.json?v=3')
  .then((response) => {
    if (!response.ok) throw new Error('No se pudieron cargar los datos');
    return response.json();
  })
  .then(applyAssignments)
  .then(render)
  .catch(() => {
    zoneGrid.textContent = 'No se pudieron cargar las zonas. Intenta nuevamente.';
  });