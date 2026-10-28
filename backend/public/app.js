const API_BASE = '/api';

// State
let currentUser = null;
let currentToken = localStorage.getItem('applytrack_token') || null;
let applicationsList = [];

// DOM Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const navUserSection = document.getElementById('nav-user-section');
const currentUsernameSpan = document.getElementById('current-username');
const logoutBtn = document.getElementById('logout-btn');

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const addAppBtn = document.getElementById('add-app-btn');
const appsTableBody = document.getElementById('apps-table-body');
const emptyState = document.getElementById('empty-state');

// Modal Elements
const appModal = document.getElementById('app-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const appForm = document.getElementById('app-form');
const modalTitle = document.getElementById('modal-title');
const modalAppId = document.getElementById('modal-app-id');
const modalCompany = document.getElementById('modal-company');
const modalRole = document.getElementById('modal-role');
const modalStatus = document.getElementById('modal-status');
const modalAppliedDate = document.getElementById('modal-applied-date');
const modalLink = document.getElementById('modal-link');
const modalInterviewDate = document.getElementById('modal-interview-date');
const modalNotes = document.getElementById('modal-notes');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statApplied = document.getElementById('stat-applied');
const statInterview = document.getElementById('stat-interview');
const statOffer = document.getElementById('stat-offer');
const statRejected = document.getElementById('stat-rejected');
const statGhosted = document.getElementById('stat-ghosted');

// --- Helper Functions ---

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getTodayDateString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// --- API Request Wrapper ---

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && currentToken) {
    // Session expired
    showToast('Session expired. Please log in again.', 'error');
    logout();
    throw new Error('Session expired');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || 'Something went wrong';
    throw new Error(errorMsg);
  }

  return data;
}

// --- Authentication Flow ---

async function checkSession() {
  if (!currentToken) {
    showAuthView();
    return;
  }

  try {
    const data = await apiRequest('/auth/me');
    currentUser = data.user;
    showDashboardView();
  } catch (err) {
    logout();
  }
}

function showAuthView() {
  authSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  navUserSection.classList.add('hidden');
}

function showDashboardView() {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  navUserSection.classList.remove('hidden');
  currentUsernameSpan.textContent = currentUser ? currentUser.username : 'User';
  loadApplications();
}

function logout() {
  currentToken = null;
  currentUser = null;
  localStorage.removeItem('applytrack_token');
  localStorage.removeItem('applytrack_user');
  showAuthView();
  showToast('Logged out successfully', 'info');
}

// Tab Switching
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
});

tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
});

// Login Form Submit
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem('applytrack_token', currentToken);
    localStorage.setItem('applytrack_user', JSON.stringify(currentUser));

    loginForm.reset();
    showToast('Welcome back, ' + currentUser.username + '!', 'success');
    showDashboardView();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Register Form Submit
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;

  try {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem('applytrack_token', currentToken);
    localStorage.setItem('applytrack_user', JSON.stringify(currentUser));

    registerForm.reset();
    showToast('Account created successfully!', 'success');
    showDashboardView();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

logoutBtn.addEventListener('click', logout);

// --- Applications Dashboard ---

async function loadApplications() {
  try {
    const queryParams = new URLSearchParams();
    const statusVal = statusFilter.value;
    const searchVal = searchInput.value.trim();

    if (statusVal) queryParams.set('status', statusVal);
    if (searchVal) queryParams.set('search', searchVal);

    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const data = await apiRequest(`/applications${qs}`);
    applicationsList = data.applications || [];

    renderTable(applicationsList);
    updateStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateStats() {
  try {
    // Fetch all applications without filter to compute full stats
    const allData = await apiRequest('/applications');
    const all = allData.applications || [];

    statTotal.textContent = all.length;
    statApplied.textContent = all.filter(a => a.status === 'Applied').length;
    statInterview.textContent = all.filter(a => a.status === 'Interview').length;
    statOffer.textContent = all.filter(a => a.status === 'Offer').length;
    statRejected.textContent = all.filter(a => a.status === 'Rejected').length;
    statGhosted.textContent = all.filter(a => a.status === 'Ghosted').length;
  } catch (err) {
    // Silent fail for stats
  }
}

function renderTable(apps) {
  appsTableBody.innerHTML = '';

  if (apps.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  apps.forEach((app) => {
    const row = document.createElement('tr');

    const companyHtml = app.link
      ? `<a href="${encodeURI(app.link)}" target="_blank" rel="noopener noreferrer" class="app-company-link">
          ${escapeHtml(app.company)} <span class="external-icon">↗</span>
         </a>`
      : `<strong>${escapeHtml(app.company)}</strong>`;

    row.innerHTML = `
      <td>${companyHtml}</td>
      <td>${escapeHtml(app.role)}</td>
      <td><span class="status-badge badge-${app.status}">${app.status}</span></td>
      <td>${formatDate(app.applied_date)}</td>
      <td>${formatDate(app.interview_date)}</td>
      <td class="notes-cell" title="${escapeHtml(app.notes || '')}">${escapeHtml(app.notes || '-')}</td>
      <td class="text-right">
        <button class="btn-action-edit" data-id="${app.id}">Edit</button>
        <button class="btn-action-del" data-id="${app.id}">Delete</button>
      </td>
    `;

    // Event listeners for Edit and Delete
    row.querySelector('.btn-action-edit').addEventListener('click', () => openEditModal(app));
    row.querySelector('.btn-action-del').addEventListener('click', () => confirmDelete(app.id, app.company));

    appsTableBody.appendChild(row);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Search & Filter Listeners ---

let debounceTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    loadApplications();
  }, 250);
});

statusFilter.addEventListener('change', () => {
  loadApplications();
});

// Stat card quick filter
document.querySelectorAll('.stat-card').forEach(card => {
  card.addEventListener('click', () => {
    const status = card.getAttribute('data-status');
    statusFilter.value = status === 'All' ? '' : status;
    loadApplications();
  });
});

// --- Modal Management ---

function openAddModal() {
  modalTitle.textContent = 'Add Job Application';
  appForm.reset();
  modalAppId.value = '';
  modalAppliedDate.value = getTodayDateString();
  appModal.classList.remove('hidden');
}

function openEditModal(app) {
  modalTitle.textContent = 'Edit Job Application';
  modalAppId.value = app.id;
  modalCompany.value = app.company || '';
  modalRole.value = app.role || '';
  modalStatus.value = app.status || 'Applied';
  modalLink.value = app.link || '';
  modalAppliedDate.value = app.applied_date ? app.applied_date.split('T')[0] : '';
  modalInterviewDate.value = app.interview_date ? app.interview_date.split('T')[0] : '';
  modalNotes.value = app.notes || '';
  appModal.classList.remove('hidden');
}

function closeModal() {
  appModal.classList.add('hidden');
}

addAppBtn.addEventListener('click', openAddModal);
modalCloseBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);

appModal.addEventListener('click', (e) => {
  if (e.target === appModal) closeModal();
});

// App Form Submit (Create or Update)
appForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = modalAppId.value;
  const payload = {
    company: modalCompany.value.trim(),
    role: modalRole.value.trim(),
    status: modalStatus.value,
    applied_date: modalAppliedDate.value,
    link: modalLink.value.trim() || null,
    interview_date: modalInterviewDate.value || null,
    notes: modalNotes.value.trim() || null,
  };

  try {
    if (id) {
      // Update
      await apiRequest(`/applications/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Application updated successfully', 'success');
    } else {
      // Create
      await apiRequest('/applications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Application added successfully', 'success');
    }

    closeModal();
    loadApplications();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function confirmDelete(id, company) {
  if (!confirm(`Are you sure you want to delete the application for "${company}"?`)) {
    return;
  }

  try {
    await apiRequest(`/applications/${id}`, { method: 'DELETE' });
    showToast('Application deleted successfully', 'success');
    loadApplications();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Initial session check
checkSession();
