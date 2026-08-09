// ============================================================
//  CRUD OPERATIONS - SECTIONS
// ============================================================

window.deleteSection = function(id) {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    
    const noteCount = sec.notes ? sec.notes.length : 0;
    const listCount = sec.items ? sec.items.length : 0;
    const subCount = sec.subs ? sec.subs.length : 0;
    
    let message = `⚠️ Delete section "${capitalize(sec.name)}"?\n\n`;
    message += `This will permanently remove:\n`;
    message += `• ${noteCount} notes\n`;
    message += `• ${listCount} lists\n`;
    message += `• ${subCount} subsections\n\n`;
    message += `This action cannot be undone!`;
    
    if (!confirm(message)) return;
    
    sections = sections.filter(s => s.id !== id);
    if (selectedSectionId === id) {
        selectedSectionId = null;
        selectedSubsection = null;
    }
    render();
};

// ============================================================
//  CRUD OPERATIONS - SUBSECTIONS
// ============================================================

window.addSubsection = function(sectionId, parentPath = '') {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    
    const parentDepth = parentPath ? parentPath.split('/').filter(Boolean).length : 0;
    if (parentDepth >= 5) {
        alert('Maximum subsection depth (5 levels) reached');
        return;
    }

    const name = prompt('Subsection name:');
    if (!name || !name.trim()) return;
    
    const newSub = { name: name.trim().toLowerCase(), notes: [], items: [], subs: [] };
    
    // If parentPath is provided, add as nested subsection
    if (parentPath) {
        const pathParts = parentPath.split('/');
        let current = sec.subs || [];
        let parent = null;
        
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            parent = current.find(s => s.name === part);
            if (!parent) return;
            if (i < pathParts.length - 1) {
                current = parent.subs || [];
            }
        }
        
        if (!parent.subs) parent.subs = [];
        parent.subs.push(newSub);
    } else {
        // Add as top-level subsection
        if (!sec.subs) sec.subs = [];
        sec.subs.push(newSub);
    }
    
    render();
    
    // Select the new subsection
    const newPath = parentPath ? [...parentPath.split('/'), newSub.name] : [newSub.name];
    selectSubsection(sectionId, newPath);
};

window.deleteSubsection = function(sectionId, path) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    
    const pathParts = path.split('/');
    const subName = pathParts[pathParts.length - 1];
    
    // Find the subsection to delete
    let current = sec.subs || [];
    let parent = null;
    let subIndex = -1;
    
    for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        subIndex = current.findIndex(s => s.name === part);
        if (subIndex === -1) return;
        
        if (i < pathParts.length - 1) {
            parent = current[subIndex];
            current = parent.subs || [];
        }
    }
    
    const sub = current[subIndex];
    if (!sub) return;
    
    const noteCount = sub.notes ? sub.notes.length : 0;
    const listCount = sub.items ? sub.items.length : 0;
    const nestedCount = sub.subs ? sub.subs.length : 0;
    
    let message = `⚠️ Delete subsection "${capitalize(subName)}"?\n\n`;
    message += `This will permanently remove:\n`;
    message += `• ${noteCount} notes\n`;
    message += `• ${listCount} lists\n`;
    if (nestedCount > 0) {
        message += `• ${nestedCount} nested subsections\n`;
    }
    message += `\nThis action cannot be undone!`;
    
    if (!confirm(message)) return;
    
    // Delete the subsection
    current.splice(subIndex, 1);
    
    // Clear selection if this subsection was selected
    if (selectedSectionId === sectionId) {
        const selectedPath = pathParts.join('/');
        const currentSelectedPath = selectedSubsectionPath.join('/');
        if (currentSelectedPath === selectedPath || currentSelectedPath.startsWith(selectedPath + '/')) {
            selectedSubsectionPath = [];
        }
    }
    
    render();
};

window.deleteCurrentSubsection = function() {
    if (!selectedSectionId || selectedSubsectionPath.length === 0) return;
    
    const path = selectedSubsectionPath.join('/');
    deleteSubsection(selectedSectionId, path);
};

// ============================================================
//  CRUD OPERATIONS - SECTION NOTES
// ============================================================

window.addNoteToSection = function(sectionId) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    if (!sec.notes) sec.notes = [];
    const ni = sec.notes.length;
    sec.notes.push({ title: 'New Note', content: '', x: 10 + (ni * 20) % 200, y: 10 + (ni * 20) % 200, width: 300, height: 160 });
    render();
    setTimeout(() => {
        const titleInputs = document.querySelectorAll('.note-box .editable-title');
        if (titleInputs.length > 0) {
            titleInputs[titleInputs.length - 1].focus();
            titleInputs[titleInputs.length - 1].select();
        }
    }, 50);
};

window.deleteNote = function(id, noteIndex) {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    sec.notes.splice(noteIndex, 1);
    render();
};

// ============================================================
//  CRUD OPERATIONS - SECTION LISTS
// ============================================================

window.addListToSection = function(sectionId) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    if (!sec.items) sec.items = [];
    const liIdx = sec.items.length;
    sec.items.push({ title: 'New List', items: [], x: 340 + (liIdx * 20) % 200, y: 10 + (liIdx * 20) % 200, width: 320, height: 140, autoSize: true });
    render();
    setTimeout(() => {
        const titleInputs = document.querySelectorAll('.list-box .editable-title');
        if (titleInputs.length > 0) {
            titleInputs[titleInputs.length - 1].focus();
            titleInputs[titleInputs.length - 1].select();
        }
    }, 50);
};

window.deleteList = function(sectionId, listIndex) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    sec.items.splice(listIndex, 1);
    render();
};

// ============================================================
//  CRUD OPERATIONS - SECTION LIST ITEMS
// ============================================================

window.addSubItem = function(sectionId, listIndex, afterIndex = null) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const list = sec.items[listIndex];
    if (!list) return;
    if (!list.items) list.items = [];
    const newIndex = afterIndex === null ? list.items.length : afterIndex + 1;
    list.items.splice(newIndex, 0, { text: '', done: false, rating: 0 });
    render();
    setTimeout(() => {
        const newItem = document.querySelector('.list-box.box-selected')?.querySelectorAll('.editable-item')[newIndex];
        newItem?.focus();
    }, 50);
};

window.deleteSubItem = function(sectionId, listIndex, subIndex) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const list = sec.items[listIndex];
    if (!list) return;
    list.items.splice(subIndex, 1);
    render();
};

window.toggleSubItem = function(sectionId, listIndex, subIndex) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const list = sec.items[listIndex];
    if (!list) return;
    list.items[subIndex].done = !list.items[subIndex].done;
    render();
};

window.setSubItemRating = function(sectionId, listIndex, subIndex, rating) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const list = sec.items[listIndex];
    if (!list || !list.items || !list.items[subIndex]) return;
    list.items[subIndex].rating = rating;
    render();
};

// ============================================================
//  CRUD OPERATIONS - SUBSECTION NOTES
// ============================================================

window.addSubNote = function(subPath) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    if (!sub.notes) sub.notes = [];
    const ni = sub.notes.length;
    sub.notes.push({ title: 'New Note', content: '', x: 10 + (ni * 20) % 200, y: 10 + (ni * 20) % 200, width: 300, height: 160 });
    render();
    setTimeout(() => {
        const titleInputs = document.querySelectorAll('.note-box .editable-title');
        if (titleInputs.length > 0) {
            titleInputs[titleInputs.length - 1].focus();
            titleInputs[titleInputs.length - 1].select();
        }
    }, 50);
};

window.deleteSubNote = function(subPath, noteIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    sub.notes.splice(noteIndex, 1);
    render();
};

// ============================================================
//  CRUD OPERATIONS - SUBSECTION LISTS
// ============================================================

window.addSubList = function(subPath) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    if (!sub.items) sub.items = [];
    const liIdx = sub.items.length;
    sub.items.push({ title: 'New List', items: [], x: 340 + (liIdx * 20) % 200, y: 10 + (liIdx * 20) % 200, width: 320, height: 140, autoSize: true });
    render();
    setTimeout(() => {
        const titleInputs = document.querySelectorAll('.list-box .editable-title');
        if (titleInputs.length > 0) {
            titleInputs[titleInputs.length - 1].focus();
            titleInputs[titleInputs.length - 1].select();
        }
    }, 50);
};

window.deleteSubList = function(subPath, listIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    sub.items.splice(listIndex, 1);
    render();
};

// ============================================================
//  CRUD OPERATIONS - SUBSECTION LIST ITEMS
// ============================================================

window.addSubItemToSub = function(subPath, listIndex, afterIndex = null) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    if (!list.items) list.items = [];
    const newIndex = afterIndex === null ? list.items.length : afterIndex + 1;
    list.items.splice(newIndex, 0, { text: '', done: false, rating: 0 });
    render();
    setTimeout(() => {
        const newItem = document.querySelector('.list-box.box-selected')?.querySelectorAll('.editable-item')[newIndex];
        newItem?.focus();
    }, 50);
};

window.deleteSubItemFromSub = function(subPath, listIndex, subIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    list.items.splice(subIndex, 1);
    render();
};

window.toggleSubItemInSub = function(subPath, listIndex, subIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    list.items[subIndex].done = !list.items[subIndex].done;
    render();
};

window.setSubItemRatingInSub = function(subPath, listIndex, subIndex, rating) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list || !list.items || !list.items[subIndex]) return;
    list.items[subIndex].rating = rating;
    render();
};

// ============================================================
//  LOCATION HANDLERS
// ============================================================

window.setItemLocation = function(sectionId, listIndex, subIndex) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const list = sec.items[listIndex];
    if (!list || !list.items || !list.items[subIndex]) return;
    const item = list.items[subIndex];
    const loc = prompt('Paste Google Maps link (e.g. https://maps.app.goo.gl/...) or address:', item.location || '');
    if (loc !== null) {
        item.location = loc.trim();
        render();
    }
};

window.setSubItemLocationInSub = function(subPath, listIndex, subIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list || !list.items || !list.items[subIndex]) return;
    const item = list.items[subIndex];
    const loc = prompt('Paste Google Maps link (e.g. https://maps.app.goo.gl/...) or address:', item.location || '');
    if (loc !== null) {
        item.location = loc.trim();
        render();
    }
};

window.setListLocation = function(sectionId, listIndex) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const list = sec.items[listIndex];
    if (!list) return;
    const loc = prompt('Paste Google Maps link (e.g. https://maps.app.goo.gl/...) or address for this list:', list.location || '');
    if (loc !== null) {
        list.location = loc.trim();
        render();
    }
};

window.setSubListLocationInSub = function(subPath, listIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    const loc = prompt('Paste Google Maps link (e.g. https://maps.app.goo.gl/...) or address for this list:', list.location || '');
    if (loc !== null) {
        list.location = loc.trim();
        render();
    }
};
// Stop sharing leaves the personal source intact; deletion removes every linked shared copy.
window.stopSharingSection = async function(id) {
    const section = sections.find(item => item.id === id);
    if (!section?.sharedShareIds?.length || !confirm('Stop sharing "' + capitalize(section.name) + '"? Your personal section will remain.')) return;
    try {
        for (const shareId of section.sharedShareIds) await sharedApi('POST', { action: 'stop-sharing', shareId });
        section.sharedShareIds = [];
        await loadSharedSections(); render(); showSaveIndicator('Sharing stopped');
    } catch (error) { showSaveIndicator(error.message, true); }
};
window.deleteSection = async function(id) {
    const sec = sections.find(s => s.id === id);
    if (!sec || !confirm('Delete section "' + capitalize(sec.name) + '" and all of its shared copies? This cannot be undone.')) return;
    // Personal sections created before the shared-source migration may retain
    // stale shared IDs. They must not block deletion of the personal copy.
    sections = sections.filter(s => s.id !== id);
    if (selectedSectionId === id) { selectedSectionId = null; selectedSubsectionPath = []; }
    render();
};
