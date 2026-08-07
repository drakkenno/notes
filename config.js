// ============================================================
//  CONFIGURATION - Set your Vercel API URL here
// ============================================================
const VERCEL_API_URL = 'https://notes-cw3bp504e-drakenotes1.vercel.app/api/notes';
const AUTH_API_URL = 'https://notes-cw3bp504e-drakenotes1.vercel.app/api/auth';

// ============================================================
//  STATE
// ============================================================
let sections = [];
let nextId = 1;
let isSyncing = false;
let saveTimeout = null;
let isVercelConfigured = false;
let selectedSectionId = null;
let selectedSubsectionPath = []; // Array of subsection names representing the path
let currentUser = null; // Authenticated user session
const STORAGE_KEY = 'notesAppData';
const AUTH_STORAGE_KEY = 'notesAppUser';

// ============================================================
//  DOM REFS
// ============================================================
const sidebarContainer = document.getElementById('sidebarSectionsContainer');
const mainContainer = document.getElementById('mainSectionsContainer');
const addSectionBtn = document.getElementById('addSectionBtn');
const toggleBtn = document.getElementById('toggleSidebarBtn');
const sidebar = document.getElementById('sidebar');
const syncLabel = document.getElementById('syncLabel');
const statusText = document.getElementById('statusText');
let pullBtn, pushBtn;
let sidebarVisible = true;

// ============================================================
//  HELPERS
// ============================================================
function capitalize(str) {
    if (!str) return '';
    return str.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escJs(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

function genId() { return nextId++; }

// ============================================================
//  DEFAULT BOX SIZES
// ============================================================
function getDefaultBoxSize(index) {
    const widths = [280, 320, 300, 360, 340, 380];
    const heights = [180, 200, 220, 190, 240, 210];
    const i = index % widths.length;
    return {
        width: widths[i],
        height: heights[i],
        x: 10 + (i * 30) % 350,
        y: 10 + (i * 40) % 250
    };
}

// ============================================================
//  NAVIGATION HELPERS
// ============================================================
function getCurrentSubsection() {
    // Returns the subsection object at the current path, or null
    if (selectedSubsectionPath.length === 0) return null;
    
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec || !sec.subs) return null;
    
    let current = sec.subs;
    let sub = null;
    
    for (let i = 0; i < selectedSubsectionPath.length; i++) {
        const name = selectedSubsectionPath[i];
        sub = current.find(s => s.name === name);
        if (!sub) return null;
        if (i < selectedSubsectionPath.length - 1) {
            current = sub.subs || [];
        }
    }
    
    return sub;
}

function getParentSubsection() {
    // Returns the parent subsection object, or null if at section level
    if (selectedSubsectionPath.length <= 1) return null;
    
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec || !sec.subs) return null;
    
    let current = sec.subs;
    let sub = null;
    
    for (let i = 0; i < selectedSubsectionPath.length - 1; i++) {
        const name = selectedSubsectionPath[i];
        sub = current.find(s => s.name === name);
        if (!sub) return null;
        current = sub.subs || [];
    }
    
    return sub;
}

// ============================================================
//  INITIALIZATION - Check if Vercel is configured
// ============================================================
console.log('VERCEL_API_URL:', VERCEL_API_URL);

if (VERCEL_API_URL && VERCEL_API_URL !== 'https://your-vercel-app.vercel.app/api/notes') {
    isVercelConfigured = true;
    console.log('✅ Vercel is configured');
    setTimeout(() => {
        const statusTextEl = document.getElementById('statusText');
        if (statusTextEl) {
            statusTextEl.innerHTML = `Cloud sync: <span class="connected">connected</span>`;
        }
    }, 100);
} else {
    isVercelConfigured = false;
    console.warn('⚠️ Vercel is NOT configured. Please update VERCEL_API_URL in config.js');
}