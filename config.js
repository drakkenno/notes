// ============================================================
//  CONFIGURATION - Set your Vercel API URL here
// ============================================================
const VERCEL_API_URL = 'https://notes-7e9f690p1-drakenotes1.vercel.app/api/notes';

// ============================================================
//  STATE
// ============================================================
let sections = [];
let nextId = 1;
let isSyncing = false;
let saveTimeout = null;
let isVercelConfigured = false;
let selectedSectionId = null;
let selectedSubsection = null;

const STORAGE_KEY = 'notesAppData';

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
const syncBtn = document.getElementById('syncBtn');
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