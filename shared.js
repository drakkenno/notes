// Recipient-based section sharing
const SHARED_API_URL = 'https://notes-qz019dfhz-drakenotes1.vercel.app/api/shared';
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
        await sharedApi('POST', { action: 'share-section', recipients, permission, section });
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
    render();
};

function canEditSharedSection(share) {
    return share.owner === currentUser.username ||
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
    const selectedShare = sharedSections.find(share => share.id === selectedSharedSectionId);
    if (selectedShare) return renderSharedSection(selectedShare);

    let html = '<div class="canvas"><div class="canvas-header"><div class="title-section"><i class="fas fa-share-alt"></i><h1>Shared Sections</h1></div><button class="back-btn" onclick="isSharedSectionsView=false; render()"><i class="fas fa-arrow-left"></i> Back</button></div>';
    if (!sharedSections.length) {
        html += '<div class="empty-state-hero"><i class="fas fa-share-alt"></i><p>No sections have been shared with you.</p></div>';
    } else {
        html += '<div class="box-grid" id="sharedBoxGrid">';
        sharedSections.forEach((share, index) => {
            const section = share.section;
            const canDelete = share.owner === currentUser.username;
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
    if (!notes.length && !lists.length) {
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
    mainContainer.innerHTML = html + '</div>';
    setTimeout(autoResizeTextareas, 10);
}