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
});

// Global error handlers
function initGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Show user-friendly error message
    const errorMessage = event.reason?.message || 'An unexpected error occurred';
    showNotification(errorMessage, 'error');
    
    // Prevent default browser error handling
    event.preventDefault();
  });
  
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    
    // Show user-friendly error message for critical errors
    if (event.error && !event.error.toString().includes('ResizeObserver')) {
      const errorMessage = event.error?.message || 'An unexpected error occurred';
      showNotification(errorMessage, 'error');
    }
    
    // Don't prevent default for script loading errors
    if (event.filename) {
      console.error(`Script error in ${event.filename}:${event.lineno}:${event.colno}`);
    }
  });
  
  // Handle network errors
  window.addEventListener('offline', () => {
    showNotification('You are offline. Some features may not work.', 'warning', 0);
  });
  
  window.addEventListener('online', () => {
    showNotification('You are back online', 'success', 3000);
  });
}

// Mobile menu toggle
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
  
  // Close on link click
  const sidebarLinks = sidebar.querySelectorAll('a');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        menuBtn.classList.remove('active');
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      }
    });
  });
}

// Smooth scroll
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Form validation
function initFormValidation() {
  const forms = document.querySelectorAll('form[data-validate]');
  
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      if (!validateForm(form)) {
        e.preventDefault();
      }
    });
    
    // Real-time validation
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => {
        if (input.classList.contains('error')) {
          validateField(input);
        }
      });
    });
  });
}

function validateForm(form) {
  let isValid = true;
  const inputs = form.querySelectorAll('input[required], textarea[required]');
  
  inputs.forEach(input => {
    if (!validateField(input)) {
      isValid = false;
    }
  });
  
  return isValid;
}

function validateField(field) {
  const value = field.value.trim();
  const type = field.type;
  let isValid = true;
  let message = '';
  
  // Required check
  if (field.hasAttribute('required') && !value) {
    isValid = false;
    message = 'This field is required';
  }
  
  // Email validation
  if (type === 'email' && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      isValid = false;
      message = 'Please enter a valid email';
    }
  }
  
  // Password validation
  if (type === 'password' && value && field.hasAttribute('data-min-length')) {
    const minLength = parseInt(field.getAttribute('data-min-length'));
    if (value.length < minLength) {
      isValid = false;
      message = `Password must be at least ${minLength} characters`;
    }
  }
  
  // Show/hide error
  if (!isValid) {
    showFieldError(field, message);
  } else {
    clearFieldError(field);
  }
  
  return isValid;
}

function showFieldError(field, message) {
  field.classList.add('error');
  
  let errorEl = field.parentElement.querySelector('.field-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    field.parentElement.appendChild(errorEl);
  }
  
  errorEl.textContent = message;
  errorEl.style.color = '#ef4444';
  errorEl.style.fontSize = '0.875rem';
  errorEl.style.marginTop = '0.25rem';
}

function clearFieldError(field) {
  field.classList.remove('error');
  const errorEl = field.parentElement.querySelector('.field-error');
  if (errorEl) {
    errorEl.remove();
  }
}

// Notifications
function initNotifications() {
  // Create notification container if it doesn't exist
  if (!document.querySelector('.notification-container')) {
    const container = document.createElement('div');
    container.className = 'notification-container';
    container.style.cssText = `
      position: fixed;
      top: 2rem;
      right: 2rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 400px;
    `;
    document.body.appendChild(container);
  }
}

function showNotification(message, type = 'info', duration = 5000) {
  const container = document.querySelector('.notification-container');
  if (!container) return;
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type} glass-card animate-fade-in-right`;
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#06b6d4'
  };
  
  notification.style.cssText = `
    padding: 1rem 1.5rem;
    border-left: 4px solid ${colors[type] || colors.info};
    display: flex;
    align-items: center;
    gap: 1rem;
    min-width: 300px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  `;
  
  notification.innerHTML = `
    <div style="flex: 1;">${message}</div>
    <button onclick="this.parentElement.remove()" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.5rem; padding: 0; line-height: 1;">&times;</button>
  `;
  
  container.appendChild(notification);
  
  if (duration > 0) {
    setTimeout(() => {
      notification.style.animation = 'fadeInRight 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
}

// API helper functions
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(API_BASE + endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

async function apiUpload(endpoint, formData) {
  try {
    const response = await fetch(API_BASE + endpoint, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Upload failed');
    }
    
    return data;
  } catch (error) {
    console.error('Upload Error:', error);
    throw error;
  }
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Format date
function formatDate(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return d.toLocaleDateString();
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Loading state
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

// Modal helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
    document.body.style.overflow = '';
  }
});

// Escape key to close modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
      modal.style.display = 'none';
    });
    document.body.style.overflow = '';
  }
});

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard', 'success', 2000);
  } catch (error) {
    console.error('Copy failed:', error);
    showNotification('Failed to copy', 'error');
  }
}

// Export functions for use in other scripts
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
  copyToClipboard
};

// ── CACHE BUSTING HELPER ──
window.app.cacheBust = function(url) {
  if (!url) return url;
  const timestamp = Date.now();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${timestamp}`;
};

// ── IMAGE CACHE BUSTER ──
window.app.reloadImage = function(imgElement) {
  if (!imgElement || !imgElement.src) return;
  const originalSrc = imgElement.src.split('?')[0]; // Remove existing query params
  imgElement.src = window.app.cacheBust(originalSrc);
};

// ── RELOAD ALL IMAGES ──
window.app.reloadAllImages = function() {
  // Reload all images on the page
  document.querySelectorAll('img').forEach(img => {
    if (img.src && !img.src.includes('data:image')) {
      window.app.reloadImage(img);
    }
  });
  
  // Reload favicon
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    const href = favicon.href.split('?')[0];
    favicon.href = window.app.cacheBust(href);
  }
  
  console.log('All images reloaded with cache busting');
};

// ── PAGE TRANSITION HELPER ──
window.app.transitionView = function(callback) {
  const content = document.getElementById('content') || document.getElementById('main-content');
  if (!content) {
    callback();
    return;
  }
  
  // Add exit animation
  content.style.opacity = '0';
  content.style.transform = 'translateX(-20px)';
  content.style.transition = 'opacity 0.25s ease-in, transform 0.25s ease-in';
  
  // Wait for exit, then load new content
  setTimeout(() => {
    callback();
    
    // Reset and add enter animation
    content.style.opacity = '0';
    content.style.transform = 'translateX(20px)';
    
    requestAnimationFrame(() => {
      content.style.transition = 'opacity 0.35s cubic-bezier(0.16,1,0.3,1), transform 0.35s cubic-bezier(0.16,1,0.3,1)';
      content.style.opacity = '1';
      content.style.transform = 'translateX(0)';
    });
  }, 250);
};

// ── SMOOTH SCROLL TO TOP ──
window.app.scrollToTop = function(smooth = true) {
  const main = document.querySelector('.main') || document.querySelector('.main-inner');
  if (main) {
    main.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
};


// ═══════════════════════════════════════════════════════════
// BENGALI LANGUAGE AUTO-DETECTION
// Automatically detects and applies Bengali font to text
// ═══════════════════════════════════════════════════════════

// Bengali Unicode range: U+0980–U+09FF
function containsBengali(text) {
  if (!text) return false;
  return /[\u0980-\u09FF]/.test(text);
}

// Apply Bengali font to element if it contains Bengali text
function applyBengaliFont(element) {
  if (!element || element.nodeType !== 1) return;
  // Skip interactive elements and icons
  const tag = element.tagName;
  if (!tag || ['SCRIPT','STYLE','I','SVG','CANVAS','IMG','INPUT','SELECT'].includes(tag)) return;
  const text = element.textContent || element.value || '';
  if (containsBengali(text)) {
    element.setAttribute('lang', 'bn');
    element.classList.add('bengali');
  }
}

// Auto-detect Bengali in input fields as user types
function initBengaliInputDetection() {
  document.addEventListener('input', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      applyBengaliFont(e.target);
    }
  });
}

// Initialize Bengali detection — run once on load, not on every mutation
document.addEventListener('DOMContentLoaded', () => {
  initBengaliInputDetection();
});

// Export Bengali detection functions
window.app = window.app || {};
window.app.bengali = {
  containsBengali,
  applyBengaliFont
};
