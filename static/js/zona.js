const zoneId = new URLSearchParams(window.location.search).get('id');
const assignments = JSON.parse(localStorage.getItem('zoneAssignments') || '{}');

if (zoneId === '4' && !assignments[zoneId]) {
  window.location.replace(`zona-vacia.html?id=${zoneId}`);
}

if (zoneId !== '1' && zoneId !== '2' && zoneId !== '3' && zoneId !== '4') {
  window.location.replace('construccion.html');
}

const imageByZone = {
  1: { source: 'imagenes/Monstera.webp', alt: 'Monstera de hojas grandes' },
  2: { source: 'imagenes/Alpahaca.webp', alt: 'Planta de albahaca' },
  3: { source: 'imagenes/Helecho.webp', alt: 'Helecho frondoso' },
  4: { source: 'imagenes/Aloe vera.webp', alt: 'Sábila' },
  5: { source: 'imagenes/Echeveria.webp', alt: 'Echeveria' },
  6: { source: 'imagenes/Jade.webp', alt: 'Crassula ovata' },
  7: { source: 'imagenes/Haworthia.webp', alt: 'Haworthia' },
  8: { source: 'imagenes/Cactus.webp', alt: 'Cactus en general' },
  9: { source: 'imagenes/Sansevieria.webp', alt: 'Sansevieria' },
};

const imageByPlant = {
  Monstera: imageByZone[1],
  Albahaca: imageByZone[2],
  Helecho: imageByZone[3],
  'Aloe vera (sábila)': imageByZone[4],
  Echeveria: imageByZone[5],
  'Jade (Crassula ovata)': imageByZone[6],
  Haworthia: imageByZone[7],
  'Cactus (en general)': imageByZone[8],
  'Sansevieria (lengua de suegra)': imageByZone[9],
};

const referenceDate = new Date();

const formatShortDate = (date) => new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
}).format(date);

const formatTime = (date) => new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(date);

const formatFullDate = (date) => new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(date);

const normalizeDayPoints = (points) => {
  const coordinates = points.split(' ').map((point) => point.split(',').map(Number));
  const lastIndex = Math.max(1, coordinates.length - 1);
  return coordinates.map(([, y], index) => `${56 + (788 * index) / lastIndex},${y}`).join(' ');
};

const normalizeTodayPoints = (points) => {
  const coordinates = points.split(' ').map((point) => point.split(',').map(Number));
  const lastIndex = Math.max(1, coordinates.length - 1);
  return coordinates.map(([, y], index) => `${44 + (648 * index) / lastIndex},${y}`).join(' ');
};

const humidityToY = (humidity) => 182 - (Number(humidity) * 1.44);

const humidityToWideY = (humidity) => 220 - (Number(humidity) * 1.84);

const normalizeWidePoints = (points) => points.split(' ').map((point) => {
  const [x, y] = point.split(',').map(Number);
  return `${56 + ((x - 44) / 648) * 788},${36 + ((y - 38) / 144) * 184}`;
}).join(' ');

const updateTodayChart = (data) => {
  const coordinates = normalizeTodayPoints(data.chartToday).split(' ').map((point) => point.split(','));
  coordinates[coordinates.length - 1][1] = humidityToY(data.humedad).toFixed(1);
  const points = coordinates.map(([x, y]) => `${x},${y}`).join(' ');
  const lastPoint = points.split(' ').at(-1).split(',');
  const minimumY = humidityToY(data.rango[0]);
  const maximumY = humidityToY(data.rango[1]);
  document.querySelector('#today-chart-line').setAttribute('points', points);
  document.querySelector('#today-chart-band').setAttribute('y', maximumY.toFixed(1));
  document.querySelector('#today-chart-band').setAttribute('height', (minimumY - maximumY).toFixed(1));
  const currentLabel = document.querySelector('#today-chart-value');
  currentLabel.setAttribute('x', Number(lastPoint[0]) - 5);
  currentLabel.setAttribute('y', Math.min(200, Number(lastPoint[1]) + 16));
  const labels = [...document.querySelectorAll('#today-axis-labels text')];
  const times = ['00:00', '03:00', '06:00', '09:00', '12:00', formatTime(referenceDate)];
  labels.forEach((label, index) => {
    label.textContent = times[index];
  });
};

const setText = (selector, value) => {
  document.querySelector(selector).textContent = value;
};

const updatePeriod = (data, period) => {
  const isWeek = period === 'week';
  const rawPoints = isWeek ? data.chartWeek : normalizeWidePoints(data.chartToday);
  const coordinates = rawPoints.split(' ').map((point) => point.split(','));
  coordinates[coordinates.length - 1][1] = humidityToWideY(data.humedad).toFixed(1);
  const points = coordinates.map(([x, y]) => `${x},${y}`).join(' ');
  const lastPoint = coordinates.at(-1);
  document.querySelector('#week-chart-line').setAttribute('points', points);
  const periodLabel = document.querySelector('#week-chart-value');
  periodLabel.setAttribute('x', Number(lastPoint[0]) - 5);
  periodLabel.setAttribute('y', Math.min(236, Number(lastPoint[1]) + 16));
  const minimumY = humidityToWideY(data.rango[0]);
  const maximumY = humidityToWideY(data.rango[1]);
  document.querySelector('#period-chart-band').setAttribute('y', maximumY.toFixed(1));
  document.querySelector('#period-chart-band').setAttribute('height', (minimumY - maximumY).toFixed(1));
  document.querySelector('#day-axis-labels').style.display = isWeek ? 'none' : 'inline';
  document.querySelector('#week-axis-labels').style.display = isWeek ? 'inline' : 'none';
  if (isWeek) {
    const labels = [...document.querySelectorAll('#week-axis-labels text')];
    labels.forEach((label, index) => {
      const date = new Date(referenceDate);
      date.setDate(referenceDate.getDate() - (6 - index));
      label.textContent = formatShortDate(date);
    });
  } else {
    const labels = [...document.querySelectorAll('#day-axis-labels text')];
    const times = ['00:00', '03:00', '06:00', '09:00', '12:00', formatTime(referenceDate)];
    labels.forEach((label, index) => {
      label.textContent = times[index];
    });
  }
  setText('#time-in-range', isWeek ? data.tiempoRango7d : data.tiempoRango);
  setText('#time-out-range', isWeek ? data.horasFuera7d : data.horasFuera);
  const currentDate = formatFullDate(referenceDate);
  const previousDate = new Date(referenceDate);
  previousDate.setDate(referenceDate.getDate() - 6);
  setText('#period-chart-footnote', isWeek ? `${formatFullDate(previousDate)}–${currentDate} · Periodo de 7 días · ${data.planta} ${data.rango[0]}–${data.rango[1]} %` : `${currentDate} · 00:00–${formatTime(referenceDate)} · ${data.planta} ${data.rango[0]}–${data.rango[1]} %`);
};

const renderDetail = (data) => {
  const [minimum, maximum] = data.rango;
  const image = imageByPlant[data.planta] || { source: 'assets/plant-empty.svg', alt: `Ícono de ${data.planta}` };
  const stateClass = data.estado.toLowerCase().replaceAll(' ', '-');
  document.title = `Zona ${zoneId} | ${data.planta}`;
  setText('#detail-title', `Zona ${zoneId} · ${data.planta} · ${data.estado}`);
  document.querySelector('#change-plant-link').href = `asignar.html?id=${zoneId}`;
  setText('#detail-meta', `09/10/2026 · ${data.lectura.replace('Hoy ', '')} · Datos locales`);
  setText('#plant-title', data.planta);
  setText('#summary-plant-title', data.planta);
  setText('#plant-scientific', data.cientifico);
  setText('#plant-description', data.descripcion);
  setText('#plant-category', data.categoria);
  setText('#plant-use', data.uso);
  setText('#plant-water', data.agua);
  setText('#plant-range', `${minimum}–${maximum} %`);
  setText('#plant-temperature', data.temperatura);
  setText('#plant-light', data.luz);
  setText('#plant-care', data.cuidado);
  setText('#plant-source', data.fuente || 'Fuente no registrada');
  setText('#photo-credit', data.credito || 'Fuente no registrada');
  setText('#humidity-label', `Humedad del suelo · Lectura ${data.lectura.replace('Hoy ', '').replace('Ayer ', '')}`);
  setText('#humidity-value', data.humedad);
  setText('#detail-range-caption', `Rango de planta ${minimum}–${maximum} %`);
  setText('#summary-state', `${data.estado} · Planta asignada a Zona ${zoneId}`);
  setText('#summary-node', data.nodo);
  setText('#summary-reading', `Última lectura · ${data.lectura}`);
  setText('#summary-irrigation', `Último riego · ${data.riego}`);
  setText('#summary-range', `Rango de planta · ${minimum}–${maximum} %`);
  setText('#time-in-range', data.tiempoRango);
  setText('#time-out-range', data.horasFuera);
  setText('#irrigation-duration', data.riegoDia);
  setText('#irrigation-volume', `${data.mililitros} · caudal 2 ml/s`);
  setText('#ambient-temperature', data.temperaturaAmbiente);
  setText('#ambient-humidity', data.humedadAmbiente);
  setText('#node-battery', data.bateria);
  setText('#conditions-reading', `Última lectura ${data.lectura.replace('Hoy ', '').replace('Ayer ', '')}`);
  document.querySelector('#profile-image').src = image.source;
  document.querySelector('#profile-image').alt = image.alt;
  document.querySelector('#summary-image').src = image.source;
  document.querySelector('#summary-image').alt = '';
  document.querySelector('#detail-range-safe').style.left = `${minimum}%`;
  document.querySelector('#detail-range-safe').style.width = `${maximum - minimum}%`;
  document.querySelector('#detail-range-marker').style.left = `${data.humedad}%`;
  updateTodayChart(data);
  document.querySelector('#week-chart-line').setAttribute('points', normalizeDayPoints(data.chartToday));
  setText('#today-chart-value', `${data.humedad} %`);
  setText('#week-chart-value', `${data.humedad} %`);
  document.querySelector('#summary-state').className = `zone-state zone-state--${stateClass}`;
  document.querySelector('#alert-title').textContent = data.alerta || 'Sin alertas activas';
  document.querySelector('#alert-detail').textContent = data.alerta ? `${data.humedad} % frente al rango de ${minimum}–${maximum} %. Último reporte: ${data.lectura}.` : 'La zona se encuentra dentro del rango recomendado.';
  document.querySelector('#detail-alert').hidden = !data.alerta;
  updatePeriod(data, 'day');
};

const setupInteractions = (data) => {
  const dialog = document.querySelector('#irrigation-dialog');
  const manualButton = document.querySelector('#manual-irrigation');
  const feedback = document.querySelector('#manual-feedback');
  const confirmButton = document.querySelector('#confirm-irrigation');
  const periodButtons = document.querySelectorAll('.period-button');
  manualButton.addEventListener('click', () => dialog.showModal());
  confirmButton.addEventListener('click', () => {
    manualButton.disabled = true;
    manualButton.textContent = 'Riego pendiente';
    feedback.textContent = 'Ya hay un riego manual pendiente.';
  });
  periodButtons.forEach((button) => button.addEventListener('click', () => {
    const period = button.textContent.includes('7') ? 'week' : 'day';
    updatePeriod(data, period);
    periodButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
  }));
};

const buildCatalogDetail = (plant, zoneNumber) => ({
  planta: plant.planta,
  estado: 'En rango',
  humedad: Math.round((plant.rango[0] + plant.rango[1]) / 2),
  rango: plant.rango,
  cientifico: '—',
  descripcion: plant.necesidad,
  categoria: 'Planta disponible',
  uso: 'Decorativo',
  agua: 'Según necesidad',
  temperatura: '—',
  luz: '—',
  cuidado: plant.necesidad,
  fuente: 'Fuente no registrada',
  credito: 'Fuente no registrada',
  nodo: `Nodo ${zoneNumber} en línea`,
  lectura: '—',
  riego: '—',
  alerta: '',
  temperaturaAmbiente: '—',
  humedadAmbiente: '—',
  bateria: '—',
  tiempoRango: '—',
  horasFuera: '—',
  tiempoRango7d: '—',
  horasFuera7d: '—',
  riegoDia: '0 s',
  mililitros: '—',
  chartToday: '44,112 180,108 315,104 450,100 570,98 692,96',
  chartWeek: '56,120 170,114 280,108 390,104 510,100 650,98 844,96',
});

Promise.all([
  fetch('data/detalles-zonas.json').then((response) => response.json()),
  fetch('data/zonas.json?v=2').then((response) => response.json()),
])
  .then(([details, zoneData]) => {
    const assignedPlant = assignments[zoneId];
    const catalogPlant = zoneData.plantasDisponibles.find((item) => item.planta === assignedPlant);
    const detail = assignedPlant
      ? Object.values(details).find((item) => item.planta === assignedPlant) || (catalogPlant ? buildCatalogDetail(catalogPlant, zoneId) : details[zoneId])
      : details[zoneId];
    renderDetail(detail);
    setupInteractions(detail);
  })
  .catch(() => {
    setText('#detail-title', 'No se pudieron cargar los datos');
    document.querySelector('#detail-alert').hidden = false;
    setText('#alert-title', 'Error al cargar la zona');
    setText('#alert-detail', 'Intenta actualizar la página para volver a cargar los datos.');
  });
