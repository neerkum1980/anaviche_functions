const nav = document.querySelector('nav');
const panels = document.querySelectorAll('.panel');

if (nav) {
  const toggleNav = () => {
    nav.classList.toggle('scrolled', window.scrollY > 12);
  };

  toggleNav();
  window.addEventListener('scroll', toggleNav);
}

if (panels.length > 0) {
  const observer = new IntersectionObserver(
    (entries, entryObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          entryObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  panels.forEach((panel) => observer.observe(panel));
}