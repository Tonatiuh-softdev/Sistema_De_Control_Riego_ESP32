const zoneId = new URLSearchParams(window.location.search).get('id');

if (zoneId === '4') {
  window.location.replace(`zona-vacia.html?id=${zoneId}`);
}

if (zoneId !== '1' && zoneId !== '2' && zoneId !== '3' && zoneId !== '4') {
  window.location.replace('construccion.html');
}

const imageByZone = {
  1: { source: 'assets/monstera.svg', alt: 'Monstera de hojas grandes en un jardín' },
  2: { source: 'assets/albahaca.svg', alt: 'Plántulas de albahaca en macetas' },
  3: { source: 'assets/helecho.svg', alt: 'Helecho frondoso en un jardín' },
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
  const image = imageByZone[zoneId];
  const stateClass = data.estado.toLowerCase().replaceAll(' ', '-');
  document.title = `Zona ${zoneId} | ${data.planta}`;
  setText('#detail-title', `Zona ${zoneId} · ${data.planta} · ${data.estado}`);
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

fetch('data/detalles-zonas.json')
  .then((response) => {
    if (!response.ok) throw new Error('No se pudieron cargar los detalles');
    return response.json();
  })
  .then((details) => {
    renderDetail(details[zoneId]);
    setupInteractions(details[zoneId]);
  })
  .catch(() => {
    setText('#detail-title', 'No se pudieron cargar los datos');
    document.querySelector('#detail-alert').hidden = false;
    setText('#alert-title', 'Error al cargar la zona');
    setText('#alert-detail', 'Intenta actualizar la página para volver a cargar los datos.');
  });
