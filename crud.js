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

window.addSubsection = function(id) {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    const name = prompt('Subsection name:');
    if (name && name.trim()) {
        if (!sec.subs) sec.subs = [];
        const newSub = { name: name.trim().toLowerCase(), notes: [], items: [] };
        sec.subs.push(newSub);
        render();
        selectSubsection(id, newSub.name);
    }
};

window.deleteSubsection = function(sectionId, subName) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    
    const noteCount = sub.notes ? sub.notes.length : 0;
    const listCount = sub.items ? sub.items.length : 0;
    
    let message = `⚠️ Delete subsection "${capitalize(subName)}"?\n\n`;
    message += `This will permanently remove:\n`;
    message += `• ${noteCount} notes\n`;
    message += `• ${listCount} lists\n\n`;
    message += `This action cannot be undone!`;
    
    if (!confirm(message)) return;
    
    const index = sec.subs.findIndex(s => s.name === subName);
    if (index !== -1) {
        sec.subs.splice(index, 1);
        if (selectedSectionId === sectionId && selectedSubsection === subName) {
            selectedSubsection = null;
        }
        render();
    }
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
    sec.items.push({ title: 'New List', items: [], x: 340 + (liIdx * 20) % 200, y: 10 + (liIdx * 20) % 200, width: 320, height: 200 });
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

window.addSubItem = function(sectionId, listIndex) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const list = sec.items[listIndex];
    if (!list) return;
    if (!list.items) list.items = [];
    list.items.push({ text: 'New Item', done: false, rating: 0 });
    render();
    setTimeout(() => {
        const itemInputs = document.querySelectorAll('.list-box .editable-item');
        if (itemInputs.length > 0) {
            itemInputs[itemInputs.length - 1].focus();
            itemInputs[itemInputs.length - 1].select();
        }
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

window.addSubNote = function(subName) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
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

window.deleteSubNote = function(subName, noteIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    sub.notes.splice(noteIndex, 1);
    render();
};

// ============================================================
//  CRUD OPERATIONS - SUBSECTION LISTS
// ============================================================

window.addSubList = function(subName) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    if (!sub.items) sub.items = [];
    const liIdx = sub.items.length;
    sub.items.push({ title: 'New List', items: [], x: 340 + (liIdx * 20) % 200, y: 10 + (liIdx * 20) % 200, width: 320, height: 200 });
    render();
    setTimeout(() => {
        const titleInputs = document.querySelectorAll('.list-box .editable-title');
        if (titleInputs.length > 0) {
            titleInputs[titleInputs.length - 1].focus();
            titleInputs[titleInputs.length - 1].select();
        }
    }, 50);
};

window.deleteSubList = function(subName, listIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    sub.items.splice(listIndex, 1);
    render();
};

// ============================================================
//  CRUD OPERATIONS - SUBSECTION LIST ITEMS
// ============================================================

window.addSubItemToSub = function(subName, listIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    if (!list.items) list.items = [];
    list.items.push({ text: 'New Item', done: false, rating: 0 });
    render();
    setTimeout(() => {
        const itemInputs = document.querySelectorAll('.list-box .editable-item');
        if (itemInputs.length > 0) {
            itemInputs[itemInputs.length - 1].focus();
            itemInputs[itemInputs.length - 1].select();
        }
    }, 50);
};

window.deleteSubItemFromSub = function(subName, listIndex, subIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    list.items.splice(subIndex, 1);
    render();
};

window.toggleSubItemInSub = function(subName, listIndex, subIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    list.items[subIndex].done = !list.items[subIndex].done;
    render();
};

window.setSubItemRatingInSub = function(subName, listIndex, subIndex, rating) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
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

window.setSubItemLocationInSub = function(subName, listIndex, subIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
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

window.setSubListLocationInSub = function(subName, listIndex) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    const loc = prompt('Paste Google Maps link (e.g. https://maps.app.goo.gl/...) or address for this list:', list.location || '');
    if (loc !== null) {
        list.location = loc.trim();
        render();
    }
};