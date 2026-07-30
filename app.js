// ============================================================
//  API FUNCTIONS
// ============================================================

async function loadFromVercel() {
    try {
        if (!currentUser?.username) throw new Error('Login required');
        const url = `${VERCEL_API_URL}?username=${encodeURIComponent(currentUser.username)}`;
        const response = await fetch(url);
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
                sharedShareIds: sec.sharedShareIds || [],
                notes: sec.notes || [],
                items: sec.items || [],
                width: sec.width || 300,
                height: sec.height || 200,
                x: sec.x || 10,
                y: sec.y || 10
            })),
            nextId: data.nextId || 1,
            username: currentUser?.username
        };
        if (!saveData.username) throw new Error('Login required');
        
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
                // Ensure all subsections have subs array for nested subsections
                if (sec.subs) {
                    sec.subs.forEach(sub => {
                        if (!sub.subs) sub.subs = [];
                        if (!sub.notes) sub.notes = [];
                        if (!sub.items) sub.items = [];
                    });
                }
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
    isSharedSectionsView = false;
    selectedSectionId = sectionId;
    selectedSubsectionPath = [];
    render();
}

function selectSubsection(sectionId, subsectionPath) {
    isSharedSectionsView = false;
    selectedSectionId = parseInt(sectionId);
    // subsectionPath can be a string (for backward compatibility) or an array
    if (Array.isArray(subsectionPath)) {
        selectedSubsectionPath = subsectionPath;
    } else {
        // Split the string path by '/' to get the array of subsection names
        selectedSubsectionPath = subsectionPath.split('/').filter(p => p.length > 0);
    }
    render();
}

function clearSelection() {
    selectedSectionId = null;
    selectedSubsectionPath = [];
    render();
}

// ============================================================
//  RENDER - SIDEBAR
// ============================================================

function renderSubsectionTree(subs, sectionId, parentPath, depth = 0) {
    if (!subs || subs.length === 0) return '';
    
    let html = '<ul class="subsection-list">';
    subs.forEach(sub => {
        const currentPath = [...parentPath, sub.name];
        const isActive = selectedSectionId === sectionId && 
                        selectedSubsectionPath.length === currentPath.length &&
                        selectedSubsectionPath.every((val, idx) => val === currentPath[idx]);
        
        const pathStr = escJs(currentPath.join('/'));
        html += `<li class="${isActive ? 'active' : ''}" style="padding-left:${depth * 1.2}rem; cursor:pointer;" onclick="selectSubsection(${sectionId}, '${pathStr}')">`;
        html += `<i class="fas fa-circle"></i> ${capitalize(sub.name)}`;
        html += `<span class="section-actions" style="margin-left:auto;">`;
        html += `<i class="fas fa-plus-circle" onclick="event.stopPropagation(); addSubsection(${sectionId}, '${pathStr}')" title="Add nested subsection"></i>`;
        html += `<i class="fas fa-times delete-sub" onclick="event.stopPropagation(); deleteSubsection(${sectionId}, '${pathStr}')" title="Delete subsection"></i>`;
        html += `</span>`;
        html += `</li>`;
        
        // Recursively render nested subsections
        if (sub.subs && sub.subs.length > 0) {
            html += renderSubsectionTree(sub.subs, sectionId, currentPath, depth + 1);
        }
    });
    html += '</ul>';
    return html;
}

function renderSidebar() {
    if (!sidebarContainer) return;
    if (sections.length === 0) {
        sidebarContainer.innerHTML = '';
        return;
    }
    let html = `<div class="section-group">
                    <div class="section-title ${isSharedSectionsView ? 'active' : ''}" onclick="showSharedSections()">
                        <span><i class="fas fa-share-alt" style="margin-right:6px;"></i> Shared Sections</span>
                    </div>
                </div>`;
    sections.forEach((sec) => {
        const isActive = selectedSectionId === sec.id && selectedSubsectionPath.length === 0;
        html += `<div class="section-group" data-section-id="${sec.id}">`;
        html += `<div class="section-title ${isActive ? 'active' : ''}" onclick="selectSection(${sec.id})">
                    <span><i class="fas fa-folder-open" style="margin-right:6px;"></i> ${capitalize(sec.name)}</span>
                    <span class="section-actions">
                        <i class="fas fa-trash-alt" onclick="event.stopPropagation(); deleteSection(${sec.id})" title="Delete section"></i>
                        <i class="fas fa-share-alt" onclick="event.stopPropagation(); shareSection(${sec.id})" title="Share section"></i>
                        <i class="fas fa-plus-circle" onclick="event.stopPropagation(); addSubsection(${sec.id})" title="Add subsection"></i>
                    </span>
                </div>`;
        
        // Render nested subsection tree
        if (sec.subs && sec.subs.length > 0) {
            html += renderSubsectionTree(sec.subs, sec.id, [], 0);
        } else {
            html += `<ul class="subsection-list">`;
            html += `<li style="color:#7a7a5a; font-size:0.8rem; padding-left:1.2rem; cursor:default;"><i class="fas fa-ellipsis-h"></i> no subs</li>`;
            html += `</ul>`;
        }
        
        html += `</div>`;
    });
    sidebarContainer.innerHTML = html;
}

// Collapsible personal and shared section navigation
const expandedPersonalSections = new Set();
const expandedSharedOwners = new Set();
const expandedSharedSections = new Set();
let sharedSidebarExpanded = false;

window.togglePersonalSection = function(id) {
    expandedPersonalSections.has(id) ? expandedPersonalSections.delete(id) : expandedPersonalSections.add(id);
    renderSidebar();
};
window.toggleSharedSidebar = function() {
    sharedSidebarExpanded = !sharedSidebarExpanded;
    renderSidebar();
};
window.toggleSharedOwner = function(owner) {
    expandedSharedOwners.has(owner) ? expandedSharedOwners.delete(owner) : expandedSharedOwners.add(owner);
    renderSidebar();
};
window.toggleSharedSource = function(id) {
    expandedSharedSections.has(id) ? expandedSharedSections.delete(id) : expandedSharedSections.add(id);
    renderSidebar();
};
window.openSharedFromSidebar = function(id) {
    isSharedSectionsView = true;
    selectedSharedSectionId = Number(id);
    selectedSharedSubsectionPath = [];
    selectedSectionId = null;
    selectedSubsectionPath = [];
    render();
};

function sharedSidebarSubtree(subs, shareId, depth = 1, parentPath = []) {
    if (!Array.isArray(subs) || !subs.length) return '';
    return '<ul class="subsection-list">' + subs.map(sub => {
        const path = [...parentPath, sub.name];
        const pathStr = escJs(path.join('/'));
        return `<li style="padding-left:${depth * 1.2}rem;cursor:pointer;" onclick="event.stopPropagation(); openSharedSubsection(${shareId}, '${pathStr}')"><i class="fas fa-circle"></i> ${capitalize(sub.name)}</li>${sharedSidebarSubtree(sub.subs, shareId, depth + 1, path)}`;
    }).join('') + '</ul>';
}

function renderSidebar() {
    if (!sidebarContainer) return;
    let html = '';
    const sharedChevron = sharedSidebarExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
    html += `<div class="section-group"><div class="section-title ${isSharedSectionsView ? 'active' : ''}" onclick="toggleSharedSidebar()"><span><i class="fas ${sharedChevron}" style="margin-right:6px"></i><i class="fas fa-share-alt" style="margin-right:6px"></i> Shared Sections</span></div>`;
    if (sharedSidebarExpanded) {
        const grouped = sharedSections.reduce((groups, share) => {
            (groups[share.owner] ||= []).push(share); return groups;
        }, {});
        Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).forEach(([owner, shares]) => {
            const ownerOpen = expandedSharedOwners.has(owner);
            html += `<div class="section-title" style="padding-left:1rem" onclick="toggleSharedOwner('${escJs(owner)}')"><span><i class="fas ${ownerOpen ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-user" style="margin-right:6px"></i>${esc(owner)}</span></div>`;
            if (ownerOpen) shares.forEach(share => {
                const open = expandedSharedSections.has(share.id);
                html += `<div class="section-title" style="padding-left:2rem" onclick="toggleSharedSource(${share.id})"><span><i class="fas ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-folder-open" style="margin-right:6px"></i>${esc(share.section.name)}</span><span class="section-actions"><i class="fas fa-external-link-alt" onclick="event.stopPropagation(); openSharedFromSidebar(${share.id})" title="Open shared section"></i></span></div>`;
                if (open) html += sharedSidebarSubtree(share.section.subs, share.id, 3);
            });
        });
    }
    html += '</div>';

    sections.forEach(sec => {
        const active = selectedSectionId === sec.id && selectedSubsectionPath.length === 0 && !isSharedSectionsView;
        const open = expandedPersonalSections.has(sec.id);
        html += `<div class="section-group" data-section-id="${sec.id}"><div class="section-title ${active ? 'active' : ''}" onclick="togglePersonalSection(${sec.id})"><span><i class="fas ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-folder-open" style="margin-right:6px"></i> ${capitalize(sec.name)}</span><span class="section-actions"><i class="fas fa-external-link-alt" onclick="event.stopPropagation(); selectSection(${sec.id})" title="Open section"></i><i class="fas fa-share-alt" onclick="event.stopPropagation(); shareSection(${sec.id})" title="Share section"></i><i class="fas fa-plus-circle" onclick="event.stopPropagation(); addSubsection(${sec.id})" title="Add subsection"></i><i class="fas fa-trash-alt" onclick="event.stopPropagation(); deleteSection(${sec.id})" title="Delete section"></i></span></div>`;
        if (open) html += renderSubsectionTree(sec.subs, sec.id, [], 1);
        html += '</div>';
    });
    sidebarContainer.innerHTML = html;
}

function renderSidebar() {
    if (!sidebarContainer) return;
    let html = '';
    html += `<div class="section-group"><div class="section-title ${isSharedSectionsView ? 'active' : ''}" onclick="toggleSharedSidebar()"><span><i class="fas ${sharedSidebarExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-share-alt" style="margin-right:6px"></i> Shared Sections</span></div>`;
    if (sharedSidebarExpanded) {
        sharedSections.forEach(share => {
            const open = expandedSharedSections.has(share.id);
            html += `<div class="section-title" style="padding-left:1rem" onclick="toggleSharedSource(${share.id})"><span><i class="fas ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-folder-open" style="margin-right:6px"></i>${esc(share.section.name)}</span><span class="section-actions"><i class="fas fa-external-link-alt" onclick="event.stopPropagation(); openSharedFromSidebar(${share.id})" title="Open shared section"></i></span></div>`;
            if (open) html += sharedSidebarSubtree(share.section.subs, share.id, 2);
        });
    }
    html += '</div>';
    sections.forEach(sec => {
        const active = selectedSectionId === sec.id && selectedSubsectionPath.length === 0 && !isSharedSectionsView;
        const open = expandedPersonalSections.has(sec.id);
        html += `<div class="section-group" data-section-id="${sec.id}"><div class="section-title ${active ? 'active' : ''}" onclick="togglePersonalSection(${sec.id})"><span><i class="fas ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-folder-open" style="margin-right:6px"></i> ${capitalize(sec.name)}</span><span class="section-actions"><i class="fas fa-external-link-alt" onclick="event.stopPropagation(); selectSection(${sec.id})" title="Open section"></i><i class="fas fa-share-alt" onclick="event.stopPropagation(); shareSection(${sec.id})" title="Share section"></i><i class="fas fa-plus-circle" onclick="event.stopPropagation(); addSubsection(${sec.id})" title="Add subsection"></i><i class="fas fa-trash-alt" onclick="event.stopPropagation(); deleteSection(${sec.id})" title="Delete section"></i></span></div>`;
        if (open) html += renderSubsectionTree(sec.subs, sec.id, [], 1);
        html += '</div>';
    });
    sidebarContainer.innerHTML = html;
}
// Make the section name open its content. Only its chevron expands the subtree.
const renderSidebarWithClickTargets = renderSidebar;
renderSidebar = function() {
    renderSidebarWithClickTargets();
    const groups = sidebarContainer.querySelectorAll('.section-group');
    if (!groups.length) return;
    const sharedGroup = groups[0];
    const sharedTitles = Array.from(sharedGroup.querySelectorAll(':scope > .section-title'));
    sharedTitles.forEach((title, index) => {
        title.removeAttribute('onclick');
        title.addEventListener('click', event => {
            if (event.target.closest('.section-actions')) return;
            const isChevron = event.target.closest('i') === title.querySelector('i');
            if (index === 0) { if (isChevron) toggleSharedSidebar(); else showSharedSections(); }
            else { const share = sharedSections[index - 1]; if (!share) return; if (isChevron) toggleSharedSource(share.id); else { activeSharedEditorId = null; isSharedSectionsView = true; selectedSharedSectionId = share.id; selectedSharedSubsectionPath = []; selectedSectionId = null; selectedSubsectionPath = []; render(); } }
        });
    });
    sidebarContainer.querySelectorAll('.section-group[data-section-id]').forEach(group => {
        const id = Number(group.dataset.sectionId), title = group.querySelector(':scope > .section-title');
        if (!title) return;
        const section = sections.find(item => item.id === id);
        if (section?.sharedShareIds?.length) {
            const stop = document.createElement('i');
            stop.className = 'fas fa-unlink'; stop.title = 'Stop sharing';
            stop.onclick = event => { event.stopPropagation(); stopSharingSection(id); };
            title.querySelector('.section-actions')?.appendChild(stop);
        }
        title.removeAttribute('onclick');
        title.addEventListener('click', event => {
            if (event.target.closest('.section-actions')) return;
            const isChevron = event.target.closest('i') === title.querySelector('i');
            if (isChevron) togglePersonalSection(id); else selectSection(id);
        });
    });
};
// Shared subsection tree items have their onclick set directly in sharedSidebarSubtree.
// No post-render override is needed since the HTML attribute is set during rendering.
// Avoid GitHub writes when rendering did not change the notes payload.
let lastCloudSaveSignature = null;
const saveToVercelWithDeduplication = saveToVercel;
saveToVercel = async function(data) {
    const signature = (currentUser?.username || '') + ':' + JSON.stringify({ sections: data.sections, nextId: data.nextId });
    if (signature === lastCloudSaveSignature) return true;
    const saved = await saveToVercelWithDeduplication(data);
    if (saved) lastCloudSaveSignature = signature;
    return saved;
};
