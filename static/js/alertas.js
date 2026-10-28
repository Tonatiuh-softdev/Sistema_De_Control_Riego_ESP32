// alertas.js — consume /api/alertas y PATCH /api/alertas/{id}

const alertsList = document.querySelector('#alerts-list');

const TIPO_LABEL = {
  humedad_baja: 'Humedad baja',
  sobrehumedad: 'Sobrehumedad',
  sin_reporte: 'Nodo sin conexión',
  bateria_baja: 'Batería baja',
  lectura_invalida: 'Lectura inválida',
};

const KIND_MAP = {
  humedad_baja: 'low',
  sobrehumedad: 'high',
  sin_reporte: 'offline',
  bateria_baja: 'battery',
  lectura_invalida: 'invalid',
};

const createAlert = (alerta) => {
  const article = document.createElement('article');
  article.className = `alert-item alert-item--${KIND_MAP[alerta.tipo] || 'low'}`;
  article.dataset.id = alerta.id;

  const icon = document.createElement('span');
  icon.className = 'alert-item-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '!';

  const content = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = `${alerta.zona} · ${TIPO_LABEL[alerta.tipo] || alerta.tipo}`;
  const description = document.createElement('p');
  description.textContent = alerta.timestamp_apertura
    ? `Desde ${new Intl.DateTimeFormat('es-MX', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(alerta.timestamp_apertura))}`
    : '';
  content.append(heading, description);

  const link = document.createElement('a');
  link.href = `zona.html?id=${alerta.id_zona}`;
  link.textContent = 'Ver zona →';

  const btn = document.createElement('button');
  btn.className = 'button button--secondary';
  btn.textContent = 'Marcar resuelta';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Resolviendo…';
    fetch(`/api/alertas/${alerta.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'resuelta' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          article.style.opacity = '0.4';
          setTimeout(() => { article.remove(); if (!alertsList.children.length) alertsList.textContent = 'No hay alertas activas.'; }, 600);
        } else {
          btn.disabled = false;
          btn.textContent = 'Marcar resuelta';
        }
      })
      .catch(() => { btn.disabled = false; btn.textContent = 'Marcar resuelta'; });
  });

  article.append(icon, content, link, btn);
  return article;
};

fetch('/api/alertas?estado=activa')
  .then(r => r.json())
  .then(alertas => {
    if (!alertas.length) { alertsList.textContent = 'No hay alertas activas.'; return; }
    alertas.forEach(a => alertsList.append(createAlert(a)));
  })
  .catch(() => { alertsList.textContent = 'No se pudieron cargar las alertas.'; });
