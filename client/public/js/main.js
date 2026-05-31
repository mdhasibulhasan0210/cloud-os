// Main JavaScript - MD.Hasibul Hasan Personal Cloud OS

// API base URL
const API_BASE = window.location.origin + '/api';

// Global state
const state = {
  user: null,
  token: null,
  socket: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initSmoothScroll();
  initFormValidation();
  initNotifications();
  initGlobalErrorHandlers();
  initBengaliInputDetection();
});

// ── GLOBAL ERROR HANDLERS ──
function initGlobalErrorHandlers() {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    const msg = event.reason?.message || 'An unexpected error occurred';
    if (typeof showNotification === 'function') showNotification(msg, 'error');
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    if (event.error && !event.error.toString().includes('ResizeObserver')) {
      const msg = event.error?.message || 'An unexpected error occurred';
      if (typeof showNotification === 'function') showNotification(msg, 'error');
    }
    if (event.filename) console.error(`Script error in ${event.filename}:${event.lineno}:${event.colno}`);
  });

  window.addEventListener('offline', () => {
    if (typeof showNotification === 'function')
      showNotification('You are offline. Some features may not work.', 'warning', 0);
  });

  window.addEventListener('online', () => {
    if (typeof showNotification === 'function')
      showNotification('You are back online', 'success', 3000);
  });
}

// ── MOBILE MENU ──
function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!menuBtn || !sidebar) return;

  menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('active');
    sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
  });

  if (overlay) {
    overlay.addEventListener('click', () => {
      menuBtn.classList.remove('active');
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    });
  }

  sidebar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        menuBtn.classList.remove('active');
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      }
    });
  });
}

// ── SMOOTH SCROLL ──
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ── FORM VALIDATION ──
function initFormValidation() {
  document.querySelectorAll('form[data-validate]').forEach(form => {
    form.addEventListener('submit', (e) => { if (!validateForm(form)) e.preventDefault(); });
    form.querySelectorAll('input, textarea').forEach(input => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => { if (input.classList.contains('error')) validateField(input); });
    });
  });
}

function validateForm(form) {
  let isValid = true;
  form.querySelectorAll('input[required], textarea[required]').forEach(input => {
    if (!validateField(input)) isValid = false;
  });
  return isValid;
}

function validateField(field) {
  const value = field.value.trim();
  const type = field.type;
  let isValid = true, message = '';

  if (field.hasAttribute('required') && !value) { isValid = false; message = 'This field is required'; }
  if (type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { isValid = false; message = 'Please enter a valid email'; }
  if (type === 'password' && value && field.hasAttribute('data-min-length')) {
    const min = parseInt(field.getAttribute('data-min-length'));
    if (value.length < min) { isValid = false; message = `Password must be at least ${min} characters`; }
  }

  if (!isValid) showFieldError(field, message);
  else clearFieldError(field);
  return isValid;
}

function showFieldError(field, message) {
  field.classList.add('error');
  let el = field.parentElement.querySelector('.field-error');
  if (!el) { el = document.createElement('div'); el.className = 'field-error'; field.parentElement.appendChild(el); }
  el.textContent = message;
  el.style.cssText = 'color:#ef4444;font-size:0.875rem;margin-top:0.25rem';
}

function clearFieldError(field) {
  field.classList.remove('error');
  const el = field.parentElement.querySelector('.field-error');
  if (el) el.remove();
}

// ── NOTIFICATIONS (CloudOS branded toast) ──
function initNotifications() {
  if (!document.querySelector('.toast-container')) {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
}

function showNotification(message, type = 'info', duration = 5000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const dur = duration > 0 ? duration : 5000;

  toast.innerHTML = `
    <div class="toast-head">
      <div class="toast-logo-icon"><i class="fas fa-cloud"></i></div>
      <span class="toast-brand"><i class="fas fa-cloud" style="font-size:.7rem;margin-right:.3rem"></i>CloudOS</span>
      <div class="toast-status-dot"></div>
    </div>
    <div class="toast-msg">${message}</div>
    <div class="toast-progress"><div class="toast-progress-bar" style="animation-duration:${dur}ms"></div></div>
  `;

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add('hide');
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 450);
    }, dur);
  }
}

// ── API HELPERS ──
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(API_BASE + endpoint, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'include'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

async function apiUpload(endpoint, formData) {
  try {
    const response = await fetch(API_BASE + endpoint, {
      method: 'POST', body: formData, credentials: 'include'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Upload failed');
    return data;
  } catch (error) {
    console.error('Upload Error:', error);
    throw error;
  }
}

// ── UTILITIES ──
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(date) {
  const d = new Date(date), now = new Date(), diff = now - d;
  const seconds = Math.floor(diff / 1000), minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => { clearTimeout(timeout); func(...args); }, wait);
  };
}

function setLoading(element, isLoading) {
  if (isLoading) {
    element.disabled = true;
    element.dataset.originalText = element.textContent;
    element.innerHTML = '<span class="spinner"></span> Loading...';
  } else {
    element.disabled = false;
    element.textContent = element.dataset.originalText || element.textContent;
  }
}

// ── MODAL HELPERS ──
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
    document.body.style.overflow = '';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => { m.style.display = 'none'; });
    document.body.style.overflow = '';
  }
});

// ── CLIPBOARD ──
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard', 'success', 2000);
  } catch (error) {
    showNotification('Failed to copy', 'error');
  }
}

// ── BENGALI AUTO-DETECTION ──
function containsBengali(text) {
  return text ? /[\u0980-\u09FF]/.test(text) : false;
}

function applyBengaliFont(element) {
  if (!element || element.nodeType !== 1) return;
  const tag = element.tagName;
  if (!tag || ['SCRIPT','STYLE','I','SVG','CANVAS','IMG','INPUT','SELECT'].includes(tag)) return;
  const text = element.textContent || element.value || '';
  if (containsBengali(text)) {
    element.setAttribute('lang', 'bn');
    element.classList.add('bengali');
  }
}

function initBengaliInputDetection() {
  document.addEventListener('input', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') applyBengaliFont(e.target);
  });
}

// ── CACHE BUSTING ──
function cacheBust(url) {
  if (!url) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
}

// ── EXPORT GLOBAL APP OBJECT ──
window.app = {
  state,
  apiRequest,
  apiUpload,
  showNotification,
  formatFileSize,
  formatDate,
  debounce,
  setLoading,
  openModal,
  closeModal,
  copyToClipboard,
  cacheBust,
  reloadImage(imgEl) {
    if (!imgEl || !imgEl.src) return;
    imgEl.src = cacheBust(imgEl.src.split('?')[0]);
  },
  reloadAllImages() {
    document.querySelectorAll('img').forEach(img => {
      if (img.src && !img.src.includes('data:image')) this.reloadImage(img);
    });
    const fav = document.querySelector('link[rel="icon"]');
    if (fav) fav.href = cacheBust(fav.href.split('?')[0]);
  },
  transitionView(callback) {
    const content = document.getElementById('content') || document.getElementById('main-content');
    if (!content) { callback(); return; }
    content.style.cssText = 'opacity:0;transform:translateX(-20px);transition:opacity .25s ease-in,transform .25s ease-in';
    setTimeout(() => {
      callback();
      content.style.cssText = 'opacity:0;transform:translateX(20px)';
      requestAnimationFrame(() => {
        content.style.cssText = 'opacity:1;transform:translateX(0);transition:opacity .35s cubic-bezier(0.16,1,0.3,1),transform .35s cubic-bezier(0.16,1,0.3,1)';
      });
    }, 250);
  },
  scrollToTop(smooth = true) {
    const main = document.querySelector('.main') || document.querySelector('.main-inner');
    if (main) main.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  },
  bengali: { containsBengali, applyBengaliFont }
};
