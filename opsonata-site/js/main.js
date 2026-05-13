/* ── OpSonata site — main.js ─────────────────── */

// ── Nav scroll state ─────────────────────────
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav?.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── Mobile menu ──────────────────────────────
const hamburger   = document.querySelector('.hamburger');
const mobileMenu  = document.querySelector('.mobile-menu');

hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu?.classList.toggle('open');
});

// Close on link click
mobileMenu?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    hamburger?.classList.remove('open');
    mobileMenu?.classList.remove('open');
  });
});

// ── Scroll-triggered animations ───────────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      const delay = entry.target.dataset.delay || 0;
      setTimeout(() => entry.target.classList.add('in-view'), Number(delay));
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

// ── Contact form ──────────────────────────────
const contactForm = document.getElementById('contact-form');
contactForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  const btn = contactForm.querySelector('button[type="submit"]');
  const success = document.getElementById('form-success');

  btn.disabled = true;
  btn.textContent = 'Invio in corso…';

  // Simulate async send (replace with real fetch/action)
  setTimeout(() => {
    contactForm.style.display = 'none';
    if (success) {
      success.style.display = 'block';
    }
  }, 1200);
});

// ── Cookie banner ─────────────────────────────
const cookieBanner  = document.getElementById('cookie-banner');
const cookieAccept  = document.getElementById('cookie-accept');
const cookieDecline = document.getElementById('cookie-decline');
const COOKIE_KEY    = 'OpSonata.cookie-consent';

if (cookieBanner && !localStorage.getItem(COOKIE_KEY)) {
  setTimeout(() => cookieBanner.classList.add('visible'), 800);
}

cookieAccept?.addEventListener('click', () => {
  localStorage.setItem(COOKIE_KEY, 'accepted');
  cookieBanner?.classList.remove('visible');
});

cookieDecline?.addEventListener('click', () => {
  localStorage.setItem(COOKIE_KEY, 'declined');
  cookieBanner?.classList.remove('visible');
});

// ── Counter animation (hero stats) ───────────
function animateCounter(el, end, duration = 1400) {
  const start = performance.now();
  const from  = 0;
  const suffix = el.dataset.suffix || '';
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const value = Math.round(from + (end - from) * easeOut(progress));
    el.textContent = value.toLocaleString('it-IT') + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('[data-count]').forEach(el => {
        animateCounter(el, Number(el.dataset.count), 1600);
      });
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.hero-stats').forEach(el => statsObserver.observe(el));

// ── Smooth active nav link on scroll ─────────
const sections  = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navAnchors.forEach(a => {
        a.style.color = a.getAttribute('href') === '#' + entry.target.id
          ? 'var(--text)' : '';
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => sectionObserver.observe(s));
