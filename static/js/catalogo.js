// catalogo.js — consume /api/plantas; sin localStorage

const catalogGrid = document.querySelector('#catalog-grid');

const createPlantCard = (plant) => {
  const card = document.createElement('article');
  card.className = 'catalog-card';
  const image = document.createElement('img');
  image.src = plant.imagen_ruta || plant.imagen || 'assets/plant-empty.svg';
  image.alt = plant.nombre_comun || plant.planta || '';
  image.width = 360; image.height = 220;
  const content = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = plant.nombre_comun || plant.planta;
  const range = document.createElement('strong');
  range.textContent = `Rango de humedad ${plant.humedad_min ?? plant.rango?.[0] ?? '?'}–${plant.humedad_max ?? plant.rango?.[1] ?? '?'} %`;
  const description = document.createElement('p');
  description.className = 'catalog-description';
  description.textContent = plant.descripcion || plant.necesidad || 'Necesidades no registradas.';
  content.append(heading, range, description);
  card.append(image, content);
  card.tabIndex = 0;
  card.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.catalog-card.is-expanded').forEach(i => { if (i !== card) i.classList.remove('is-expanded'); });
    card.classList.toggle('is-expanded');
  });
  card.addEventListener('mouseleave', () => card.classList.remove('is-expanded'));
  return card;
};

document.addEventListener('click', () => {
  document.querySelectorAll('.catalog-card.is-expanded').forEach(c => c.classList.remove('is-expanded'));
});

fetch('/api/plantas')
  .then(r => r.json())
  .then(plantas => plantas.forEach(p => catalogGrid.append(createPlantCard(p))))
  .catch(() => { catalogGrid.textContent = 'No se pudo cargar el catálogo.'; });
