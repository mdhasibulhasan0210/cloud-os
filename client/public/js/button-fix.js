// Button Click Fix - Ensures all onclick handlers work properly
// This file ensures that all button clicks are properly handled

(function() {
  'use strict';
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  function init() {
    console.log('Button fix initialized');
    
    // Add click event delegation for dynamically created buttons
    document.body.addEventListener('click', function(e) {
      const target = e.target;
      
      // Handle button clicks
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        const button = target.tagName === 'BUTTON' ? target : target.closest('button');
        
        // Add visual feedback
        button.classList.add('anim-button-press');
        setTimeout(() => button.classList.remove('anim-button-press'), 200);
        
        // Log for debugging
        if (button.onclick) {
          console.log('Button clicked:', button.textContent.trim());
        }
      }
    }, true);
    
    // Ensure all onclick attributes are properly executed
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            // Check if the node or its children have onclick attributes
            const buttonsWithOnclick = node.querySelectorAll ? 
              node.querySelectorAll('[onclick]') : [];
            
            buttonsWithOnclick.forEach(function(btn) {
              // Ensure the onclick handler is properly bound
              if (btn.onclick && typeof btn.onclick === 'function') {
                const originalOnclick = btn.onclick;
                btn.onclick = function(e) {
                  try {
                    return originalOnclick.call(this, e);
                  } catch (error) {
                    console.error('Button click error:', error);
                    if (window.app && window.app.showNotification) {
                      window.app.showNotification('Action failed: ' + error.message, 'error');
                    }
                  }
                };
              }
            });
          }
        });
      });
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Add global error handler for onclick errors
  window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('onclick')) {
      console.error('Onclick error:', e);
      e.preventDefault();
    }
  });
  
})();
