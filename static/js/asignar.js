// asignar.js — usa PUT /api/zonas/{id}/planta; sin localStorage

const zoneId = new URLSearchParams(window.location.search).get('id') || '4';
const options = document.querySelector('#plant-options');
document.querySelector('#assign-zone-number').textContent = zoneId;

const createElement = (tag, cls, text) => {
  const el = document.createElement(tag); if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text; return el;
};

const createPlantOption = (plant, onAssign) => {
  const article = createElement('article', 'plant-option');
  const image = document.createElement('img');
  image.src = plant.imagen_ruta || plant.imagen || 'assets/plant-empty.svg';
  image.alt = plant.nombre_comun || plant.nombre || plant.planta || '';
  image.width = 180; image.height = 110;
  const content = document.createElement('div');
  const title = createElement('h2', '', plant.nombre_comun || plant.nombre || plant.planta);
  const detail = createElement('p', '', `Rango ${plant.humedad_min ?? plant.rango?.[0] ?? '?'}–${plant.humedad_max ?? plant.rango?.[1] ?? '?'} %`);
  const button = createElement('button', 'button button--primary', 'Asignar');
  button.type = 'button';
  button.addEventListener('click', () => onAssign(plant.id || plant.id_planta));
  content.append(title, detail, button);
  article.append(image, content);
  return article;
};

const asignar = (idPlanta) => {
  fetch(`/api/zonas/${zoneId}/planta`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_planta: idPlanta }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok) window.location.href = 'index.html';
      else options.prepend(createElement('p', 'error-msg', data.detalle || 'Error al asignar.'));
    })
    .catch(() => options.prepend(createElement('p', 'error-msg', 'Error de conexión.')));
};

fetch('/api/plantas?activa=true')
  .then(r => r.json())
  .then(plantas => plantas.forEach(p => options.append(createPlantOption(p, asignar))))
  .catch(() => { options.textContent = 'No se pudieron cargar las plantas disponibles.'; });
