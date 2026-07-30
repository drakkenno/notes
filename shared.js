// Recipient-based section sharing
const SHARED_API_URL = 'https://notes-blsp0zwdt-drakenotes1.vercel.app/api/shared';
let sharedSections = [];
let isSharedSectionsView = false;
let selectedSharedSectionId = null;

async function sharedApi(method = 'GET', body) {
    if (!currentUser?.token) throw new Error('Please sign in again');
    const response = await fetch(SHARED_API_URL, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Shared sections request failed');
    return data;
}

async function loadSharedSections() {
    if (!currentUser) return;
    const data = await sharedApi();
    sharedSections = data.sections || [];
}

window.showSharedSections = async function() {
    isSharedSectionsView = true;
    selectedSharedSectionId = null;
    selectedSectionId = null;
    selectedSubsectionPath = [];
    selectedSharedSubsectionPath = [];
    try { await loadSharedSections(); } catch (error) { showSaveIndicator(error.message, true); }
    render();
};

window.shareSection = async function(sectionId) {
    const section = sections.find(item => item.id === sectionId);
    if (!section) return;
    const input = prompt('Share with registered usernames (comma-separated):');
    if (!input) return;
    const recipients = [...new Set(input.split(',').map(name => name.trim().toLowerCase()).filter(Boolean))]
        .filter(name => name !== currentUser.username.toLowerCase());
    if (!recipients.length) return alert('Enter at least one other username.');

    const access = prompt('Access type: enter "reader" or "contributor"', 'reader');
    if (access === null) return;
    const permission = access.trim().toLowerCase();
    if (!['reader', 'contributor'].includes(permission)) {
        return alert('Access type must be "reader" or "contributor".');
    }

    try {
        await sharedApi('POST', { action: 'share-section', recipients, permission, sourceSectionId: section.id, section });
        showSaveIndicator(`Section shared as ${permission}`);
        await loadSharedSections();
    } catch (error) {
        showSaveIndicator(error.message, true);
    }
};

window.deleteSharedSection = async function(shareId) {
    if (!confirm('Remove this shared section?')) return;
    try {
        await sharedApi('POST', { action: 'delete-section', shareId });
        selectedSharedSectionId = null;
        await loadSharedSections();
        render();
    } catch (error) {
        showSaveIndicator(error.message, true);
    }
};

window.selectSharedSection = function(shareId) {
    selectedSharedSectionId = Number(shareId);
    render();
};

window.closeSharedSection = function() {
    selectedSharedSectionId = null;
    selectedSharedSubsectionPath = [];
    render();
};

function canEditSharedSection(share) {
    return currentUser.username === 'drakeno' || share.owner === currentUser.username ||
        (share.permission === 'contributor' && share.recipients.includes(currentUser.username));
}

async function saveSharedSection(share) {
    try {
        const data = await sharedApi('POST', { action: 'update-section', shareId: share.id, section: share.section });
        const index = sharedSections.findIndex(item => item.id === share.id);
        if (index !== -1) sharedSections[index] = data.share;
        showSaveIndicator('Shared section saved');
    } catch (error) {
        showSaveIndicator(error.message, true);
        await loadSharedSections();
        render();
    }
}

window.updateSharedSectionTitle = function(shareId, value) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !canEditSharedSection(share) || !value.trim()) return;
    share.section.name = value.trim();
    saveSharedSection(share);
};

window.updateSharedNote = function(shareId, noteIndex, field, value) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const note = share?.section?.notes?.[noteIndex];
    if (!share || !note || !canEditSharedSection(share) || !['title', 'content'].includes(field)) return;
    note[field] = field === 'title' ? (value.trim() || 'Note') : value;
    saveSharedSection(share);
};

window.updateSharedListTitle = function(shareId, listIndex, value) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const list = share?.section?.items?.[listIndex];
    if (!share || !list || !canEditSharedSection(share)) return;
    list.title = value.trim() || 'List';
    saveSharedSection(share);
};

window.updateSharedListItem = function(shareId, listIndex, itemIndex, value) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const item = share?.section?.items?.[listIndex]?.items?.[itemIndex];
    if (!share || !item || !canEditSharedSection(share)) return;
    item.text = value.trim();
    saveSharedSection(share);
};

window.toggleSharedListItem = function(shareId, listIndex, itemIndex) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const item = share?.section?.items?.[listIndex]?.items?.[itemIndex];
    if (!share || !item || !canEditSharedSection(share)) return;
    item.done = !item.done;
    saveSharedSection(share).then(render);
};

function renderSharedSections() {
    const selectedShare = sharedSections.find(share => share.id == selectedSharedSectionId);
    if (selectedShare) return renderSharedSection(selectedShare);

    let html = '<div class="canvas"><div class="canvas-header"><div class="title-section"><i class="fas fa-share-alt"></i><h1>Shared Sections</h1></div><button class="back-btn" onclick="isSharedSectionsView=false; render()"><i class="fas fa-arrow-left"></i> Back</button></div>';
    if (!sharedSections.length) {
        html += '<div class="empty-state-hero"><i class="fas fa-share-alt"></i><p>No sections have been shared with you.</p></div>';
    } else {
        html += '<div class="box-grid" id="sharedBoxGrid">';
        sharedSections.forEach((share, index) => {
            const section = share.section;
            const canDelete = currentUser.username === 'drakeno' || share.owner === currentUser.username;
            const x = section.x !== undefined ? section.x : (index * 30) % 400 + 20;
            const y = section.y !== undefined ? section.y : (index * 40) % 300 + 20;
            const width = section.width || 280 + (index % 3) * 40;
            const height = section.height || 180 + (index % 4) * 30;
            const permission = share.permission === 'contributor' ? 'Contributor' : 'Reader';
            html += `<article class="note-box shared-section-box" onclick="selectSharedSection(${share.id})" style="left:${x}px; top:${y}px; width:${width}px; height:${height}px; cursor:pointer;">
                ${canDelete ? `<button class="box-delete-btn" onclick="event.stopPropagation(); deleteSharedSection(${share.id})" title="Remove share"><i class="fas fa-times"></i></button>` : ''}
                <div class="box-title"><i class="fas fa-folder-open"></i><span>${capitalize(section.name)}</span></div>
                <div class="note-content">${(section.notes || []).length} notes &middot; ${(section.items || []).length} lists${(section.subs || []).length ? ` &middot; ${(section.subs || []).length} subsections` : ''}</div>
                <div class="shared-by"><i class="fas fa-user"></i> ${esc(share.owner)} &middot; ${permission}</div>
            </article>`;
        });
        html += '</div>';
    }
    mainContainer.innerHTML = html + '</div>';
}

function renderSharedSubsectionTree(subs, shareId, depth = 1, parentPath = []) {
    if (!Array.isArray(subs) || subs.length === 0) return '';
    return `<ul class="subsection-list shared-subsection-tree">${subs.map(sub => {
        const path = [...parentPath, sub.name];
        const pathStr = escJs(path.join('/'));
        const notes = sub.notes || [];
        const lists = sub.items || [];
        const summary = `${notes.length} notes · ${lists.length} lists${sub.subs?.length ? ` · ${sub.subs.length} subsections` : ''}`;
        return `<li style="padding-left:${depth * 1.2}rem;cursor:pointer;" onclick="event.stopPropagation(); openSharedSubsection(${shareId}, '${pathStr}')"><i class="fas fa-folder-open"></i> <strong>${esc(sub.name)}</strong><span class="shared-subsection-summary">${summary}</span>${renderSharedSubsectionTree(sub.subs, shareId, depth + 1, path)}</li>`;
    }).join('')}</ul>`;
}
function renderSharedSection(share) {
    const section = share.section;
    const editable = canEditSharedSection(share);
    const permission = share.permission === 'contributor' ? 'Contributor' : 'Reader';
    let html = `<div class="canvas has-selection"><div class="canvas-header"><div class="title-section"><i class="fas fa-folder-open" style="color:#f5e56b;font-size:1.5rem"></i>`;
    html += editable
        ? `<input class="editable-title" value="${esc(section.name)}" onchange="updateSharedSectionTitle(${share.id}, this.value)">`
        : `<h1>${capitalize(section.name)}</h1>`;
    html += `<span class="shared-access-badge"><i class="fas ${editable ? 'fa-pen' : 'fa-eye'}"></i> ${permission}</span></div><button class="back-btn" onclick="closeSharedSection()"><i class="fas fa-arrow-left"></i> Back</button></div>`;

    const notes = section.notes || [];
    const lists = section.items || [];
    if (!notes.length && !lists.length && !(section.subs || []).length) {
        html += '<div class="empty-state-hero"><i class="fas fa-folder-open"></i><p>This shared section is empty.</p></div>';
    } else {
        html += '<div class="box-grid--responsive">';
        notes.forEach((note, noteIndex) => {
            html += `<article class="note-box"><div class="box-title"><i class="fas fa-pen-fancy"></i>${editable ? `<input class="editable-title" value="${esc(note.title || 'Note')}" onchange="updateSharedNote(${share.id}, ${noteIndex}, 'title', this.value)">` : `<span>${esc(note.title || 'Note')}</span>`}</div><div class="note-content">${editable ? `<textarea class="editable-content" onchange="updateSharedNote(${share.id}, ${noteIndex}, 'content', this.value)">${esc(note.content || '')}</textarea>` : `<div class="shared-readonly-content">${esc(note.content || '')}</div>`}</div></article>`;
        });
        lists.forEach((list, listIndex) => {
            html += `<article class="list-box"><div class="box-title"><i class="fas fa-list-ul"></i>${editable ? `<input class="editable-title" value="${esc(list.title || 'List')}" onchange="updateSharedListTitle(${share.id}, ${listIndex}, this.value)">` : `<span>${esc(list.title || 'List')}</span>`}</div><div class="list-items">`;
            (list.items || []).forEach((item, itemIndex) => {
                const icon = item.done ? 'fa-check-circle' : 'fa-circle';
                html += `<div class="sub-list-item"><i class="fas ${icon}" style="color:${item.done ? '#f5e56b' : '#7a7a5a'};${editable ? 'cursor:pointer' : ''}" ${editable ? `onclick="toggleSharedListItem(${share.id}, ${listIndex}, ${itemIndex})"` : ''}></i>${editable ? `<textarea class="editable-item" rows="1" onchange="updateSharedListItem(${share.id}, ${listIndex}, ${itemIndex}, this.value)">${esc(item.text || '')}</textarea>` : `<span>${esc(item.text || '')}</span>`}</div>`;
            });
            if (!(list.items || []).length) html += '<div class="empty-message">No items</div>';
            html += '</div></article>';
        });
        html += '</div>';
    }
    if ((section.subs || []).length) {
        html += `<section class="subsections-list"><div class="shared-folder-title"><i class="fas fa-sitemap"></i> Subsections</div>${renderSharedSubsectionTree(section.subs, share.id)}</section>`;
    }
    mainContainer.innerHTML = html + '</div>';
    setTimeout(autoResizeTextareas, 10);
}
// Backward-compatible name used by the login flow.
window.loadSharedFolders = loadSharedSections;

// Share dialog and live source-section synchronization
let sharedSyncTimer = null;
window.shareSection = async function(sectionId) {
    const section = sections.find(item => item.id === sectionId);
    if (!section) return;
    try {
        const data = await sharedApi('POST', { action: 'list-share-users' });
        const users = data.users || [];
        if (!users.length) return alert('There are no other registered users.');
        const overlay = document.createElement('div');
        overlay.className = 'login-overlay visible';
        overlay.innerHTML = `<section class="auth-card"><h2>Share ${esc(section.name)}</h2>
            <label>Recipients</label><select id="shareRecipients" multiple size="${Math.min(users.length, 8)}">${users.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select>
            <label>Access</label><select id="sharePermission"><option value="reader">Reader</option><option value="contributor">Contributor</option></select>
            <div><button class="auth-btn" id="shareConfirm">Share</button><button class="auth-link" id="shareCancel">Cancel</button></div></section>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#shareCancel').onclick = () => overlay.remove();
        overlay.querySelector('#shareConfirm').onclick = async () => {
            const recipients = [...overlay.querySelector('#shareRecipients').selectedOptions].map(option => option.value);
            if (!recipients.length) return alert('Select at least one recipient.');
            const permission = overlay.querySelector('#sharePermission').value;
            try {
                const result = await sharedApi('POST', { action: 'share-section', recipients, permission, sourceSectionId: section.id, section });
                section.sharedShareIds = [...new Set([...(section.sharedShareIds || []), result.share.id])];
                overlay.remove();
                render();
                showSaveIndicator(`Section shared as ${permission}`);
            } catch (error) { alert(error.message || 'Sharing failed'); }
        };
    } catch (error) {
        showSaveIndicator(error.message, true);
    }
};

function scheduleSharedSectionSync() {
    if (isSharedSectionsView || !currentUser?.username) return;
    clearTimeout(sharedSyncTimer);
    sharedSyncTimer = setTimeout(async () => {
        for (const section of sections) {
            for (const shareId of section.sharedShareIds || []) {
                try {
                    await sharedApi('POST', { action: 'source-update', shareId, section });
                } catch (error) {
                    console.error('Could not update shared section', error);
                }
            }
        }
    }, 700);
}

let sharedSectionsRefreshTimer = null;
setInterval(async () => {
    if (!isSharedSectionsView || !currentUser?.token) return;
    try {
        await loadSharedSections();
        render();
    } catch (error) {
        console.error('Shared sections refresh failed', error);
    }
}, 30000);window.stopSharedSection = async function(shareId) {
    if (!confirm('Stop sharing this section? The original personal section will remain.')) return;
    try {
        await sharedApi('POST', { action: 'stop-sharing', shareId });
        selectedSharedSectionId = null;
        await loadSharedSections(); render(); showSaveIndicator('Sharing stopped');
    } catch (error) { showSaveIndicator(error.message, true); }
};
const renderSharedSectionsWithStopControl = renderSharedSections;
renderSharedSections = function() {
    renderSharedSectionsWithStopControl();
    const share = sharedSections.find(item => item.id == selectedSharedSectionId);
    if (!share || (currentUser.username !== 'drakeno' && share.owner !== currentUser.username)) return;
    const header = mainContainer.querySelector('.canvas-header');
    if (!header || header.querySelector('.stop-sharing-btn')) return;
    const button = document.createElement('button');
    button.className = 'action-btn stop-sharing-btn';
    button.innerHTML = '<i class="fas fa-unlink"></i> Stop sharing';
    button.onclick = () => stopSharedSection(share.id);
    header.appendChild(button);
};
// Do not depend on the debounced render cycle for structural personal-section changes.
window.syncSharedSectionNow = async function(section) {
    if (!section?.sharedShareIds?.length) return;
    for (const shareId of section.sharedShareIds) {
        try { await sharedApi('POST', { action: 'source-update', shareId, section }); }
        catch (error) { console.error('Could not synchronize shared section', error); showSaveIndicator(error.message, true); }
    }
};
const deleteSubsectionWithImmediateSharedSync = window.deleteSubsection;
window.deleteSubsection = function(sectionId, path) {
    const section = sections.find(item => item.id === sectionId);
    const before = JSON.stringify(section?.subs || []);
    const result = deleteSubsectionWithImmediateSharedSync(sectionId, path);
    if (section && before !== JSON.stringify(section.subs || [])) syncSharedSectionNow(section);
    return result;
};
// Selected shared subsections render their own notes and lists while retaining the parent share connection.
let selectedSharedSubsectionPath = [];
function getSharedSubsection(share, path) {
    let items = share?.section?.subs || [], found = null;
    for (const name of path) { found = items.find(item => item.name === name); if (!found) return null; items = found.subs || []; }
    return found;
}
window.openSharedSubsection = function(shareId, path) {
    selectedSharedSectionId = Number(shareId);
    selectedSharedSubsectionPath = Array.isArray(path) ? path : String(path).split('/').filter(Boolean);
    isSharedSectionsView = true; selectedSectionId = null; selectedSubsectionPath = []; render();
};
window.closeSharedSubsection = function() { selectedSharedSubsectionPath = []; render(); };
window.updateSharedSubsectionValue = function(shareId, path, kind, first, second, field, value) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const sub = getSharedSubsection(share, path);
    if (!share || !sub || !canEditSharedSection(share)) return;
    let target;
    if (kind === 'note') target = sub.notes?.[first];
    if (kind === 'list') target = sub.items?.[first];
    if (kind === 'item') target = sub.items?.[first]?.items?.[second];
    if (!target) return;
    target[field] = field === 'title' ? (value.trim() || 'Untitled') : value;
    saveSharedSection(share);
};
const renderSharedSectionWithSubsectionSupport = renderSharedSection;
renderSharedSection = function(share) {
    if (!selectedSharedSubsectionPath.length) return renderSharedSectionWithSubsectionSupport(share);
    const sub = getSharedSubsection(share, selectedSharedSubsectionPath);
    if (!sub) { selectedSharedSubsectionPath = []; return renderSharedSectionWithSubsectionSupport(share); }
    const editable = canEditSharedSection(share), path = escJs(selectedSharedSubsectionPath.join('/'));
    let html = '<div class="canvas has-selection"><div class="canvas-header"><div class="title-section"><i class="fas fa-folder-open" style="color:#f5e56b;font-size:1.5rem"></i><h1>' + esc(capitalize(sub.name)) + '</h1></div><button class="back-btn" onclick="closeSharedSubsection()"><i class="fas fa-arrow-left"></i> Back</button></div><div class="box-grid--responsive">';
    (sub.notes || []).forEach((note, index) => {
        const title = editable ? '<input class="editable-title" value="' + esc(note.title || 'Note') + '" onchange="updateSharedSubsectionValue(' + share.id + ', \'" + path + "\', \'note\', ' + index + ', 0, \'title\', this.value)">' : '<span>' + esc(note.title || 'Note') + '</span>';
        const content = editable ? '<textarea class="editable-content" onchange="updateSharedSubsectionValue(' + share.id + ', \'" + path + "\', \'note\', ' + index + ', 0, \'content\', this.value)">' + esc(note.content || '') + '</textarea>' : '<div class="shared-readonly-content">' + esc(note.content || '') + '</div>';
        html += '<article class="note-box"><div class="box-title"><i class="fas fa-pen-fancy"></i>' + title + '</div><div class="note-content">' + content + '</div></article>';
    });
    (sub.items || []).forEach((list, listIndex) => {
        const title = editable ? '<input class="editable-title" value="' + esc(list.title || 'List') + '" onchange="updateSharedSubsectionValue(' + share.id + ', \'" + path + "\', \'list\', ' + listIndex + ', 0, \'title\', this.value)">' : '<span>' + esc(list.title || 'List') + '</span>';
        let rows = ''; (list.items || []).forEach((item, itemIndex) => { const value = editable ? '<textarea class="editable-item" rows="1" onchange="updateSharedSubsectionValue(' + share.id + ', \'" + path + "\', \'item\', ' + listIndex + ', ' + itemIndex + ', \'text\', this.value)">' + esc(item.text || '') + '</textarea>' : '<span>' + esc(item.text || '') + '</span>'; rows += '<div class="sub-list-item">' + value + '</div>'; });
        html += '<article class="list-box"><div class="box-title"><i class="fas fa-list-ul"></i>' + title + '</div><div class="list-items">' + (rows || '<div class="empty-message">No items</div>') + '</div></article>';
    });
    // Show nested subsections as clickable cards
    if (sub.subs && sub.subs.length > 0) {
        html += '<div class="subsections-list" style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid #2a2a1a;width:100%;">';
        html += '<div class="shared-folder-title"><i class="fas fa-sitemap"></i> Subsections</div>';
        html += renderSharedSubsectionCards(sub.subs, share.id, 1, selectedSharedSubsectionPath);
        html += '</div>';
    }
    if (!(sub.notes || []).length && !(sub.items || []).length && !(sub.subs || []).length) html += '<div class="empty-state-hero"><i class="fas fa-folder-open"></i><p>This subsection is empty.</p></div>';
    html += '</div></div>'; mainContainer.innerHTML = html; setTimeout(autoResizeTextareas, 10);
};
// Shared subsections use the same card vocabulary as personal sections instead of an unformatted list.
function renderSharedSubsectionCards(subs, shareId, depth = 1, parentPath = []) {
    if (!Array.isArray(subs) || !subs.length) return '';
    return '<div class="box-grid--responsive shared-subsection-grid">' + subs.map((sub, index) => {
        const path = [...parentPath, sub.name];
        const pathValue = escJs(path.join('/'));
        const noteCount = (sub.notes || []).length;
        const listCount = (sub.items || []).length;
        const childCount = (sub.subs || []).length;
        const x = sub.x !== undefined ? sub.x : 20 + index * 24;
        const y = sub.y !== undefined ? sub.y : 20 + index * 24;
        const body = '<div class="note-content">' + noteCount + ' notes &middot; ' + listCount + ' lists' + (childCount ? ' &middot; ' + childCount + ' subsections' : '') + '</div>';
        return '<article class="note-box shared-section-box" style="left:' + x + 'px;top:' + y + 'px;cursor:pointer" onclick="event.stopPropagation(); openSharedSubsection(' + shareId + ", '" + pathValue + "')" + '"><div class="box-title"><i class="fas fa-folder-open"></i><span>' + esc(capitalize(sub.name)) + '</span></div>' + body + renderSharedSubsectionCards(sub.subs, shareId, depth + 1, path) + '</article>';
    }).join('') + '</div>';
}
const renderSharedSectionWithRoleHeader = renderSharedSection;
renderSharedSection = function(share) {
    renderSharedSectionWithRoleHeader(share);
    if (selectedSharedSubsectionPath.length) return;
    const header = mainContainer.querySelector('.canvas-header .title-section');
    if (!header || header.querySelector('.shared-recipients')) return;
    const recipients = (share.recipients || []).join(', ') || 'No recipients';
    const role = share.permission === 'contributor' ? 'Contributor' : 'Reader';
    const detail = document.createElement('span');
    detail.className = 'shared-access-badge shared-recipients';
    detail.title = 'Recipients: ' + recipients;
    detail.innerHTML = '<i class="fas fa-users"></i> ' + role + ': ' + esc(recipients);
    header.appendChild(detail);
};
// Exact shared editor: reuse the personal renderer and CRUD model, then save through the share connection.
let activeSharedEditorId = null;
let savedPersonalEditorState = null;
let sharedEditorSaveTimer = null;
let sharedEditorLastSnapshot = null;
const normalRenderForSharedEditor = render;
const normalClearSelectionForSharedEditor = clearSelection;
const normalDeleteSectionForSharedEditor = window.deleteSection;

function activeSharedEditorShare() { return sharedSections.find(share => share.id === activeSharedEditorId) || null; }
function leaveSharedEditor() {
    if (!savedPersonalEditorState) return;
    sections = savedPersonalEditorState.sections; nextId = savedPersonalEditorState.nextId;
    selectedSectionId = savedPersonalEditorState.selectedSectionId; selectedSubsectionPath = savedPersonalEditorState.selectedSubsectionPath;
    activeSharedEditorId = null; savedPersonalEditorState = null; sharedEditorLastSnapshot = null; isSharedSectionsView = false;
    normalRenderForSharedEditor();
}
window.openSharedFromSidebar = function(shareId) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share) return;
    if (!savedPersonalEditorState) savedPersonalEditorState = { sections, nextId, selectedSectionId, selectedSubsectionPath };
    activeSharedEditorId = share.id; sharedEditorLastSnapshot = JSON.stringify(share.section); sections = [share.section]; nextId = Math.max(1, Number(share.section.id || 0) + 1);
    selectedSectionId = share.section.id; selectedSubsectionPath = []; isSharedSectionsView = false; render();
};
window.selectSharedSection = function(shareId) {
    selectedSharedSectionId = Number(shareId);
    isSharedSectionsView = true;
    selectedSectionId = null;
    selectedSubsectionPath = [];
    selectedSharedSubsectionPath = [];
    activeSharedEditorId = null;
    render();
};
render = function() {
    const share = activeSharedEditorShare();
    if (!share) return normalRenderForSharedEditor();
    renderSidebar(); renderMain();
    const editable = canEditSharedSection(share);
    mainContainer.classList.toggle('shared-editor-readonly', !editable);
    if (!editable) {
        mainContainer.querySelectorAll('input, textarea').forEach(field => { field.readOnly = true; field.disabled = false; });
        mainContainer.querySelectorAll('.box-delete-btn, .delete-subsection-btn, .edit-title-btn, .box-actions, .action-btn').forEach(control => { if (!control.classList.contains('back-btn')) control.style.display = 'none'; });
        mainContainer.querySelectorAll('[onclick]').forEach(control => { if (!control.classList.contains('back-btn')) control.removeAttribute('onclick'); });
    } else {
        const snapshot = JSON.stringify(share.section);
        if (snapshot !== sharedEditorLastSnapshot) {
            // Mark this version handled before saving: an API error must not create a render/save loop.
            sharedEditorLastSnapshot = snapshot;
            clearTimeout(sharedEditorSaveTimer);
            sharedEditorSaveTimer = setTimeout(() => saveSharedSection(share), 300);
        }
    }
};
clearSelection = function() { if (activeSharedEditorId !== null) return leaveSharedEditor(); return normalClearSelectionForSharedEditor(); };
window.deleteSection = async function(id) {
    if (activeSharedEditorId === null) return normalDeleteSectionForSharedEditor(id);
    const share = activeSharedEditorShare();
    if (!share || !canEditSharedSection(share) || !confirm('Delete this shared section and its linked personal section?')) return;
    await deleteSharedSection(share.id); leaveSharedEditor();
};
const normalDeleteSubsectionForSharedEditor = window.deleteSubsection;
window.deleteSubsection = function(sectionId, path) {
    if (activeSharedEditorId === null) return normalDeleteSubsectionForSharedEditor(sectionId, path);
    const section = sections.find(item => item.id === sectionId), parts = String(path).split('/').filter(Boolean);
    if (!section || !parts.length || !confirm('Delete this shared subsection?')) return;
    let siblings = section.subs || [];
    for (let i = 0; i < parts.length - 1; i++) { const parent = siblings.find(item => item.name === parts[i]); if (!parent) return; siblings = parent.subs || []; }
    const index = siblings.findIndex(item => item.name === parts.at(-1)); if (index < 0) return;
    siblings.splice(index, 1); selectedSubsectionPath = []; render();
};
// Only send a shared-source write when the linked source section actually changed.
const sharedSourceSignatures = new Map();
scheduleSharedSectionSync = function() {
    if (isSharedSectionsView || !currentUser?.username) return;
    clearTimeout(sharedSyncTimer);
    sharedSyncTimer = setTimeout(async () => {
        for (const section of sections) {
            const signature = JSON.stringify(section);
            for (const shareId of section.sharedShareIds || []) {
                const key = String(shareId);
                if (sharedSourceSignatures.get(key) === signature) continue;
                try {
                    await sharedApi('POST', { action: 'source-update', shareId, section });
                    sharedSourceSignatures.set(key, signature);
                } catch (error) { console.error('Could not synchronize shared section', error); }
            }
        }
    }, 800);
};

// Owners manage recipients and access level directly from the shared section.
window.manageSharedAccess = async function(shareId) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const isOwner = currentUser?.username === 'drakeno' || share?.owner === currentUser?.username;
    if (!share || !isOwner) return;
    try {
        const data = await sharedApi('POST', { action: 'list-share-users' });
        const users = (data.users || []).filter(name => name !== share.owner);
        const overlay = document.createElement('div');
        overlay.className = 'login-overlay visible';
        overlay.innerHTML = `<section class="auth-card share-access-card"><h2>Manage access</h2>
            <p class="share-owner-label"><i class="fas fa-user"></i> Shared from <strong>${esc(share.owner)}</strong></p>
            <label>People with access</label>
            <select id="manageShareRecipients" multiple size="${Math.min(Math.max(users.length, 3), 8)}">${users.map(name => `<option value="${esc(name)}" ${share.recipients.includes(name) ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select>
            <label>Access for selected people</label>
            <select id="manageSharePermission"><option value="reader" ${share.permission === 'reader' ? 'selected' : ''}>Reader</option><option value="contributor" ${share.permission === 'contributor' ? 'selected' : ''}>Contributor</option></select>
            <p class="share-access-help">Readers can view this section. Contributors can edit it.</p>
            <div><button class="auth-btn" id="manageShareSave">Save access</button><button class="auth-link" id="manageShareCancel">Cancel</button></div></section>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#manageShareCancel').onclick = () => overlay.remove();
        overlay.querySelector('#manageShareSave').onclick = async () => {
            const recipients = [...overlay.querySelector('#manageShareRecipients').selectedOptions].map(option => option.value);
            if (!recipients.length) return alert('Select at least one recipient. Use Stop sharing to remove the share entirely.');
            const permission = overlay.querySelector('#manageSharePermission').value;
            try {
                const result = await sharedApi('POST', { action: 'manage-share', shareId: share.id, recipients, permission });
                const index = sharedSections.findIndex(item => item.id === share.id);
                if (index !== -1) sharedSections[index] = result.share;
                overlay.remove(); render(); showSaveIndicator('Sharing access updated');
            } catch (error) { alert(error.message || 'Could not update access'); }
        };
    } catch (error) { showSaveIndicator(error.message, true); }
};

const renderSharedSectionsWithAccessManagement = renderSharedSections;
renderSharedSections = function() {
    renderSharedSectionsWithAccessManagement();
    const share = sharedSections.find(item => item.id == selectedSharedSectionId);
    const isOwner = currentUser?.username === 'drakeno' || share?.owner === currentUser?.username;
    if (!share) return;
    const header = mainContainer.querySelector('.canvas-header');
    if (!header) return;
    if (isOwner && !header.querySelector('.manage-sharing-btn')) {
        const button = document.createElement('button');
        button.className = 'action-btn manage-sharing-btn';
        button.innerHTML = '<i class="fas fa-user-cog"></i> Manage access';
        button.title = 'Manage who can access this shared section';
        button.onclick = () => manageSharedAccess(share.id);
        header.appendChild(button);
    }
    if (!header.querySelector('.shared-from-label')) {
        const label = document.createElement('span');
        label.className = 'shared-from-label';
        label.innerHTML = `<i class="fas fa-user"></i> Shared from ${esc(share.owner)}`;
        header.querySelector('.title-section')?.appendChild(label);
    }
};
