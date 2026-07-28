// ============================================================
// SHARED SECTION - A special section visible to all users
// ============================================================

const SHARED_SECTION_ID = -1; // Virtual ID for the shared section

async function sharedApi(method = 'GET', body = null) {
    if (!currentUser?.token) throw new Error('Please sign in again');
    const options = {
        method,
        headers: { Authorization: `Bearer ${currentUser.token}` }
    };
    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const response = await fetch(SHARED_API_URL, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
}

async function loadSharedFolders() {
    if (!currentUser) return;
    if (isLoadingShared) return;
    isLoadingShared = true;
    try {
        const data = await sharedApi();
        sharedFolders = data.folders || [];
        
        // Always update the shared section with loaded data
        updateSharedSection();
        
        if (isSharedView) render();
        else renderSidebar();
    } catch (error) {
        console.error('Failed to load shared folders:', error);
        showSaveIndicator(error.message, true);
    } finally {
        isLoadingShared = false;
    }
}

function updateSharedSection() {
    // Convert shared folders to a section format
    const existingIndex = sections.findIndex(s => s.id === SHARED_SECTION_ID);
    
    const sharedSection = {
        id: SHARED_SECTION_ID,
        name: 'Shared',
        isShared: true,
        notes: sharedFolders.map(folder => ({
            id: folder.id,
            title: folder.title,
            content: folder.content,
            createdBy: folder.createdBy,
            createdAt: folder.createdAt,
            contributors: [], // Can be expanded later
            x: 10,
            y: 10,
            width: 300,
            height: 160
        })),
        items: [],
        subs: [],
        x: 10,
        y: 10,
        width: 300,
        height: 200
    };
    
    if (existingIndex >= 0) {
        sections[existingIndex] = sharedSection;
    } else {
        sections.unshift(sharedSection); // Add at the beginning
    }
}

window.showSharedView = async function() {
    isSharedView = true;
    selectedSectionId = SHARED_SECTION_ID;
    selectedSubsection = null;
    render();
    await loadSharedFolders();
};

window.createSharedFolder = async function() {
    const title = prompt('Shared folder name:');
    if (!title?.trim()) return;
    const content = prompt('Shared content (visible to every user):') ?? '';
    try {
        await sharedApi('POST', { action: 'create', title: title.trim(), content });
        showSaveIndicator('Shared folder created');
        await loadSharedFolders();
    } catch (error) {
        showSaveIndicator(error.message, true);
    }
};

window.deleteSharedFolder = async function(folderId) {
    const folder = sharedFolders.find(item => item.id === folderId);
    if (!folder || !confirm(`Delete shared folder "${folder.title}"?`)) return;
    try {
        await sharedApi('POST', { action: 'delete', folderId });
        showSaveIndicator('Shared folder deleted');
        await loadSharedFolders();
    } catch (error) {
        showSaveIndicator(error.message, true);
    }
};

function renderSharedView() {
    if (!mainContainer) return;
    const username = currentUser?.username || '';
    let html = `<div class="canvas shared-canvas">
        <div class="canvas-header">
            <div class="title-section"><i class="fas fa-users"></i><h1>Shared</h1></div>
            <button class="action-btn" onclick="createSharedFolder()"><i class="fas fa-folder-plus"></i> Add shared folder</button>
        </div>
        <p class="shared-intro">Everything here is visible to all users. Only its creator or drakeno can delete it.</p>`;

    if (isLoadingShared && sharedFolders.length === 0) {
        html += `<div class="empty-message"><i class="fas fa-spinner fa-spin"></i> Loading shared folders...</div>`;
    } else if (sharedFolders.length === 0) {
        html += `<div class="empty-state-hero shared-empty"><i class="fas fa-folder-open"></i><p>No shared folders yet</p></div>`;
    } else {
        html += `<div class="shared-folder-grid">`;
        sharedFolders.forEach(folder => {
            const canDelete = username === 'drakeno' || username === folder.createdBy;
            html += `<article class="shared-folder-card">
                ${canDelete ? `<button class="box-delete-btn" onclick="deleteSharedFolder(${folder.id})" title="Delete shared folder"><i class="fas fa-times"></i></button>` : ''}
                <div class="shared-folder-title"><i class="fas fa-folder-open"></i> ${esc(folder.title)}</div>
                <div class="shared-folder-content">${esc(folder.content || 'No content').replace(/\n/g, '<br>')}</div>
                <div class="shared-folder-meta"><i class="fas fa-user"></i> ${esc(folder.createdBy)} · ${new Date(folder.createdAt).toLocaleString()}</div>
            </article>`;
        });
        html += `</div>`;
    }
    html += `</div>`;
    mainContainer.innerHTML = html;
}