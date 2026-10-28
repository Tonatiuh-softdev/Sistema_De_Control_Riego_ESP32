// zona.js — consume /api/zonas/{id} y /api/zonas/{id}/estadisticas; sin localStorage

const zoneId = new URLSearchParams(window.location.search).get('id');

if (!zoneId || !['1','2','3','4'].includes(zoneId)) {
  window.location.replace('construccion.html');
}

const setText = (selector, value) => {
  const el = document.querySelector(selector);
  if (el) el.textContent = value ?? '—';
};

const formatTime = (iso) => iso
  ? new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
  : '—';

const formatFullDate = (iso) => iso
  ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
  : '—';

const formatShortDate = (iso) => iso
  ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit' }).format(new Date(iso))
  : '—';

// ── Gráfica — coordenadas calculadas en el front ──────────────────────────────
// SVG hoy: viewBox x ∈ [44,692], y = 182 - pct*1.44
// SVG semana: viewBox x ∈ [56,844], y = 220 - pct*1.84

const humToYHoy = (h) => (182 - h * 1.44).toFixed(1);
const humToYSemana = (h) => (220 - h * 1.84).toFixed(1);

const puntosAPolyline = (puntos, xMin, xRange, yFn) => {
  if (!puntos.length) return '';
  const n = Math.max(1, puntos.length - 1);
  return puntos.map((p, i) => `${(xMin + xRange * i / n).toFixed(1)},${yFn(p.humedad_pct)}`).join(' ');
};

const renderGraficaHoy = (puntos, rango) => {
  const pts = puntosAPolyline(puntos, 44, 648, humToYHoy);
  if (!pts) return;
  document.querySelector('#today-chart-line')?.setAttribute('points', pts);
  const last = pts.split(' ').at(-1).split(',');
  document.querySelector('#today-chart-value')?.setAttribute('x', Number(last[0]) - 5);
  document.querySelector('#today-chart-value')?.setAttribute('y', Math.min(200, Number(last[1]) + 16));
  if (rango) {
    const yMax = humToYHoy(rango[1]);
    const yMin = humToYHoy(rango[0]);
    document.querySelector('#today-chart-band')?.setAttribute('y', yMax);
    document.querySelector('#today-chart-band')?.setAttribute('height', (yMin - yMax).toFixed(1));
  }
  // etiquetas eje X
  const labels = [...document.querySelectorAll('#today-axis-labels text')];
  const now = new Date();
  const times = ['00:00','03:00','06:00','09:00','12:00',formatTime(now.toISOString())];
  labels.forEach((l, i) => { l.textContent = times[i]; });
};

const renderGraficaSemana = (puntos, rango) => {
  const pts = puntosAPolyline(puntos, 56, 788, humToYSemana);
  if (!pts) return;
  document.querySelector('#week-chart-line')?.setAttribute('points', pts);
  const last = pts.split(' ').at(-1).split(',');
  document.querySelector('#week-chart-value')?.setAttribute('x', Number(last[0]) - 5);
  document.querySelector('#week-chart-value')?.setAttribute('y', Math.min(236, Number(last[1]) + 16));
  if (rango) {
    const yMax = humToYSemana(rango[1]);
    const yMin = humToYSemana(rango[0]);
    document.querySelector('#period-chart-band')?.setAttribute('y', yMax);
    document.querySelector('#period-chart-band')?.setAttribute('height', (yMin - yMax).toFixed(1));
  }
  const labels = [...document.querySelectorAll('#week-axis-labels text')];
  const now = new Date();
  labels.forEach((l, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (6 - i));
    l.textContent = formatShortDate(d.toISOString());
  });
};

const renderDetail = (zona, statsHoy, statsSemana) => {
  const p = zona.planta;
  const ul = zona.ultima_lectura;
  const rango = p?.rango || null;
  const humedad = ul?.humedad_pct ?? null;
  const hmin = rango?.[0], hmax = rango?.[1];

  document.title = `Zona ${zoneId} | ${p?.nombre || 'Sin planta'}`;
  setText('#detail-title', `Zona ${zoneId} · ${p?.nombre || 'Sin planta'} · ${zona.estado}`);
  document.querySelector('#change-plant-link')?.setAttribute('href', `asignar.html?id=${zoneId}`);
  setText('#plant-title', p?.nombre);
  setText('#summary-plant-title', p?.nombre);
  setText('#plant-scientific', p?.cientifico);
  setText('#plant-description', p?.descripcion);
  setText('#plant-category', p?.categoria);
  setText('#plant-use', p?.uso);
  setText('#plant-water', p?.agua);
  setText('#plant-range', rango ? `${hmin}–${hmax} %` : '—');
  setText('#plant-temperature', p?.temperatura);
  setText('#plant-light', p?.luz);
  setText('#plant-care', p?.cuidado);
  setText('#plant-source', 'Fuente no registrada');
  setText('#photo-credit', p?.credito);
  setText('#humidity-label', `Humedad del suelo · Lectura ${formatTime(ul?.timestamp)}`);
  setText('#humidity-value', humedad !== null ? humedad : '—');
  setText('#detail-range-caption', rango ? `Rango de planta ${hmin}–${hmax} %` : '—');
  setText('#summary-state', `${zona.estado} · Planta asignada a Zona ${zoneId}`);
  setText('#summary-node', `${zona.nodo.nombre} ${zona.nodo.en_linea ? 'en línea' : 'desconectado'}`);
  setText('#summary-reading', `Última lectura · ${formatTime(ul?.timestamp)}`);
  setText('#summary-irrigation', 'Último riego · —');
  setText('#summary-range', rango ? `Rango de planta · ${hmin}–${hmax} %` : '—');
  setText('#ambient-temperature', ul?.temperatura_ambiente !== null ? `${ul.temperatura_ambiente} °C` : '—');
  setText('#ambient-humidity', ul?.humedad_ambiente !== null ? `${ul.humedad_ambiente} %` : '—');
  setText('#node-battery', ul?.voltaje_bateria !== null ? `${ul.voltaje_bateria?.toFixed(2)} V` : '—');
  setText('#conditions-reading', `Última lectura ${formatTime(ul?.timestamp)}`);

  if (rango && humedad !== null) {
    document.querySelector('#detail-range-safe').style.left = `${hmin}%`;
    document.querySelector('#detail-range-safe').style.width = `${hmax - hmin}%`;
    document.querySelector('#detail-range-marker').style.left = `${humedad}%`;
  }

  // Imagen de planta
  if (p?.imagen) {
    document.querySelector('#profile-image')?.setAttribute('src', p.imagen);
    document.querySelector('#profile-image')?.setAttribute('alt', p.nombre);
    document.querySelector('#summary-image')?.setAttribute('src', p.imagen);
  }

  // Estado CSS
  const stateClass = zona.estado.toLowerCase().replace(/\s+/g, '-');
  document.querySelector('#summary-state')?.setAttribute('class', `zone-state zone-state--${stateClass}`);

  // Alerta
  const alertaAbierta = zona.alertas?.find(a => a.abierta);
  setText('#alert-title', alertaAbierta ? alertaAbierta.tipo_label : 'Sin alertas activas');
  setText('#alert-detail', alertaAbierta
    ? `Humedad: ${humedad} % frente al rango ${hmin}–${hmax} %. Reporte: ${formatTime(ul?.timestamp)}.`
    : 'La zona se encuentra dentro del rango recomendado.');
  document.querySelector('#detail-alert')?.toggleAttribute('hidden', !alertaAbierta);

  // Estadísticas periodo hoy
  const stHoy = statsHoy;
  setText('#time-in-range', stHoy?.tiempo_en_rango_pct !== null ? `${stHoy.tiempo_en_rango_pct} %` : '—');
  setText('#time-out-range', stHoy?.horas_fuera_rango !== null ? `${stHoy.horas_fuera_rango} h` : '—');
  setText('#today-chart-value', humedad !== null ? `${humedad} %` : '—');
  setText('#week-chart-value', humedad !== null ? `${humedad} %` : '—');

  // Gráficas
  renderGraficaHoy(stHoy?.puntos || [], rango);
  renderGraficaSemana(statsSemana?.puntos || [], rango);

  // Nota a pie de gráfica
  const now = new Date();
  const hace7 = new Date(now); hace7.setDate(now.getDate() - 6);
  setText('#period-chart-footnote',
    `${formatFullDate(hace7.toISOString())}–${formatFullDate(now.toISOString())} · 7 días · ${p?.nombre || ''} ${rango ? `${hmin}–${hmax} %` : ''}`);

  // Ocultar elementos de riego manual (no existe en esta versión)
  document.querySelector('#manual-irrigation')?.setAttribute('disabled', '');
  document.querySelector('#irrigation-dialog')?.setAttribute('hidden', '');
  setText('#irrigation-duration', '—');
  setText('#irrigation-volume', '—');
};

const setupPeriodButtons = (statsHoy, statsSemana, zona) => {
  const buttons = document.querySelectorAll('.period-button');
  buttons.forEach(btn => btn.addEventListener('click', () => {
    const isWeek = btn.textContent.includes('7');
    buttons.forEach(b => {
      b.classList.toggle('is-selected', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    if (isWeek) renderGraficaSemana(statsSemana?.puntos || [], zona.planta?.rango || null);
    else renderGraficaHoy(statsHoy?.puntos || [], zona.planta?.rango || null);
    const stHoy = statsHoy, stSemana = statsSemana;
    setText('#time-in-range', isWeek
      ? (stSemana?.tiempo_en_rango_pct !== null ? `${stSemana.tiempo_en_rango_pct} %` : '—')
      : (stHoy?.tiempo_en_rango_pct !== null ? `${stHoy.tiempo_en_rango_pct} %` : '—'));
    setText('#time-out-range', isWeek
      ? (stSemana?.horas_fuera_rango !== null ? `${stSemana.horas_fuera_rango} h` : '—')
      : (stHoy?.horas_fuera_rango !== null ? `${stHoy.horas_fuera_rango} h` : '—'));
  }));
};

Promise.all([
  fetch(`/api/zonas/${zoneId}`).then(r => { if (!r.ok) throw new Error('zona'); return r.json(); }),
  fetch(`/api/zonas/${zoneId}/estadisticas?periodo=24h`).then(r => r.ok ? r.json() : null),
  fetch(`/api/zonas/${zoneId}/estadisticas?periodo=7d`).then(r => r.ok ? r.json() : null),
])
  .then(([zona, statsHoy, statsSemana]) => {
    // Redirigir si la zona no tiene planta
    if (!zona.planta) {
      window.location.replace(`zona-vacia.html?id=${zoneId}`);
      return;
    }
    renderDetail(zona, statsHoy, statsSemana);
    setupPeriodButtons(statsHoy, statsSemana, zona);
  })
  .catch(() => {
    setText('#detail-title', 'No se pudieron cargar los datos');
    document.querySelector('#detail-alert')?.removeAttribute('hidden');
    setText('#alert-title', 'Error al cargar la zona');
    setText('#alert-detail', 'Intenta actualizar la página.');
  });
