// Advanced PDF Viewer with Performance Optimizations
// MD.Hasibul Hasan Personal Cloud OS

class PDFViewer {
  constructor(container, fileUrl) {
    this.container = container;
    this.fileUrl = fileUrl;
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.5;
    this.rendering = false;
    this.pageCache = new Map(); // LRU cache for rendered pages
    this.maxCacheSize = 15;
    this.visiblePages = new Set();
    
    this.init();
  }
  
  async init() {
    try {
      // Show loading skeleton
      this.showSkeleton();
      
      // Load PDF.js
      if (typeof pdfjsLib === 'undefined') {
        await this.loadPDFJS();
      }
      
      // Configure PDF.js worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        url: this.fileUrl,
        rangeChunkSize: 65536, // 64KB chunks for streaming
        disableAutoFetch: true, // Only fetch pages as needed
        disableStream: false
      });
      
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;
      
      // Build UI
      this.buildUI();
      
      // Render first page
      await this.renderPage(1);
      
      // Setup intersection observer for lazy loading
      this.setupIntersectionObserver();
      
      // Preload next page in background
      this.preloadPage(2);
      
    } catch (error) {
      console.error('PDF loading error:', error);
      this.showError('Failed to load PDF. The file may be corrupted.');
    }
  }
  
  async loadPDFJS() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  buildUI() {
    this.container.innerHTML = `
      <div class="pdf-viewer-container">
        <div class="pdf-controls glass-card" style="border-radius: 8px; border: 0.5px solid rgba(0,255,136,0.15);">
          <button onclick="pdfViewer.previousPage()" class="btn btn-secondary" id="prev-page">
            <i class="fas fa-chevron-left"></i> Previous
          </button>
          <span class="page-info">
            Page <input type="number" id="page-input" value="1" min="1" max="${this.totalPages}" style="width: 60px; text-align: center; border-radius: 6px; border: 0.5px solid rgba(0,255,136,0.15);"> / ${this.totalPages}
          </span>
          <button onclick="pdfViewer.nextPage()" class="btn btn-secondary" id="next-page">
            Next <i class="fas fa-chevron-right"></i>
          </button>
          <div class="zoom-controls">
            <button onclick="pdfViewer.zoomOut()" class="btn btn-secondary">
              <i class="fas fa-search-minus"></i>
            </button>
            <span id="zoom-level">${Math.round(this.scale * 100)}%</span>
            <button onclick="pdfViewer.zoomIn()" class="btn btn-secondary">
              <i class="fas fa-search-plus"></i>
            </button>
          </div>
          <button onclick="pdfViewer.close()" class="btn btn-secondary">
            <i class="fas fa-times"></i> Close
          </button>
        </div>
        <div class="pdf-pages-container" id="pdf-pages" style="border-radius: 8px;"></div>
      </div>
    `;
    
    // Page input handler
    document.getElementById('page-input').addEventListener('change', (e) => {
      const page = parseInt(e.target.value);
      if (page >= 1 && page <= this.totalPages) {
        this.goToPage(page);
      }
    });
    
    // Touch gestures for mobile
    if ('ontouchstart' in window) {
      this.setupTouchGestures();
    }
  }
  
  async renderPage(pageNum, forceRender = false) {
    if (this.rendering && !forceRender) return;
    
    // Check cache first
    if (this.pageCache.has(pageNum) && !forceRender) {
      this.displayCachedPage(pageNum);
      return;
    }
    
    this.rendering = true;
    
    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale });
      
      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      
      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.className = 'pdf-page-canvas';
      canvas.dataset.pageNum = pageNum;
      canvas.style.borderRadius = '4px';
      canvas.style.border = '0.5px solid rgba(0,255,136,0.1)';
      canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)';
      
      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Add to cache
      this.addToCache(pageNum, canvas);
      
      // Display page
      this.displayPage(pageNum, canvas);
      
      // Cleanup
      page.cleanup();
      
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
      
      // Retry once
      if (!forceRender) {
        setTimeout(() => this.renderPage(pageNum, true), 1000);
      } else {
        this.showPageError(pageNum);
      }
    } finally {
      this.rendering = false;
    }
  }
  
  displayPage(pageNum, canvas) {
    const container = document.getElementById('pdf-pages');
    
    // Create page wrapper
    let pageWrapper = container.querySelector(`[data-page="${pageNum}"]`);
    if (!pageWrapper) {
      pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper';
      pageWrapper.dataset.page = pageNum;
      container.appendChild(pageWrapper);
    }
    
    // Clear and add canvas
    pageWrapper.innerHTML = '';
    pageWrapper.appendChild(canvas);
    
    this.visiblePages.add(pageNum);
  }
  
  displayCachedPage(pageNum) {
    const canvas = this.pageCache.get(pageNum);
    if (canvas) {
      this.displayPage(pageNum, canvas.cloneNode(true));
    }
  }
  
  addToCache(pageNum, canvas) {
    // Implement LRU cache
    if (this.pageCache.size >= this.maxCacheSize) {
      const firstKey = this.pageCache.keys().next().value;
      this.pageCache.delete(firstKey);
    }
    
    this.pageCache.set(pageNum, canvas.cloneNode(true));
  }
  
  setupIntersectionObserver() {
    const options = {
      root: document.getElementById('pdf-pages'),
      rootMargin: '200px', // Preload pages 200px before they're visible
      threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.dataset.page);
          if (!this.visiblePages.has(pageNum)) {
            this.renderPage(pageNum);
          }
        }
      });
    }, options);
    
    // Observe all page wrappers
    const container = document.getElementById('pdf-pages');
    for (let i = 1; i <= this.totalPages; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page-wrapper skeleton';
      wrapper.dataset.page = i;
      wrapper.style.minHeight = '800px';
      container.appendChild(wrapper);
      observer.observe(wrapper);
    }
  }
  
  async preloadPage(pageNum) {
    if (pageNum > this.totalPages || this.pageCache.has(pageNum)) return;
    
    // Preload in background when idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => this.renderPage(pageNum));
    } else {
      setTimeout(() => this.renderPage(pageNum), 100);
    }
  }
  
  setupTouchGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let pinchDistance = 0;
    
    const container = this.container;
    
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        pinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });
    
    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const newDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        if (newDistance > pinchDistance + 10) {
          this.zoomIn();
          pinchDistance = newDistance;
        } else if (newDistance < pinchDistance - 10) {
          this.zoomOut();
          pinchDistance = newDistance;
        }
      }
    });
    
    container.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // Swipe detection
        if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 50) {
          if (deltaX > 0) {
            this.previousPage();
          } else {
            this.nextPage();
          }
        }
      }
    });
  }
  
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePageDisplay();
      this.scrollToPage(this.currentPage);
      this.preloadPage(this.currentPage + 1);
    }
  }
  
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePageDisplay();
      this.scrollToPage(this.currentPage);
    }
  }
  
  goToPage(pageNum) {
    if (pageNum >= 1 && pageNum <= this.totalPages) {
      this.currentPage = pageNum;
      this.updatePageDisplay();
      this.scrollToPage(pageNum);
    }
  }
  
  scrollToPage(pageNum) {
    const pageWrapper = document.querySelector(`[data-page="${pageNum}"]`);
    if (pageWrapper) {
      pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  
  zoomIn() {
    this.scale = Math.min(this.scale + 0.25, 3);
    this.updateZoom();
  }
  
  zoomOut() {
    this.scale = Math.max(this.scale - 0.25, 0.5);
    this.updateZoom();
  }
  
  updateZoom() {
    document.getElementById('zoom-level').textContent = Math.round(this.scale * 100) + '%';
    
    // Clear cache and properly dispose of canvases
    this.pageCache.forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
    });
    this.pageCache.clear();
    this.visiblePages.clear();
    
    const container = document.getElementById('pdf-pages');
    // Remove all existing canvases
    const existingCanvases = container.querySelectorAll('canvas');
    existingCanvases.forEach(canvas => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
    });
    container.innerHTML = '';
    
    this.setupIntersectionObserver();
  }
  
  updatePageDisplay() {
    const pageInput = document.getElementById('page-input');
    if (pageInput) {
      pageInput.value = this.currentPage;
    }
    
    // Update button states
    document.getElementById('prev-page').disabled = this.currentPage === 1;
    document.getElementById('next-page').disabled = this.currentPage === this.totalPages;
  }
  
  showSkeleton() {
    this.container.innerHTML = `
      <div class="pdf-loading">
        <div class="skeleton" style="width: 100%; height: 600px; border-radius: 1rem;"></div>
        <p class="text-center mt-md">Loading PDF...</p>
      </div>
    `;
  }
  
  showError(message) {
    this.container.innerHTML = `
      <div class="pdf-error glass-card text-center" style="padding: 3rem;">
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444;"></i>
        <h3 class="mt-md">Error Loading PDF</h3>
        <p class="text-muted">${message}</p>
        <button onclick="pdfViewer.close()" class="btn btn-primary mt-md">Close</button>
      </div>
    `;
  }
  
  showPageError(pageNum) {
    const pageWrapper = document.querySelector(`[data-page="${pageNum}"]`);
    if (pageWrapper) {
      pageWrapper.innerHTML = `
        <div class="page-error" style="padding: 2rem; text-align: center; color: #ef4444;">
          <i class="fas fa-exclamation-circle"></i>
          <p>Failed to load page ${pageNum}</p>
        </div>
      `;
    }
  }
  
  close() {
    // Cleanup canvases to prevent memory leaks
    this.pageCache.forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
    });
    this.pageCache.clear();
    
    // Clear all rendered canvases in DOM
    const container = document.getElementById('pdf-pages');
    if (container) {
      const canvases = container.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.width = 0;
        canvas.height = 0;
      });
    }
    
    // Destroy PDF document
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
    
    this.container.innerHTML = '';
    
    // Navigate back or close modal
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/dashboard';
    }
  }
}

// Global instance
let pdfViewer = null;

// Initialize PDF viewer
function initPDFViewer(fileId) {
  const container = document.getElementById('pdf-viewer-container');
  if (!container) return;
  
  const fileUrl = `/api/files/preview/${fileId}`;
  pdfViewer = new PDFViewer(container, fileUrl);
}

// Export for use in other scripts
window.PDFViewer = PDFViewer;
window.initPDFViewer = initPDFViewer;
