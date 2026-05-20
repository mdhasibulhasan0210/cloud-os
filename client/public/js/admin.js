// Admin Panel JavaScript - MD.Hasibul Hasan Personal Cloud OS
let currentView = 'dashboard';
let currentSubjectId = null, currentSubjectName = '';
let currentChapterId = null, currentChapterName = '';
let allApprovedUsers = [];

document.addEventListener('DOMContentLoaded', () => {
  loadAdminDashboard();
  initAdminNavigation();
  prefetchUsers();
});

async function prefetchUsers() {
  try {
    const r = await app.apiRequest('/users/approved');
    allApprovedUsers = r.users || [];
  } catch(e) {}
}

function initAdminNavigation() {
  const navLinks = document.querySelectorAll('.admin-nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      loadAdminView(link.dataset.view);
    });
  });
}

async function loadAdminView(view) {
  currentView = view;
  const views = {
    dashboard: loadAdminDashboard, users: loadUsersView,
    files: loadFilesView, subjects: loadSubjectsView,
    pending: loadPendingView, broadcasts: loadBroadcastsView,
    settings: loadSettingsView, results: loadResultsView,
    messages: loadMessagesView, notifications: loadNotificationsView
  };
  if (views[view]) await views[view]();
}

async function loadAdminDashboard() {
  try {
    const r = await app.apiRequest('/admin/stats');
    const s = r.stats;
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<h2>Admin Dashboard</h2>
      <div class="grid grid-3 mt-lg">
        <div class="stat-card glass-card"><div class="stat-icon">👥</div><div class="stat-value">${s.users.total}</div><div class="stat-label">Total Users</div><div class="stat-meta text-muted">${s.users.pending} pending</div></div>
        <div class="stat-card glass-card"><div class="stat-icon">📁</div><div class="stat-value">${s.files.total}</div><div class="stat-label">Total Files</div><div class="stat-meta text-muted">${s.files.pending} pending</div></div>
        <div class="stat-card glass-card"><div class="stat-icon">💾</div><div class="stat-value">${s.storage.usedMB}</div><div class="stat-label">Storage (MB)</div></div>
        <div class="stat-card glass-card"><div class="stat-icon">📚</div><div class="stat-value">${s.subjects}</div><div class="stat-label">Subjects</div></div>
        <div class="stat-card glass-card"><div class="stat-icon">📖</div><div class="stat-value">${s.chapters}</div><div class="stat-label">Chapters</div></div>
        <div class="stat-card glass-card"><div class="stat-icon">📢</div><div class="stat-value">${s.broadcasts}</div><div class="stat-label">Broadcasts</div></div>
      </div>`;
  } catch(e) { app.showNotification('Failed to load dashboard', 'error'); }
}

async function loadUsersView() {
  try {
    const r = await app.apiRequest('/users');
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<div class="flex-between mb-lg"><h2>User Management</h2></div>
      <div class="table-responsive"><table class="admin-table"><thead><tr>
        <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th>
      </tr></thead><tbody>
        ${r.users.map(u => `<tr>
          <td data-label="User"><div class="flex" style="align-items:center;gap:.5rem">
            <img src="${u.profilePicture}" style="width:32px;height:32px;border-radius:50%;object-fit:cover"> ${u.username}
          </div></td>
          <td data-label="Email">${u.email}</td>
          <td data-label="Role"><span class="badge">${u.role}</span></td>
          <td data-label="Status"><span class="badge ${u.status==='approved'?'badge-success':u.status==='pending'?'badge-warning':'badge-danger'}">${u.status}</span></td>
          <td data-label="Joined">${app.formatDate(u.createdAt)}</td>
          <td data-label="Actions">
            ${u.role !== 'admin' ? `
              ${u.status === 'pending' ? `<button onclick="approveUser('${u.id}')" class="btn btn-sm btn-primary">Approve</button>` : ''}
              <button onclick="editUser('${u.id}','${u.username}','${u.email}','${u.role}','${u.status}')" class="btn btn-sm btn-secondary">Edit</button>
              <button onclick="deleteUser('${u.id}')" class="btn btn-sm btn-danger">Delete</button>
            ` : '<span class="text-muted">Admin</span>'}
          </td>
        </tr>`).join('')}
      </tbody></table></div>`;
  } catch(e) { app.showNotification('Failed to load users', 'error'); }
}

async function loadSubjectsView() {
  try {
    const r = await app.apiRequest('/subjects');
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<div class="flex-between mb-lg"><h2>Subject Management</h2>
      <button onclick="showCreateSubjectModal()" class="btn btn-primary">+ New Subject</button></div>
      <div class="grid grid-2">
        ${r.subjects.map(s => `<div class="subject-card glass-card">
          <h3>${s.name}</h3>
          <div class="subject-stats text-muted">${s.chapterCount} chapters • ${s.fileCount} files</div>
          <div class="subject-actions mt-md">
            <button onclick="viewSubject('${s.id}','${s.name.replace(/'/g,"\\'")}')" class="btn btn-sm btn-primary">View</button>
            <button onclick="editSubject('${s.id}','${s.name.replace(/'/g,"\\'")}')" class="btn btn-sm btn-secondary">Edit</button>
            <button onclick="deleteSubject('${s.id}')" class="btn btn-sm btn-danger">Delete</button>
          </div>
        </div>`).join('')}
      </div>`;
  } catch(e) { app.showNotification('Failed to load subjects', 'error'); }
}

async function viewSubject(subjectId, subjectName) {
  currentSubjectId = subjectId; currentSubjectName = subjectName;
  try {
    const r = await app.apiRequest(`/subjects/${subjectId}/chapters`);
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<div class="flex-between mb-lg">
      <div><button onclick="loadSubjectsView()" class="btn btn-sm btn-secondary">← Back</button>
      <h2 style="display:inline;margin-left:.5rem">📁 ${subjectName}</h2></div>
      <div style="display:flex;gap:.5rem">
        <button onclick="showCreateChapterModal('${subjectId}','${subjectName.replace(/'/g,"\\'")}')" class="btn btn-primary">+ New Chapter</button>
        <button onclick="showUploadModal('${subjectId}','','${subjectName.replace(/'/g,"\\'")}')" class="btn btn-secondary">⬆ Upload File</button>
      </div></div>
      <div class="chapters-list">
        ${r.chapters.length === 0 ? '<p class="text-muted">No chapters yet</p>' :
          r.chapters.map((ch,i) => `<div class="glass-card" style="padding:.8rem 1rem;margin-bottom:.5rem;display:flex;align-items:center;justify-content:space-between">
            <span style="cursor:pointer;font-weight:600" onclick="viewChapter('${ch.id}','${ch.name.replace(/'/g,"\\'")}')">${i+1}. ${ch.name} <span class="text-muted" style="font-size:.75rem">(${ch.fileCount} files)</span></span>
            <div style="display:flex;gap:.4rem">
              <button onclick="viewChapter('${ch.id}','${ch.name.replace(/'/g,"\\'")}')" class="btn btn-sm btn-primary">Open</button>
              <button onclick="editChapter('${ch.id}','${ch.name.replace(/'/g,"\\'")}')" class="btn btn-sm btn-secondary">Edit</button>
              <button onclick="deleteChapter('${ch.id}')" class="btn btn-sm btn-danger">Delete</button>
            </div>
          </div>`).join('')}
      </div>`;
  } catch(e) { app.showNotification('Failed to load chapters', 'error'); }
}

async function viewChapter(chapterId, chapterName) {
  currentChapterId = chapterId; currentChapterName = chapterName;
  try {
    const r = await app.apiRequest(`/files?chapterId=${chapterId}`);
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<div class="flex-between mb-lg">
      <div><button onclick="viewSubject('${currentSubjectId}','${currentSubjectName.replace(/'/g,"\\'")}')" class="btn btn-sm btn-secondary">← Back</button>
      <h2 style="display:inline;margin-left:.5rem">📄 ${currentSubjectName} › ${chapterName}</h2></div>
      <button onclick="showUploadModal('${currentSubjectId}','${chapterId}','${currentSubjectName.replace(/'/g,"\\'")}')" class="btn btn-primary">⬆ Upload</button>
    </div>
    <div class="table-responsive"><table class="admin-table"><thead><tr>
      <th>File</th><th>Category</th><th>Size</th><th>Download</th><th>Actions</th>
    </tr></thead><tbody>
      ${r.files.length === 0 ? '<tr><td colspan="5" class="text-muted" style="text-align:center">No files in this chapter</td></tr>' :
        r.files.map(f => `<tr>
          <td data-label="File">${f.filename}</td>
          <td data-label="Category"><span class="badge">${f.category}</span></td>
          <td data-label="Size">${app.formatFileSize(f.size)}</td>
          <td data-label="Download"><span class="badge ${f.downloadAllowed?'badge-success':'badge-danger'}">${f.downloadAllowed?'Yes':'No'}</span></td>
          <td data-label="Actions" style="display:flex;gap:.3rem;flex-wrap:wrap">
            <button onclick="toggleDownload('${f.id}',${!f.downloadAllowed})" class="btn btn-sm btn-secondary" title="Toggle download">${f.downloadAllowed?'🔒':'🔓'}</button>
            <button onclick="showShareModal('${f.id}','${f.filename.replace(/'/g,"\\'")}')" class="btn btn-sm btn-secondary" title="Share with users">👥 Share</button>
            <button onclick="deleteFile('${f.id}')" class="btn btn-sm btn-danger" title="Delete">🗑</button>
          </td>
        </tr>`).join('')}
    </tbody></table></div>`;
  } catch(e) { app.showNotification('Failed to load files', 'error'); }
}

function showShareModal(fileId, filename) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  const userList = allApprovedUsers.map(u => `
    <label style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;cursor:pointer">
      <input type="checkbox" class="share-user-cb" value="${u.id}">
      <img src="${u.profilePicture}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">
      <span>${u.username} <span style="color:#6b7280;font-size:.75rem">(${u.email})</span></span>
    </label>`).join('');
  modal.innerHTML = `<div class="modal" style="max-width:420px">
    <h3>👥 Share "${filename}"</h3>
    <div style="margin:.5rem 0">
      <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-weight:600;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:.4rem">
        <input type="checkbox" id="share-all-cb" onchange="toggleAllShare(this)"> Select All
      </label>
      <div style="max-height:260px;overflow-y:auto">${userList || '<p class="text-muted">No approved users</p>'}</div>
    </div>
    <div class="flex gap-sm mt-md">
      <button onclick="submitShare('${fileId}',this)" class="btn btn-primary">Share</button>
      <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function toggleAllShare(cb) {
  document.querySelectorAll('.share-user-cb').forEach(c => c.checked = cb.checked);
}

async function submitShare(fileId, btn) {
  const selected = [...document.querySelectorAll('.share-user-cb:checked')].map(c => c.value);
  if (!selected.length) { app.showNotification('Select at least one user', 'error'); return; }
  try {
    await app.apiRequest('/files/share', { method: 'POST', body: JSON.stringify({ fileId, userIds: selected }) });
    app.showNotification(`Shared with ${selected.length} user(s)`, 'success');
    btn.closest('.modal-overlay').remove();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

async function toggleDownload(fileId, allow) {
  try {
    await app.apiRequest(`/files/${fileId}`, { method: 'PUT', body: JSON.stringify({ downloadAllowed: allow }) });
    app.showNotification(`Download ${allow ? 'enabled' : 'disabled'}`, 'success');
    viewChapter(currentChapterId, currentChapterName);
  } catch(e) { app.showNotification(e.message, 'error'); }
}

function showUploadModal(subjectId, chapterId, subjectName) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal" style="max-width:440px">
    <h3>⬆ Upload File</h3>
    <form id="upload-form-modal">
      <div class="form-group">
        <label class="form-label">File (max 500MB)</label>
        <input type="file" id="upload-file-field" accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx" required style="width:100%;padding:.5rem;background:rgba(0,255,136,.04);border:1px solid rgba(0,255,136,.2);border-radius:7px;color:#e2e8f0">
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select id="upload-cat-field" style="width:100%;padding:.5rem;background:#0a1a12;border:1px solid rgba(0,255,136,.2);border-radius:7px;color:#e2e8f0">
          <option value="pdf">PDF</option><option value="book">Book</option>
          <option value="note">Note</option><option value="sheet">Sheet</option><option value="other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <textarea id="upload-desc-field" rows="2" style="width:100%;padding:.5rem;background:rgba(0,255,136,.04);border:1px solid rgba(0,255,136,.2);border-radius:7px;color:#e2e8f0;resize:none"></textarea>
      </div>
      <div id="upload-prog-wrap" style="display:none;margin-bottom:.75rem">
        <div style="background:rgba(0,255,136,.1);border-radius:4px;height:8px;overflow:hidden">
          <div id="upload-prog-bar" style="height:100%;background:#00ff88;width:0%;transition:width .3s"></div>
        </div>
        <div id="upload-prog-text" style="font-size:.72rem;color:#6b7280;margin-top:.3rem">Uploading 0%</div>
      </div>
      <div class="flex gap-sm">
        <button type="submit" class="btn btn-primary">Upload</button>
        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#upload-form-modal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('upload-file-field').files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', document.getElementById('upload-cat-field').value);
    fd.append('description', document.getElementById('upload-desc-field').value);
    if (subjectId) fd.append('subjectId', subjectId);
    if (chapterId) fd.append('chapterId', chapterId);
    const wrap = document.getElementById('upload-prog-wrap');
    const bar = document.getElementById('upload-prog-bar');
    const txt = document.getElementById('upload-prog-text');
    wrap.style.display = 'block';
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/files/upload'); xhr.withCredentials = true;
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) { const p = Math.round(ev.loaded/ev.total*100); bar.style.width=p+'%'; txt.textContent=`Uploading ${p}%`; }
        };
        xhr.onload = () => { try { const res=JSON.parse(xhr.responseText); if(xhr.status<300&&res.success) resolve(res); else reject(new Error(res.message||'Upload failed')); } catch(err){reject(new Error('Upload failed'));} };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
      });
      bar.style.width='100%'; txt.textContent='Upload complete!';
      app.showNotification('File uploaded!', 'success');
      setTimeout(() => { modal.remove(); if(chapterId) viewChapter(chapterId, currentChapterName); else viewSubject(subjectId, subjectName); }, 700);
    } catch(err) { wrap.style.display='none'; app.showNotification(err.message, 'error'); }
  });
}

function showCreateSubjectModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal"><h3>Create Subject</h3>
    <form id="create-subject-form">
      <div class="form-group"><label class="form-label">Subject Name</label>
        <input type="text" name="name" class="form-input" required autofocus></div>
      <div class="flex gap-sm">
        <button type="submit" class="btn btn-primary">Create</button>
        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
      </div>
    </form></div>`;
  document.body.appendChild(modal);
  modal.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await app.apiRequest('/subjects', { method: 'POST', body: JSON.stringify({ name: e.target.name.value }) });
      app.showNotification('Subject created', 'success'); modal.remove(); loadSubjectsView();
    } catch(err) { app.showNotification(err.message, 'error'); }
  });
}

function editSubject(id, name) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal"><h3>Edit Subject</h3>
    <form id="edit-subject-form">
      <div class="form-group"><label class="form-label">Subject Name</label>
        <input type="text" name="name" class="form-input" value="${name}" required></div>
      <div class="flex gap-sm">
        <button type="submit" class="btn btn-primary">Save</button>
        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
      </div>
    </form></div>`;
  document.body.appendChild(modal);
  modal.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await app.apiRequest(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify({ name: e.target.name.value }) });
      app.showNotification('Subject updated', 'success'); modal.remove(); loadSubjectsView();
    } catch(err) { app.showNotification(err.message, 'error'); }
  });
}

function showCreateChapterModal(subjectId, subjectName) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal"><h3>New Chapter in "${subjectName}"</h3>
    <form id="create-chapter-form">
      <div class="form-group"><label class="form-label">Chapter Name</label>
        <input type="text" name="name" class="form-input" required autofocus></div>
      <div class="flex gap-sm">
        <button type="submit" class="btn btn-primary">Create</button>
        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
      </div>
    </form></div>`;
  document.body.appendChild(modal);
  modal.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await app.apiRequest(`/subjects/${subjectId}/chapters`, { method: 'POST', body: JSON.stringify({ name: e.target.name.value }) });
      app.showNotification('Chapter created', 'success'); modal.remove(); viewSubject(subjectId, subjectName);
    } catch(err) { app.showNotification(err.message, 'error'); }
  });
}

function editChapter(id, name) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal"><h3>Edit Chapter</h3>
    <form id="edit-chapter-form">
      <div class="form-group"><label class="form-label">Chapter Name</label>
        <input type="text" name="name" class="form-input" value="${name}" required></div>
      <div class="flex gap-sm">
        <button type="submit" class="btn btn-primary">Save</button>
        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
      </div>
    </form></div>`;
  document.body.appendChild(modal);
  modal.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await app.apiRequest(`/chapters/${id}`, { method: 'PUT', body: JSON.stringify({ name: e.target.name.value }) });
      app.showNotification('Chapter updated', 'success'); modal.remove(); viewSubject(currentSubjectId, currentSubjectName);
    } catch(err) { app.showNotification(err.message, 'error'); }
  });
}

async function loadPendingView() {
  try {
    const r = await app.apiRequest('/files/pending');
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<h2>Pending Approvals</h2>
      ${r.files.length === 0 ? '<p class="text-muted mt-lg">No pending files</p>' :
        `<div class="grid grid-3 mt-lg">${r.files.map(f => `
          <div class="file-card glass-card">
            <img src="${f.thumbnailPath||'/assets/images/default-thumb.jpg'}" alt="${f.filename}" class="file-card-thumb">
            <div class="file-card-info">
              <div class="file-card-name">${f.filename}</div>
              <div class="file-card-meta text-muted">By ${f.uploadedBy}<br>${app.formatFileSize(f.size)}</div>
              <div class="file-card-actions mt-sm">
                <button onclick="approveFile('${f.id}')" class="btn btn-sm btn-primary">Approve</button>
                <button onclick="rejectFile('${f.id}')" class="btn btn-sm btn-danger">Reject</button>
              </div>
            </div>
          </div>`).join('')}</div>`}`;
  } catch(e) { app.showNotification('Failed to load pending files', 'error'); }
}

async function loadFilesView() {
  try {
    const r = await app.apiRequest('/files');
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<div class="flex-between mb-lg"><h2>All Files</h2></div>
      <div class="grid grid-3">
        ${r.files.map(f => `<div class="file-card glass-card">
          <img src="${f.thumbnailPath||'/assets/images/default-thumb.jpg'}" alt="${f.filename}" class="file-card-thumb">
          <div class="file-card-info">
            <div class="file-card-name">${f.filename}</div>
            <div class="file-card-meta text-muted">${app.formatFileSize(f.size)}</div>
            <div class="file-card-actions mt-sm">
              <button onclick="showShareModal('${f.id}','${f.filename.replace(/'/g,"\\'")}')" class="btn btn-sm btn-secondary">👥 Share</button>
              <button onclick="deleteFile('${f.id}')" class="btn btn-sm btn-danger">Delete</button>
            </div>
          </div>
        </div>`).join('')}
      </div>`;
  } catch(e) { app.showNotification('Failed to load files', 'error'); }
}

async function loadBroadcastsView() {
  try {
    const r = await app.apiRequest('/broadcasts');
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<div class="flex-between mb-lg"><h2>Broadcasts</h2>
      <button onclick="showCreateBroadcastModal()" class="btn btn-primary">+ Create Broadcast</button></div>
      <div class="broadcasts-list">
        ${r.broadcasts.map(b => `<div class="broadcast-card glass-card ${b.pinned?'pinned':''}">
          ${b.pinned?'<span class="badge">Pinned</span>':''}
          <div class="broadcast-message">${b.message}</div>
          <div class="broadcast-meta text-muted mt-sm">${app.formatDate(b.createdAt)}</div>
          <div class="broadcast-actions mt-md">
            <button onclick="togglePin('${b.id}',${!b.pinned})" class="btn btn-sm btn-secondary">${b.pinned?'Unpin':'Pin'}</button>
            <button onclick="deleteBroadcast('${b.id}')" class="btn btn-sm btn-danger">Delete</button>
          </div>
        </div>`).join('')}
      </div>`;
  } catch(e) { app.showNotification('Failed to load broadcasts', 'error'); }
}

async function loadSettingsView() {
  try {
    const r = await app.apiRequest('/admin/settings');
    const s = r.settings;
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<h2>Site Settings</h2>
      <form id="settings-form" class="mt-lg" style="max-width:600px">
        <div class="form-group"><label class="form-label">Tagline</label>
          <input type="text" name="tagline" class="form-input" value="${s.tagline||''}"></div>
        <div class="form-group"><label class="form-label">Bio (Home Page)</label>
          <textarea name="bio" class="form-textarea" rows="4">${s.bio||''}</textarea></div>
        <div class="form-group"><label class="form-label">About Text</label>
          <textarea name="aboutText" class="form-textarea" rows="6">${s.aboutText||''}</textarea></div>
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </form>`;
    document.getElementById('settings-form').addEventListener('submit', saveSettings);
  } catch(e) { app.showNotification('Failed to load settings', 'error'); }
}

async function loadResultsView() {
  try {
    const r = await app.apiRequest('/results');
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<div class="flex-between mb-lg"><h2>Results</h2></div>
      <div class="table-responsive"><table class="admin-table"><thead><tr><th>Title</th><th>GPA</th><th>Date</th><th>Actions</th></tr></thead><tbody>
        ${r.results.map(res => `<tr>
          <td>${res.title}</td><td>${res.gpa}</td><td>${app.formatDate(res.createdAt)}</td>
          <td><button onclick="deleteResult('${res.id}')" class="btn btn-sm btn-danger">Delete</button></td>
        </tr>`).join('')}
      </tbody></table></div>`;
  } catch(e) { app.showNotification('Failed to load results', 'error'); }
}

async function loadMessagesView() {
  const c = document.getElementById('admin-content');
  if (c) c.innerHTML = '<h2>Messages</h2><p class="text-muted mt-lg">Use the Dashboard messaging feature to view conversations.</p>';
}

async function loadNotificationsView() {
  try {
    const r = await app.apiRequest('/notifications');
    const c = document.getElementById('admin-content');
    if (!c) return;
    c.innerHTML = `<div class="flex-between mb-lg"><h2>Notifications</h2>
      <button onclick="markAllRead()" class="btn btn-secondary">Mark All Read</button></div>
      <div>${r.notifications.map(n => `<div class="glass-card" style="padding:.75rem 1rem;margin-bottom:.4rem;display:flex;justify-content:space-between;align-items:center;opacity:${n.read?.8:1}">
        <span>${n.message}</span>
        <span class="text-muted" style="font-size:.72rem">${app.formatDate(n.createdAt)}</span>
      </div>`).join('')}</div>`;
  } catch(e) { app.showNotification('Failed to load notifications', 'error'); }
}

async function saveSettings(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await app.apiRequest('/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
    app.showNotification('Settings saved', 'success');
  } catch(err) { app.showNotification(err.message, 'error'); }
}

async function approveUser(userId) {
  try {
    await app.apiRequest(`/users/${userId}`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) });
    app.showNotification('User approved', 'success'); loadUsersView();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

function editUser(id, username, email, role, status) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal"><h3>Edit User</h3>
    <form id="edit-user-form">
      <div class="form-group"><label class="form-label">Username</label>
        <input type="text" name="username" class="form-input" value="${username}" required></div>
      <div class="form-group"><label class="form-label">Email</label>
        <input type="email" name="email" class="form-input" value="${email}" required></div>
      <div class="form-group"><label class="form-label">Status</label>
        <select name="status" class="form-input">
          <option value="pending" ${status==='pending'?'selected':''}>Pending</option>
          <option value="approved" ${status==='approved'?'selected':''}>Approved</option>
          <option value="suspended" ${status==='suspended'?'selected':''}>Suspended</option>
        </select></div>
      <div class="flex gap-sm">
        <button type="submit" class="btn btn-primary">Save</button>
        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
      </div>
    </form></div>`;
  document.body.appendChild(modal);
  modal.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await app.apiRequest(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      app.showNotification('User updated', 'success'); modal.remove(); loadUsersView();
    } catch(err) { app.showNotification(err.message, 'error'); }
  });
}

async function deleteUser(userId) {
  if (!confirm('Delete this user?')) return;
  try {
    await app.apiRequest(`/users/${userId}`, { method: 'DELETE' });
    app.showNotification('User deleted', 'success'); loadUsersView();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

async function approveFile(fileId) {
  try {
    await app.apiRequest(`/files/approve/${fileId}`, { method: 'PUT' });
    app.showNotification('File approved', 'success'); loadPendingView();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

async function rejectFile(fileId) {
  if (!confirm('Reject and delete this file?')) return;
  try {
    await app.apiRequest(`/files/reject/${fileId}`, { method: 'PUT' });
    app.showNotification('File rejected', 'success'); loadPendingView();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

async function deleteFile(fileId) {
  if (!confirm('Delete this file?')) return;
  try {
    await app.apiRequest(`/files/${fileId}`, { method: 'DELETE' });
    app.showNotification('File deleted', 'success');
    if (currentChapterId) viewChapter(currentChapterId, currentChapterName);
    else loadFilesView();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

async function deleteSubject(id) {
  if (!confirm('Delete subject and all its chapters/files?')) return;
  try {
    await app.apiRequest(`/subjects/${id}`, { method: 'DELETE' });
    app.showNotification('Subject deleted', 'success'); loadSubjectsView();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

async function deleteChapter(id) {
  if (!confirm('Delete chapter and all its files?')) return;
  try {
    await app.apiRequest(`/chapters/${id}`, { method: 'DELETE' });
    app.showNotification('Chapter deleted', 'success'); viewSubject(currentSubjectId, currentSubjectName);
  } catch(e) { app.showNotification(e.message, 'error'); }
}

async function deleteResult(id) {
  if (!confirm('Delete this result?')) return;
  try {
    await app.apiRequest(`/results/${id}`, { method: 'DELETE' });
    app.showNotification('Result deleted', 'success'); loadResultsView();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

async function togglePin(id, pinned) {
  try {
    await app.apiRequest(`/broadcasts/${id}`, { method: 'PUT', body: JSON.stringify({ pinned }) });
    app.showNotification(pinned ? 'Pinned' : 'Unpinned', 'success'); loadBroadcastsView();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

async function deleteBroadcast(id) {
  if (!confirm('Delete this broadcast?')) return;
  try {
    await app.apiRequest(`/broadcasts/${id}`, { method: 'DELETE' });
    app.showNotification('Broadcast deleted', 'success'); loadBroadcastsView();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

function showCreateBroadcastModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal"><h3>Create Broadcast</h3>
    <form id="create-broadcast-form">
      <div class="form-group"><label class="form-label">Message</label>
        <textarea name="message" class="form-textarea" rows="4" required></textarea></div>
      <div class="form-group"><label class="form-label">
        <input type="checkbox" name="pinned" value="true"> Pin this broadcast
      </label></div>
      <div class="flex gap-sm">
        <button type="submit" class="btn btn-primary">Create</button>
        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
      </div>
    </form></div>`;
  document.body.appendChild(modal);
  modal.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await app.apiRequest('/broadcasts', { method: 'POST', body: JSON.stringify({ message: fd.get('message'), pinned: fd.get('pinned')==='true' }) });
      app.showNotification('Broadcast created', 'success'); modal.remove(); loadBroadcastsView();
    } catch(err) { app.showNotification(err.message, 'error'); }
  });
}

async function markAllRead() {
  try {
    await app.apiRequest('/notifications/read-all', { method: 'PUT' });
    app.showNotification('All marked as read', 'success'); loadNotificationsView();
  } catch(e) { app.showNotification(e.message, 'error'); }
}

// Expose globals
window.approveUser = approveUser; window.editUser = editUser; window.deleteUser = deleteUser;
window.approveFile = approveFile; window.rejectFile = rejectFile; window.deleteFile = deleteFile;
window.deleteSubject = deleteSubject; window.editSubject = editSubject; window.viewSubject = viewSubject;
window.showCreateSubjectModal = showCreateSubjectModal; window.showCreateChapterModal = showCreateChapterModal;
window.editChapter = editChapter; window.deleteChapter = deleteChapter; window.viewChapter = viewChapter;
window.showCreateBroadcastModal = showCreateBroadcastModal; window.deleteBroadcast = deleteBroadcast;
window.togglePin = togglePin; window.showShareModal = showShareModal; window.submitShare = submitShare;
window.toggleAllShare = toggleAllShare; window.toggleDownload = toggleDownload;
window.showUploadModal = showUploadModal; window.deleteResult = deleteResult; window.markAllRead = markAllRead;
