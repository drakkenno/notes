// Recipient-based section sharing
// Keep the shared endpoint on the same deployment as the Notes API.
const SHARED_API_URL = VERCEL_API_URL.replace(/\/api\/notes$/, '/api/shared');
let sharedSections = [];
const pendingSharedSaveIds = new Set();
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

function sharedSectionAliases(share) {
    const owner = String(share?.owner || '');
    return [...new Set([
        share?.sourceKey && owner + ':key:' + share.sourceKey,
        share?.connection?.sourceSectionId && owner + ':source:' + share.connection.sourceSectionId,
        share?.sourceSectionId && owner + ':source:' + share.sourceSectionId,
        share?.section?.id && owner + ':section:' + share.section.id
    ].filter(Boolean))];
}

function collapseSharedSectionDuplicates(shares) {
    const canonical = [];
    const byAlias = new Map();
    for (const share of shares || []) {
        const aliases = sharedSectionAliases(share);
        const current = aliases.map(alias => byAlias.get(alias)).find(Boolean);
        if (!current) {
            canonical.push(share);
            aliases.forEach(alias => byAlias.set(alias, share));
            continue;
        }
        const roles = { ...(current.recipientPermissions || {}) };
        current.recipients = Array.isArray(current.recipients) ? current.recipients : [];
        for (const recipient of share.recipients || []) {
            if (!current.recipients.includes(recipient)) current.recipients.push(recipient);
            if (share.recipientPermissions?.[recipient] === 'contributor') roles[recipient] = 'contributor';
            else if (!roles[recipient]) roles[recipient] = 'reader';
        }
        current.recipientPermissions = roles;
        aliases.forEach(alias => byAlias.set(alias, current));
    }
    return canonical;
}

async function loadSharedSections() {
    if (!currentUser) return;
    const data = await sharedApi();
    sharedSections = collapseSharedSectionDuplicates(data.sections || []);
}

window.showSharedSections = async function() {
    isSharedSectionsView = true;
    selectedSharedSectionId = null;
    selectedSectionId = null;
    selectedSubsectionPath = [];
    selectedSharedSubsectionPath = [];
    // Shared data is refreshed only by the explicit Pull button.
    render();
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

function getUserSharePermission(share, username = currentUser?.username) {
    if (share?.owner === username || username === 'drakeno') return 'owner';
    return share?.recipientPermissions?.[username] === 'contributor' ? 'contributor' : 'reader';
}

function canEditSharedSection(share) {
    return currentUser.username === 'drakeno' || share.owner === currentUser.username ||
        (getUserSharePermission(share) === 'contributor' && share.recipients.includes(currentUser.username));
}

function saveSharedSection(share) {
    // Edits remain local until the user explicitly presses Sync now.
    const index = sharedSections.findIndex(item => item.id === share.id);
    if (index !== -1) sharedSections[index] = share;
    pendingSharedSaveIds.add(share.id);
    showSaveIndicator('Shared changes pending Push');
}

window.pushPendingSharedSectionsNow = async function() {
    const pending = sharedSections.filter(share => pendingSharedSaveIds.has(share.id));
    for (const share of pending) {
        await pushSharedSection(share);
        pendingSharedSaveIds.delete(share.id);
    }
};

async function pushSharedSection(share) {
    const data = await sharedApi('POST', { action: 'update-section', shareId: share.id, section: share.section });
    const index = sharedSections.findIndex(item => item.id === share.id);
    if (index !== -1) sharedSections[index] = data.share;
    if (activeSharedEditorId === share.id && sections.length === 1) sections[0] = data.share.section;
    showSaveIndicator('Shared section synchronized with personal section');
}


function isSharedOwner(share) {
    return currentUser?.username === 'drakeno' || share?.owner === currentUser?.username;
}

window.addSharedSubsection = function(shareId, parentPath = '') {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !canEditSharedSection(share)) return;
    const name = prompt('Subsection name:');
    if (!name || !name.trim()) return;
    const newSub = { name: name.trim().toLowerCase(), notes: [], items: [], subs: [] };
    let siblings = share.section.subs || (share.section.subs = []);
    for (const part of String(parentPath).split('/').filter(Boolean)) {
        const parent = siblings.find(item => item.name === part);
        if (!parent) return;
        siblings = parent.subs || (parent.subs = []);
    }
    siblings.push(newSub);
    saveSharedSection(share);
    render();
};

window.deleteSharedSubsection = function(shareId, path) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !isSharedOwner(share) || !confirm('Delete this shared subsection?')) return;
    const parts = String(path).split('/').filter(Boolean);
    let siblings = share.section.subs || [];
    for (let index = 0; index < parts.length - 1; index++) {
        const parent = siblings.find(item => item.name === parts[index]);
        if (!parent) return;
        siblings = parent.subs || [];
    }
    const index = siblings.findIndex(item => item.name === parts.at(-1));
    if (index < 0) return;
    siblings.splice(index, 1);
    saveSharedSection(share);
    render();
};

window.addSharedSubNote = function(shareId, subPath) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const sub = getSharedSubsection(share, String(subPath).split('/').filter(Boolean));
    if (!share || !sub || !canEditSharedSection(share)) return;
    (sub.notes || (sub.notes = [])).push({ title: 'New Note', content: '', width: 300, height: 160 });
    saveSharedSection(share); render();
};
window.addSharedSubList = function(shareId, subPath) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const sub = getSharedSubsection(share, String(subPath).split('/').filter(Boolean));
    if (!share || !sub || !canEditSharedSection(share)) return;
    (sub.items || (sub.items = [])).push({ title: 'New List', items: [], width: 320, height: 200 });
    saveSharedSection(share); render();
};

window.deleteSharedNote = function(shareId, index) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !canEditSharedSection(share)) return;
    share.section.notes.splice(index, 1); saveSharedSection(share); render();
};
window.deleteSharedList = function(shareId, index) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !canEditSharedSection(share)) return;
    share.section.items.splice(index, 1); saveSharedSection(share); render();
};
window.deleteSharedSubNote = function(shareId, subPath, index) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const sub = getSharedSubsection(share, String(subPath).split('/').filter(Boolean));
    if (!share || !sub || !canEditSharedSection(share)) return;
    sub.notes.splice(index, 1); saveSharedSection(share); render();
};
window.deleteSharedSubList = function(shareId, subPath, index) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const sub = getSharedSubsection(share, String(subPath).split('/').filter(Boolean));
    if (!share || !sub || !canEditSharedSection(share)) return;
    sub.items.splice(index, 1); saveSharedSection(share); render();
};

function focusNewestSharedTitle(kind) {
    setTimeout(() => {
        const cards = document.querySelectorAll(kind === 'note' ? '.note-box .editable-title' : '.list-box .editable-title');
        const field = cards[cards.length - 1];
        if (field) { field.focus(); field.select(); }
    }, 50);
}

window.addSharedNote = function(shareId) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !canEditSharedSection(share)) return;
    const notes = share.section.notes || (share.section.notes = []);
    const index = notes.length;
    notes.push({ title: 'New Note', content: '', x: 10 + (index * 20) % 200, y: 10 + (index * 20) % 200, width: 300, height: 160 });
    saveSharedSection(share);
    render();
    focusNewestSharedTitle('note');
};

window.addSharedList = function(shareId) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !canEditSharedSection(share)) return;
    const lists = share.section.items || (share.section.items = []);
    const index = lists.length;
    lists.push({ title: 'New List', items: [], x: 340 + (index * 20) % 200, y: 10 + (index * 20) % 200, width: 320, height: 140, autoSize: true });
    saveSharedSection(share);
    render();
    focusNewestSharedTitle('list');
};

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
    item.text = value;
    saveSharedSection(share);
};

window.addSharedListItem = function(shareId, listIndex, afterIndex = null) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const list = share?.section?.items?.[listIndex];
    if (!share || !list || !canEditSharedSection(share)) return;
    const items = list.items || (list.items = []);
    const newIndex = afterIndex === null ? items.length : afterIndex + 1;
    items.splice(newIndex, 0, { text: '', done: false, rating: 0 });
    saveSharedSection(share);
    render();
    setTimeout(() => {
        const box = document.querySelector(`.list-box[data-type="sharedList"][data-share-id="${share.id}"][data-index="${listIndex}"]`);
        const field = box?.querySelectorAll('.editable-item')[newIndex];
        if (field) { field.focus(); field.select(); }
    }, 50);
};

window.deleteSharedListItem = function(shareId, listIndex, itemIndex) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const items = share?.section?.items?.[listIndex]?.items;
    const item = items?.[itemIndex];
    if (!share || !item || !canEditSharedSection(share)) return;
    if (!confirm(`Delete list item "${item.text || '(empty item)'}"? This cannot be undone.`)) return;
    items.splice(itemIndex, 1);
    saveSharedSection(share);
    render();
};

window.setSharedListLocation = function(shareId, listIndex, itemIndex = null) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const list = share?.section?.items?.[listIndex];
    const target = itemIndex === null ? list : list?.items?.[itemIndex];
    if (!share || !target || !canEditSharedSection(share)) return;
    const label = itemIndex === null
        ? 'Paste Google Maps link or address for this list:'
        : 'Paste Google Maps link or address:';
    const location = prompt(label, target.location || '');
    if (location === null) return;
    target.location = location.trim();
    saveSharedSection(share);
    render();
};

window.exportSharedSection = function(shareId) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share?.section) return;
    const section = share.section;
    downloadJson(`${safeFileName(section.name)}.json`, {
        type: 'section',
        name: section.name,
        notes: section.notes || [],
        items: section.items || [],
        subs: section.subs || []
    });
    showSaveIndicator(`Exported shared section "${capitalize(section.name)}"`);
};


window.toggleSharedListItem = function(shareId, listIndex, itemIndex) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const item = share?.section?.items?.[listIndex]?.items?.[itemIndex];
    if (!share || !item || !canEditSharedSection(share)) return;
    item.done = !item.done;
    saveSharedSection(share);
    render();
};

function renderSharedSections() {
    const selectedShare = sharedSections.find(share => share.id == selectedSharedSectionId);
    if (selectedShare) return renderSharedSection(selectedShare);

    let html = '<div class="canvas"><div class="canvas-header"><div class="title-section"><i class="fas fa-share-alt"></i><h1>Shared Sections</h1></div><div style="display:flex;gap:.6rem;align-items:center"><button class="back-btn" data-onclick="organizeSharedCanvas()"><i class="fas fa-th-large"></i> Organize</button><button class="back-btn" data-onclick="isSharedSectionsView=false; render()"><i class="fas fa-arrow-left"></i> Back</button></div></div>';
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
            const userRole = getUserSharePermission(share);
            const permission = userRole === 'owner' ? 'Owner' : userRole === 'contributor' ? 'Contributor' : 'Reader';
            html += `<article class="note-box shared-section-box" data-onclick="selectSharedSection(${share.id})" style="left:${x}px; top:${y}px; width:${width}px; height:${height}px; cursor:pointer;">
                ${canDelete ? `<button class="box-delete-btn" data-onclick="event.stopPropagation(); deleteSharedSection(${share.id})" title="Remove share"><i class="fas fa-times"></i></button>` : ''}
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
        const share = sharedSections.find(item => item.id === Number(shareId));
        const add = canEditSharedSection(share) ? `<i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSharedSubsection(${shareId}, '${pathStr}')" title="Add subsection"></i>` : '';
        const remove = isSharedOwner(share) ? `<i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSharedSubsection(${shareId}, '${pathStr}')" title="Delete subsection"></i>` : '';
        return `<li style="padding-left:${depth * 1.2}rem;cursor:pointer;" data-onclick="event.stopPropagation(); openSharedSubsection(${shareId}, '${pathStr}')"><i class="fas fa-folder-open"></i> <strong>${esc(sub.name)}</strong><span class="shared-subsection-summary">${summary}</span>${add}${remove}${renderSharedSubsectionTree(sub.subs, shareId, depth + 1, path)}</li>`;
    }).join('')}</ul>`;
}
function renderSharedSection(share) {
    const section = share.section;
    const editable = canEditSharedSection(share);
    const userRole = getUserSharePermission(share);
    const permission = userRole === 'owner' ? 'Owner' : userRole === 'contributor' ? 'Contributor' : 'Reader';
    let html = `<div class="canvas has-selection"><div class="canvas-header"><div class="title-section"><i class="fas fa-folder-open" style="color:#f5e56b;font-size:1.5rem"></i>`;
    html += editable
        ? `<input class="editable-title" value="${esc(section.name)}" data-onchange="updateSharedSectionTitle(${share.id}, this.value)">`
        : `<h1>${capitalize(section.name)}</h1>`;
    html += `<span class="shared-access-badge"><i class="fas ${editable ? 'fa-pen' : 'fa-eye'}"></i> ${permission}</span></div><button class="back-btn canvas-action-btn shared-export-btn" data-onclick="exportSharedSection(${share.id})"><i class="fas fa-download"></i> Export</button><button class="back-btn" data-onclick="closeSharedSection()"><i class="fas fa-arrow-left"></i> Back</button></div>`;

    const notes = section.notes || [];
    const lists = section.items || [];
    if (!notes.length && !lists.length && !(section.subs || []).length) {
        html += '<div class="empty-state-hero"><i class="fas fa-folder-open"></i><p>This shared section is empty.</p></div>';
    } else {
        html += '<div class="box-grid--responsive">';
        notes.forEach((note, noteIndex) => {
            html += `<article class="note-box">${editable ? `<button class="box-delete-btn" data-onclick="deleteSharedNote(${share.id}, ${noteIndex})"><i class="fas fa-times"></i></button>` : ''}<div class="box-title"><i class="fas fa-pen-fancy"></i>${editable ? `<input class="editable-title" value="${esc(note.title || 'Note')}" data-onchange="updateSharedNote(${share.id}, ${noteIndex}, 'title', this.value)">` : `<span>${esc(note.title || 'Note')}</span>`}</div><div class="note-content">${editable ? `<textarea class="editable-content" data-oninput="updateSharedNote(${share.id}, ${noteIndex}, 'content', this.value)">${esc(note.content || '')}</textarea>` : `<div class="shared-readonly-content">${esc(note.content || '')}</div>`}</div></article>`;
        });
        lists.forEach((list, listIndex) => {
            const listLocation = renderLocationBadge(list.location);
            html += `<article class="list-box" data-type="sharedList" data-share-id="${share.id}" data-index="${listIndex}">${editable ? `<button class="box-delete-btn" data-onclick="deleteSharedList(${share.id}, ${listIndex})"><i class="fas fa-times"></i></button>` : ''}<div class="box-title"><i class="fas fa-list-ul"></i>${editable ? `<input class="editable-title" value="${esc(list.title || 'List')}" data-onchange="updateSharedListTitle(${share.id}, ${listIndex}, this.value)">` : `<span>${esc(list.title || 'List')}</span>`}${listLocation}${editable ? `<span class="box-actions"><i class="fas fa-map-marker-alt ${list.location ? 'has-location' : ''}" data-onclick="event.stopPropagation(); setSharedListLocation(${share.id}, ${listIndex})" title="Add or edit list location"></i><i class="fas fa-plus" data-onclick="addSharedListItem(${share.id}, ${listIndex})" title="Add item"></i></span>` : ''}</div><div class="list-items">`;
            (list.items || []).forEach((item, itemIndex) => {
                const icon = item.done ? 'fa-check-circle' : 'fa-circle';
                html += `<div class="sub-list-item"><i class="fas ${icon}" style="color:${item.done ? '#f5e56b' : '#7a7a5a'};${editable ? 'cursor:pointer' : ''}" ${editable ? `data-onclick="toggleSharedListItem(${share.id}, ${listIndex}, ${itemIndex})"` : ''}></i>${editable ? `<textarea class="editable-item" rows="1" data-oninput="updateSharedListItem(${share.id}, ${listIndex}, ${itemIndex}, this.value)" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'" onfocus="this.select()">${esc(item.text || '')}</textarea>` : `<span>${esc(item.text || '')}</span>`}${renderLocationBadge(item.location, true)}${editable ? `<span class="item-tag">${item.done ? 'done' : 'pending'}</span><i class="fas fa-map-marker-alt ${item.location ? 'has-location' : ''}" data-onclick="event.stopPropagation(); setSharedListLocation(${share.id}, ${listIndex}, ${itemIndex})" title="Add or edit location"></i><i class="fas fa-times item-delete" data-onclick="deleteSharedListItem(${share.id}, ${listIndex}, ${itemIndex})" title="Delete item"></i>` : ''}</div>`;
            });
            if (!(list.items || []).length) html += '<div class="empty-message">No items</div>';
            html += `</div>${editable ? `<button class="add-item-btn" data-onclick="addSharedListItem(${share.id}, ${listIndex})"><i class="fas fa-plus"></i> Add item</button>` : ''}</article>`;
        });
        html += '</div>';
    }
    if ((section.subs || []).length) {
        html += `<section class="subsections-list"><div class="shared-folder-title"><i class="fas fa-sitemap"></i> Subsections</div>${renderSharedSubsectionTree(section.subs, share.id)}</section>`;
    }
    if (editable) html += `<div style="margin-top:2rem; padding-top:1rem; border-top:1px solid #2a2a1a; display:flex; gap:0.8rem; flex-wrap:wrap;"><button class="action-btn" data-onclick="addSharedNote(${share.id})"><i class="fas fa-plus"></i> Add note</button><button class="action-btn" data-onclick="addSharedList(${share.id})"><i class="fas fa-plus"></i> Add list</button><button class="action-btn" data-onclick="addSharedSubsection(${share.id})"><i class="fas fa-plus"></i> Add subsection</button></div>`;
    mainContainer.innerHTML = html + '</div>';
    window.restoreSelectedBox?.();
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

// Shared sections are refreshed only when the user opens Shared Sections.
window.stopSharedSection = async function(shareId) {
    if (!confirm('Stop sharing? The current shared section will be restored to the owner?s personal notes.')) return;
    try {
        const result = await sharedApi('POST', { action: 'stop-sharing', shareId });
        if (share.owner === currentUser?.username && result.restoredSection && !sections.some(item => item.id === result.restoredSection.id)) sections.push(result.restoredSection);
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
window.syncSharedSectionNow = async function() {
    // Structural changes are synchronized by the next explicit Push.
};

// Selected shared subsections render their own notes and lists while retaining the parent share connection.
let selectedSharedSubsectionPath = [];
function getSharedSubsection(share, path) {
    // The delegated DOM handlers pass data attributes as strings, while
    // callers inside the renderer often have an array. Treat both forms as
    // a sequence of subsection names.
    const names = Array.isArray(path) ? path : String(path || '').split('/').filter(Boolean);
    let items = share?.section?.subs || [], found = null;
    for (const name of names) { found = items.find(item => item.name === name); if (!found) return null; items = found.subs || []; }
    return found;
}
window.openSharedSubsection = function(shareId, path) {
    selectedSharedSectionId = Number(shareId);
    selectedSharedSubsectionPath = Array.isArray(path) ? path : String(path).split('/').filter(Boolean);
    isSharedSectionsView = true; selectedSectionId = null; selectedSubsectionPath = []; render();
};
window.closeSharedSubsection = function() { selectedSharedSubsectionPath = []; render(); };
window.updateSharedSubsectionName = function(shareId, path, value) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const sub = getSharedSubsection(share, String(path).split('/').filter(Boolean));
    const nextName = String(value || '').trim().toLowerCase();
    if (!share || !sub || !canEditSharedSection(share) || !nextName) return;
    const oldPath = String(path).split('/').filter(Boolean);
    sub.name = nextName;
    selectedSharedSubsectionPath = [...oldPath.slice(0, -1), nextName];
    saveSharedSection(share); render();
};
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
    const hasContent = (sub.notes || []).length || (sub.items || []).length || (sub.subs || []).length;
    let html = '<div class="canvas has-selection"><div class="canvas-header"><div class="title-section"><i class="fas fa-folder-open" style="color:#f5e56b;font-size:1.5rem"></i><h1>' + esc(capitalize(sub.name)) + '</h1></div><div style="display:flex;gap:.6rem;align-items:center"><button class="back-btn" data-onclick="organizeSharedSubsectionCanvas()"><i class="fas fa-th-large"></i> Organize</button><button class="back-btn" data-onclick="closeSharedSubsection()"><i class="fas fa-arrow-left"></i> Back</button></div></div>';
    if (!hasContent) html += '<div class="empty-state-hero"><i class="fas fa-folder-open"></i><p>Subsection: ' + esc(capitalize(sub.name)) + '<br><span style="font-size:0.9rem;color:#7a7a5a">Add notes and lists below</span></p></div>';
    html += '<div class="box-grid--responsive" id="sharedSubsectionGrid">';
    (sub.notes || []).forEach(note => { html += '<article class="note-box"><div class="box-title"><i class="fas fa-pen-fancy"></i><span>' + esc(note.title || 'Note') + '</span></div><div class="note-content"><div class="shared-readonly-content">' + esc(note.content || '') + '</div></div></article>'; });
    (sub.items || []).forEach(list => { const rows = (list.items || []).map(item => '<div class="sub-list-item"><span>' + esc(item.text || '') + '</span></div>').join('') || '<div class="empty-message">No items</div>'; html += '<article class="list-box"><div class="box-title"><i class="fas fa-list-ul"></i><span>' + esc(list.title || 'List') + '</span></div><div class="list-items">' + rows + '</div></article>'; });
    html += '</div>';
    if (sub.subs && sub.subs.length) html += '<section class="subsections-list"><div class="shared-folder-title"><i class="fas fa-sitemap"></i> Subsections</div>' + renderSharedSubsectionCards(sub.subs, share.id, 1, selectedSharedSubsectionPath) + '</section>';
    mainContainer.innerHTML = html + '</div>'; setTimeout(autoResizeTextareas, 10);
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
        return '<article class="note-box shared-section-box" style="left:' + x + 'px;top:' + y + 'px;cursor:pointer" data-onclick="event.stopPropagation(); openSharedSubsection(' + shareId + ", '" + pathValue + "')" + '"><div class="box-title"><i class="fas fa-folder-open"></i><span>' + esc(capitalize(sub.name)) + '</span></div>' + body + renderSharedSubsectionCards(sub.subs, shareId, depth + 1, path) + '</article>';
    }).join('') + '</div>';
}
const renderSharedSectionWithRoleHeader = renderSharedSection;
renderSharedSection = function(share) {
    renderSharedSectionWithRoleHeader(share);
    if (selectedSharedSubsectionPath.length) return;
    const header = mainContainer.querySelector('.canvas-header .title-section');
    if (!header || header.querySelector('.shared-recipients')) return;
    const recipients = (share.recipients || []).join(', ') || 'No recipients';
    const role = (share.recipients || []).map(name => `${share.recipientPermissions?.[name] === 'contributor' ? 'Contributor' : 'Reader'}: ${name}`).join(', ') || 'No recipients';
    const detail = document.createElement('span');
    detail.className = 'shared-access-badge shared-recipients';
    detail.title = 'Recipients: ' + recipients;
    detail.innerHTML = '<i class="fas fa-users"></i> ' + esc(role);
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
    activeSharedEditorId = share.id;
    // Use the shared copy as the renderer's working data. Its save path writes
    // through the persistent connection to the owner's personal section.
    sections = [share.section];
    nextId = Math.max(nextId || 1, Number(share.section.id || 0) + 1);
    sharedEditorLastSnapshot = JSON.stringify(share.section);
    selectedSectionId = share.section.id; selectedSubsectionPath = []; isSharedSectionsView = false; render();
};
window.selectSharedSection = function(shareId) {
    // Reuse the personal canvas feature set while retaining the shared save path.
    openSharedFromSidebar(Number(shareId));
};
render = function() {
    const share = activeSharedEditorShare();
    if (!share) return normalRenderForSharedEditor();
    renderSidebar(); renderMain();
    const editable = canEditSharedSection(share);
    mainContainer.classList.toggle('shared-editor-readonly', !editable);
    if (!editable) {
        mainContainer.querySelectorAll('input, textarea').forEach(field => { field.readOnly = true; field.disabled = false; });
        mainContainer.querySelectorAll('.box-delete-btn, .delete-subsection-btn, .edit-title-btn, .box-actions, .action-btn, .canvas-action-btn, .add-item-btn, .drag-handle, .resize-handle, .item-delete').forEach(control => { if (!control.classList.contains('back-btn') || control.classList.contains('canvas-action-btn')) control.style.display = 'none'; });
        mainContainer.querySelectorAll('[data-onclick]').forEach(control => { if (!control.classList.contains('back-btn') || control.classList.contains('canvas-action-btn')) control.removeAttribute('data-onclick'); });
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
    // Cloud writes only occur after an explicit Push or Sync now action.
};
window.syncAllSharedSectionsNow = async function() {
    for (const section of sections || []) {
        for (const shareId of section.sharedShareIds || []) {
            await sharedApi('POST', { action: 'source-update', shareId, section });
        }
    }
};

const renderSharedSectionsWithAccessManagement = renderSharedSections;
renderSharedSections = function() {
    renderSharedSectionsWithAccessManagement();
    const share = sharedSections.find(item => item.id == selectedSharedSectionId);
    const isOwner = currentUser?.username === 'drakeno' || share?.owner === currentUser?.username;
    if (!share) return;
    const header = mainContainer.querySelector('.canvas-header');
    if (!header) return;
    if (isOwner && !header.querySelector('.delete-shared-section-btn')) {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-btn delete-shared-section-btn';
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
        deleteButton.title = 'Permanently delete this shared section';
        deleteButton.onclick = () => deleteSharedSection(share.id);
        header.appendChild(deleteButton);
    }
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

// Polished per-user sharing dialogs. These late definitions replace the legacy multi-select dialogs above.
function shareAccessRow(name, access, selectable) {
    const active = access !== 'none';
    const status = !active ? 'No access' : access === 'contributor' ? 'Can edit' : 'Can view';
    return `<div class="share-user-row ${active ? 'selected' : ''}" data-user="${esc(name)}">
        <div class="share-user-identity">${selectable ? `<input class="share-user-check" type="checkbox" ${active ? 'checked' : ''}>` : ''}<span class="share-user-avatar">${esc(name.charAt(0).toUpperCase())}</span><span><strong>${esc(name)}</strong><small>${status}</small></span></div>
        <select class="share-user-permission" aria-label="Access for ${esc(name)}" ${selectable && !active ? 'disabled' : ''}>${selectable ? '' : `<option value="none" ${!active ? 'selected' : ''}>No access</option>`}<option value="reader" ${access === 'reader' ? 'selected' : ''}>Reader</option><option value="contributor" ${access === 'contributor' ? 'selected' : ''}>Contributor</option></select>
    </div>`;
}
function bindShareAccessRows(overlay, selectable) {
    overlay.querySelectorAll('.share-user-check').forEach(check => { check.onchange = () => { const row=check.closest('.share-user-row'), select=row.querySelector('.share-user-permission'); row.classList.toggle('selected',check.checked); select.disabled=!check.checked; row.querySelector('small').textContent=check.checked?(select.value==='contributor'?'Can edit':'Can view'):'No access'; }; });
    overlay.querySelectorAll('.share-user-permission').forEach(select => { select.onchange=()=>{ const row=select.closest('.share-user-row'), active=selectable?row.querySelector('.share-user-check').checked:select.value!=='none'; row.classList.toggle('selected',active); row.querySelector('small').textContent=!active?'No access':select.value==='contributor'?'Can edit':'Can view'; }; });
}
window.shareSection = async function(sectionId) {
    const section=sections.find(item=>item.id===sectionId); if(!section)return;
    // A persistent key makes repeat shares update this exact record.
    if (!section.shareKey) section.shareKey = crypto.randomUUID();
    try {
        const data=await sharedApi('POST',{action:'list-share-users'}), users=data.users||[]; if(!users.length)return alert('There are no other registered users.');
        const overlay=document.createElement('div'); overlay.className='login-overlay visible';
        overlay.innerHTML=`<section class="auth-card share-access-card"><div class="share-dialog-heading"><span class="share-dialog-icon"><i class="fas fa-user-plus"></i></span><div><h2>Give access</h2><p>Share <strong>${esc(section.name)}</strong> with your team.</p></div></div><div class="share-list-label"><span>People</span><span>Access</span></div><div class="share-user-list">${users.map(name=>shareAccessRow(name,'none',true)).join('')}</div><p class="share-access-help"><i class="fas fa-info-circle"></i> Readers can view. Contributors can edit.</p><div class="share-dialog-actions"><button class="auth-link" id="shareCancel">Cancel</button><button class="auth-btn" id="shareConfirm"><i class="fas fa-share-alt"></i> Give access</button></div></section>`;
        document.body.appendChild(overlay); bindShareAccessRows(overlay,true); overlay.querySelector('#shareCancel').onclick=()=>overlay.remove();
        overlay.querySelector('#shareConfirm').onclick=async()=>{ const rows=[...overlay.querySelectorAll('.share-user-row')].filter(row=>row.querySelector('.share-user-check').checked), recipients=rows.map(row=>row.dataset.user); if(!recipients.length)return alert('Select at least one recipient.'); const recipientPermissions=Object.fromEntries(rows.map(row=>[row.dataset.user,row.querySelector('.share-user-permission').value])); try{const result=await sharedApi('POST',{action:'share-section',recipients,recipientPermissions,sourceSectionId:section.id,sourceKey:section.shareKey,section}); section.sharedShareIds=[]; sections=sections.filter(item=>item.id!==section.id); selectedSectionId=null; selectedSubsectionPath=[]; if(!sharedSections.some(item=>item.id===result.share.id)) sharedSections.push(result.share); overlay.remove(); render(); showSaveIndicator(`Moved to Shared Sections and granted access to ${recipients.length} ${recipients.length===1?'person':'people'}`);}catch(error){alert(error.message||'Sharing failed');}};
    } catch(error){showSaveIndicator(error.message,true);}
};
window.syncSharedSectionToPersonal = async function(shareId) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !canEditSharedSection(share)) return;
    try {
        await pushSharedSection(share);
    } catch (error) { showSaveIndicator(error.message, true); }
};
// Open shared subsections through the personal canvas renderer so every
// note/list control (editing, deletion, locations, ratings, and nesting) matches.
window.openSharedSubsection = function(shareId, path) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share) return;
    if (!savedPersonalEditorState) savedPersonalEditorState = { sections, nextId, selectedSectionId, selectedSubsectionPath };
    activeSharedEditorId = share.id;
    sections = [share.section];
    selectedSectionId = share.section.id;
    selectedSubsectionPath = Array.isArray(path) ? path : String(path).split('/').filter(Boolean);
    selectedSharedSectionId = share.id;
    selectedSharedSubsectionPath = selectedSubsectionPath;
    isSharedSectionsView = false;
    sharedEditorLastSnapshot = JSON.stringify(share.section);
    render();
};

window.manageSharedAccess = async function(shareId) {
    const share=sharedSections.find(item=>item.id===Number(shareId)), isOwner=currentUser?.username==='drakeno'||share?.owner===currentUser?.username; if(!share||!isOwner)return;
    try {
        const data=await sharedApi('POST',{action:'list-share-users'}), users=(data.users||[]).filter(name=>name!==share.owner), accessFor=name=>share.recipientPermissions?.[name]||(share.recipients.includes(name)?share.permission||'reader':'none');
        const overlay=document.createElement('div'); overlay.className='login-overlay visible'; overlay.innerHTML=`<section class="auth-card share-access-card"><div class="share-dialog-heading"><span class="share-dialog-icon"><i class="fas fa-users-cog"></i></span><div><h2>Manage access</h2><p>Shared from <strong>${esc(share.owner)}</strong></p></div></div><div class="share-list-label"><span>People</span><span>Access</span></div><div class="share-user-list">${users.map(name=>shareAccessRow(name,accessFor(name),false)).join('')}</div><p class="share-access-help"><i class="fas fa-info-circle"></i> Everyone with access is listed here. Changes apply when saved.</p><div class="share-dialog-actions"><button class="auth-link" id="manageShareCancel">Cancel</button><button class="auth-btn" id="manageShareSave"><i class="fas fa-check"></i> Save changes</button></div></section>`;
        document.body.appendChild(overlay); bindShareAccessRows(overlay,false); overlay.querySelector('#manageShareCancel').onclick=()=>overlay.remove();
        overlay.querySelector('#manageShareSave').onclick=async()=>{const rows=[...overlay.querySelectorAll('.share-user-row')], active=rows.filter(row=>row.querySelector('.share-user-permission').value!=='none'), recipients=active.map(row=>row.dataset.user); if(!recipients.length)return alert('Keep at least one person, or use Stop sharing.'); const recipientPermissions=Object.fromEntries(active.map(row=>[row.dataset.user,row.querySelector('.share-user-permission').value])); try{const result=await sharedApi('POST',{action:'manage-share',shareId:share.id,recipients,recipientPermissions}), index=sharedSections.findIndex(item=>item.id===share.id); if(index!==-1)sharedSections[index]=result.share; overlay.remove(); render(); showSaveIndicator('Sharing access updated');}catch(error){alert(error.message||'Could not update access');}};
    } catch(error){showSaveIndicator(error.message,true);}
};

// Direct controls for the Shared Sections renderer.
let sharedHierarchyClipboard = null;
let sharedHierarchyDrag = null;
function sharedHierarchyClone(value) { return JSON.parse(JSON.stringify(value)); }
function sharedHierarchyLocate(shareId, path) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const names = String(path || '').split('/').filter(Boolean);
    if (!share || !names.length) return null;
    let siblings = share.section.subs || (share.section.subs = []);
    for (let i = 0; i < names.length - 1; i++) { const parent = siblings.find(item => item.name === names[i]); if (!parent) return null; siblings = parent.subs || (parent.subs = []); }
    const index = siblings.findIndex(item => item.name === names.at(-1));
    return index < 0 ? null : { share, siblings, index, sub: siblings[index], names };
}
function sharedHierarchyName(siblings, name) { const base = String(name || 'Copied subsection'); let result = base, number = 2; while (siblings.some(item => item.name === result)) result = `${base} (${number++})`; return result; }
function sharedHierarchyFinish(...shares) { [...new Set(shares)].forEach(share => saveSharedSection(share)); render(); }
window.copySharedSection = function(shareId) { const share = sharedSections.find(item => item.id === Number(shareId)); if (!share || !canEditSharedSection(share)) return; sharedHierarchyClipboard = sharedHierarchyClone(share.section); showSaveIndicator('Shared section copied'); };
window.copySharedSubsection = function(shareId, path) { const found = sharedHierarchyLocate(shareId, path); if (!found || !canEditSharedSection(found.share)) return; sharedHierarchyClipboard = sharedHierarchyClone(found.sub); showSaveIndicator('Shared subsection copied'); };
window.pasteSharedIntoSection = function(shareId) { const share = sharedSections.find(item => item.id === Number(shareId)); if (!share || !canEditSharedSection(share) || !sharedHierarchyClipboard) return showSaveIndicator('Copy a section or subsection first', true); const siblings = share.section.subs || (share.section.subs = []), copy = sharedHierarchyClone(sharedHierarchyClipboard); copy.name = sharedHierarchyName(siblings, copy.name); copy.notes ||= []; copy.items ||= []; copy.subs ||= []; siblings.push(copy); sharedHierarchyFinish(share); };
window.pasteSharedIntoSubsection = function(shareId, path) { const found = sharedHierarchyLocate(shareId, path); if (!found || !canEditSharedSection(found.share) || !sharedHierarchyClipboard) return showSaveIndicator('Copy a section or subsection first', true); if (found.names.length >= 5) return showSaveIndicator('Maximum subsection depth (5 levels) reached', true); const siblings = found.sub.subs || (found.sub.subs = []), copy = sharedHierarchyClone(sharedHierarchyClipboard); copy.name = sharedHierarchyName(siblings, copy.name); copy.notes ||= []; copy.items ||= []; copy.subs ||= []; siblings.push(copy); sharedHierarchyFinish(found.share); };
window.startSharedHierarchyDrag = function(event, shareId, path) { const found = sharedHierarchyLocate(shareId, path); if (!found || !canEditSharedSection(found.share)) return; sharedHierarchyDrag = { shareId: Number(shareId), path }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'shared-subsection'); event.currentTarget.classList.add('hierarchy-dragging'); };
window.sharedHierarchyDragOver = function(event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; event.currentTarget.classList.add('hierarchy-drop-target'); };
window.sharedHierarchyDragLeave = function(event) { event.currentTarget.classList.remove('hierarchy-drop-target'); };
window.dropSharedHierarchy = function(event, shareId, path) { event.preventDefault(); event.currentTarget.classList.remove('hierarchy-drop-target'); if (!sharedHierarchyDrag) return; const source = sharedHierarchyLocate(sharedHierarchyDrag.shareId, sharedHierarchyDrag.path), target = sharedHierarchyLocate(shareId, path); sharedHierarchyDrag = null; if (!source || !target || !canEditSharedSection(source.share) || !canEditSharedSection(target.share)) return; if (source.share.id === target.share.id && target.names.join('/').startsWith(source.names.join('/') + '/')) return showSaveIndicator('A subsection cannot be moved into itself', true); if (target.names.length >= 5) return showSaveIndicator('Maximum subsection depth (5 levels) reached', true); const [moved] = source.siblings.splice(source.index, 1), siblings = target.sub.subs || (target.sub.subs = []); moved.name = sharedHierarchyName(siblings, moved.name); siblings.push(moved); sharedHierarchyFinish(source.share, target.share); };
function renderSharedSubsectionTree(subs, shareId, depth = 1, parentPath = []) {
    if (!Array.isArray(subs) || !subs.length) return '';
    const share = sharedSections.find(item => item.id === Number(shareId));
    const editable = !!share && canEditSharedSection(share);
    return `<ul class="subsection-list shared-subsection-tree">${subs.map(sub => {
        const path = [...parentPath, sub.name], pathStr = escJs(path.join('/'));
        const summary = `${(sub.notes || []).length} notes &middot; ${(sub.items || []).length} lists${sub.subs?.length ? ` &middot; ${sub.subs.length} subsections` : ''}`;
        const controls = editable ? `<span class="section-actions"><i class="fas fa-copy" data-onclick="event.stopPropagation(); copySharedSubsection(${shareId}, '${pathStr}')" title="Copy subsection"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteSharedIntoSubsection(${shareId}, '${pathStr}')" title="Paste as nested subsection"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSharedSubsection(${shareId}, '${pathStr}')" title="Add subsection"></i>${isSharedOwner(share) ? `<i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSharedSubsection(${shareId}, '${pathStr}')" title="Delete subsection"></i>` : ''}</span>` : '';
        return `<li class="shared-hierarchy-subsection" ${editable ? `draggable="true" data-ondragstart="startSharedHierarchyDrag(event, ${shareId}, '${pathStr}')" data-ondragover="sharedHierarchyDragOver(event)" data-ondragleave="sharedHierarchyDragLeave(event)" data-ondrop="dropSharedHierarchy(event, ${shareId}, '${pathStr}')"` : ''} style="padding-left:${depth * 1.2}rem;cursor:pointer;" data-onclick="event.stopPropagation(); openSharedSubsection(${shareId}, '${pathStr}')"><i class="fas fa-folder-open"></i> <strong>${esc(sub.name)}</strong><span class="shared-subsection-summary">${summary}</span>${controls}${renderSharedSubsectionTree(sub.subs, shareId, depth + 1, path)}</li>`;
    }).join('')}</ul>`;
}
const renderSharedSectionWithHierarchyControls = renderSharedSection;
renderSharedSection = function(share) {
    renderSharedSectionWithHierarchyControls(share);
    if (!canEditSharedSection(share) || selectedSharedSubsectionPath.length) return;
    const actions = mainContainer.querySelector('.canvas > div[style*="margin-top:2rem"]');
    if (actions && !actions.querySelector('.shared-hierarchy-actions')) {
        const controls = document.createElement('span'); controls.className = 'shared-hierarchy-actions';
        controls.innerHTML = `<button class="action-btn" data-onclick="copySharedSection(${share.id})"><i class="fas fa-copy"></i> Copy section</button><button class="action-btn" data-onclick="pasteSharedIntoSection(${share.id})"><i class="fas fa-paste"></i> Paste as subsection</button>`;
        actions.appendChild(controls);
    }
};

// Shared canvas: independently movable cards and always-visible hierarchy actions.
function moveSharedSectionCard(event, shareId) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !canEditSharedSection(share)) return;
    event.preventDefault(); event.stopPropagation();
    const card = event.currentTarget.closest('.shared-canvas-card');
    const canvas = document.getElementById('sharedBoxGrid');
    if (!card || !canvas) return;
    const cardRect = card.getBoundingClientRect(), canvasRect = canvas.getBoundingClientRect();
    const offsetX = event.clientX - cardRect.left, offsetY = event.clientY - cardRect.top;
    const move = moveEvent => {
        share.section.x = Math.max(0, Math.round(moveEvent.clientX - canvasRect.left - offsetX));
        share.section.y = Math.max(0, Math.round(moveEvent.clientY - canvasRect.top - offsetY));
        card.style.left = `${share.section.x}px`; card.style.top = `${share.section.y}px`;
    };
    const stop = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); saveSharedSection(share); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop);
}
const renderSharedSectionsBeforeCanvasControls = renderSharedSections;
renderSharedSections = function() {
    const selectedShare = sharedSections.find(share => share.id == selectedSharedSectionId);
    if (selectedShare) return renderSharedSectionsBeforeCanvasControls();
    let html = '<div class="canvas"><div class="canvas-header"><div class="title-section"><i class="fas fa-share-alt"></i><h1>Shared Sections</h1></div><button class="back-btn" data-onclick="isSharedSectionsView=false; render()"><i class="fas fa-arrow-left"></i> Back</button></div>';
    if (!sharedSections.length) html += '<div class="empty-state-hero"><i class="fas fa-share-alt"></i><p>No sections have been shared with you.</p></div>';
    else {
        html += '<div class="box-grid" id="sharedBoxGrid">';
        sharedSections.forEach((share, index) => {
            const section = share.section, editable = canEditSharedSection(share);
            const x = section.x ?? (20 + (index % 3) * 330), y = section.y ?? (20 + Math.floor(index / 3) * 240);
            const width = section.width || 280, height = section.height || 180;
            const role = getUserSharePermission(share), permission = role === 'owner' ? 'Owner' : role === 'contributor' ? 'Contributor' : 'Reader';
            const controls = editable ? `<div class="shared-card-actions"><button data-onclick="event.stopPropagation(); copySharedSection(${share.id})" title="Copy section"><i class="fas fa-copy"></i></button><button data-onclick="event.stopPropagation(); pasteSharedIntoSection(${share.id})" title="Paste as subsection"><i class="fas fa-paste"></i></button></div>` : '';
            html += `<article class="note-box shared-section-box shared-canvas-card" data-onclick="selectSharedSection(${share.id})" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px;cursor:pointer"><div class="box-title">${editable ? `<span class="drag-handle" data-onmousedown="moveSharedSectionCard(event, ${share.id})" title="Drag to move"><i class="fas fa-grip-lines"></i></span>` : ''}<i class="fas fa-folder-open"></i><span>${esc(capitalize(section.name))}</span>${controls}</div><div class="note-content">${(section.notes || []).length} notes &middot; ${(section.items || []).length} lists${section.subs?.length ? ` &middot; ${section.subs.length} subsections` : ''}</div><div class="shared-by"><i class="fas fa-user"></i> ${esc(share.owner)} &middot; ${permission}</div></article>`;
        });
        html += '</div>';
    }
    mainContainer.innerHTML = html + '</div>';
};

// Keep shared navigation completely separate from personal sections.
window.openSharedFromSidebar = function(shareId) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share) return;
    if (activeSharedEditorId !== null && typeof leaveSharedEditor === 'function') leaveSharedEditor();
    activeSharedEditorId = null;
    selectedSharedSectionId = share.id;
    selectedSharedSubsectionPath = [];
    selectedSectionId = null;
    selectedSubsectionPath = [];
    isSharedSectionsView = true;
    render();
};
window.openSharedSubsection = function(shareId, path) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share) return;
    if (activeSharedEditorId !== null && typeof leaveSharedEditor === 'function') leaveSharedEditor();
    activeSharedEditorId = null;
    selectedSharedSectionId = share.id;
    selectedSharedSubsectionPath = Array.isArray(path) ? path : String(path).split('/').filter(Boolean);
    selectedSectionId = null;
    selectedSubsectionPath = [];
    isSharedSectionsView = true;
    render();
};

// Moving a card should not also activate its open-on-click action.
document.addEventListener('click', event => {
    const card = event.target.closest('.shared-canvas-card[data-skip-open="true"]');
    if (!card) return;
    card.dataset.skipOpen = '';
    event.preventDefault();
    event.stopImmediatePropagation();
}, true);
function moveSharedSectionCard(event, shareId) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !canEditSharedSection(share)) return;
    event.preventDefault(); event.stopPropagation();
    const card = event.currentTarget.closest('.shared-canvas-card'), canvas = document.getElementById('sharedBoxGrid');
    if (!card || !canvas) return;
    const cardRect = card.getBoundingClientRect(), canvasRect = canvas.getBoundingClientRect();
    const offsetX = event.clientX - cardRect.left, offsetY = event.clientY - cardRect.top;
    let moved = false;
    const move = moveEvent => {
        const x = Math.max(0, Math.round(moveEvent.clientX - canvasRect.left - offsetX));
        const y = Math.max(0, Math.round(moveEvent.clientY - canvasRect.top - offsetY));
        moved ||= x !== Number(share.section.x || 0) || y !== Number(share.section.y || 0);
        share.section.x = x; share.section.y = y; card.style.left = `${x}px`; card.style.top = `${y}px`;
    };
    const stop = () => {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop);
        if (moved) { card.dataset.skipOpen = 'true'; saveSharedSection(share); }
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop);
}

// Shared Sections sidebar: use shared-data actions rather than personal-section controls.
sharedSidebarSubtree = function(subs, shareId, depth = 1, parentPath = []) {
    if (!Array.isArray(subs) || !subs.length) return '';
    const share = sharedSections.find(item => item.id === Number(shareId));
    const editable = !!share && canEditSharedSection(share);
    return '<ul class="subsection-list shared-subsection-tree">' + subs.map(sub => {
        const path = [...parentPath, sub.name], pathValue = escJs(path.join('/'));
        const controls = editable ? `<span class="section-actions"><i class="fas fa-copy" data-onclick="event.stopPropagation(); copySharedSubsection(${shareId}, '${pathValue}')" title="Copy subsection"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteSharedIntoSubsection(${shareId}, '${pathValue}')" title="Paste as nested subsection"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSharedSubsection(${shareId}, '${pathValue}')" title="Add nested subsection"></i>${isSharedOwner(share) ? `<i class="fas fa-times" data-onclick="event.stopPropagation(); deleteSharedSubsection(${shareId}, '${pathValue}')" title="Delete subsection"></i>` : ''}</span>` : '';
        const drag = editable ? `draggable="true" data-ondragstart="startSharedHierarchyDrag(event, ${shareId}, '${pathValue}')" data-ondragover="sharedHierarchyDragOver(event)" data-ondragleave="sharedHierarchyDragLeave(event)" data-ondrop="dropSharedHierarchy(event, ${shareId}, '${pathValue}')"` : '';
        return `<li class="shared-hierarchy-subsection" ${drag} style="padding-left:${depth * 1.2}rem;cursor:pointer;" data-onclick="event.stopPropagation(); openSharedSubsection(${shareId}, '${pathValue}')"><i class="fas fa-circle"></i> ${esc(capitalize(sub.name))}${controls}</li>${sharedSidebarSubtree(sub.subs, shareId, depth + 1, path)}`;
    }).join('') + '</ul>';
};
const renderSidebarBeforeSharedHierarchyActions = renderSidebar;
renderSidebar = function() {
    renderSidebarBeforeSharedHierarchyActions();
    document.querySelectorAll('i[data-onclick*="openSharedFromSidebar"]').forEach(open => {
        const match = (open.getAttribute('data-onclick') || '').match(/openSharedFromSidebar\((\d+)\)/);
        const share = match && sharedSections.find(item => item.id === Number(match[1]));
        const actions = open.closest('.section-actions');
        if (!share || !actions || !canEditSharedSection(share) || actions.querySelector('.shared-sidebar-copy')) return;
        const copy = document.createElement('i'); copy.className = 'fas fa-copy shared-sidebar-copy'; copy.title = 'Copy shared section'; copy.onclick = event => { event.stopPropagation(); copySharedSection(share.id); };
        const paste = document.createElement('i'); paste.className = 'fas fa-paste shared-sidebar-paste'; paste.title = 'Paste as subsection'; paste.onclick = event => { event.stopPropagation(); pasteSharedIntoSection(share.id); };
        actions.insertBefore(paste, open); actions.insertBefore(copy, open);
    });
};

// Keep exactly one Copy then Paste control on personal subsection rows.
const renderSidebarBeforePersonalControlCleanup = renderSidebar;
renderSidebar = function() {
    renderSidebarBeforePersonalControlCleanup();
    document.querySelectorAll('.section-group[data-section-id] .subsection-list li .section-actions').forEach(actions => {
        const copy = actions.querySelector('.fa-copy');
        const paste = actions.querySelector('.fa-paste');
        actions.querySelectorAll('.fa-copy').forEach((icon, index) => { if (index) icon.remove(); });
        actions.querySelectorAll('.fa-paste').forEach((icon, index) => { if (index) icon.remove(); });
        // Reinsert the surviving controls in the consistent order.
        if (paste?.isConnected) actions.prepend(paste);
        if (copy?.isConnected) actions.prepend(copy);
    });
};

// Canonical action strips for personal hierarchy rows: one stable control set only.
const renderSidebarBeforeCanonicalActions = renderSidebar;
renderSidebar = function() {
    renderSidebarBeforeCanonicalActions();
    document.querySelectorAll('.section-group[data-section-id]').forEach(group => {
        const sectionId = Number(group.dataset.sectionId);
        const titleActions = group.querySelector(':scope > .section-title .section-actions');
        if (titleActions) {
            titleActions.innerHTML = `<i class="fas fa-copy" data-onclick="event.stopPropagation(); copySection(${sectionId})" title="Copy section"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteIntoSection(${sectionId})" title="Paste as subsection"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSubsection(${sectionId})" title="Add subsection"></i><i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSection(${sectionId})" title="Delete section"></i>`;
        }
        group.querySelectorAll('.subsection-list li').forEach(row => {
            const path = (row.getAttribute('data-onclick') || '').match(/selectSubsection\([^,]+, '([^']+)'\)/)?.[1];
            if (!path || path === 'no subs') return;
            const actions = row.querySelector(':scope > .section-actions');
            if (!actions) return;
            actions.innerHTML = `<i class="fas fa-copy" data-onclick="event.stopPropagation(); copySubsection(${sectionId}, '${path}')" title="Copy subsection"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteIntoSubsection(${sectionId}, '${path}')" title="Paste as nested subsection"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSubsection(${sectionId}, '${path}')" title="Add nested subsection"></i><i class="fas fa-times delete-sub" data-onclick="event.stopPropagation(); deleteSubsection(${sectionId}, '${path}')" title="Delete subsection"></i>`;
        });
    });
};

// Apply the same Copy ? Paste ? Add ? Delete order to editable shared section rows.
const renderSidebarBeforeSharedCanonicalActions = renderSidebar;
renderSidebar = function() {
    renderSidebarBeforeSharedCanonicalActions();
    document.querySelectorAll('.section-actions').forEach(actions => {
        const opener = actions.querySelector('i[data-onclick*="openSharedFromSidebar"]');
        const match = opener?.getAttribute('data-onclick')?.match(/openSharedFromSidebar\((\d+)\)/);
        const share = match && sharedSections.find(item => item.id === Number(match[1]));
        if (!share || !canEditSharedSection(share)) return;
        actions.innerHTML = `<i class="fas fa-copy" data-onclick="event.stopPropagation(); copySharedSection(${share.id})" title="Copy shared section"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteSharedIntoSection(${share.id})" title="Paste as subsection"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSharedSubsection(${share.id})" title="Add subsection"></i>${isSharedOwner(share) ? `<i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSharedSection(${share.id})" title="Delete shared section"></i>` : ''}`;
    });
};

// This must run after app.js's DOM-ready decorator, which adds the duplicate icons.
document.addEventListener('DOMContentLoaded', () => {
    const normalizePersonalActions = () => {
        document.querySelectorAll('.section-group[data-section-id] .subsection-list li').forEach(row => {
            const sectionId = Number(row.closest('.section-group[data-section-id]')?.dataset.sectionId);
            const path = (row.getAttribute('data-onclick') || '').match(/selectSubsection\([^,]+, '([^']+)'\)/)?.[1];
            const actions = row.querySelector(':scope > .section-actions');
            if (!sectionId || !path || !actions) return;
            actions.innerHTML = `<i class="fas fa-copy" data-onclick="event.stopPropagation(); copySubsection(${sectionId}, '${path}')" title="Copy subsection"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteIntoSubsection(${sectionId}, '${path}')" title="Paste as nested subsection"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSubsection(${sectionId}, '${path}')" title="Add nested subsection"></i><i class="fas fa-times delete-sub" data-onclick="event.stopPropagation(); deleteSubsection(${sectionId}, '${path}')" title="Delete subsection"></i>`;
        });
        document.querySelectorAll('.section-group[data-section-id] > .section-title .section-actions').forEach(actions => {
            const sectionId = Number(actions.closest('.section-group').dataset.sectionId);
            actions.innerHTML = `<i class="fas fa-copy" data-onclick="event.stopPropagation(); copySection(${sectionId})" title="Copy section"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteIntoSection(${sectionId})" title="Paste as subsection"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSubsection(${sectionId})" title="Add subsection"></i><i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSection(${sectionId})" title="Delete section"></i>`;
        });
    };
    const rendererBeforeFinalPersonalActionCleanup = renderSidebar;
    renderSidebar = function() { rendererBeforeFinalPersonalActionCleanup(); normalizePersonalActions(); };
    normalizePersonalActions();
});

// Restore personal sharing without reintroducing duplicate hierarchy controls.
document.addEventListener('DOMContentLoaded', () => {
    const rendererBeforeRestoringShare = renderSidebar;
    renderSidebar = function() {
        rendererBeforeRestoringShare();
        document.querySelectorAll('.section-group[data-section-id] > .section-title .section-actions').forEach(actions => {
            const sectionId = Number(actions.closest('.section-group').dataset.sectionId);
            actions.innerHTML = `<i class="fas fa-copy" data-onclick="event.stopPropagation(); copySection(${sectionId})" title="Copy section"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteIntoSection(${sectionId})" title="Paste as subsection"></i><i class="fas fa-share-alt" data-onclick="event.stopPropagation(); shareSection(${sectionId})" title="Share section"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSubsection(${sectionId})" title="Add subsection"></i><i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSection(${sectionId})" title="Delete section"></i>`;
        });
    };
    renderSidebar();
});

// Contributors may delete content within a shared section, but never the shared section itself.
window.deleteSharedSubsection = function(shareId, path) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share || !canEditSharedSection(share) || !confirm('Delete this shared subsection?')) return;
    const names = String(path).split('/').filter(Boolean); let siblings = share.section.subs || [];
    for (let i = 0; i < names.length - 1; i++) { const parent = siblings.find(item => item.name === names[i]); if (!parent) return; siblings = parent.subs || []; }
    const index = siblings.findIndex(item => item.name === names.at(-1)); if (index < 0) return;
    siblings.splice(index, 1); saveSharedSection(share); render();
};
function renderSharedSubsectionTree(subs, shareId, depth = 1, parentPath = []) {
    if (!Array.isArray(subs) || !subs.length) return '';
    const share = sharedSections.find(item => item.id === Number(shareId)), editable = !!share && canEditSharedSection(share);
    return `<ul class="subsection-list shared-subsection-tree">${subs.map(sub => {
        const path = [...parentPath, sub.name], pathStr = escJs(path.join('/'));
        const summary = `${(sub.notes || []).length} notes &middot; ${(sub.items || []).length} lists${sub.subs?.length ? ` &middot; ${sub.subs.length} subsections` : ''}`;
        const controls = editable ? `<span class="section-actions"><i class="fas fa-copy" data-onclick="event.stopPropagation(); copySharedSubsection(${shareId}, '${pathStr}')" title="Copy subsection"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteSharedIntoSubsection(${shareId}, '${pathStr}')" title="Paste as nested subsection"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSharedSubsection(${shareId}, '${pathStr}')" title="Add subsection"></i><i class="fas fa-trash-alt" data-onclick="event.stopPropagation(); deleteSharedSubsection(${shareId}, '${pathStr}')" title="Delete subsection"></i></span>` : '';
        return `<li class="shared-hierarchy-subsection" ${editable ? `draggable="true" data-ondragstart="startSharedHierarchyDrag(event, ${shareId}, '${pathStr}')" data-ondragover="sharedHierarchyDragOver(event)" data-ondragleave="sharedHierarchyDragLeave(event)" data-ondrop="dropSharedHierarchy(event, ${shareId}, '${pathStr}')"` : ''} style="padding-left:${depth * 1.2}rem;cursor:pointer;" data-onclick="event.stopPropagation(); openSharedSubsection(${shareId}, '${pathStr}')"><i class="fas fa-folder-open"></i> <strong>${esc(sub.name)}</strong><span class="shared-subsection-summary">${summary}</span>${controls}${renderSharedSubsectionTree(sub.subs, shareId, depth + 1, path)}</li>`;
    }).join('')}</ul>`;
}
sharedSidebarSubtree = function(subs, shareId, depth = 1, parentPath = []) {
    if (!Array.isArray(subs) || !subs.length) return '';
    const share = sharedSections.find(item => item.id === Number(shareId)), editable = !!share && canEditSharedSection(share);
    return '<ul class="subsection-list shared-subsection-tree">' + subs.map(sub => { const path = [...parentPath, sub.name], pathStr = escJs(path.join('/')); const active = isSharedSectionsView && Number(selectedSharedSectionId) === Number(shareId) && selectedSharedSubsectionPath.length === path.length && selectedSharedSubsectionPath.every((value, index) => value === path[index]); const controls = editable ? `<span class="section-actions"><i class="fas fa-copy" data-onclick="event.stopPropagation(); copySharedSubsection(${shareId}, '${pathStr}')" title="Copy subsection"></i><i class="fas fa-paste" data-onclick="event.stopPropagation(); pasteSharedIntoSubsection(${shareId}, '${pathStr}')" title="Paste as nested subsection"></i><i class="fas fa-plus-circle" data-onclick="event.stopPropagation(); addSharedSubsection(${shareId}, '${pathStr}')" title="Add subsection"></i><i class="fas fa-times" data-onclick="event.stopPropagation(); deleteSharedSubsection(${shareId}, '${pathStr}')" title="Delete subsection"></i></span>` : ''; return `<li class="${active ? 'active ' : ''}shared-hierarchy-subsection" style="padding-left:${depth * 1.2}rem;cursor:pointer;" data-onclick="event.stopPropagation(); openSharedSubsection(${shareId}, '${pathStr}')"><i class="fas fa-circle"></i> ${esc(capitalize(sub.name))}${controls}</li>${sharedSidebarSubtree(sub.subs, shareId, depth + 1, path)}`; }).join('') + '</ul>';
};

// Shared subsections keep their own share payload, while exposing the same
// note, list, item, and location controls available in personal subsections.
function mutateSharedSubsection(shareId, subPath, mutation) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const sub = getSharedSubsection(share, String(subPath).split('/').filter(Boolean));
    if (!share || !sub || !canEditSharedSection(share)) return;
    const canvas = document.getElementById('canvas');
    const scroll = { top: canvas?.scrollTop || 0, left: canvas?.scrollLeft || 0 };
    mutation(sub);
    saveSharedSection(share);
    render();
    requestAnimationFrame(() => { const restored = document.getElementById('canvas'); if (restored) { restored.scrollTop = scroll.top; restored.scrollLeft = scroll.left; } window.restoreSelectedBox?.(); });
}
window.addSharedSubItem = function(shareId, subPath, listIndex, afterIndex = null) {
    let newIndex = -1;
    mutateSharedSubsection(shareId, subPath, sub => {
        const list = sub.items?.[listIndex];
        if (list) { const items = list.items || (list.items = []); newIndex = afterIndex === null ? items.length : afterIndex + 1; items.splice(newIndex, 0, { text: '', done: false, rating: 0 }); }
    });
    setTimeout(() => {
        const box = document.querySelector(`.list-box[data-type="sharedSubList"][data-share-id="${Number(shareId)}"][data-index="${listIndex}"]`);
        const field = newIndex >= 0 ? box?.querySelectorAll('.editable-item')[newIndex] : null;
        if (field) { field.focus(); field.select(); }
    }, 50);
};
window.deleteSharedSubItem = function(shareId, subPath, listIndex, itemIndex) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const sub = getSharedSubsection(share, String(subPath).split('/').filter(Boolean));
    const item = sub?.items?.[listIndex]?.items?.[itemIndex];
    if (!share || !item || !canEditSharedSection(share)) return;
    if (!confirm(`Delete list item "${item.text || '(empty item)'}"? This cannot be undone.`)) return;
    mutateSharedSubsection(shareId, subPath, target => target.items?.[listIndex]?.items?.splice(itemIndex, 1));
};
window.toggleSharedSubItem = function(shareId, subPath, listIndex, itemIndex) {
    mutateSharedSubsection(shareId, subPath, sub => {
        const item = sub.items?.[listIndex]?.items?.[itemIndex];
        if (item) item.done = !item.done;
    });
};
window.setSharedSubLocation = function(shareId, subPath, listIndex, itemIndex = null) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    const sub = getSharedSubsection(share, String(subPath).split('/').filter(Boolean));
    const target = itemIndex === null ? sub?.items?.[listIndex] : sub?.items?.[listIndex]?.items?.[itemIndex];
    if (!share || !target || !canEditSharedSection(share)) return;
    const label = itemIndex === null ? 'Paste Google Maps link or address for this list:' : 'Paste Google Maps link or address:';
    const location = prompt(label, target.location || '');
    if (location === null) return;
    target.location = location.trim();
    saveSharedSection(share);
    render();
};

const renderSharedSectionBeforeIndependentSubsections = renderSharedSection;
renderSharedSection = function(share) {
    if (!selectedSharedSubsectionPath.length) return renderSharedSectionBeforeIndependentSubsections(share);
    const sub = getSharedSubsection(share, selectedSharedSubsectionPath);
    if (!sub) { selectedSharedSubsectionPath = []; return renderSharedSectionBeforeIndependentSubsections(share); }
    const editable = canEditSharedSection(share);
    const path = escJs(selectedSharedSubsectionPath.join('/'));
    const notes = sub.notes || [];
    const lists = sub.items || [];
    let html = `<div class="canvas has-selection"><div class="canvas-header"><div class="title-section"><i class="fas fa-folder-open" style="color:#f5e56b;font-size:1.5rem"></i><h1>${esc(capitalize(sub.name))}</h1><span class="subsection-label">(subsection)</span></div><button class="back-btn" data-onclick="closeSharedSubsection()"><i class="fas fa-arrow-left"></i> Back</button></div>`;
    if (!notes.length && !lists.length) html += `<div class="empty-state-hero"><i class="fas fa-folder-open"></i><p>Subsection: ${esc(capitalize(sub.name))}<br><span style="font-size:.9rem;color:#7a7a5a">Add notes and lists below</span></p></div>`;
    html += '<div class="box-grid--responsive" id="sharedSubsectionGrid">';
    notes.forEach((note, noteIndex) => {
        html += `<div class="note-box" data-type="sharedSubNote" data-share-id="${share.id}" data-sub-path="${path}" data-index="${noteIndex}">${editable ? `<button class="box-delete-btn" data-onclick="deleteSharedSubNote(${share.id}, '${path}', ${noteIndex})" title="Delete note"><i class="fas fa-times"></i></button>` : ''}<div class="box-title"><i class="fas fa-pen-fancy"></i>${editable ? `<input class="editable-title" value="${esc(note.title || 'Note')}" data-onchange="updateSharedSubsectionValue(${share.id}, '${path}', 'note', ${noteIndex}, 0, 'title', this.value)">` : `<span>${esc(note.title || 'Note')}</span>`}</div><div class="note-content">${editable ? `<textarea class="editable-content" data-onchange="updateSharedSubsectionValue(${share.id}, '${path}', 'note', ${noteIndex}, 0, 'content', this.value)">${esc(note.content || '')}</textarea>` : `<div class="shared-readonly-content">${esc(note.content || '')}</div>`}</div></div>`;
    });
    lists.forEach((list, listIndex) => {
        const listLocation = renderLocationBadge(list.location);
        html += `<div class="list-box" data-type="sharedSubList" data-share-id="${share.id}" data-sub-path="${path}" data-index="${listIndex}">${editable ? `<button class="box-delete-btn" data-onclick="deleteSharedSubList(${share.id}, '${path}', ${listIndex})" title="Delete list"><i class="fas fa-times"></i></button>` : ''}<div class="box-title"><i class="fas fa-list-ul"></i>${editable ? `<input class="editable-title" value="${esc(list.title || 'List')}" data-onchange="updateSharedSubsectionValue(${share.id}, '${path}', 'list', ${listIndex}, 0, 'title', this.value)">` : `<span>${esc(list.title || 'List')}</span>`}${listLocation}${editable ? `<span class="box-actions"><i class="fas fa-map-marker-alt ${list.location ? 'has-location' : ''}" data-onclick="event.stopPropagation(); setSharedSubLocation(${share.id}, '${path}', ${listIndex})" title="Add or edit location"></i><i class="fas fa-plus" data-onclick="addSharedSubItem(${share.id}, '${path}', ${listIndex})" title="Add item"></i></span>` : ''}</div><div class="list-items">`;
        (list.items || []).forEach((item, itemIndex) => {
            const icon = item.done ? 'fa-check-circle' : 'fa-circle';
            const itemLocation = renderLocationBadge(item.location, true);
            html += `<div class="sub-list-item"><i class="fas ${icon}" style="color:${item.done ? '#f5e56b' : '#7a7a5a'};${editable ? 'cursor:pointer' : ''}" ${editable ? `data-onclick="toggleSharedSubItem(${share.id}, '${path}', ${listIndex}, ${itemIndex})"` : ''}></i>${editable ? `<textarea class="editable-item" rows="1" data-onchange="updateSharedSubsectionValue(${share.id}, '${path}', 'item', ${listIndex}, ${itemIndex}, 'text', this.value)">${esc(item.text || '')}</textarea>` : `<span>${esc(item.text || '')}</span>`}${itemLocation}${editable ? `<i class="fas fa-map-marker-alt ${item.location ? 'has-location' : ''}" data-onclick="event.stopPropagation(); setSharedSubLocation(${share.id}, '${path}', ${listIndex}, ${itemIndex})" title="Add or edit location"></i><i class="fas fa-times item-delete" data-onclick="deleteSharedSubItem(${share.id}, '${path}', ${listIndex}, ${itemIndex})" title="Delete item"></i>` : ''}</div>`;
        });
        if (!(list.items || []).length) html += '<div class="empty-message"><i class="fas fa-plus-circle"></i> No items yet.</div>';
        html += `</div>${editable ? `<button class="add-item-btn" data-onclick="addSharedSubItem(${share.id}, '${path}', ${listIndex})"><i class="fas fa-plus"></i> Add item</button>` : ''}</div>`;
    });
    html += '</div>';
    if (editable) html += `<div style="margin-top:2rem;padding-top:1rem;border-top:1px solid #2a2a1a;display:flex;gap:.8rem;flex-wrap:wrap"><button class="action-btn" data-onclick="addSharedSubNote(${share.id}, '${path}')"><i class="fas fa-plus"></i> Add note</button><button class="action-btn" data-onclick="addSharedSubList(${share.id}, '${path}')"><i class="fas fa-plus"></i> Add list</button><button class="action-btn" data-onclick="addSharedSubsection(${share.id}, '${path}')"><i class="fas fa-plus"></i> Add nested subsection</button></div>`;
    mainContainer.innerHTML = html + '</div>';
    window.restoreSelectedBox?.();
    setTimeout(autoResizeTextareas, 10);
};

// Shared sections use the same canvas renderer and keyboard interactions as personal
// sections. The activeSharedEditor save bridge keeps the backing shared copy separate.
window.selectSharedSection = function(shareId) {
    window.openSharedFromSidebar(shareId);
};
window.openSharedSubsection = function(shareId, path) {
    const share = sharedSections.find(item => item.id === Number(shareId));
    if (!share) return;
    const subsectionPath = Array.isArray(path) ? path : String(path).split('/').filter(Boolean);
    if (!getSharedSubsection(share, subsectionPath)) {
        showSaveIndicator('Shared subsection not found', true);
        return;
    }
    if (!savedPersonalEditorState) {
        savedPersonalEditorState = { sections, nextId, selectedSectionId, selectedSubsectionPath };
    }
    activeSharedEditorId = share.id;
    sections = [share.section];
    nextId = Math.max(nextId || 1, Number(share.section.id || 0) + 1);
    selectedSectionId = share.section.id;
    selectedSubsectionPath = subsectionPath;
    selectedSharedSectionId = share.id;
    selectedSharedSubsectionPath = subsectionPath;
    isSharedSectionsView = false;
    sharedEditorLastSnapshot = JSON.stringify(share.section);
    render();
};

window.organizeSharedCanvas = function() {
    const grid = document.getElementById('sharedBoxGrid'), canvas = document.getElementById('canvas');
    if (!grid || !canvas) return;
    const cards = Array.from(grid.querySelectorAll('.shared-canvas-card'));
    if (!cards.length) return;
    const styles = getComputedStyle(canvas), available = canvas.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const gap = 24, width = Math.max(200, Math.min(360, Math.floor((available - gap) / Math.max(1, Math.floor((available + gap) / 344)))));
    let x = 0, y = 0, rowHeight = 0;
    cards.forEach(card => {
        if (x && x + width > available) { x = 0; y += rowHeight + gap; rowHeight = 0; }
        const share = sharedSections.find(item => item.id === Number(card.dataset.onclick?.match(/\((\d+)/)?.[1]));
        if (share && canEditSharedSection(share)) { share.section.x = x; share.section.y = y; share.section.width = width; }
        card.style.left = `${x}px`; card.style.top = `${y}px`; card.style.width = `${width}px`;
        rowHeight = Math.max(rowHeight, card.offsetHeight); x += width + gap;
    });
    grid.style.minHeight = `${y + rowHeight + gap}px`;
    sharedSections.filter(canEditSharedSection).forEach(saveSharedSection);
    canvas.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    showSaveIndicator(`${cards.length} shared card${cards.length === 1 ? '' : 's'} organized`);
};

window.organizeSharedSubsectionCanvas = function() {
    const grid = document.getElementById('sharedSubsectionGrid');
    if (!grid) return;
    grid.scrollIntoView({ block: 'start', behavior: 'smooth' });
    showSaveIndicator('This subsection is already arranged for easy reading');
};
// Align the separate shared renderer with the personal canvas header.
// This layer only moves rendered controls; shared and personal data remain independent.
window.organizeSharedSectionCanvas = function() {
    const grid = mainContainer.querySelector('.box-grid--responsive');
    if (!grid) return;
    grid.scrollIntoView({ block: 'start', behavior: 'smooth' });
    showSaveIndicator('Shared section cards are organized');
};

function alignSeparateSharedCanvasHeader() {
    const canvas = mainContainer.querySelector('.canvas');
    const header = canvas?.querySelector(':scope > .canvas-header');
    const title = header?.querySelector(':scope > .title-section');
    if (!canvas || !header || !title || header.querySelector(':scope > .canvas-header-primary')) return;

    const selected = selectedSharedSectionId !== null;
    const subsection = selectedSharedSubsectionPath.length > 0;
    const share = sharedSections.find(item => item.id == selectedSharedSectionId);
    const editable = !!share && canEditSharedSection(share);

    const primary = document.createElement('div');
    primary.className = 'canvas-header-primary';
    const actions = document.createElement('div');
    actions.className = 'canvas-header-actions';
    const meta = document.createElement('div');
    meta.className = 'canvas-header-meta';

    primary.appendChild(title);
    primary.appendChild(actions);
    header.prepend(primary);
    header.appendChild(meta);

    const movedParents = new Set();
    if (selected && editable) {
        const selectors = subsection
            ? [`[data-onclick^="addSharedSubNote(${share.id}"]`, `[data-onclick^="addSharedSubList(${share.id}"]`, `[data-onclick^="addSharedSubsection(${share.id}"]`]
            : [`[data-onclick^="addSharedNote(${share.id}"]`, `[data-onclick^="addSharedList(${share.id}"]`, `[data-onclick^="addSharedSubsection(${share.id}"]`];
        selectors.forEach(selector => {
            const button = canvas.querySelector(selector);
            if (!button || button.closest('.box-actions, .shared-card-actions')) return;
            movedParents.add(button.parentElement);
            button.classList.remove('action-btn');
            button.classList.add('back-btn', 'canvas-action-btn');
            actions.appendChild(button);
        });
    }

    const organize = document.createElement('button');
    organize.className = 'back-btn canvas-action-btn desktop-organize-btn';
    organize.innerHTML = '<i class="fas fa-th-large"></i> Organize';
    organize.setAttribute('data-onclick', !selected ? 'organizeSharedCanvas()' : subsection ? 'organizeSharedSubsectionCanvas()' : 'organizeSharedSectionCanvas()');
    actions.appendChild(organize);

    // Match personal headers: Add actions, Organize, Export, then Back.
    const exportButton = header.querySelector(':scope > .shared-export-btn');
    if (exportButton) actions.appendChild(exportButton);

    const back = header.querySelector(':scope > .back-btn');
    if (back) actions.appendChild(back);

    title.querySelectorAll(':scope > .shared-access-badge, :scope > .shared-from-label, :scope > .subsection-label').forEach(item => meta.appendChild(item));

    if (selected && title.querySelector('.editable-title')) {
        const edit = document.createElement('button');
        edit.className = 'edit-title-btn';
        edit.title = 'Edit title';
        edit.innerHTML = '<i class="fas fa-edit"></i>';
        edit.setAttribute('data-onclick', "document.querySelector('.canvas-header .editable-title').focus()");
        meta.prepend(edit);
    }
    if (subsection && share && isSharedOwner(share)) {
        const remove = document.createElement('button');
        remove.className = 'delete-subsection-btn';
        remove.title = 'Delete subsection';
        remove.innerHTML = '<i class="fas fa-trash-alt"></i>';
        remove.setAttribute('data-onclick', `deleteSharedSubsection(${share.id}, '${escJs(selectedSharedSubsectionPath.join('/'))}')`);
        meta.appendChild(remove);
    }

    header.querySelectorAll(':scope > .action-btn, :scope > .manage-sharing-btn, :scope > .delete-shared-section-btn, :scope > .stop-sharing-btn').forEach(button => meta.appendChild(button));
    movedParents.forEach(parent => { if (parent && parent !== actions && !parent.children.length) parent.remove(); });
}

const renderSharedSectionsBeforeAlignedHeaders = renderSharedSections;
renderSharedSections = function() {
    renderSharedSectionsBeforeAlignedHeaders();
    alignSeparateSharedCanvasHeader();
};
