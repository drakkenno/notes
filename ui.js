// ============================================================
//  RENDER - MAIN CANVAS
// ============================================================

function render() {
    renderSidebar();
    renderMain();
    saveLocalData();
    if (isVercelConfigured && !isSyncing) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveToVercel({ sections, nextId });
        }, 1000);
    }
}

function renderMain() {
    if (!mainContainer) return;
    
    let html = `<div class="canvas ${selectedSectionId !== null ? 'has-selection' : ''}" id="canvas">`;
    
    // Header
    html += `<div class="canvas-header">`;
    
    if (selectedSectionId !== null) {
        const sec = sections.find(s => s.id === selectedSectionId);
        if (sec) {
            const displayName = selectedSubsection ? `${capitalize(sec.name)} / ${capitalize(selectedSubsection)}` : capitalize(sec.name);
            html += `<div class="title-section">
                        <i class="fas fa-folder-open" style="color:#f5e56b; font-size:1.5rem;"></i>
                        <input class="editable-title" value="${esc(displayName)}" 
                               onchange="updateSectionTitle(${sec.id}, this.value)"
                               onfocus="this.select()"
                               style="font-size:1.8rem; font-weight:600; background:transparent; border:none; color:#f5e56b; outline:none; border-bottom:2px solid transparent; min-width:100px;">
                        <button class="edit-title-btn" onclick="document.querySelector('.canvas-header .editable-title').focus()" style="background:transparent; border:none; color:#7a7a5a; cursor:pointer; font-size:0.8rem;">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${selectedSubsection ? `<span style="color: #7a7a5a; font-size: 0.9rem; margin-left: 0.5rem;">(subsection)</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 0.8rem; align-items: center;">
                        <button class="back-btn" onclick="clearSelection()"><i class="fas fa-arrow-left"></i> Back</button>
                        <span class="badge" id="syncStatus"><i class="fas fa-database"></i> <span id="syncLabel">local</span></span>
                    </div>`;
        }
    } else {
        html += `<div class="title-section">
                    <i class="fas fa-sticky-note" style="color:#f5e56b; font-size:1.5rem;"></i>
                    <h1>Notes & Lists</h1>
                </div>
                <span class="badge" id="syncStatus"><i class="fas fa-database"></i> <span id="syncLabel">local</span></span>`;
    }
    html += `</div>`;
    
    // Content
    if (selectedSectionId === null) {
        // Show all sections as boxes
        if (sections.length === 0) {
            html += `
                <div class="empty-state-hero">
                    <i class="fas fa-pencil-alt"></i>
                    <p>Start by adding a section<br><span style="font-size:0.9rem; color:#7a7a5a;">click "Add section" in the sidebar</span></p>
                </div>
            `;
        } else {
            html += `<div class="box-grid" id="boxGrid">`;
            sections.forEach((sec, index) => {
                const x = sec.x !== undefined ? sec.x : (index * 30) % 400 + 20;
                const y = sec.y !== undefined ? sec.y : (index * 40) % 300 + 20;
                const width = sec.width || 280 + (index % 3) * 40;
                const height = sec.height || 180 + (index % 4) * 30;
                html += `
                    <div class="note-box" id="box-${sec.id}" 
                         style="cursor: default; position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; min-width:200px; min-height:120px;"
                         data-section-id="${sec.id}">
                        <div class="box-title">
                            <span class="drag-handle" onclick="event.stopPropagation();"><i class="fas fa-grip-lines"></i></span>
                            <i class="fas fa-folder-open"></i>
                            <span>${capitalize(sec.name)}</span>
                            <span class="box-actions">
                                <i class="fas fa-trash-alt" onclick="event.stopPropagation(); deleteSection(${sec.id})" title="Delete section"></i>
                            </span>
                        </div>
                        <div class="note-content" style="color: #7a7a5a; font-size: 0.85rem;">
                            ${sec.notes ? sec.notes.length : 0} notes · ${sec.items ? sec.items.length : 0} lists
                            ${sec.subs && sec.subs.length > 0 ? ` · ${sec.subs.length} subsections` : ''}
                        </div>
                        <div class="resize-handle" onclick="event.stopPropagation();">
                            <i class="fas fa-grip-lines"></i>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            
            // Add drag and drop functionality after render
            setTimeout(() => {
                makeDraggable();
                makeResizable();
            }, 50);
        }
    } else {
        // Section selected - show its content
        const sec = sections.find(s => s.id === selectedSectionId);
        if (!sec) {
            html += `<div class="empty-state-hero"><i class="fas fa-exclamation-triangle"></i><p>Section not found</p></div>`;
            html += `</div>`;
            mainContainer.innerHTML = html;
            return;
        }
        
        // If we're in a subsection, show its content
        if (selectedSubsection) {
            const sub = sec.subs.find(s => s.name === selectedSubsection);
            if (!sub) {
                html += `<div class="empty-state-hero"><i class="fas fa-exclamation-triangle"></i><p>Subsection not found</p></div>`;
                html += `</div>`;
                mainContainer.innerHTML = html;
                return;
            }
            
            html += `<div class="empty-state-hero" style="position: relative; transform: none; margin: 2rem auto; width: 80%; max-width: 500px;">
                        <i class="fas fa-folder-open"></i>
                        <p>Subsection: ${capitalize(sub.name)}<br><span style="font-size:0.9rem; color:#7a7a5a;">Add notes and lists below</span></p>
                    </div>`;
            
            html += `<div class="box-grid" id="boxGrid">`;
            let offsetY = 10;
            
            // Subsection notes
            if (sub.notes && sub.notes.length > 0) {
                sub.notes.forEach((note, ni) => {
                    const width = 300 + (ni % 3) * 30;
                    const height = 160 + (ni % 4) * 20;
                    html += `
                        <div class="note-box" id="box-${sec.id}-note-${ni}"
                             style="position:absolute; left:${10 + (ni * 15) % 350}px; top:${offsetY}px; width:${width}px; height:${height}px; min-width:200px; min-height:120px;">
                            <div class="box-title">
                                <span class="drag-handle" onclick="event.stopPropagation();"><i class="fas fa-grip-lines"></i></span>
                                <i class="fas fa-pen-fancy"></i>
                                <input class="editable-title" value="${esc(note.title || 'Note')}" 
                                       onchange="updateSubNoteTitle('${sub.name}', ${ni}, this.value)"
                                       onfocus="this.select()"
                                       style="background:transparent; border:none; color:#f5e56b; font-weight:600; font-size:0.9rem; outline:none; border-bottom:2px solid transparent; flex:1;">
                                <span class="box-actions">
                                    <i class="fas fa-trash-alt" onclick="deleteSubNote('${sub.name}', ${ni})" title="Delete note"></i>
                                </span>
                            </div>
                            <div class="note-content">
                                <textarea class="editable-content" 
                                          onchange="updateSubNoteContent('${sub.name}', ${ni}, this.value)"
                                          style="background:transparent; border:none; color:#d4c45a; font-size:0.95rem; line-height:1.6; outline:none; width:100%; min-height:30px; max-height:200px; font-family:inherit; resize:vertical; padding:0.2rem; border-radius:4px;">${esc(note.content || '')}</textarea>
                            </div>
                            <div class="resize-handle" onclick="event.stopPropagation();">
                                <i class="fas fa-grip-lines"></i>
                            </div>
                        </div>
                    `;
                    offsetY += 30;
                });
            }
            
            // Subsection lists
            if (sub.items && sub.items.length > 0) {
                sub.items.forEach((list, liIdx) => {
                    const width = 320 + (liIdx % 3) * 30;
                    const height = 200 + (liIdx % 4) * 20;
                    html += `
                        <div class="list-box" id="box-${sec.id}-list-${liIdx}"
                             style="position:absolute; left:${350 + (liIdx * 20) % 300}px; top:${offsetY}px; width:${width}px; height:${height}px; min-width:200px; min-height:150px;">
                            <div class="box-title">
                                <span class="drag-handle" onclick="event.stopPropagation();"><i class="fas fa-grip-lines"></i></span>
                                <i class="fas fa-list-ul"></i>
                                <input class="editable-title" value="${esc(list.title || 'List')}" 
                                       onchange="updateSubListTitle('${sub.name}', ${liIdx}, this.value)"
                                       onfocus="this.select()"
                                       style="background:transparent; border:none; color:#f5e56b; font-weight:600; font-size:0.9rem; outline:none; border-bottom:2px solid transparent; flex:1;">
                                <span class="box-actions">
                                    <i class="fas fa-plus" onclick="addSubItemToSub('${sub.name}', ${liIdx})" title="Add item"></i>
                                    <i class="fas fa-trash-alt" onclick="deleteSubList('${sub.name}', ${liIdx})" title="Delete list"></i>
                                </span>
                            </div>
                            <div class="list-items" style="max-height:calc(100% - 60px); overflow-y:auto;">
                    `;
                    
                    if (list.items && list.items.length > 0) {
                        list.items.forEach((item, subIdx) => {
                            const icon = item.done ? 'fa-check-circle' : 'fa-circle';
                            const color = item.done ? '#f5e56b' : '#7a7a5a';
                            html += `
                                <div class="sub-list-item">
                                    <i class="fas ${icon}" style="color:${color};" onclick="toggleSubItemInSub('${sub.name}', ${liIdx}, ${subIdx})" title="Toggle done"></i>
                                    <input class="editable-item" value="${esc(item.text)}" 
                                           onchange="updateSubItemInSub('${sub.name}', ${liIdx}, ${subIdx}, this.value)"
                                           onfocus="this.select()"
                                           style="flex:1; background:transparent; border:none; color:#d4c45a; font-size:0.9rem; outline:none; padding:0.1rem 0.2rem; border-radius:4px;">
                                    <span class="item-tag">${item.done ? 'done' : 'pending'}</span>
                                    <i class="fas fa-times item-delete" onclick="deleteSubItemFromSub('${sub.name}', ${liIdx}, ${subIdx})" title="Delete item"></i>
                                </div>
                            `;
                        });
                    } else {
                        html += `<div class="empty-message"><i class="fas fa-plus-circle"></i> No items yet. Click + to add.</div>`;
                    }
                    
                    html += `
                            </div>
                            <button class="add-item-btn" onclick="addSubItemToSub('${sub.name}', ${liIdx})"><i class="fas fa-plus"></i> Add item</button>
                            <div class="resize-handle" onclick="event.stopPropagation();">
                                <i class="fas fa-grip-lines"></i>
                            </div>
                        </div>
                    `;
                    offsetY += 30;
                });
            }
            html += `</div>`;
            
            html += `
                <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #2a2a1a; display: flex; gap: 0.8rem; flex-wrap: wrap;">
                    <button class="action-btn" onclick="addSubNote('${sub.name}')"><i class="fas fa-plus"></i> Add note</button>
                    <button class="action-btn" onclick="addSubList('${sub.name}')"><i class="fas fa-plus"></i> Add list</button>
                </div>
            `;
            
            setTimeout(() => {
                makeDraggable();
                makeResizable();
            }, 50);
        } else {
            // Show parent section content
            html += `<div class="box-grid" id="boxGrid">`;
            let offsetY = 10;
            
            // Section notes
            if (sec.notes && sec.notes.length > 0) {
                sec.notes.forEach((note, ni) => {
                    const width = 300 + (ni % 3) * 30;
                    const height = 160 + (ni % 4) * 20;
                    html += `
                        <div class="note-box" id="box-${sec.id}-note-${ni}"
                             style="position:absolute; left:${10 + (ni * 15) % 350}px; top:${offsetY}px; width:${width}px; height:${height}px; min-width:200px; min-height:120px;">
                            <div class="box-title">
                                <span class="drag-handle" onclick="event.stopPropagation();"><i class="fas fa-grip-lines"></i></span>
                                <i class="fas fa-pen-fancy"></i>
                                <input class="editable-title" value="${esc(note.title || 'Note')}" 
                                       onchange="updateNoteTitle(${sec.id}, ${ni}, this.value)"
                                       onfocus="this.select()"
                                       style="background:transparent; border:none; color:#f5e56b; font-weight:600; font-size:0.9rem; outline:none; border-bottom:2px solid transparent; flex:1;">
                                <span class="box-actions">
                                    <i class="fas fa-trash-alt" onclick="deleteNote(${sec.id}, ${ni})" title="Delete note"></i>
                                </span>
                            </div>
                            <div class="note-content">
                                <textarea class="editable-content" 
                                          onchange="updateNoteContent(${sec.id}, ${ni}, this.value)"
                                          style="background:transparent; border:none; color:#d4c45a; font-size:0.95rem; line-height:1.6; outline:none; width:100%; min-height:30px; max-height:200px; font-family:inherit; resize:vertical; padding:0.2rem; border-radius:4px;">${esc(note.content || '')}</textarea>
                            </div>
                            <div class="resize-handle" onclick="event.stopPropagation();">
                                <i class="fas fa-grip-lines"></i>
                            </div>
                        </div>
                    `;
                    offsetY += 30;
                });
            }
            
            // Section lists
            if (sec.items && sec.items.length > 0) {
                sec.items.forEach((list, liIdx) => {
                    const width = 320 + (liIdx % 3) * 30;
                    const height = 200 + (liIdx % 4) * 20;
                    html += `
                        <div class="list-box" id="box-${sec.id}-list-${liIdx}"
                             style="position:absolute; left:${350 + (liIdx * 20) % 300}px; top:${offsetY}px; width:${width}px; height:${height}px; min-width:200px; min-height:150px;">
                            <div class="box-title">
                                <span class="drag-handle" onclick="event.stopPropagation();"><i class="fas fa-grip-lines"></i></span>
                                <i class="fas fa-list-ul"></i>
                                <input class="editable-title" value="${esc(list.title || 'List')}" 
                                       onchange="updateListTitle(${sec.id}, ${liIdx}, this.value)"
                                       onfocus="this.select()"
                                       style="background:transparent; border:none; color:#f5e56b; font-weight:600; font-size:0.9rem; outline:none; border-bottom:2px solid transparent; flex:1;">
                                <span class="box-actions">
                                    <i class="fas fa-plus" onclick="addSubItem(${sec.id}, ${liIdx})" title="Add item"></i>
                                    <i class="fas fa-trash-alt" onclick="deleteList(${sec.id}, ${liIdx})" title="Delete list"></i>
                                </span>
                            </div>
                            <div class="list-items" style="max-height:calc(100% - 60px); overflow-y:auto;">
                    `;
                    
                    if (list.items && list.items.length > 0) {
                        list.items.forEach((item, subIdx) => {
                            const icon = item.done ? 'fa-check-circle' : 'fa-circle';
                            const color = item.done ? '#f5e56b' : '#7a7a5a';
                            html += `
                                <div class="sub-list-item">
                                    <i class="fas ${icon}" style="color:${color};" onclick="toggleSubItem(${sec.id}, ${liIdx}, ${subIdx})" title="Toggle done"></i>
                                    <input class="editable-item" value="${esc(item.text)}" 
                                           onchange="updateSubItem(${sec.id}, ${liIdx}, ${subIdx}, this.value)"
                                           onfocus="this.select()"
                                           style="flex:1; background:transparent; border:none; color:#d4c45a; font-size:0.9rem; outline:none; padding:0.1rem 0.2rem; border-radius:4px;">
                                    <span class="item-tag">${item.done ? 'done' : 'pending'}</span>
                                    <i class="fas fa-times item-delete" onclick="deleteSubItem(${sec.id}, ${liIdx}, ${subIdx})" title="Delete item"></i>
                                </div>
                            `;
                        });
                    } else {
                        html += `<div class="empty-message"><i class="fas fa-plus-circle"></i> No items yet. Click + to add.</div>`;
                    }
                    
                    html += `
                            </div>
                            <button class="add-item-btn" onclick="addSubItem(${sec.id}, ${liIdx})"><i class="fas fa-plus"></i> Add item</button>
                            <div class="resize-handle" onclick="event.stopPropagation();">
                                <i class="fas fa-grip-lines"></i>
                            </div>
                        </div>
                    `;
                    offsetY += 30;
                });
            }
            html += `</div>`;
            
            // Show subsections at the bottom
            if (sec.subs && sec.subs.length > 0) {
                html += `<div class="subsections-list">`;
                html += `<div style="color: #7a7a5a; font-size: 0.8rem; margin-bottom: 0.5rem;"><i class="fas fa-sitemap"></i> Subsections</div>`;
                sec.subs.forEach(sub => {
                    html += `
                        <span class="subsection-item" onclick="selectSubsection(${sec.id}, '${sub.name}')">
                            ${capitalize(sub.name)}
                            <span class="sub-delete" onclick="event.stopPropagation(); deleteSubsection(${sec.id}, '${sub.name}')">
                                <i class="fas fa-times"></i>
                            </span>
                        </span>
                    `;
                });
                html += `</div>`;
            }
            
            html += `
                <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #2a2a1a; display: flex; gap: 0.8rem; flex-wrap: wrap;">
                    <button class="action-btn" onclick="addNoteToSection(${sec.id})"><i class="fas fa-plus"></i> Add note</button>
                    <button class="action-btn" onclick="addListToSection(${sec.id})"><i class="fas fa-plus"></i> Add list</button>
                    <button class="action-btn" onclick="addSubsection(${sec.id})"><i class="fas fa-plus"></i> Add subsection</button>
                </div>
            `;
            
            setTimeout(() => {
                makeDraggable();
                makeResizable();
            }, 50);
        }
    }
    
    html += `</div>`;
    mainContainer.innerHTML = html;
}

// ============================================================
//  UPDATE FUNCTIONS - SECTION
// ============================================================

function updateSectionTitle(sectionId, newValue) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    if (newValue && newValue.trim() !== '') {
        sec.name = newValue.trim();
        render();
    }
}

function updateNoteTitle(sectionId, noteIndex, newValue) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const note = sec.notes[noteIndex];
    if (!note) return;
    if (newValue && newValue.trim() !== '') {
        note.title = newValue.trim();
        render();
    }
}

function updateNoteContent(sectionId, noteIndex, newValue) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const note = sec.notes[noteIndex];
    if (!note) return;
    note.content = newValue;
    render();
}

function updateListTitle(sectionId, listIndex, newValue) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const list = sec.items[listIndex];
    if (!list) return;
    if (newValue && newValue.trim() !== '') {
        list.title = newValue.trim();
        render();
    }
}

function updateSubItem(sectionId, listIndex, subIndex, newValue) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const list = sec.items[listIndex];
    if (!list) return;
    const item = list.items[subIndex];
    if (!item) return;
    if (newValue && newValue.trim() !== '') {
        item.text = newValue.trim();
        render();
    }
}

// ============================================================
//  UPDATE FUNCTIONS - SUBSECTION
// ============================================================

function updateSubNoteTitle(subName, noteIndex, newValue) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    const note = sub.notes[noteIndex];
    if (!note) return;
    if (newValue && newValue.trim() !== '') {
        note.title = newValue.trim();
        render();
    }
}

function updateSubNoteContent(subName, noteIndex, newValue) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    const note = sub.notes[noteIndex];
    if (!note) return;
    note.content = newValue;
    render();
}

function updateSubListTitle(subName, listIndex, newValue) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    if (newValue && newValue.trim() !== '') {
        list.title = newValue.trim();
        render();
    }
}

function updateSubItemInSub(subName, listIndex, subIndex, newValue) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    const item = list.items[subIndex];
    if (!item) return;
    if (newValue && newValue.trim() !== '') {
        item.text = newValue.trim();
        render();
    }
}

// ============================================================
//  DRAG AND DROP FUNCTIONALITY
// ============================================================

let dragData = null;

function makeDraggable() {
    document.querySelectorAll('.drag-handle').forEach(handle => {
        handle.removeEventListener('mousedown', startDrag);
        handle.addEventListener('mousedown', startDrag);
    });
}

function startDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const box = e.target.closest('.note-box, .list-box');
    if (!box) return;
    
    const rect = box.getBoundingClientRect();
    const container = document.getElementById('boxGrid') || document.querySelector('.box-grid');
    const containerRect = container ? container.getBoundingClientRect() : null;
    
    dragData = {
        box: box,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: rect.left - (containerRect ? containerRect.left : 0),
        startTop: rect.top - (containerRect ? containerRect.top : 0),
        sectionId: box.dataset.sectionId ? parseInt(box.dataset.sectionId) : null
    };
    
    box.classList.add('dragging');
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
}

function onDrag(e) {
    if (!dragData) return;
    
    const container = document.getElementById('boxGrid') || document.querySelector('.box-grid');
    const containerRect = container ? container.getBoundingClientRect() : null;
    
    const dx = e.clientX - dragData.startX;
    const dy = e.clientY - dragData.startY;
    
    let newX = dragData.startLeft + dx;
    let newY = dragData.startTop + dy;
    
    // Keep within container bounds
    if (containerRect) {
        newX = Math.max(0, Math.min(newX, containerRect.width - 200));
        newY = Math.max(0, Math.min(newY, containerRect.height - 120));
    }
    
    dragData.box.style.left = newX + 'px';
    dragData.box.style.top = newY + 'px';
    
    // Update data
    if (dragData.sectionId !== null) {
        const sec = sections.find(s => s.id === dragData.sectionId);
        if (sec) {
            sec.x = newX;
            sec.y = newY;
        }
    }
}

function stopDrag() {
    if (dragData) {
        dragData.box.classList.remove('dragging');
        saveLocalData();
        if (isVercelConfigured && !isSyncing) {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveToVercel({ sections, nextId });
            }, 500);
        }
    }
    dragData = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// ============================================================
//  RESIZE FUNCTIONALITY
// ============================================================

function makeResizable() {
    document.querySelectorAll('.resize-handle').forEach(handle => {
        handle.removeEventListener('mousedown', startResize);
        handle.addEventListener('mousedown', startResize);
    });
}

let resizeData = null;

function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const box = e.target.closest('.note-box, .list-box');
    if (!box) return;
    
    const rect = box.getBoundingClientRect();
    const container = document.getElementById('boxGrid') || document.querySelector('.box-grid');
    const containerRect = container ? container.getBoundingClientRect() : null;
    
    resizeData = {
        box: box,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: rect.left - (containerRect ? containerRect.left : 0),
        startTop: rect.top - (containerRect ? containerRect.top : 0),
        sectionId: box.dataset.sectionId ? parseInt(box.dataset.sectionId) : null
    };
    
    box.classList.add('resizing');
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
}

function onResize(e) {
    if (!resizeData) return;
    
    const dx = e.clientX - resizeData.startX;
    const dy = e.clientY - resizeData.startY;
    
    let newWidth = Math.max(200, resizeData.startWidth + dx);
    let newHeight = Math.max(120, resizeData.startHeight + dy);
    
    // Constrain to viewport
    const maxWidth = window.innerWidth - 100;
    const maxHeight = window.innerHeight - 150;
    newWidth = Math.min(newWidth, maxWidth);
    newHeight = Math.min(newHeight, maxHeight);
    
    resizeData.box.style.width = newWidth + 'px';
    resizeData.box.style.height = newHeight + 'px';
    resizeData.box.style.minWidth = '200px';
    resizeData.box.style.minHeight = '120px';
    
    // Save dimensions to data
    if (resizeData.sectionId !== null) {
        const sec = sections.find(s => s.id === resizeData.sectionId);
        if (sec) {
            sec.width = newWidth;
            sec.height = newHeight;
        }
    }
}

function stopResize() {
    if (resizeData) {
        resizeData.box.classList.remove('resizing');
        saveLocalData();
        if (isVercelConfigured && !isSyncing) {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveToVercel({ sections, nextId });
            }, 500);
        }
    }
    resizeData = null;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
}