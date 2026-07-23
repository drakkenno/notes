// ============================================================
//  API FUNCTIONS
// ============================================================

async function loadFromVercel() {
    try {
        const response = await fetch(VERCEL_API_URL);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading from Vercel:', error);
        showSaveIndicator('Failed to load from cloud', true);
        return null;
    }
}

async function saveToVercel(data) {
    try {
        // Ensure position data is saved
        const saveData = {
            sections: data.sections.map(sec => ({
                id: sec.id,
                name: sec.name,
                subs: sec.subs || [],
                notes: sec.notes || [],
                items: sec.items || [],
                width: sec.width || 300,
                height: sec.height || 200,
                x: sec.x || 10,
                y: sec.y || 10
            })),
            nextId: data.nextId || 1
        };
        
        const response = await fetch(VERCEL_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saveData)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        showSaveIndicator('Saved to cloud!');
        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Error saving to Vercel:', error);
        showSaveIndicator(`Save failed: ${error.message}`, true);
        updateSyncStatus('unsynced');
        return false;
    }
}

async function syncFromVercel() {
    if (isSyncing) return;
    isSyncing = true;
    updateSyncStatus('syncing');
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    try {
        const data = await loadFromVercel();
        if (data && data.sections) {
            // Ensure all sections have position properties
            data.sections = data.sections.map(sec => {
                if (!sec.width) sec.width = 300;
                if (!sec.height) sec.height = 200;
                if (!sec.x) sec.x = 10 + Math.random() * 200;
                if (!sec.y) sec.y = 10 + Math.random() * 200;
                if (!sec.subs) sec.subs = [];
                if (!sec.notes) sec.notes = [];
                if (!sec.items) sec.items = [];
                return sec;
            });
            sections = data.sections || [];
            nextId = data.nextId || 1;
            render();
            showSaveIndicator('✅ Loaded from cloud!');
            updateStatusPanel(true);
        } else {
            // No data in cloud, save current with position data
            const saveData = {
                sections: sections.map(sec => ({
                    ...sec,
                    width: sec.width || 300,
                    height: sec.height || 200,
                    x: sec.x || 10,
                    y: sec.y || 10
                })),
                nextId: nextId
            };
            await saveToVercel(saveData);
            updateStatusPanel(true);
        }
    } catch (error) {
        console.error('Sync failed:', error);
        showSaveIndicator('❌ Sync failed', true);
    } finally {
        isSyncing = false;
        updateSyncStatus('synced');
        syncBtn.disabled = false;
        syncBtn.innerHTML = '<i class="fas fa-sync"></i> Sync';
    }
}

window.syncNow = async function() {
    console.log('Sync button clicked!');
    if (!isVercelConfigured) {
        showSaveIndicator('⚠️ Vercel API not configured. Check the URL.', true);
        return;
    }
    await syncFromVercel();
};

// ============================================================
//  UI HELPERS
// ============================================================

function updateSyncStatus(status) {
    const statusMap = {
        'synced': '<i class="fas fa-check-circle synced"></i> synced',
        'unsynced': '<i class="fas fa-exclamation-circle unsynced"></i> unsynced',
        'syncing': '<i class="fas fa-spinner syncing"></i> syncing...',
        'local': '<i class="fas fa-database"></i> local'
    };
    const syncLabel = document.getElementById('syncLabel');
    if (syncLabel) {
        syncLabel.innerHTML = statusMap[status] || statusMap.local;
    }
}

function updateStatusPanel(connected) {
    const statusTextEl = document.getElementById('statusText');
    if (!statusTextEl) return;
    if (connected) {
        statusTextEl.innerHTML = `Cloud sync: <span class="connected">connected</span>`;
        isVercelConfigured = true;
    } else {
        statusTextEl.innerHTML = `Cloud sync: <span class="disconnected">not configured</span>`;
        isVercelConfigured = false;
    }
}

function showSaveIndicator(message, isError = false) {
    const indicator = document.getElementById('saveIndicator');
    if (!indicator) return;
    indicator.textContent = message;
    indicator.className = 'save-indicator show';
    if (isError) indicator.classList.add('error');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        indicator.classList.remove('show');
        indicator.classList.remove('error');
    }, 3000);
}

// ============================================================
//  LOCAL STORAGE
// ============================================================

function loadLocalData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            sections = parsed.sections || [];
            nextId = parsed.nextId || 1;
        }
    } catch (e) {
        console.warn('Failed to load local data', e);
    }
}

function saveLocalData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sections, nextId }));
    } catch (e) {
        console.warn('Failed to save local data', e);
    }
}

// ============================================================
//  SELECTION FUNCTIONS
// ============================================================

function selectSection(sectionId) {
    selectedSectionId = sectionId;
    selectedSubsection = null;
    render();
}

function selectSubsection(sectionId, subsectionName) {
    selectedSectionId = sectionId;
    selectedSubsection = subsectionName;
    render();
}

function clearSelection() {
    selectedSectionId = null;
    selectedSubsection = null;
    render();
}

// ============================================================
//  RENDER - SIDEBAR
// ============================================================

function renderSidebar() {
    if (!sidebarContainer) return;
    if (sections.length === 0) {
        sidebarContainer.innerHTML = '';
        return;
    }
    let html = '';
    sections.forEach((sec) => {
        const isActive = selectedSectionId === sec.id && !selectedSubsection;
        const isSubActive = selectedSectionId === sec.id && selectedSubsection;
        html += `<div class="section-group" data-section-id="${sec.id}">`;
        html += `<div class="section-title ${isActive ? 'active' : ''}" onclick="selectSection(${sec.id})">
                    <span><i class="fas fa-folder-open" style="margin-right:6px;"></i> ${capitalize(sec.name)}</span>
                    <span class="section-actions">
                        <i class="fas fa-trash-alt" onclick="event.stopPropagation(); deleteSection(${sec.id})" title="Delete section"></i>
                        <i class="fas fa-plus-circle" onclick="event.stopPropagation(); addSubsection(${sec.id})" title="Add subsection"></i>
                    </span>
                </div>`;
        html += `<ul class="subsection-list">`;
        if (sec.subs && sec.subs.length > 0) {
            sec.subs.forEach(sub => {
                const isSubActive2 = isSubActive && sub.name === selectedSubsection;
                html += `<li class="${isSubActive2 ? 'active' : ''}" onclick="selectSubsection(${sec.id}, '${sub.name}')">
                            <i class="fas fa-circle"></i> ${capitalize(sub.name)}
                            <span class="delete-sub" onclick="event.stopPropagation(); deleteSubsection(${sec.id}, '${sub.name}')" title="Delete subsection">
                                <i class="fas fa-times"></i>
                            </span>
                        </li>`;
            });
        } else {
            html += `<li style="color:#7a7a5a; font-size:0.8rem; padding-left:1.2rem; cursor:default;"><i class="fas fa-ellipsis-h"></i> no subs</li>`;
        }
        html += `</ul></div>`;
    });
    sidebarContainer.innerHTML = html;
}