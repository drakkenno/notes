// ============================================================
//  API FUNCTIONS
// ============================================================

async function loadFromVercel() {
    try {
        if (!currentUser?.username) throw new Error('Login required');
        const url = `${VERCEL_API_URL}?username=${encodeURIComponent(currentUser.username)}`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${currentUser.token}` } });
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
                shareKey: sec.shareKey || undefined,
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
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
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

// ============================================================
//  PULL FROM CLOUD
// ============================================================

function mergeData(localData, cloudData, direction = 'pull') {
    // Returns merged data and list of conflicts
    if (!cloudData || !cloudData.sections) return { merged: localData, conflicts: [] };
    
    const conflicts = [];
    
    // Start with local data
    const mergedSections = JSON.parse(JSON.stringify(localData.sections || []));
    
    // For each cloud section, merge it in
    (cloudData.sections || []).forEach(cloudSec => {
        const localSec = mergedSections.find(s => s.name === cloudSec.name);
        
        if (!localSec) {
            // Section only exists in cloud - add it
            mergedSections.push(JSON.parse(JSON.stringify(cloudSec)));
            return;
        }
        
        // Section exists in both - merge everything
        // Merge subsections by name
        const localSubs = localSec.subs || [];
        const cloudSubs = cloudSec.subs || [];
        cloudSubs.forEach(cloudSub => {
            const localSub = localSubs.find(s => s.name === cloudSub.name);
            if (!localSub) {
                // Subsection only in cloud - add it
                localSubs.push(JSON.parse(JSON.stringify(cloudSub)));
            } else {
                // Merge notes in subsection
                const localNotes = localSub.notes || [];
                const cloudNotes = cloudSub.notes || [];
                cloudNotes.forEach(cloudNote => {
                    const localNote = localNotes.find(n => n.title === cloudNote.title);
                    if (!localNote) {
                        localNotes.push(JSON.parse(JSON.stringify(cloudNote)));
                    } else if (localNote.content !== cloudNote.content) {
                        // Same name different content - track conflict and cloud version wins
                        conflicts.push({
                            type: 'note',
                            section: localSec.name,
                            subsection: localSub.name,
                            title: cloudNote.title,
                            direction: direction
                        });
                        Object.assign(localNote, JSON.parse(JSON.stringify(cloudNote)));
                    }
                });
                // Merge lists in subsection
                const localItems = localSub.items || [];
                const cloudItems = cloudSub.items || [];
                cloudItems.forEach(cloudItem => {
                    const localItem = localItems.find(i => i.title === cloudItem.title);
                    if (!localItem) {
                        localItems.push(JSON.parse(JSON.stringify(cloudItem)));
                    } else {
                        // Merge list items
                        const localListItems = localItem.items || [];
                        const cloudListItems = cloudItem.items || [];
                        cloudListItems.forEach(cloudEntry => {
                            const exists = localListItems.some(
                                li => li.text === cloudEntry.text || 
                                (li.id !== undefined && cloudEntry.id !== undefined && li.id === cloudEntry.id)
                            );
                            if (!exists) {
                                localListItems.push(JSON.parse(JSON.stringify(cloudEntry)));
                            }
                        });
                        // Update location/position if cloud has it and local doesn't
                        if (!localItem.location && cloudItem.location) {
                            localItem.location = cloudItem.location;
                        }
                        if (cloudItem.x !== undefined) localItem.x = cloudItem.x;
                        if (cloudItem.y !== undefined) localItem.y = cloudItem.y;
                        if (cloudItem.width !== undefined) localItem.width = cloudItem.width;
                        if (cloudItem.height !== undefined) localItem.height = cloudItem.height;
                    }
                });
            }
        });
        
        // Merge section notes
        const localNotes = localSec.notes || [];
        const cloudNotes = cloudSec.notes || [];
        cloudNotes.forEach(cloudNote => {
            const localNote = localNotes.find(n => n.title === cloudNote.title);
            if (!localNote) {
                localNotes.push(JSON.parse(JSON.stringify(cloudNote)));
            } else if (localNote.content !== cloudNote.content) {
                // Same name different content - track conflict and cloud version wins
                conflicts.push({
                    type: 'note',
                    section: localSec.name,
                    title: cloudNote.title,
                    direction: direction
                });
                Object.assign(localNote, JSON.parse(JSON.stringify(cloudNote)));
            }
        });
        
        // Merge section lists
        const localItems = localSec.items || [];
        const cloudItems = cloudSec.items || [];
        cloudItems.forEach(cloudItem => {
            const localItem = localItems.find(i => i.title === cloudItem.title);
            if (!localItem) {
                localItems.push(JSON.parse(JSON.stringify(cloudItem)));
            } else {
                // Merge list items
                const localListItems = localItem.items || [];
                const cloudListItems = cloudItem.items || [];
                cloudListItems.forEach(cloudEntry => {
                    const exists = localListItems.some(
                        li => li.text === cloudEntry.text || 
                        (li.id !== undefined && cloudEntry.id !== undefined && li.id === cloudEntry.id)
                    );
                    if (!exists) {
                        localListItems.push(JSON.parse(JSON.stringify(cloudEntry)));
                    }
                });
                // Update location/position if cloud has it and local doesn't
                if (!localItem.location && cloudItem.location) {
                    localItem.location = cloudItem.location;
                }
                if (cloudItem.x !== undefined) localItem.x = cloudItem.x;
                if (cloudItem.y !== undefined) localItem.y = cloudItem.y;
                if (cloudItem.width !== undefined) localItem.width = cloudItem.width;
                if (cloudItem.height !== undefined) localItem.height = cloudItem.height;
            }
        });
        
        // Update position data if cloud has it
        if (cloudSec.x !== undefined) localSec.x = cloudSec.x;
        if (cloudSec.y !== undefined) localSec.y = cloudSec.y;
        if (cloudSec.width !== undefined) localSec.width = cloudSec.width;
        if (cloudSec.height !== undefined) localSec.height = cloudSec.height;
        
        // Merge share IDs
        if (cloudSec.sharedShareIds && cloudSec.sharedShareIds.length > 0) {
            if (!localSec.sharedShareIds) localSec.sharedShareIds = [];
            cloudSec.sharedShareIds.forEach(id => {
                if (!localSec.sharedShareIds.includes(id)) {
                    localSec.sharedShareIds.push(id);
                }
            });
        }
    });
    
    // Use the max nextId from both
    const mergedNextId = Math.max(localData.nextId || 1, cloudData.nextId || 1);
    
    return {
        merged: {
            sections: mergedSections,
            nextId: mergedNextId
        },
        conflicts: conflicts
    };
}

async function pullFromVercel() {
    if (isSyncing) return;
    isSyncing = true;
    updateSyncStatus('syncing');
    pullBtn.disabled = true;
    pullBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pulling...';

    try {
        const data = await loadFromVercel();
        if (data && data.sections) {
            // Pull is an explicit request to make this device match the cloud.
            // Additive merging resurrected items that had been deleted because
            // an absence from one copy was ignored.
            sections = JSON.parse(JSON.stringify(data.sections));
            nextId = data.nextId || 1;

            sections = sections.map(sec => {
                if (!sec.width) sec.width = 300;
                if (!sec.height) sec.height = 200;
                if (!sec.x) sec.x = 10 + Math.random() * 200;
                if (!sec.y) sec.y = 10 + Math.random() * 200;
                if (!sec.subs) sec.subs = [];
                if (!sec.notes) sec.notes = [];
                if (!sec.items) sec.items = [];
                sec.subs.forEach(sub => {
                    if (!sub.subs) sub.subs = [];
                    if (!sub.notes) sub.notes = [];
                    if (!sub.items) sub.items = [];
                });
                return sec;
            });

            // Pull refreshes both personal and shared data.
            if (typeof loadSharedSections === 'function') await loadSharedSections();
            render();
            showSaveIndicator('Pulled from cloud!');
            updateStatusPanel(true);
        } else {
            showSaveIndicator('No data in cloud', false);
        }
    } catch (error) {
        console.error('Pull failed:', error);
        showSaveIndicator('Pull failed: ' + error.message, true);
    } finally {
        isSyncing = false;
        updateSyncStatus('synced');
        pullBtn.disabled = false;
        pullBtn.innerHTML = '<i class="fas fa-download"></i> Pull';
    }
}

window.pullNow = async function() {
    console.log('Pull button clicked!');
    if (!isVercelConfigured) {
        showSaveIndicator('⚠️ Vercel API not configured. Check the URL.', true);
        return;
    }
    await pullFromVercel();
};

// ============================================================
//  PUSH TO CLOUD
// ============================================================

async function pushToVercel() {
    if (isSyncing) return;
    isSyncing = true;
    updateSyncStatus('syncing');
    pushBtn.disabled = true;
    pushBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing...';

    try {
        // An empty array is a valid state: it may mean the user deleted every section.
        if (!sections) throw new Error('No local data to push');

        // Push replaces the cloud copy with this device's data, so deletions
        // do not get lost when stale cloud entries are merged back in.
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

        const success = await saveToVercel(saveData);
        if (success) {
            // Synchronize linked shares only as part of this explicit Push action.
            if (typeof syncAllSharedSectionsNow === 'function') await syncAllSharedSectionsNow();
            if (typeof pushPendingSharedSectionsNow === 'function') await pushPendingSharedSectionsNow();
            showSaveIndicator('Pushed to cloud!');
            updateStatusPanel(true);
        }
    } catch (error) {
        console.error('Push failed:', error);
        showSaveIndicator('Push failed: ' + error.message, true);
    } finally {
        isSyncing = false;
        updateSyncStatus('synced');
        pushBtn.disabled = false;
        pushBtn.innerHTML = '<i class="fas fa-upload"></i> Push';
    }
}

window.pushNow = async function() {
    console.log('Push button clicked!');
    if (!isVercelConfigured) {
        showSaveIndicator('⚠️ Vercel API not configured. Check the URL.', true);
        return;
    }
    await pushToVercel();
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

// Update button references for Pull and Push
function initSyncButtons() {
    pullBtn = document.getElementById('pullBtn');
    pushBtn = document.getElementById('pushBtn');
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
        html += `<li class="${isActive ? 'active' : ''}" style="padding-left:${depth * 1.2}rem; cursor:pointer;" data-onclick="selectSubsection(${sectionId}, '${pathStr}')">`;
        html += `<i class="fas fa-circle"></i> ${capitalize(sub.name)}`;
        html += `<span class="section-actions" style="margin-left:auto;">`;
        html += `<i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSubsection(${sectionId}, '${pathStr}')" title="Add nested subsection"></i>`;
        html += `<i class="fas fa-times delete-sub" data-onclick="event.stopPropagation(); deleteSubsection(${sectionId}, '${pathStr}')" title="Delete subsection"></i>`;
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
                    <div class="section-title ${isSharedSectionsView ? 'active' : ''}" data-onclick="showSharedSections()">
                        <span><i class="fas fa-share-alt" style="margin-right:6px;"></i> Shared Sections</span>
                    </div>
                </div>`;
    sections.forEach((sec) => {
        const isActive = selectedSectionId === sec.id && selectedSubsectionPath.length === 0;
        html += `<div class="section-group" data-section-id="${sec.id}">`;
        html += `<div class="section-title ${isActive ? 'active' : ''}" data-onclick="selectSection(${sec.id})">
                    <span><i class="fas fa-folder-open" style="margin-right:6px;"></i> ${capitalize(sec.name)}</span>
                    <span class="section-actions">
                        <i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSection(${sec.id})" title="Delete section"></i>
                        <i class="fas fa-share-alt" data-onclick="event.stopPropagation(); shareSection(${sec.id})" title="Share section"></i>
                        <i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSubsection(${sec.id})" title="Add subsection"></i>
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
        const share = sharedSections.find(item => item.id === Number(shareId));
        const add = canEditSharedSection(share) ? `<i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSharedSubsection(${shareId}, '${pathStr}')" title="Add nested subsection"></i>` : '';
        const remove = isSharedOwner(share) ? `<i class="fas fa-times" data-onclick="event.stopPropagation(); deleteSharedSubsection(${shareId}, '${pathStr}')" title="Delete subsection"></i>` : '';
        return `<li style="padding-left:${depth * 1.2}rem;cursor:pointer;" data-onclick="event.stopPropagation(); openSharedSubsection(${shareId}, '${pathStr}')"><i class="fas fa-circle"></i> ${capitalize(sub.name)}<span class="section-actions">${add}${remove}</span></li>${sharedSidebarSubtree(sub.subs, shareId, depth + 1, path)}`;
    }).join('') + '</ul>';
}

function renderSidebar() {
    if (!sidebarContainer) return;
    let html = '';
    const sharedChevron = sharedSidebarExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
    html += `<div class="section-group"><div class="section-title ${isSharedSectionsView ? 'active' : ''}" data-onclick="toggleSharedSidebar()"><span><i class="fas ${sharedChevron}" style="margin-right:6px"></i><i class="fas fa-share-alt" style="margin-right:6px"></i> Shared Sections</span></div>`;
    if (sharedSidebarExpanded) {
        const grouped = sharedSections.reduce((groups, share) => {
            (groups[share.owner] ||= []).push(share); return groups;
        }, {});
        Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).forEach(([owner, shares]) => {
            const ownerOpen = expandedSharedOwners.has(owner);
            html += `<div class="section-title" style="padding-left:1rem" data-onclick="toggleSharedOwner('${escJs(owner)}')"><span><i class="fas ${ownerOpen ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-user" style="margin-right:6px"></i>${esc(owner)}</span></div>`;
            if (ownerOpen) shares.forEach(share => {
                const open = expandedSharedSections.has(share.id);
                html += `<div class="section-title" style="padding-left:2rem" data-onclick="toggleSharedSource(${share.id})"><span><i class="fas ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-folder-open" style="margin-right:6px"></i>${esc(share.section.name)}</span><span class="section-actions"><i class="fas fa-external-link-alt" data-onclick="event.stopPropagation(); openSharedFromSidebar(${share.id})" title="Open shared section"></i>${canEditSharedSection(share) ? `<i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSharedSubsection(${share.id})" title="Add subsection"></i>` : ''}${isSharedOwner(share) ? `<i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSharedSection(${share.id})" title="Delete shared section"></i>` : ''}</span></div>`;
                if (open) html += sharedSidebarSubtree(share.section.subs, share.id, 3);
            });
        });
    }
    html += '</div>';

    sections.forEach(sec => {
        const active = selectedSectionId === sec.id && selectedSubsectionPath.length === 0 && !isSharedSectionsView;
        const open = expandedPersonalSections.has(sec.id);
        html += `<div class="section-group" data-section-id="${sec.id}"><div class="section-title ${active ? 'active' : ''}" data-onclick="togglePersonalSection(${sec.id})"><span><i class="fas ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-folder-open" style="margin-right:6px"></i> ${capitalize(sec.name)}</span><span class="section-actions"><i class="fas fa-external-link-alt" data-onclick="event.stopPropagation(); selectSection(${sec.id})" title="Open section"></i><i class="fas fa-share-alt" data-onclick="event.stopPropagation(); shareSection(${sec.id})" title="Share section"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSubsection(${sec.id})" title="Add subsection"></i><i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSection(${sec.id})" title="Delete section"></i></span></div>`;
        if (open) html += renderSubsectionTree(sec.subs, sec.id, [], 1);
        html += '</div>';
    });
    sidebarContainer.innerHTML = html;
}

function renderSidebar() {
    if (!sidebarContainer) return;
    let html = '';
    html += `<div class="section-group"><div class="section-title ${isSharedSectionsView ? 'active' : ''}" data-onclick="toggleSharedSidebar()"><span><i class="fas ${sharedSidebarExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-share-alt" style="margin-right:6px"></i> Shared Sections</span></div>`;
    if (sharedSidebarExpanded) {
        sharedSections.forEach(share => {
            const open = expandedSharedSections.has(share.id);
            html += `<div class="section-title" style="padding-left:1rem" data-onclick="toggleSharedSource(${share.id})"><span><i class="fas ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-folder-open" style="margin-right:6px"></i>${esc(share.section.name)}</span><span class="section-actions"><i class="fas fa-external-link-alt" data-onclick="event.stopPropagation(); openSharedFromSidebar(${share.id})" title="Open shared section"></i>${canEditSharedSection(share) ? `<i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSharedSubsection(${share.id})" title="Add subsection"></i>` : ''}${isSharedOwner(share) ? `<i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSharedSection(${share.id})" title="Delete shared section"></i>` : ''}</span></div>`;
            if (open) html += sharedSidebarSubtree(share.section.subs, share.id, 2);
        });
    }
    html += '</div>';
    sections.forEach(sec => {
        const active = selectedSectionId === sec.id && selectedSubsectionPath.length === 0 && !isSharedSectionsView;
        const open = expandedPersonalSections.has(sec.id);
        html += `<div class="section-group" data-section-id="${sec.id}"><div class="section-title ${active ? 'active' : ''}" data-onclick="togglePersonalSection(${sec.id})"><span><i class="fas ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:6px"></i><i class="fas fa-folder-open" style="margin-right:6px"></i> ${capitalize(sec.name)}</span><span class="section-actions"><i class="fas fa-external-link-alt" data-onclick="event.stopPropagation(); selectSection(${sec.id})" title="Open section"></i><i class="fas fa-share-alt" data-onclick="event.stopPropagation(); shareSection(${sec.id})" title="Share section"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSubsection(${sec.id})" title="Add subsection"></i><i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSection(${sec.id})" title="Delete section"></i></span></div>`;
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
        title.removeAttribute('data-onclick');
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
        title.removeAttribute('data-onclick');
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
// Hierarchy move/copy/paste controls added after the application modules load.
document.addEventListener('DOMContentLoaded', () => {
  let clipboard = null, dragged = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const parts = value => String(value || '').split('/').filter(Boolean);
  const locate = (sectionId, path) => { const section=sections.find(s=>s.id===Number(sectionId)); const names=parts(path); if(!section||!names.length)return null; let siblings=section.subs||(section.subs=[]); for(let i=0;i<names.length-1;i++){const parent=siblings.find(s=>s.name===names[i]);if(!parent)return null;siblings=parent.subs||(parent.subs=[]);} const index=siblings.findIndex(s=>s.name===names.at(-1)); return index<0?null:{section,siblings,index,sub:siblings[index],names}; };
  const unique = (siblings,name) => { const base=String(name||'Copied subsection'); let result=base,n=2; while(siblings.some(s=>s.name===result))result=`${base} (${n++})`; return result; };
  const paste = (sectionId,path='') => { if(!clipboard)return showSaveIndicator('Copy a section or subsection first',true); const dest=path?locate(sectionId,path):null; const siblings=dest?(dest.sub.subs||(dest.sub.subs=[])):(sections.find(s=>s.id===Number(sectionId))?.subs||[]); if(!siblings)return; const copy=clone(clipboard.value); copy.name=unique(siblings,copy.name); copy.notes||=[];copy.items||=[];copy.subs||=[]; siblings.push(copy); expandedPersonalSections.add(Number(sectionId)); render();showSaveIndicator('Pasted'); };
  window.copySection=id=>{const section=sections.find(s=>s.id===Number(id));if(section){clipboard={value:clone(section)};showSaveIndicator('Section copied');}};
  window.copySubsection=(id,path)=>{const found=locate(id,path);if(found){clipboard={value:clone(found.sub)};showSaveIndicator('Subsection copied');}};
  window.pasteIntoSection=id=>paste(id);
  window.pasteIntoSubsection=(id,path)=>{const found=locate(id,path);if(found&&found.names.length>=5)return showSaveIndicator('Maximum subsection depth (5 levels) reached',true);paste(id,path);};
  window.pasteAsSection=()=>{if(!clipboard)return showSaveIndicator('Copy a section or subsection first',true);const copy=clone(clipboard.value);let name=copy.name||'Copied section',n=2;while(sections.some(s=>s.name===name))name=`${copy.name||'Copied section'} (${n++})`;copy.name=name;copy.id=nextId++;copy.notes||=[];copy.items||=[];copy.subs||=[];sections.push(copy);render();showSaveIndicator('Pasted as a new section');};
  const decorate=()=>{document.querySelectorAll('.section-group[data-section-id]').forEach(group=>{const id=Number(group.dataset.sectionId),title=group.querySelector(':scope > .section-title');if(!title||title.dataset.hierarchy)return;title.dataset.hierarchy='1';title.draggable=true;title.ondragstart=e=>{dragged={type:'section',id};e.dataTransfer.setData('text/plain','section');};title.ondragover=e=>{e.preventDefault();title.classList.add('hierarchy-drop-target');};title.ondragleave=()=>title.classList.remove('hierarchy-drop-target');title.ondrop=e=>{e.preventDefault();title.classList.remove('hierarchy-drop-target');if(dragged?.type==='section'&&dragged.id!==id){const from=sections.findIndex(s=>s.id===dragged.id),to=sections.findIndex(s=>s.id===id);sections.splice(to,0,sections.splice(from,1)[0]);render();}else if(dragged?.type==='sub')moveSub(dragged,id,[]);dragged=null;};const actions=title.querySelector('.section-actions');if(actions){actions.insertAdjacentHTML('afterbegin',`<i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteIntoSection(${id})" title="Paste as subsection"></i><i class="fas fa-copy" data-onclick="event.stopPropagation(); copySection(${id})" title="Copy section"></i>`);}});document.querySelectorAll('.section-group[data-section-id] .subsection-list li').forEach(li=>{if(li.dataset.hierarchy)return;const sectionId=Number(li.closest('.section-group').dataset.sectionId),name=[...li.childNodes].find(n=>n.nodeType===3)?.textContent?.trim();if(!name||name==='no subs')return;const path=(li.getAttribute('data-onclick')||'').match(/selectSubsection\\([^,]+, '([^']+)'\\)/)?.[1]||name;li.dataset.hierarchy='1';li.draggable=true;li.ondragstart=e=>{dragged={type:'sub',id:sectionId,path};e.dataTransfer.setData('text/plain','sub');};li.ondragover=e=>{e.preventDefault();li.classList.add('hierarchy-drop-target');};li.ondragleave=()=>li.classList.remove('hierarchy-drop-target');li.ondrop=e=>{e.preventDefault();li.classList.remove('hierarchy-drop-target');if(dragged?.type==='sub')moveSub(dragged,sectionId,parts(path));dragged=null;};li.querySelector('.section-actions')?.insertAdjacentHTML('afterbegin',`<i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteIntoSubsection(${sectionId}, '${path}')" title="Paste nested subsection"></i><i class="fas fa-copy" data-onclick="event.stopPropagation(); copySubsection(${sectionId}, '${path}')" title="Copy subsection"></i>`);});};
  const moveSub=(source,targetId,targetPath)=>{const found=locate(source.id,source.path),target=targetPath.length?locate(targetId,targetPath):null;if(!found||!target&&!sections.some(s=>s.id===targetId))return;if(target&&source.id===targetId&&target.names.join('/').startsWith(found.names.join('/')+'/'))return showSaveIndicator('A subsection cannot be moved into itself',true);const [item]=found.siblings.splice(found.index,1),siblings=target?(target.sub.subs||(target.sub.subs=[])):(sections.find(s=>s.id===targetId).subs||(sections.find(s=>s.id===targetId).subs=[]));item.name=unique(siblings,item.name);siblings.push(item);render();};
  const original=renderSidebar;renderSidebar=function(){original();decorate();};
  const add=document.getElementById('addSectionBtn');if(add){const button=document.createElement('button');button.className='add-section-btn';button.innerHTML='<i class="fas fa-paste"></i> Paste as section';button.onclick=pasteAsSection;add.insertAdjacentElement('afterend',button);} decorate();
});

// Shared-section hierarchy controls follow the contributor permission model.
document.addEventListener('DOMContentLoaded', () => {
  const hierarchySidebarRenderer = renderSidebar;
  renderSidebar = function () {
    hierarchySidebarRenderer();
    const sharedEditor = typeof activeSharedEditorShare === 'function' ? activeSharedEditorShare() : null;
    if (!sharedEditor) return;
    const editable = canEditSharedSection(sharedEditor);
    document.querySelectorAll('.section-group[data-section-id] .fa-copy, .section-group[data-section-id] .fa-paste').forEach(control => {
      control.style.display = editable ? '' : 'none';
    });
    document.querySelectorAll('.section-group[data-section-id] > .section-title, .section-group[data-section-id] .subsection-list li').forEach(item => {
      item.draggable = editable;
    });
    const pasteAsSection = document.querySelector('#addSectionBtn + .add-section-btn');
    if (pasteAsSection) {
      pasteAsSection.style.display = editable ? 'none' : '';
      pasteAsSection.title = editable ? 'Shared sections can be pasted into this section or one of its subsections' : '';
    }
  };
});

// Do not allow programmatic invocation of hierarchy actions for reader-only shares.
document.addEventListener('DOMContentLoaded', () => {
  const permitted = () => { const share = typeof activeSharedEditorShare === 'function' ? activeSharedEditorShare() : null; return !share || canEditSharedSection(share); };
  ['copySection', 'copySubsection', 'pasteIntoSection', 'pasteIntoSubsection', 'pasteAsSection'].forEach(name => {
    const operation = window[name];
    if (!operation) return;
    window[name] = (...args) => {
      if (!permitted()) return showSaveIndicator('You have view-only access to this shared section', true);
      return operation(...args);
    };
  });
});

// Personal subsection tree: explicit hierarchy controls, matching the shared control order.
let personalSubsectionDrag = null;
function personalSubsectionNode(sectionId, path) {
    const section = sections.find(item => item.id === Number(sectionId));
    const names = String(path || '').split('/').filter(Boolean);
    if (!section || !names.length) return null;
    let siblings = section.subs || (section.subs = []);
    for (let i = 0; i < names.length - 1; i++) { const parent = siblings.find(item => item.name === names[i]); if (!parent) return null; siblings = parent.subs || (parent.subs = []); }
    const index = siblings.findIndex(item => item.name === names.at(-1));
    return index < 0 ? null : { section, siblings, index, sub: siblings[index], names };
}
function personalSubsectionUnique(siblings, name) { const base = String(name || 'Subsection'); let output = base, number = 2; while (siblings.some(item => item.name === output)) output = `${base} (${number++})`; return output; }
window.startPersonalSubsectionDrag = function(event, sectionId, path) { personalSubsectionDrag = { sectionId: Number(sectionId), path }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'personal-subsection'); event.currentTarget.classList.add('hierarchy-dragging'); };
window.personalSubsectionDragOver = function(event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; event.currentTarget.classList.add('hierarchy-drop-target'); };
window.personalSubsectionDragLeave = function(event) { event.currentTarget.classList.remove('hierarchy-drop-target'); };
window.dropPersonalSubsection = function(event, sectionId, path) {
    event.preventDefault(); event.currentTarget.classList.remove('hierarchy-drop-target');
    const source = personalSubsectionDrag && personalSubsectionNode(personalSubsectionDrag.sectionId, personalSubsectionDrag.path);
    const target = personalSubsectionNode(sectionId, path); personalSubsectionDrag = null;
    if (!source || !target) return;
    if (source.section.id === target.section.id && target.names.join('/').startsWith(source.names.join('/') + '/')) return showSaveIndicator('A subsection cannot be moved into itself', true);
    if (target.names.length >= 5) return showSaveIndicator('Maximum subsection depth (5 levels) reached', true);
    const [moved] = source.siblings.splice(source.index, 1), siblings = target.sub.subs || (target.sub.subs = []);
    moved.name = personalSubsectionUnique(siblings, moved.name); siblings.push(moved); render();
};
function renderSubsectionTree(subs, sectionId, parentPath, depth = 0) {
    if (!subs || !subs.length) return '';
    let html = '<ul class="subsection-list">';
    subs.forEach(sub => {
        const path = [...parentPath, sub.name], pathValue = escJs(path.join('/'));
        const active = selectedSectionId === sectionId && selectedSubsectionPath.length === path.length && selectedSubsectionPath.every((value, index) => value === path[index]);
        html += `<li class="${active ? 'active ' : ''}hierarchy-subsection" draggable="true" data-ondragstart="startPersonalSubsectionDrag(event, ${sectionId}, '${pathValue}')" data-ondragover="personalSubsectionDragOver(event)" data-ondragleave="personalSubsectionDragLeave(event)" data-ondrop="dropPersonalSubsection(event, ${sectionId}, '${pathValue}')" style="padding-left:${depth * 1.2}rem;cursor:pointer;" data-onclick="selectSubsection(${sectionId}, '${pathValue}')"><i class="fas fa-circle"></i> ${capitalize(sub.name)}<span class="section-actions" style="margin-left:auto;"><i class="fas fa-copy" data-onclick="event.stopPropagation(); copySubsection(${sectionId}, '${pathValue}')" title="Copy subsection"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteIntoSubsection(${sectionId}, '${pathValue}')" title="Paste as nested subsection"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSubsection(${sectionId}, '${pathValue}')" title="Add nested subsection"></i><i class="fas fa-times delete-sub" data-onclick="event.stopPropagation(); deleteSubsection(${sectionId}, '${pathValue}')" title="Delete subsection"></i></span></li>`;
        html += renderSubsectionTree(sub.subs, sectionId, path, depth + 1);
    });
    return html + '</ul>';
}
