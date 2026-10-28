// panel.js — consume /api/panel; auto-refresco cada 60 s; sin localStorage

const zoneGrid = document.querySelector('#zones-grid');
let lastData = null;

const formatTime = (iso) => iso
  ? new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
  : '—';

const formatDate = (iso) => iso
  ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
  : '—';

const createElement = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

const createRange = (zone) => {
  const [min, max] = zone.rango;
  const pos = Math.max(0, Math.min(100, zone.humedad));
  const range = createElement('div', 'humidity-range');
  const track = createElement('div', 'range-track');
  const safe = createElement('div', 'range-safe');
  const marker = createElement('span', 'range-marker');
  safe.style.left = `${min}%`;
  safe.style.width = `${max - min}%`;
  marker.style.left = `${pos}%`;
  marker.setAttribute('aria-label', `Humedad actual: ${zone.humedad} por ciento`);
  track.append(safe, marker);
  range.append(track, createElement('p', 'range-caption', `Rango de planta ${min}–${max} %`));
  return range;
};

const estadoClass = (estado) => estado.toLowerCase().replace(/\s+/g, '-');

const createZoneCard = (zone) => {
  const offline = zone.estado === 'sin conexión';
  const pausada = zone.estado === 'pausada';
  const card = createElement('article', `zone-card${offline ? ' zone-card--offline' : ''}`);

  const detailPath = zone.planta ? 'zona.html' : 'zona-vacia.html';
  const link = createElement('a', 'zone-link');
  link.href = `${detailPath}?id=${zone.id}`;
  link.setAttribute('aria-label', `Ver zona ${zone.id}${zone.planta ? `, ${zone.planta.nombre}` : ''}`);
  link.append(createElement('span', '', zone.nombre), createElement('span', 'arrow', '↗'));
  card.append(link);

  if (zone.planta?.imagen) {
    const img = document.createElement('img');
    img.className = 'zone-image';
    img.src = zone.planta.imagen;
    img.alt = zone.planta.nombre;
    img.width = 360; img.height = 220; img.loading = 'lazy';
    card.append(img);
  } else {
    const empty = createElement('div', 'zone-image zone-image--empty');
    empty.setAttribute('aria-hidden', 'true');
    const icon = document.createElement('img');
    icon.className = 'plant-icon'; icon.src = 'assets/plant-empty.svg'; icon.alt = '';
    empty.append(icon);
    card.append(empty);
  }

  const content = createElement('div', 'zone-content');
  content.append(createElement('h3', '', zone.planta?.nombre || 'Sin planta asignada'));

  if (zone.planta) {
    const estadoLabel = offline ? 'Dato anterior' : zone.estado.charAt(0).toUpperCase() + zone.estado.slice(1);
    content.append(createElement('p', `zone-state zone-state--${estadoClass(zone.estado)}`, estadoLabel));
    content.append(createElement('p', 'metric-label', 'Humedad del suelo'));
    content.append(createElement('p', 'humidity-value', `${zone.humedad !== null ? zone.humedad : '—'} %`));
    if (zone.rango && zone.humedad !== null) content.append(createRange(zone));
  } else if (pausada) {
    content.append(createElement('p', 'zone-state zone-state--pausada', 'Pausada'));
  } else {
    content.append(createElement('p', 'empty-copy', 'Asigna una planta para consultar su rango de humedad.'));
    const btn = createElement('a', 'button button--secondary', 'Asignar planta');
    btn.href = `asignar.html?id=${zone.id}`;
    content.append(btn);
  }

  const details = createElement('div', 'zone-details');
  details.append(
    createElement('p', '', zone.nodo.nombre + (zone.nodo.en_linea ? ' en línea' : ' desconectado')),
    createElement('p', '', `Última lectura · ${zone.ultima_lectura}`),
  );
  const footer = createElement('div', 'zone-footer');
  const hasAlert = zone.alertas_activas > 0;
  footer.append(createElement('span', hasAlert ? 'active-alert' : 'no-alert',
    hasAlert ? `${zone.alertas_activas} alerta${zone.alertas_activas > 1 ? 's' : ''} activa${zone.alertas_activas > 1 ? 's' : ''}` : 'Sin alertas'));
  const vl = createElement('a', 'view-link', 'Ver zona →');
  vl.href = `${detailPath}?id=${zone.id}`;
  footer.append(vl);
  details.append(footer);
  content.append(details);
  card.append(content);
  return card;
};

const showConnectionError = () => {
  const existing = document.querySelector('#connection-error');
  if (existing) return;
  const banner = createElement('p', 'connection-error', 'Error de conexión con el servidor. Mostrando últimos datos conocidos.');
  banner.id = 'connection-error';
  document.querySelector('.dashboard')?.prepend(banner);
};

const clearConnectionError = () => {
  document.querySelector('#connection-error')?.remove();
};

const render = (data) => {
  clearConnectionError();
  // Ocultar tarjeta de tanque ya que no existe en la API
  document.querySelector('#tank-value')?.closest('.summary-card')?.remove();

  const alertsCount = data.alertas_activas;
  const offlineCount = data.zonas.filter(z => !z.nodo.en_linea).length;

  document.querySelector('#alerts-value').textContent = alertsCount;
  document.querySelector('#alerts-detail').textContent = alertsCount ? `${alertsCount} zona${alertsCount > 1 ? 's' : ''} con alerta` : 'Sin alertas';
  document.querySelector('#nodes-value').textContent = `${data.nodos_online} de ${data.nodos_total}`;
  document.querySelector('#nodes-detail').textContent = offlineCount ? `${offlineCount} desconectado${offlineCount > 1 ? 's' : ''}` : 'Todos conectados';
  document.querySelector('#updated-value').textContent = formatTime(data.hora_actualizacion);
  document.querySelector('#updated-detail').textContent = formatDate(data.hora_actualizacion);
  document.querySelector('#footer-updated').textContent = `Última actualización · ${formatTime(data.hora_actualizacion)}`;

  zoneGrid.innerHTML = '';
  data.zonas.forEach(zone => zoneGrid.append(createZoneCard(zone)));

  // Banner de alertas
  const activeAlerts = data.zonas.filter(z => z.alertas_activas > 0);
  const banner = document.querySelector('#alert-banner');
  const messages = document.querySelector('#alert-messages');
  messages.innerHTML = '';
  if (activeAlerts.length) {
    activeAlerts.slice(0, 2).forEach(z => {
      messages.append(createElement('p', '', `${z.nombre}: ${z.alerta_principal || 'alerta activa'}.`));
    });
    if (activeAlerts.length > 2)
      messages.append(createElement('p', '', `Hay ${activeAlerts.length - 2} zona${activeAlerts.length - 2 > 1 ? 's' : ''} más con alertas.`));
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
};

const cargar = () => {
  fetch('/api/panel')
    .then(r => { if (!r.ok) throw new Error('respuesta no ok'); return r.json(); })
    .then(data => { lastData = data; render(data); })
    .catch(() => {
      if (lastData) { showConnectionError(); render(lastData); }
      else { zoneGrid.textContent = 'No se pudieron cargar las zonas. Intenta nuevamente.'; showConnectionError(); }
    });
};

cargar();
setInterval(cargar, 60_000);
