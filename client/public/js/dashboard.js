// Dashboard JavaScript - MD.Hasibul Hasan Personal Cloud OS

let socket = null;
let currentUser = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  initSocket();
  loadDashboardData();
  initFileUpload();
  initSearch();
  updateNotificationBadge();
  
  // Refresh data every 30 seconds
  setInterval(() => {
    updateNotificationBadge();
    loadRecentFiles();
  }, 30000);
});

// Load current user
async function loadCurrentUser() {
  try {
    const response = await app.apiRequest('/auth/me');
    currentUser = response.user;
    app.state.user = currentUser;
    
    // Update UI with user info
    updateUserDisplay();
  } catch (error) {
    console.error('Failed to load user:', error);
    window.location.href = '/auth';
  }
}

// Update user display
function updateUserDisplay() {
  const usernameEl = document.getElementById('username');
  const profilePicEl = document.getElementById('profile-pic');
  
  if (usernameEl) usernameEl.textContent = currentUser.username;
  if (profilePicEl) profilePicEl.src = currentUser.profilePicture;
}

// Initialize Socket.IO
function initSocket() {
  // Get token from cookie
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('token='))
    ?.split('=')[1];
  
  if (!token) return;
  
  socket = io({
    auth: { token }
  });
  
  socket.on('connect', () => {
    console.log('Socket connected');
  });
  
  socket.on('file_shared', (data) => {
    app.showNotification('A file was shared with you', 'info');
    loadRecentFiles();
  });
  
  socket.on('file_approved', (data) => {
    app.showNotification('Your file was approved', 'success');
    loadRecentFiles();
  });
  
  socket.on('new_message', (data) => {
    app.showNotification('New message received', 'info');
    updateNotificationBadge();
  });
  
  socket.on('new_broadcast', (data) => {
    app.showNotification('New broadcast announcement', 'info');
    updateNotificationBadge();
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
}

// Load dashboard data
async function loadDashboardData() {
  await Promise.all([
    loadStats(),
    loadRecentFiles(),
    loadNotifications(),
    loadBroadcasts()
  ]);
}

// Load stats
async function loadStats() {
  try {
    const [filesRes, notifRes] = await Promise.all([
      app.apiRequest('/files?personal=true'),
      app.apiRequest('/notifications/unread-count')
    ]);
    
    const statsEl = document.getElementById('dashboard-stats');
    if (!statsEl) return;
    statsEl.innerHTML = `
      <div class="stat-card glass-card">
        <div class="stat-icon">📁</div>
        <div class="stat-value">${filesRes.files.length}</div>
        <div class="stat-label">My Files</div>
      </div>
      <div class="stat-card glass-card">
        <div class="stat-icon">🔔</div>
        <div class="stat-value">${notifRes.count}</div>
        <div class="stat-label">Notifications</div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// Load recent files
async function loadRecentFiles() {
  try {
    const response = await app.apiRequest('/files?personal=true');
    const files = response.files.slice(0, 10);
    
    const container = document.getElementById('recent-files');
    if (!container) return;
    
    if (files.length === 0) {
      container.innerHTML = '<p class="text-muted">No files yet</p>';
      return;
    }
    
    container.innerHTML = files.map(file => `
      <div class="file-item glass-card hover-lift" onclick="viewFile('${file.id}')">
        <img src="${file.thumbnailPath}" alt="${file.filename}" class="file-thumb">
        <div class="file-info">
          <div class="file-name">${file.filename}</div>
          <div class="file-meta text-muted">
            ${app.formatFileSize(file.size)} • ${app.formatDate(file.createdAt)}
          </div>
        </div>
        <div class="file-actions">
          <button onclick="event.stopPropagation(); shareFile('${file.id}')" class="btn-icon" title="Share">
            <i class="fas fa-share"></i>
          </button>
          <button onclick="event.stopPropagation(); deleteFile('${file.id}')" class="btn-icon" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load files:', error);
  }
}

// Load notifications
async function loadNotifications() {
  try {
    const response = await app.apiRequest('/notifications');
    const notifications = response.notifications.slice(0, 5);
    
    const container = document.getElementById('notifications-list');
    if (!container) return;
    
    if (notifications.length === 0) {
      container.innerHTML = '<p class="text-muted">No notifications</p>';
      return;
    }
    
    container.innerHTML = notifications.map(notif => `
      <div class="notification-item ${notif.read ? '' : 'unread'}" onclick="markNotificationRead('${notif.id}')">
        <div class="notification-icon">${getNotificationIcon(notif.type)}</div>
        <div class="notification-content">
          <div class="notification-message">${notif.message}</div>
          <div class="notification-time text-muted">${app.formatDate(notif.createdAt)}</div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load notifications:', error);
  }
}

// Load broadcasts
async function loadBroadcasts() {
  try {
    const response = await app.apiRequest('/broadcasts');
    const broadcasts = response.broadcasts.slice(0, 3);
    
    const container = document.getElementById('broadcasts-list');
    if (!container) return;
    
    if (broadcasts.length === 0) {
      container.innerHTML = '<p class="text-muted">No broadcasts</p>';
      return;
    }
    
    container.innerHTML = broadcasts.map(broadcast => `
      <div class="broadcast-item glass-card ${broadcast.pinned ? 'pinned' : ''}">
        ${broadcast.pinned ? '<span class="badge">Pinned</span>' : ''}
        <div class="broadcast-message">${broadcast.message}</div>
        <div class="broadcast-time text-muted">${app.formatDate(broadcast.createdAt)}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load broadcasts:', error);
  }
}

// Update notification badge
async function updateNotificationBadge() {
  try {
    const response = await app.apiRequest('/notifications/unread-count');
    const badge = document.getElementById('notification-badge');
    
    if (badge) {
      if (response.count > 0) {
        badge.textContent = response.count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Failed to update badge:', error);
  }
}

// Get notification icon
function getNotificationIcon(type) {
  const icons = {
    share: '📤',
    broadcast: '📢',
    message: '💬',
    approval: '✅'
  };
  return icons[type] || '🔔';
}

// Mark notification as read
async function markNotificationRead(id) {
  try {
    await app.apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
    loadNotifications();
    updateNotificationBadge();
  } catch (error) {
    console.error('Failed to mark notification:', error);
  }
}

// Initialize file upload
function initFileUpload() {
  const uploadForm = document.getElementById('upload-form');
  if (!uploadForm) return;
  
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(uploadForm);
    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    
    try {
      app.setLoading(submitBtn, true);
      
      const response = await app.apiUpload('/files/upload', formData);
      
      app.showNotification(response.message, 'success');
      uploadForm.reset();
      app.closeModal('upload-modal');
      loadRecentFiles();
      loadStats();
    } catch (error) {
      app.showNotification(error.message, 'error');
    } finally {
      app.setLoading(submitBtn, false);
    }
  });
}

// View file
async function viewFile(fileId) {
  window.location.href = `/explorer?file=${fileId}`;
}

// Share file
async function shareFile(fileId) {
  try {
    // Load approved users
    const response = await app.apiRequest('/users/approved');
    const users = response.users;
    
    // Show share modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h3>Share File</h3>
        <p class="text-muted mb-md">Select users to share with:</p>
        <form id="share-form">
          <div class="user-list" style="max-height: 300px; overflow-y: auto;">
            ${users.map(user => `
              <label class="user-checkbox" style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 0.5rem; cursor: pointer;">
                <input type="checkbox" name="users" value="${user.id}">
                <img src="${user.profilePicture}" alt="${user.username}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                <div>
                  <div>${user.username}</div>
                  <div class="text-muted" style="font-size: 0.875rem;">${user.email}</div>
                </div>
              </label>
            `).join('')}
          </div>
          <div class="flex gap-sm mt-md">
            <button type="submit" class="btn btn-primary">Share</button>
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const shareForm = modal.querySelector('#share-form');
    shareForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const selectedUsers = Array.from(shareForm.querySelectorAll('input[name="users"]:checked'))
        .map(input => input.value);
      
      if (selectedUsers.length === 0) {
        app.showNotification('Please select at least one user', 'warning');
        return;
      }
      
      try {
        await app.apiRequest('/files/share', {
          method: 'POST',
          body: JSON.stringify({
            fileId,
            userIds: selectedUsers
          })
        });
        
        app.showNotification('File shared successfully', 'success');
        modal.remove();
      } catch (error) {
        app.showNotification(error.message, 'error');
      }
    });
  } catch (error) {
    app.showNotification('Failed to load users', 'error');
  }
}

// Delete file
async function deleteFile(fileId) {
  if (!confirm('Are you sure you want to delete this file?')) return;
  
  try {
    await app.apiRequest(`/files/${fileId}`, { method: 'DELETE' });
    app.showNotification('File deleted successfully', 'success');
    loadRecentFiles();
    loadStats();
  } catch (error) {
    app.showNotification(error.message, 'error');
  }
}

// Initialize search
function initSearch() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;
  
  const debouncedSearch = app.debounce(performSearch, 300);
  searchInput.addEventListener('input', debouncedSearch);
}

// Perform search
async function performSearch(e) {
  const query = e.target.value.trim();
  
  if (query.length < 2) {
    hideSearchResults();
    return;
  }
  
  try {
    const response = await app.apiRequest(`/files?personal=true`);
    const results = response.files.filter(file => 
      file.filename.toLowerCase().includes(query.toLowerCase())
    );
    
    showSearchResults(results);
  } catch (error) {
    console.error('Search failed:', error);
  }
}

// Show search results
function showSearchResults(results) {
  let resultsContainer = document.getElementById('search-results');
  
  if (!resultsContainer) {
    resultsContainer = document.createElement('div');
    resultsContainer.id = 'search-results';
    resultsContainer.className = 'search-results glass-card';
    resultsContainer.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 0.5rem;
      max-height: 400px;
      overflow-y: auto;
      z-index: 100;
    `;
    
    const searchInput = document.getElementById('search-input');
    searchInput.parentElement.style.position = 'relative';
    searchInput.parentElement.appendChild(resultsContainer);
  }
  
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="text-muted" style="padding: 1rem;">No results found</div>';
  } else {
    resultsContainer.innerHTML = results.map(file => `
      <div class="search-result-item" onclick="viewFile('${file.id}')" style="padding: 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border);">
        <div style="font-weight: 500;">${file.filename}</div>
        <div class="text-muted" style="font-size: 0.875rem;">${app.formatFileSize(file.size)}</div>
      </div>
    `).join('');
  }
  
  resultsContainer.style.display = 'block';
}

// Hide search results
function hideSearchResults() {
  const resultsContainer = document.getElementById('search-results');
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
}

// Logout
async function logout() {
  try {
    await app.apiRequest('/auth/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

// Make functions globally available
window.viewFile = viewFile;
window.shareFile = shareFile;
window.deleteFile = deleteFile;
window.markNotificationRead = markNotificationRead;
window.logout = logout;
