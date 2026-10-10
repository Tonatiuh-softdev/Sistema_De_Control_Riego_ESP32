const zoneId = new URLSearchParams(window.location.search).get('id') || '4';
const options = document.querySelector('#plant-options');
document.querySelector('#assign-zone-number').textContent = zoneId;

const createPlantOption = (plant, onAssign) => {
  const article = document.createElement('article');
  article.className = 'plant-option';
  const image = document.createElement('img');
  image.src = plant.imagen;
  image.alt = plant.alt;
  image.width = 180;
  image.height = 110;
  const content = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = plant.planta;
  const detail = document.createElement('p');
  detail.textContent = `Rango ${plant.rango[0]}–${plant.rango[1]} % · ${plant.necesidad || 'Planta disponible para asignación'}`;
  const button = document.createElement('button');
  button.className = 'button button--primary';
  button.type = 'button';
  button.textContent = 'Asignar';
  button.addEventListener('click', () => onAssign(plant.planta));
  content.append(title, detail, button);
  article.append(image, content);
  return article;
};

fetch('data/zonas.json?v=3')
  .then((response) => response.json())
  .then((data) => {
    [...data.zonas.filter((zone) => zone.planta), ...data.plantasDisponibles].forEach((plant) => {
      options.append(createPlantOption(plant, (plantName) => {
        const assignments = JSON.parse(localStorage.getItem('zoneAssignments') || '{}');
        assignments[zoneId] = plantName;
        localStorage.setItem('zoneAssignments', JSON.stringify(assignments));
        window.location.href = 'index.html';
      }));
    });
  })
  .catch(() => {
    options.textContent = 'No se pudieron cargar las plantas disponibles.';
  });