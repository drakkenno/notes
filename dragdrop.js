// ============================================================
//  DRAG AND DROP FUNCTIONALITY
// ============================================================

let draggedItem = null;
let dragType = null;
let dragSourceId = null;
let dragSourceIndex = null;
let dragSubName = null;

// ============================================================
//  DRAG START - SECTION ITEMS
// ============================================================

function dragStartNote(event, sectionId, noteIndex) {
    draggedItem = { type: 'note', sectionId, noteIndex };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `note-${sectionId}-${noteIndex}`);
    setTimeout(() => {
        event.target.closest('.note-item')?.classList.add('dragging');
    }, 0);
}

function dragStartListItem(event, sectionId, itemIndex) {
    draggedItem = { type: 'listItem', sectionId, itemIndex };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `list-${sectionId}-${itemIndex}`);
    setTimeout(() => {
        event.target.closest('.list-item')?.classList.add('dragging');
    }, 0);
}

// ============================================================
//  DRAG START - SUBSECTION ITEMS
// ============================================================

function dragStartSubNote(event, sectionId, subName, noteIndex) {
    draggedItem = { type: 'subNote', sectionId, subName, noteIndex };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `subnote-${sectionId}-${subName}-${noteIndex}`);
    setTimeout(() => {
        event.target.closest('.note-item')?.classList.add('dragging');
    }, 0);
}

function dragStartSubListItem(event, sectionId, subName, itemIndex) {
    draggedItem = { type: 'subListItem', sectionId, subName, itemIndex };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `sublist-${sectionId}-${subName}-${itemIndex}`);
    setTimeout(() => {
        event.target.closest('.list-item')?.classList.add('dragging');
    }, 0);
}

// ============================================================
//  DRAG OVER
// ============================================================

function dragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const target = event.target.closest('.note-item, .list-item');
    if (target) {
        target.classList.add('drag-over');
    }
}

function dragLeave(event) {
    const target = event.target.closest('.note-item, .list-item');
    if (target) {
        target.classList.remove('drag-over');
    }
}

// ============================================================
//  DRAG END
// ============================================================

function dragEnd(event) {
    document.querySelectorAll('.note-item, .list-item').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
    });
}

// ============================================================
//  DROP - HANDLE ALL TYPES
// ============================================================

function dropNote(event, sectionId, noteIndex) {
    event.preventDefault();
    document.querySelectorAll('.note-item, .list-item').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
    });

    if (!draggedItem) return;
    if (draggedItem.type !== 'note' || draggedItem.sectionId !== sectionId) return;

    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;

    // Remove from old position
    const [movedNote] = sec.notes.splice(draggedItem.noteIndex, 1);
    // Insert at new position
    sec.notes.splice(noteIndex, 0, movedNote);

    draggedItem = null;
    render();
}

function dropListItem(event, sectionId, itemIndex) {
    event.preventDefault();
    document.querySelectorAll('.note-item, .list-item').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
    });

    if (!draggedItem) return;
    if (draggedItem.type !== 'listItem' || draggedItem.sectionId !== sectionId) return;

    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;

    const [movedItem] = sec.listItems.splice(draggedItem.itemIndex, 1);
    sec.listItems.splice(itemIndex, 0, movedItem);

    draggedItem = null;
    render();
}

// ============================================================
//  DROP - SUBSECTION ITEMS
// ============================================================

function dropSubNote(event, sectionId, subName, noteIndex) {
    event.preventDefault();
    document.querySelectorAll('.note-item, .list-item').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
    });

    if (!draggedItem) return;
    if (draggedItem.type !== 'subNote' || draggedItem.sectionId !== sectionId || draggedItem.subName !== subName) return;

    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;

    const [movedNote] = sub.notes.splice(draggedItem.noteIndex, 1);
    sub.notes.splice(noteIndex, 0, movedNote);

    draggedItem = null;
    render();
}

function dropSubListItem(event, sectionId, subName, itemIndex) {
    event.preventDefault();
    document.querySelectorAll('.note-item, .list-item').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
    });

    if (!draggedItem) return;
    if (draggedItem.type !== 'subListItem' || draggedItem.sectionId !== sectionId || draggedItem.subName !== subName) return;

    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const sub = sec.subs.find(s => s.name === subName);
    if (!sub) return;

    const [movedItem] = sub.listItems.splice(draggedItem.itemIndex, 1);
    sub.listItems.splice(itemIndex, 0, movedItem);

    draggedItem = null;
    render();
}