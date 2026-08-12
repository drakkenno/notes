// ============================================================
//  RENDER - MAIN CANVAS
// ============================================================

function render() {
    const canvas = document.getElementById('canvas');
    const scrollState = { pageX: window.scrollX, pageY: window.scrollY, canvasLeft: canvas?.scrollLeft || 0, canvasTop: canvas?.scrollTop || 0, lists: Array.from(document.querySelectorAll('.list-box[id] .list-items')).map(items => ({ id: items.closest('.list-box').id, top: items.scrollTop })) };
    renderSidebar();
    if (isSharedSectionsView) { renderSharedSections(); return; }
    renderMain();
    window.restoreSelectedBox?.();
    saveLocalData();
    requestAnimationFrame(() => {
        window.scrollTo(scrollState.pageX, scrollState.pageY);
        const restoredCanvas = document.getElementById('canvas');
        if (restoredCanvas) { restoredCanvas.scrollLeft = scrollState.canvasLeft; restoredCanvas.scrollTop = scrollState.canvasTop; }
        scrollState.lists.forEach(({ id, top }) => { const items = document.getElementById(id)?.querySelector('.list-items'); if (items) items.scrollTop = top; });
    });
    // Auto-sync removed - use Push button to sync manually
}

// Helper to get subsection by path
function getSubsectionByPath(section, pathArray) {
    if (!section || !pathArray || pathArray.length === 0) return null;
    
    let current = section.subs || [];
    let sub = null;
    
    for (let i = 0; i < pathArray.length; i++) {
        const name = pathArray[i];
        sub = current.find(s => s.name === name);
        if (!sub) return null;
        if (i < pathArray.length - 1) {
            current = sub.subs || [];
        }
    }
    
    return sub;
}

// Auto-resize every textarea.editable-item to its content height
function autoResizeTextareas() {
    document.querySelectorAll('textarea.editable-item').forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
    });
}

function renderRatingStars(rating, onclickStr) {
    const currentRating = rating || 0;
    let starsHtml = `<span class="item-rating" title="Rating: ${currentRating}/5">`;
    for (let r = 1; r <= 5; r++) {
        let iconClass = 'far fa-star inactive';
        if (currentRating >= r) {
            iconClass = 'fas fa-star active';
        } else if (currentRating === r - 0.5) {
            iconClass = 'fas fa-star-half-alt active';
        }
        
        const halfVal = r - 0.5;
        const fullVal = r;
        const halfClick = onclickStr.replace('RATING_PLACEHOLDER', currentRating === halfVal ? 0 : halfVal);
        const fullClick = onclickStr.replace('RATING_PLACEHOLDER', currentRating === fullVal ? 0 : fullVal);
        
        starsHtml += `<span class="star-box"><i class="${iconClass}"></i><span class="star-half left" data-onclick="event.stopPropagation(); ${halfClick}" title="${halfVal} star${halfVal > 1 ? 's' : ''}"></span><span class="star-half right" data-onclick="event.stopPropagation(); ${fullClick}" title="${fullVal} star${fullVal > 1 ? 's' : ''}"></span></span>`;
    }
    starsHtml += `</span>`;
    return starsHtml;
}

function renderListRatingBadge(list) {
    if (!list || !list.items || list.items.length === 0) return '';
    const ratedItems = list.items.filter(i => i.rating && i.rating > 0);
    if (ratedItems.length === 0) return '';
    const avg = (ratedItems.reduce((acc, i) => acc + i.rating, 0) / ratedItems.length).toFixed(1);
    return `<span class="list-rating-badge" title="Average rating: ${avg} / 5 (${ratedItems.length}/${list.items.length} rated)"><i class="fas fa-star"></i> ${avg}</span>`;
}

function getGoogleMapsUrl(location) {
    if (!location || !location.trim()) return '#';
    const loc = location.trim();
    if (/^(https?:\/\/|www\.)/i.test(loc)) {
        return loc.startsWith('www.') ? `https://${loc}` : loc;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
}

function getDisplayLocation(location) {
    if (!location || !location.trim()) return '';
    const loc = location.trim();
    if (/^(https?:\/\/|www\.)/i.test(loc)) {
        if (loc.includes('goo.gl') || loc.includes('maps')) {
            return 'Google Maps';
        }
        return 'Map Link';
    }
    return loc.length > 20 ? loc.substring(0, 18) + '...' : loc;
}

function renderLocationBadge(location, isCompact = false) {
    if (!location || !location.trim()) return '';
    const loc = location.trim();
    const mapUrl = getGoogleMapsUrl(loc);
    const displayText = getDisplayLocation(loc);
    if (isCompact) {
        return `<a class="location-badge compact" href="${esc(mapUrl)}" target="_blank" title="Google Maps: ${esc(loc)}" data-onclick="event.stopPropagation(); window.open('${esc(mapUrl)}', '_blank'); return false;"><i class="fas fa-map-marker-alt"></i></a>`;
    }
    return `<a class="location-badge" href="${esc(mapUrl)}" target="_blank" title="Open in Google Maps: ${esc(loc)}" data-onclick="event.stopPropagation(); window.open('${esc(mapUrl)}', '_blank'); return false;"><i class="fas fa-map-marker-alt"></i> <span>${esc(displayText)}</span></a>`;
}

function renderMain() {
    if (!mainContainer) return;
    
    let html = `<div class="canvas ${selectedSectionId !== null ? 'has-selection' : ''}" id="canvas">`;
    
    // Header
    html += `<div class="canvas-header">`;
    
    if (selectedSectionId !== null) {
        const sec = sections.find(s => s.id === selectedSectionId);
        if (sec) {
            let displayName;
            if (selectedSubsectionPath.length > 0) {
                // Show only the current subsection name
                displayName = capitalize(selectedSubsectionPath[selectedSubsectionPath.length - 1]);
            } else {
                displayName = capitalize(sec.name);
            }
            html += `<div class="title-section personal-title-section">
                        <i class="fas fa-folder-open" style="color:#f5e56b; font-size:1.5rem;"></i>
                        <input class="editable-title personal-section-title" value="${esc(displayName)}" 
                               data-onchange="updateSectionTitle(${sec.id}, this.value)"
                               onfocus="this.select()"
                               style="font-size:1.8rem; font-weight:600; background:transparent; border:none; color:#f5e56b; outline:none; border-bottom:2px solid transparent; min-width:100px;">
                        <button class="edit-title-btn" data-onclick="document.querySelector('.canvas-header .editable-title').focus()" style="background:transparent; border:none; color:#7a7a5a; cursor:pointer; font-size:0.8rem;">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${selectedSubsectionPath.length > 0 ? `<span class="subsection-label" style="color: #7a7a5a; font-size: 0.9rem; margin-left: 0.5rem;">(subsection)</span>` : ''}
                        ${selectedSubsectionPath.length > 0 ? `<button class="delete-subsection-btn" data-onclick="deleteCurrentSubsection()" style="background:transparent; border:none; color:#ff6b6b; cursor:pointer; font-size:0.9rem; margin-left: 0.5rem;" title="Delete subsection"><i class="fas fa-trash-alt"></i></button>` : ''}
                    </div>
                    <div class="canvas-header-actions" style="display: flex; gap: 0.8rem; align-items: center;">
                        <button class="back-btn" data-onclick="clearSelection()"><i class="fas fa-arrow-left"></i> Back</button>
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
                        <button class="box-delete-btn" data-onclick="event.stopPropagation(); deleteSection(${sec.id})" title="Delete section"><i class="fas fa-times"></i></button>
                        <div class="box-title">
                            <span class="drag-handle" data-onclick="event.stopPropagation();"><i class="fas fa-grip-lines"></i></span>
                            <i class="fas fa-folder-open"></i>
                            <span>${capitalize(sec.name)}</span>
                            <span class="box-actions">
                            </span>
                        </div>
                        <div class="note-content" style="color: #7a7a5a; font-size: 0.85rem;">
                            ${sec.notes ? sec.notes.length : 0} notes · ${sec.items ? sec.items.length : 0} lists
                            ${sec.subs && sec.subs.length > 0 ? ` · ${sec.subs.length} subsections` : ''}
                        </div>
                        <div class="resize-handle" data-onclick="event.stopPropagation();">
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
        if (selectedSubsectionPath.length > 0) {
            const sub = getSubsectionByPath(sec, selectedSubsectionPath);
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
                    const subPathStr = selectedSubsectionPath.join('/');
                    html += `
                        <div class="note-box" id="box-${sec.id}-note-${ni}"
                             style="left:${x}px; top:${y}px; width:${width}px; height:${height}px;"
                             data-type="subNote" data-sub-path="${esc(subPathStr)}" data-index="${ni}">
                            <button class="box-delete-btn" data-onclick="event.stopPropagation(); deleteSubNote('${subPathStr}', ${ni})" title="Delete note"><i class="fas fa-times"></i></button>
                            <div class="box-title">
                                <span class="drag-handle" data-onclick="event.stopPropagation();"><i class="fas fa-grip-lines"></i></span>
                                <i class="fas fa-pen-fancy"></i>
                                <input class="editable-title" value="${esc(note.title || 'Note')}" 
                                       data-onchange="updateSubNoteTitle('${subPathStr}', ${ni}, this.value)"
                                       onfocus="this.select()"
                                       style="background:transparent; border:none; color:#f5e56b; font-weight:600; font-size:0.9rem; outline:none; border-bottom:2px solid transparent; flex:1;">
                            </div>
                            <div class="note-content">
                                <textarea class="editable-content" 
                                          data-onchange="updateSubNoteContent('${subPathStr}', ${ni}, this.value)"
                                          style="background:transparent; border:none; color:#d4c45a; font-size:0.95rem; line-height:1.6; outline:none; width:100%; min-height:30px; max-height:200px; font-family:inherit; resize:vertical; padding:0.2rem; border-radius:4px;">${esc(note.content || '')}</textarea>
                            </div>
                            <div class="resize-handle" data-onclick="event.stopPropagation();">
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
                    const ratingBadge = renderListRatingBadge(list);
                    const listLocBadge = renderLocationBadge(list.location);
                    const subPathStr = selectedSubsectionPath.join('/');
                    html += `
                        <div class="list-box" id="box-${sec.id}-list-${liIdx}"
                             style="left:${x}px; top:${y}px; width:${width}px; height:${height}px;"
                             data-type="subList" data-sub-path="${esc(subPathStr)}" data-index="${liIdx}">
                            <button class="box-delete-btn" data-onclick="event.stopPropagation(); deleteSubList('${subPathStr}', ${liIdx})" title="Delete list"><i class="fas fa-times"></i></button>
                            <div class="box-title">
                                <span class="drag-handle" data-onclick="event.stopPropagation();"><i class="fas fa-grip-lines"></i></span>
                                <i class="fas fa-list-ul"></i>
                                <input class="editable-title" value="${esc(list.title || 'List')}" 
                                       data-onchange="updateSubListTitle('${subPathStr}', ${liIdx}, this.value)"
                                       onfocus="this.select()"
                                       style="background:transparent; border:none; color:#f5e56b; font-weight:600; font-size:0.9rem; outline:none; border-bottom:2px solid transparent; flex:1;">
                                ${listLocBadge}
                                ${ratingBadge}
                                <span class="box-actions">
                                    <i class="fas fa-map-marker-alt ${list.location ? 'has-location' : ''}" data-onclick="event.stopPropagation(); setSubListLocationInSub('${subPathStr}', ${liIdx})" title="${list.location ? 'Location: ' + esc(list.location) + ' (Click to edit)' : 'Add Google Maps location to list'}"></i>
                                    <i class="fas fa-plus" data-onclick="addSubItemToSub('${subPathStr}', ${liIdx})" title="Add item"></i>
                                </span>
                            </div>
                            <div class="list-items" style="max-height:calc(100% - 60px); overflow-y:auto;">
                    `;
                    
                    if (list.items && list.items.length > 0) {
                        list.items.forEach((item, subIdx) => {
                            const icon = item.done ? 'fa-check-circle' : 'fa-circle';
                            const color = item.done ? '#f5e56b' : '#7a7a5a';
                            const stars = renderRatingStars(item.rating, `setSubItemRatingInSub('${subPathStr}', ${liIdx}, ${subIdx}, RATING_PLACEHOLDER)`);
                            const itemLocBadge = renderLocationBadge(item.location, true);
                            html += `
                                <div class="sub-list-item">
                                    <i class="fas ${icon}" style="color:${color};" data-onclick="toggleSubItemInSub('${subPathStr}', ${liIdx}, ${subIdx})" title="Toggle done"></i>
                                    <textarea class="editable-item" rows="1"
                                              data-onchange="updateSubItemInSub('${subPathStr}', ${liIdx}, ${subIdx}, this.value)"
                                              oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
                                              onfocus="this.select()">${esc(item.text)}</textarea>
                                    ${itemLocBadge}
                                    ${stars}
                                    <span class="item-tag">${item.done ? 'done' : 'pending'}</span>
                                    <i class="fas fa-map-marker-alt ${item.location ? 'has-location' : ''}" data-onclick="event.stopPropagation(); setSubItemLocationInSub('${subPathStr}', ${liIdx}, ${subIdx})" title="${item.location ? 'Location: ' + esc(item.location) + ' (Click to edit)' : 'Add Google Maps location'}"></i>
                                    <i class="fas fa-times item-delete" data-onclick="deleteSubItemFromSub('${subPathStr}', ${liIdx}, ${subIdx})" title="Delete item"></i>
                                </div>
                            `;
                        });
                    } else {
                        html += `<div class="empty-message"><i class="fas fa-plus-circle"></i> No items yet. Click + to add.</div>`;
                    }
                    
                    html += `
                            </div>
                            <button class="add-item-btn" data-onclick="addSubItemToSub('${subPathStr}', ${liIdx})"><i class="fas fa-plus"></i> Add item</button>
                            <div class="resize-handle" data-onclick="event.stopPropagation();">
                                <i class="fas fa-grip-lines"></i>
                            </div>
                        </div>
                    `;
                });
            }
            html += `</div>`;
            
            const subPathStr = selectedSubsectionPath.join('/');
            html += `
                <div class='canvas-actions'>
                    <button class="action-btn" data-onclick="addSubNote('${subPathStr}')"><i class="fas fa-plus"></i> Add note</button>
                    <button class="action-btn" data-onclick="addSubList('${subPathStr}')"><i class="fas fa-plus"></i> Add list</button>
                    <button class="action-btn" data-onclick="addSubsection(${sec.id}, '${subPathStr}')"><i class="fas fa-plus"></i> Add nested subsection</button>
                    <button class="action-btn" data-onclick="organizeCanvas()"><i class="fas fa-th-large"></i> Organize</button>
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
                             style="left:${x}px; top:${y}px; width:${width}px; height:${height}px;"
                             data-type="note" data-section-id="${sec.id}" data-index="${ni}">
                            <button class="box-delete-btn" data-onclick="event.stopPropagation(); deleteNote(${sec.id}, ${ni})" title="Delete note"><i class="fas fa-times"></i></button>
                            <div class="box-title">
                                <span class="drag-handle" data-onclick="event.stopPropagation();"><i class="fas fa-grip-lines"></i></span>
                                <i class="fas fa-pen-fancy"></i>
                                <input class="editable-title" value="${esc(note.title || 'Note')}" 
                                       data-onchange="updateNoteTitle(${sec.id}, ${ni}, this.value)"
                                       onfocus="this.select()"
                                       style="background:transparent; border:none; color:#f5e56b; font-weight:600; font-size:0.9rem; outline:none; border-bottom:2px solid transparent; flex:1;">
                            </div>
                            <div class="note-content">
                                <textarea class="editable-content" 
                                          data-onchange="updateNoteContent(${sec.id}, ${ni}, this.value)"
                                          style="background:transparent; border:none; color:#d4c45a; font-size:0.95rem; line-height:1.6; outline:none; width:100%; min-height:30px; max-height:200px; font-family:inherit; resize:vertical; padding:0.2rem; border-radius:4px;">${esc(note.content || '')}</textarea>
                            </div>
                            <div class="resize-handle" data-onclick="event.stopPropagation();">
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
                    const ratingBadge = renderListRatingBadge(list);
                    const listLocBadge = renderLocationBadge(list.location);
                    html += `
                        <div class="list-box" id="box-${sec.id}-list-${liIdx}"
                             style="left:${x}px; top:${y}px; width:${width}px; height:${height}px;"
                             data-type="list" data-section-id="${sec.id}" data-index="${liIdx}">
                            <button class="box-delete-btn" data-onclick="event.stopPropagation(); deleteList(${sec.id}, ${liIdx})" title="Delete list"><i class="fas fa-times"></i></button>
                            <div class="box-title">
                                <span class="drag-handle" data-onclick="event.stopPropagation();"><i class="fas fa-grip-lines"></i></span>
                                <i class="fas fa-list-ul"></i>
                                <input class="editable-title" value="${esc(list.title || 'List')}" 
                                       data-onchange="updateListTitle(${sec.id}, ${liIdx}, this.value)"
                                       onfocus="this.select()"
                                       style="background:transparent; border:none; color:#f5e56b; font-weight:600; font-size:0.9rem; outline:none; border-bottom:2px solid transparent; flex:1;">
                                ${listLocBadge}
                                ${ratingBadge}
                                <span class="box-actions">
                                    <i class="fas fa-map-marker-alt ${list.location ? 'has-location' : ''}" data-onclick="event.stopPropagation(); setListLocation(${sec.id}, ${liIdx})" title="${list.location ? 'Location: ' + esc(list.location) + ' (Click to edit)' : 'Add Google Maps location to list'}"></i>
                                    <i class="fas fa-plus" data-onclick="addSubItem(${sec.id}, ${liIdx})" title="Add item"></i>
                                </span>
                            </div>
                            <div class="list-items" style="max-height:calc(100% - 60px); overflow-y:auto;">
                    `;
                    
                    if (list.items && list.items.length > 0) {
                        list.items.forEach((item, subIdx) => {
                            const icon = item.done ? 'fa-check-circle' : 'fa-circle';
                            const color = item.done ? '#f5e56b' : '#7a7a5a';
                            const stars = renderRatingStars(item.rating, `setSubItemRating(${sec.id}, ${liIdx}, ${subIdx}, RATING_PLACEHOLDER)`);
                            const itemLocBadge = renderLocationBadge(item.location, true);
                            html += `
                                <div class="sub-list-item">
                                    <i class="fas ${icon}" style="color:${color};" data-onclick="toggleSubItem(${sec.id}, ${liIdx}, ${subIdx})" title="Toggle done"></i>
                                    <textarea class="editable-item" rows="1"
                                              data-onchange="updateSubItem(${sec.id}, ${liIdx}, ${subIdx}, this.value)"
                                              oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
                                              onfocus="this.select()">${esc(item.text)}</textarea>
                                    ${itemLocBadge}
                                    ${stars}
                                    <span class="item-tag">${item.done ? 'done' : 'pending'}</span>
                                    <i class="fas fa-map-marker-alt ${item.location ? 'has-location' : ''}" data-onclick="event.stopPropagation(); setItemLocation(${sec.id}, ${liIdx}, ${subIdx})" title="${item.location ? 'Location: ' + esc(item.location) + ' (Click to edit)' : 'Add Google Maps location'}"></i>
                                    <i class="fas fa-times item-delete" data-onclick="deleteSubItem(${sec.id}, ${liIdx}, ${subIdx})" title="Delete item"></i>
                                </div>
                            `;
                        });
                    } else {
                        html += `<div class="empty-message"><i class="fas fa-plus-circle"></i> No items yet. Click + to add.</div>`;
                    }
                    
                    html += `
                            </div>
                            <button class="add-item-btn" data-onclick="addSubItem(${sec.id}, ${liIdx})"><i class="fas fa-plus"></i> Add item</button>
                            <div class="resize-handle" data-onclick="event.stopPropagation();">
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
                    const escapedName = escJs(sub.name);
                    html += `
                        <span class="subsection-item" data-onclick="selectSubsection(${sec.id}, '${escapedName}')">
                            ${capitalize(sub.name)}
                            <span class="sub-delete" data-onclick="event.stopPropagation(); deleteSubsection(${sec.id}, '${escapedName}')">
                                <i class="fas fa-times"></i>
                            </span>
                        </span>
                    `;
                });
                html += `</div>`;
            }
            
            html += `
                <div class='canvas-actions'>
                    <button class="action-btn" data-onclick="addNoteToSection(${sec.id})"><i class="fas fa-plus"></i> Add note</button>
                    <button class="action-btn" data-onclick="addListToSection(${sec.id})"><i class="fas fa-plus"></i> Add list</button>
                    <button class="action-btn" data-onclick="addSubsection(${sec.id})"><i class="fas fa-plus"></i> Add subsection</button>
                    <button class="action-btn" data-onclick="organizeCanvas()"><i class="fas fa-th-large"></i> Organize</button>
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
    // Size every item textarea to its content
    setTimeout(() => {
        autoResizeTextareas();
        autoFitDefaultListBoxes();
        updateCanvasExtent();
    }, 10);
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
    item.text = newValue;
    saveLocalData();
}

// ============================================================
//  UPDATE FUNCTIONS - SUBSECTION
// ============================================================

function updateSubNoteTitle(subPath, noteIndex, newValue) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    const note = sub.notes[noteIndex];
    if (!note) return;
    if (newValue && newValue.trim() !== '') {
        note.title = newValue.trim();
        render();
    }
}

function updateSubNoteContent(subPath, noteIndex, newValue) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    const note = sub.notes[noteIndex];
    if (!note) return;
    note.content = newValue;
    render();
}

function updateSubListTitle(subPath, listIndex, newValue) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    if (newValue && newValue.trim() !== '') {
        list.title = newValue.trim();
        render();
    }
}

function updateSubItemInSub(subPath, listIndex, subIndex, newValue) {
    const sec = sections.find(s => s.id === selectedSectionId);
    if (!sec) return;
    const pathArray = subPath.split('/');
    const sub = getSubsectionByPath(sec, pathArray);
    if (!sub) return;
    const list = sub.items[listIndex];
    if (!list) return;
    const item = list.items[subIndex];
    if (!item) return;
    item.text = newValue;
    saveLocalData();
}

// ============================================================
//  DRAG AND DROP FUNCTIONALITY
// ============================================================

let dragData = null;

function getBoxData(box) {
    if (!box) return null;
    const type = box.dataset.type || (box.dataset.sectionId ? 'section' : null);
    const sectionId = box.dataset.sectionId ? parseInt(box.dataset.sectionId) : null;
    const index = box.dataset.index !== undefined ? parseInt(box.dataset.index) : null;
    const subPath = box.dataset.subPath || null;
    let item = null;

    if (type === 'section') {
        item = sections.find(section => section.id === sectionId);
    } else if (type === 'note' || type === 'list') {
        const section = sections.find(entry => entry.id === sectionId);
        item = type === 'note' ? section?.notes?.[index] : section?.items?.[index];
    } else if (type === 'subNote' || type === 'subList') {
        const section = sections.find(entry => entry.id === selectedSectionId);
        const sub = section && subPath ? getSubsectionByPath(section, subPath.split('/')) : null;
        item = type === 'subNote' ? sub?.notes?.[index] : sub?.items?.[index];
    }

    return { box, type, sectionId, subPath, index, item };
}

function updateCanvasExtent() {
    const grid = document.getElementById('boxGrid');
    const canvas = document.getElementById('canvas');
    if (!grid || !canvas) return;

    const boxes = Array.from(grid.children).filter(element => element.matches('.note-box, .list-box'));
    const furthestRight = boxes.reduce((edge, box) => Math.max(edge, box.offsetLeft + box.offsetWidth), 0);
    const furthestBottom = boxes.reduce((edge, box) => Math.max(edge, box.offsetTop + box.offsetHeight), 0);
    const styles = getComputedStyle(canvas);
    const availableWidth = canvas.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const availableHeight = Math.max(500, canvas.clientHeight - grid.offsetTop - parseFloat(styles.paddingBottom));

    grid.style.width = `${Math.max(availableWidth, furthestRight + 80)}px`;
    grid.style.height = `${Math.max(availableHeight, furthestBottom + 100)}px`;
}

function fitListBoxToContents(box, persist = true) {
    const data = getBoxData(box);
    if (!data?.item || !box.classList.contains('list-box')) return;

    box.classList.add('fit-to-contents');
    box.style.height = 'auto';
    const fittedHeight = Math.max(120, Math.ceil(box.scrollHeight + 2));
    box.style.height = `${fittedHeight}px`;
    box.classList.remove('fit-to-contents');
    data.item.height = fittedHeight;
    data.item.autoSize = true;
    updateCanvasExtent();
    if (persist) saveLocalData();
}

function fitNoteBoxToContents(box, persist = true) {
    const data = getBoxData(box);
    const textarea = box?.querySelector('.editable-content');
    if (!data?.item || !textarea || !box.classList.contains('note-box')) return;

    box.classList.add('show-all-content');
    textarea.style.maxHeight = 'none';
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    box.style.height = 'auto';
    const fittedHeight = Math.max(160, Math.ceil(box.scrollHeight + 2));
    box.style.height = `${fittedHeight}px`;
    data.item.height = fittedHeight;
    data.item.autoSize = true;
    updateCanvasExtent();
    if (persist) saveLocalData();
}

function autoFitDefaultListBoxes() {
    document.querySelectorAll('#boxGrid > .list-box').forEach(box => {
        const data = getBoxData(box);
        if (data?.item && data.item.autoSize !== false) fitListBoxToContents(box, false);
    });
    document.querySelectorAll('#boxGrid > .note-box[data-type]').forEach(box => {
        const data = getBoxData(box);
        if (data?.item?.autoSize === true) fitNoteBoxToContents(box, false);
    });
}

window.organizeCanvas = function() {
    const grid = document.getElementById('boxGrid');
    const canvas = document.getElementById('canvas');
    if (!grid || !canvas) return;
    const boxes = Array.from(grid.children).filter(element => element.matches('.note-box, .list-box'));
    if (!boxes.length) return;

    grid.style.width = '';
    const canvasStyles = getComputedStyle(canvas);
    const availableWidth = canvas.clientWidth - parseFloat(canvasStyles.paddingLeft) - parseFloat(canvasStyles.paddingRight);
    const gap = 24;
    const usableWidth = Math.max(200, availableWidth - 80);
    const columnCount = Math.max(1, Math.floor((usableWidth + gap) / (320 + gap)));
    const boxWidth = Math.max(200, Math.min(360, Math.floor((usableWidth - gap * (columnCount - 1)) / columnCount)));

    boxes.forEach(box => {
        const data = getBoxData(box);
        box.style.width = `${boxWidth}px`;
        if (data?.item) data.item.width = boxWidth;
    });
    autoResizeTextareas();
    boxes.forEach(box => {
        if (box.classList.contains('list-box')) fitListBoxToContents(box, false);
        else if (box.dataset.type) fitNoteBoxToContents(box, false);
    });

    let x = 0;
    let y = 0;
    let rowHeight = 0;
    boxes.forEach(box => {
        if (x > 0 && x + box.offsetWidth > usableWidth) {
            x = 0;
            y += rowHeight + gap;
            rowHeight = 0;
        }
        box.style.left = `${x}px`;
        box.style.top = `${y}px`;
        const data = getBoxData(box);
        updateItemPosition(data, x, y);
        rowHeight = Math.max(rowHeight, box.offsetHeight);
        x += box.offsetWidth + gap;
    });

    updateCanvasExtent();
    canvas.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    saveLocalData();
    showSaveIndicator(`${boxes.length} card${boxes.length === 1 ? '' : 's'} organized`);
};

function makeDraggable() {
    document.querySelectorAll('.drag-handle').forEach(handle => {
        handle.removeEventListener('mousedown', startDrag);
        handle.addEventListener('mousedown', startDrag);
    });
}

function updateItemPosition(data, x, y) {
    if (!data) return;
    const { type, sectionId, subPath, index } = data;
    
    if (type === 'section' || (sectionId !== null && type === undefined)) {
        const sec = sections.find(s => s.id === sectionId);
        if (sec) { sec.x = x; sec.y = y; }
    } else if (type === 'note') {
        const sec = sections.find(s => s.id === sectionId);
        if (sec && sec.notes && sec.notes[index]) { sec.notes[index].x = x; sec.notes[index].y = y; }
    } else if (type === 'list') {
        const sec = sections.find(s => s.id === sectionId);
        if (sec && sec.items && sec.items[index]) { sec.items[index].x = x; sec.items[index].y = y; }
    } else if (type === 'subNote' || type === 'subList') {
        const sec = sections.find(s => s.id === selectedSectionId);
        if (sec && subPath) {
            const pathArray = subPath.split('/');
            const sub = getSubsectionByPath(sec, pathArray);
            if (sub) {
                if (type === 'subNote' && sub.notes && sub.notes[index]) {
                    sub.notes[index].x = x; sub.notes[index].y = y;
                } else if (type === 'subList' && sub.items && sub.items[index]) {
                    sub.items[index].x = x; sub.items[index].y = y;
                }
            }
        }
    }
}

function updateItemSize(data, width, height) {
    if (!data) return;
    const { type, sectionId, subPath, index } = data;
    
    if (type === 'section' || (sectionId !== null && type === undefined)) {
        const sec = sections.find(s => s.id === sectionId);
        if (sec) { sec.width = width; sec.height = height; }
    } else if (type === 'note') {
        const sec = sections.find(s => s.id === sectionId);
        if (sec && sec.notes && sec.notes[index]) { sec.notes[index].width = width; sec.notes[index].height = height; }
    } else if (type === 'list') {
        const sec = sections.find(s => s.id === sectionId);
        if (sec && sec.items && sec.items[index]) { sec.items[index].width = width; sec.items[index].height = height; }
    } else if (type === 'subNote' || type === 'subList') {
        const sec = sections.find(s => s.id === selectedSectionId);
        if (sec && subPath) {
            const pathArray = subPath.split('/');
            const sub = getSubsectionByPath(sec, pathArray);
            if (sub) {
                if (type === 'subNote' && sub.notes && sub.notes[index]) {
                    sub.notes[index].width = width; sub.notes[index].height = height;
                } else if (type === 'subList' && sub.items && sub.items[index]) {
                    sub.items[index].width = width; sub.items[index].height = height;
                }
            }
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
        subPath: box.dataset.subPath || null,
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
    updateCanvasExtent();
}

function stopDrag() {
    if (dragData) {
        dragData.box.classList.remove('dragging');
        saveLocalData();
        // Auto-sync removed - use Push button to sync manually
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
        subPath: box.dataset.subPath || null,
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
    
    
    resizeData.box.style.width = newWidth + 'px';
    resizeData.box.style.height = newHeight + 'px';
    resizeData.box.style.minWidth = '200px';
    resizeData.box.style.minHeight = '120px';
    
    updateItemSize(resizeData, newWidth, newHeight);
    const data = getBoxData(resizeData.box);
    if (data?.item && ['note', 'list', 'subNote', 'subList'].includes(data.type)) {
        data.item.autoSize = false;
        if (data.type === 'note' || data.type === 'subNote') {
            resizeData.box.classList.remove('show-all-content');
            const textarea = resizeData.box.querySelector('.editable-content');
            if (textarea) textarea.style.maxHeight = '';
        }
    }
    updateCanvasExtent();
}

function stopResize() {
    if (resizeData) {
        resizeData.box.classList.remove('resizing');
        saveLocalData();
        // Auto-sync removed - use Push button to sync manually
    }
    resizeData = null;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
}
