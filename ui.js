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
            
            const hasSubNotes = sub.notes && sub.notes.length > 0;
            const hasSubItems = sub.items && sub.items.length > 0;
            
            if (!hasSubNotes && !hasSubItems) {
                html += `<div class="empty-state-hero" style="position: relative; transform: none; margin: 2rem auto; width: 80%; max-width: 500px;">
                            <i class="fas fa-folder-open"></i>
                            <p>Subsection: ${capitalize(sub.name)}<br><span style="font-size:0.9rem; color:#7a7a5a;">Add notes and lists below</span></p>
                        </div>`;
            }
            
            html += `<div class="box-grid" id="boxGrid">`;
            
            // Subsection notes
            if (hasSubNotes) {
                sub.notes.forEach((note, ni) => {
                    const x = note.x !== undefined ? note.x : (10 + (ni * 30) % 350);
                    const y = note.y !== undefined ? note.y : (10 + Math.floor(ni / 3) * 190);
                    const width = note.width || 300;
                    const height = note.height || 160;
                    html += `
                        <div class="note-box" id="box-${sec.id}-note-${ni}"
                             data-type="subNote" data-sub-name="${esc(sub.name)}" data-index="${ni}"
                             style="position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; min-width:200px; min-height:120px;">
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
                });
            }
            
            // Subsection lists
            if (hasSubItems) {
                sub.items.forEach((list, liIdx) => {
                    const x = list.x !== undefined ? list.x : (350 + (liIdx * 30) % 350);
                    const y = list.y !== undefined ? list.y : (10 + Math.floor(liIdx / 3) * 230);
                    const width = list.width || 320;
                    const height = list.height || 200;
                    html += `
                        <div class="list-box" id="box-${sec.id}-list-${liIdx}"
                             data-type="subList" data-sub-name="${esc(sub.name)}" data-index="${liIdx}"
                             style="position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; min-width:200px; min-height:150px;">
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
            
            // Section notes
            if (sec.notes && sec.notes.length > 0) {
                sec.notes.forEach((note, ni) => {
                    const x = note.x !== undefined ? note.x : (10 + (ni * 30) % 350);
                    const y = note.y !== undefined ? note.y : (10 + Math.floor(ni / 3) * 190);
                    const width = note.width || 300;
                    const height = note.height || 160;
                    html += `
                        <div class="note-box" id="box-${sec.id}-note-${ni}"
                             data-type="note" data-section-id="${sec.id}" data-index="${ni}"
                             style="position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; min-width:200px; min-height:120px;">
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
                });
            }
            
            // Section lists
            if (sec.items && sec.items.length > 0) {
                sec.items.forEach((list, liIdx) => {
                    const x = list.x !== undefined ? list.x : (350 + (liIdx * 30) % 350);
                    const y = list.y !== undefined ? list.y : (10 + Math.floor(liIdx / 3) * 230);
                    const width = list.width || 320;
                    const height = list.height || 200;
                    html += `
                        <div class="list-box" id="box-${sec.id}-list-${liIdx}"
                             data-type="list" data-section-id="${sec.id}" data-index="${liIdx}"
                             style="position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; min-width:200px; min-height:150px;">
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

function updateItemPosition(data, x, y) {
    if (!data) return;
    const { type, sectionId, subName, index } = data;
    
    if (type === 'section' || (sectionId !== null && type === undefined)) {
        const sec = sections.find(s => s.id === sectionId);
        if (sec) { sec.x = x; sec.y = y; }
    } else if (type === 'note') {
        const sec = sections.find(s => s.id === sectionId);
        if (sec && sec.notes && sec.notes[index]) { sec.notes[index].x = x; sec.notes[index].y = y; }
    } else if (type === 'list') {
        const sec = sections.find(s => s.id === sectionId);
        if (sec && sec.items && sec.items[index]) { sec.items[index].x = x; sec.items[index].y = y; }
    } else if (type === 'subNote') {
        const sec = sections.find(s => s.id === selectedSectionId);
        if (sec && sec.subs) {
            const sub = sec.subs.find(s => s.name === subName);
            if (sub && sub.notes && sub.notes[index]) { sub.notes[index].x = x; sub.notes[index].y = y; }
        }
    } else if (type === 'subList') {
        const sec = sections.find(s => s.id === selectedSectionId);
        if (sec && sec.subs) {
            const sub = sec.subs.find(s => s.name === subName);
            if (sub && sub.items && sub.items[index]) { sub.items[index].x = x; sub.items[index].y = y; }
        }
    }
}

function updateItemSize(data, width, height) {
    if (!data) return;
    const { type, sectionId, subName, index } = data;
    
    if (type === 'section' || (sectionId !== null && type === undefined)) {
        const sec = sections.find(s => s.id === sectionId);
        if (sec) { sec.width = width; sec.height = height; }
    } else if (type === 'note') {
        const sec = sections.find(s => s.id === sectionId);
        if (sec && sec.notes && sec.notes[index]) { sec.notes[index].width = width; sec.notes[index].height = height; }
    } else if (type === 'list') {
        const sec = sections.find(s => s.id === sectionId);
        if (sec && sec.items && sec.items[index]) { sec.items[index].width = width; sec.items[index].height = height; }
    } else if (type === 'subNote') {
        const sec = sections.find(s => s.id === selectedSectionId);
        if (sec && sec.subs) {
            const sub = sec.subs.find(s => s.name === subName);
            if (sub && sub.notes && sub.notes[index]) { sub.notes[index].width = width; sub.notes[index].height = height; }
        }
    } else if (type === 'subList') {
        const sec = sections.find(s => s.id === selectedSectionId);
        if (sec && sec.subs) {
            const sub = sec.subs.find(s => s.name === subName);
            if (sub && sub.items && sub.items[index]) { sub.items[index].width = width; sub.items[index].height = height; }
        }
    }
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
        type: box.dataset.type || (box.dataset.sectionId ? 'section' : null),
        sectionId: box.dataset.sectionId ? parseInt(box.dataset.sectionId) : null,
        subName: box.dataset.subName || null,
        index: box.dataset.index !== undefined ? parseInt(box.dataset.index) : null
    };
    
    box.classList.add('dragging');
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
}

function onDrag(e) {
    if (!dragData) return;
    
    const dx = e.clientX - dragData.startX;
    const dy = e.clientY - dragData.startY;
    
    let newX = Math.max(0, dragData.startLeft + dx);
    let newY = Math.max(0, dragData.startTop + dy);
    
    dragData.box.style.left = newX + 'px';
    dragData.box.style.top = newY + 'px';
    
    updateItemPosition(dragData, newX, newY);
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
        type: box.dataset.type || (box.dataset.sectionId ? 'section' : null),
        sectionId: box.dataset.sectionId ? parseInt(box.dataset.sectionId) : null,
        subName: box.dataset.subName || null,
        index: box.dataset.index !== undefined ? parseInt(box.dataset.index) : null
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
    
    updateItemSize(resizeData, newWidth, newHeight);
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