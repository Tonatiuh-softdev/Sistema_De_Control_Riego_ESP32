const catalogGrid = document.querySelector('#catalog-grid');

const createPlantCard = (plant) => {
  const card = document.createElement('article');
  card.className = 'catalog-card';
  const image = document.createElement('img');
  image.src = plant.imagen;
  image.alt = plant.alt;
  image.width = 360;
  image.height = 220;
  const content = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = plant.planta;
  const range = document.createElement('strong');
  range.textContent = `Rango de humedad ${plant.rango[0]}–${plant.rango[1]} %`;
  const description = document.createElement('p');
  description.className = 'catalog-description';
  description.textContent = plant.descripcion || plant.necesidad || 'Necesidades no registradas.';
  content.append(heading, range, description);
  card.append(image, content);
  card.tabIndex = 0;
  card.addEventListener('click', (event) => {
    event.stopPropagation();
    document.querySelectorAll('.catalog-card.is-expanded').forEach((item) => {
      if (item !== card) item.classList.remove('is-expanded');
    });
    card.classList.toggle('is-expanded');
  });
  card.addEventListener('mouseleave', () => card.classList.remove('is-expanded'));
  return card;
};

document.addEventListener('click', () => {
  document.querySelectorAll('.catalog-card.is-expanded').forEach((card) => card.classList.remove('is-expanded'));
});

fetch('data/zonas.json?v=3')
  .then((response) => response.json())
  .then((data) => {
    [...data.zonas.filter((zone) => zone.planta), ...data.plantasDisponibles].forEach((plant) => catalogGrid.append(createPlantCard(plant)));
  })
  .catch(() => {
    catalogGrid.textContent = 'No se pudo cargar el catálogo.';
  });