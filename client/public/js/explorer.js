// Subject Explorer - MD.Hasibul Hasan Personal Cloud OS

let currentSubject = null;
let currentChapter = null;

document.addEventListener('DOMContentLoaded', () => {
  loadSubjects();
  
  // Check if file ID in URL
  const urlParams = new URLSearchParams(window.location.search);
  const fileId = urlParams.get('file');
  if (fileId) {
    initPDFViewer(fileId);
  }
});

// Load subjects
async function loadSubjects() {
  try {
    const response = await app.apiRequest('/subjects');
    const subjects = response.subjects;
    
    const container = document.getElementById('subjects-container');
    if (!container) return;
    
    if (subjects.length === 0) {
      container.innerHTML = '<p class="text-muted">No subjects available</p>';
      return;
    }
    
    container.innerHTML = subjects.map(subject => `
      <div class="subject-card glass-card hover-lift stagger-item" onclick="loadChapters('${subject.id}', '${subject.name}')">
        <div class="subject-icon">📚</div>
        <h3>${subject.name}</h3>
        <div class="subject-stats text-muted">
          ${subject.chapterCount} chapters • ${subject.fileCount} files
        </div>
      </div>
    `).join('');
  } catch (error) {
    app.showNotification('Failed to load subjects', 'error');
  }
}

// Load chapters
async function loadChapters(subjectId, subjectName) {
  currentSubject = subjectId;
  
  try {
    const response = await app.apiRequest(`/subjects/${subjectId}/chapters`);
    const chapters = response.chapters;
    
    const container = document.getElementById('chapters-container');
    const breadcrumb = document.getElementById('breadcrumb');
    
    if (!container) return;
    
    // Update breadcrumb
    if (breadcrumb) {
      breadcrumb.innerHTML = `
        <span onclick="showSubjects()" class="breadcrumb-link">Subjects</span>
        <span class="breadcrumb-separator">/</span>
        <span>${subjectName}</span>
      `;
    }
    
    // Show chapters view
    document.getElementById('subjects-view').style.display = 'none';
    document.getElementById('chapters-view').style.display = 'block';
    document.getElementById('files-view').style.display = 'none';
    
    if (chapters.length === 0) {
      container.innerHTML = '<p class="text-muted">No chapters in this subject</p>';
      return;
    }
    
    container.innerHTML = chapters.map((chapter, index) => `
      <div class="chapter-card glass-card hover-lift stagger-item" onclick="loadFiles('${chapter.id}', '${chapter.name}', '${subjectName}')">
        <div class="chapter-number">${index + 1}</div>
        <div class="chapter-info">
          <h4>${chapter.name}</h4>
          <div class="chapter-stats text-muted">${chapter.fileCount} files</div>
        </div>
        <i class="fas fa-chevron-right"></i>
      </div>
    `).join('');
  } catch (error) {
    app.showNotification('Failed to load chapters', 'error');
  }
}

// Load files
async function loadFiles(chapterId, chapterName, subjectName) {
  currentChapter = chapterId;
  
  try {
    const response = await app.apiRequest(`/files?chapterId=${chapterId}`);
    const files = response.files;
    
    const container = document.getElementById('files-container');
    const breadcrumb = document.getElementById('breadcrumb');
    
    if (!container) return;
    
    // Update breadcrumb
    if (breadcrumb) {
      breadcrumb.innerHTML = `
        <span onclick="showSubjects()" class="breadcrumb-link">Subjects</span>
        <span class="breadcrumb-separator">/</span>
        <span onclick="loadChapters('${currentSubject}', '${subjectName}')" class="breadcrumb-link">${subjectName}</span>
        <span class="breadcrumb-separator">/</span>
        <span>${chapterName}</span>
      `;
    }
    
    // Show files view
    document.getElementById('subjects-view').style.display = 'none';
    document.getElementById('chapters-view').style.display = 'none';
    document.getElementById('files-view').style.display = 'block';
    
    if (files.length === 0) {
      container.innerHTML = '<p class="text-muted">No files in this chapter</p>';
      return;
    }
    
    container.innerHTML = files.map(file => `
      <div class="file-card glass-card hover-lift stagger-item">
        <img src="${file.thumbnailPath}" alt="${file.filename}" class="file-card-thumb" onclick="viewFile('${file.id}')">
        <div class="file-card-info">
          <div class="file-card-name" onclick="viewFile('${file.id}')">${file.filename}</div>
          <div class="file-card-category">
            <span class="badge">${file.category}</span>
          </div>
          <div class="file-card-meta text-muted">
            ${app.formatFileSize(file.size)} • ${app.formatDate(file.createdAt)}
          </div>
          ${file.description ? `<div class="file-card-desc text-muted">${file.description}</div>` : ''}
          <div class="file-card-actions mt-sm">
            <button onclick="viewFile('${file.id}')" class="btn btn-sm btn-primary">
              <i class="fas fa-eye"></i> View
            </button>
            ${file.downloadAllowed ? `
              <button onclick="downloadFile('${file.id}', '${file.filename}')" class="btn btn-sm btn-secondary">
                <i class="fas fa-download"></i> Download
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    app.showNotification('Failed to load files', 'error');
  }
}

// Show subjects view
function showSubjects() {
  document.getElementById('subjects-view').style.display = 'block';
  document.getElementById('chapters-view').style.display = 'none';
  document.getElementById('files-view').style.display = 'none';
  
  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = '<span>Subjects</span>';
  }
}

// View file
function viewFile(fileId) {
  window.location.href = `/explorer?file=${fileId}`;
}

// Download file
async function downloadFile(fileId, filename) {
  try {
    // Use direct link instead of loading into memory
    const downloadUrl = `/api/files/preview/${fileId}?download=true`;
    
    // Create temporary link and trigger download
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
    
    app.showNotification('Download started', 'success');
  } catch (error) {
    console.error('Download error:', error);
    app.showNotification('Download failed', 'error');
  }
}

// Make functions global
window.loadChapters = loadChapters;
window.loadFiles = loadFiles;
window.showSubjects = showSubjects;
window.viewFile = viewFile;
window.downloadFile = downloadFile;
