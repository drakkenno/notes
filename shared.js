// Recipient-based section sharing
const SHARED_API_URL = 'https://notes-qz019dfhz-drakenotes1.vercel.app/api/shared';
let sharedSections = [];
let isSharedSectionsView = false;

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
    try {
        await sharedApi('POST', { action: 'share-section', recipients, section });
        showSaveIndicator('Section shared');
        await loadSharedSections();
    } catch (error) {
        showSaveIndicator(error.message, true);
    }
};

window.deleteSharedSection = async function(shareId) {
    if (!confirm('Remove this shared section?')) return;
    try {
        await sharedApi('POST', { action: 'delete-section', shareId });
        await loadSharedSections();
        render();
    } catch (error) {
        showSaveIndicator(error.message, true);
    }
};

function renderSharedSections() {
    let html = '<div class="canvas"><div class="canvas-header"><div class="title-section"><i class="fas fa-share-alt"></i><h1>Shared Sections</h1></div><button class="back-btn" onclick="isSharedSectionsView=false; render()"><i class="fas fa-arrow-left"></i> Back</button></div>';
    if (!sharedSections.length) {
        html += '<div class="empty-state-hero"><i class="fas fa-share-alt"></i><p>No sections have been shared with you.</p></div>';
    } else {
        html += '<div class="shared-folder-grid">';
        sharedSections.forEach(share => {
            const section = share.section;
            const canDelete = share.owner === currentUser.username;
            html += `<article class="shared-folder-card"><div class="shared-folder-title"><i class="fas fa-folder-open"></i> ${esc(section.name)}</div><div class="shared-folder-content">${(section.notes || []).length} notes � ${(section.items || []).length} lists � ${(section.subs || []).length} subsections</div><div class="shared-folder-meta">Shared by ${esc(share.owner)}</div>${canDelete ? `<button class="box-delete-btn" onclick="deleteSharedSection(${share.id})" title="Remove share"><i class="fas fa-times"></i></button>` : ''}</article>`;
        });
        html += '</div>';
    }
    mainContainer.innerHTML = html + '</div>';
}