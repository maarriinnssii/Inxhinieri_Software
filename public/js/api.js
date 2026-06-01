const API_BASE = '/api';

function getToken() { return localStorage.getItem('token'); }
function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}
function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
function isLoggedIn() { return !!getToken(); }

function logout() {
  clearAuth();
  window.location.href = '/';
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gabim i panjohur.');
  return data;
}

// Toast notifications
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || '•'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = 'all .3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// Update navbar based on auth state
function updateNavbar() {
  const user = getUser();
  const guestActions = document.getElementById('guest-actions');
  const userActions = document.getElementById('user-actions');
  const userNameEl = document.getElementById('user-name');
  const userInitialEl = document.getElementById('user-initial');
  const orgLink = document.getElementById('nav-org');
  const adminLink = document.getElementById('nav-admin');
  const scanLink = document.getElementById('nav-scan');

  if (user) {
    if (guestActions) guestActions.classList.add('hidden');
    if (userActions) userActions.classList.remove('hidden');
    if (userNameEl) userNameEl.textContent = user.emri + ' ' + user.mbiemri;
    if (userInitialEl) userInitialEl.textContent = (user.emri[0] + user.mbiemri[0]).toUpperCase();
    if (orgLink) orgLink.classList.toggle('hidden', !['organizator', 'admin'].includes(user.roli));
    if (adminLink) adminLink.classList.toggle('hidden', user.roli !== 'admin');
    if (scanLink) scanLink.classList.toggle('hidden', !['staf', 'organizator', 'admin'].includes(user.roli));
    loadUnreadCount();
  } else {
    if (guestActions) guestActions.classList.remove('hidden');
    if (userActions) userActions.classList.add('hidden');
    if (orgLink) orgLink.classList.add('hidden');
    if (adminLink) adminLink.classList.add('hidden');
    if (scanLink) scanLink.classList.add('hidden');
  }
}

async function loadUnreadCount() {
  try {
    const data = await apiFetch('/notifications/unread-count');
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = data.count;
      badge.classList.toggle('hidden', data.count === 0);
    }
  } catch {}
}

function requireAuth() {
  if (!isLoggedIn()) { window.location.href = '/login.html'; return false; }
  return true;
}
function requireRole(roles) {
  const user = getUser();
  if (!user || !roles.includes(user.roli)) { window.location.href = '/'; return false; }
  return true;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('sq-AL', { day: '2-digit', month: 'long', year: 'numeric' });
}
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('sq-AL');
}

// Hamburger menu
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => navMenu.classList.toggle('open'));
  }

  const userAvatarBtn = document.getElementById('user-avatar-btn');
  const dropdownMenu = document.getElementById('user-dropdown');
  if (userAvatarBtn && dropdownMenu) {
    userAvatarBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdownMenu.classList.toggle('show'); });
    document.addEventListener('click', () => dropdownMenu.classList.remove('show'));
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  updateNavbar();
});
