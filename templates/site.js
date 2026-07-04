// 图库 lightbox
const lightbox = document.getElementById('lightbox');
if (lightbox) {
  const img = lightbox.querySelector('img');
  const cap = lightbox.querySelector('figcaption');
  document.querySelectorAll('.photo').forEach((fig) => {
    fig.addEventListener('click', () => {
      img.src = fig.querySelector('img').src;
      cap.textContent = fig.querySelector('figcaption').textContent;
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
    });
  });
  const close = () => {
    lightbox.hidden = true;
    document.body.style.overflow = '';
  };
  lightbox.addEventListener('click', close);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && close());
}
