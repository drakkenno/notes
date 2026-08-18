// CSP-safe bindings for controls that exist in the initial document.
document.addEventListener('click', event => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const actions = {
        'show-signup': showSignupForm,
        'show-login': showLoginForm,
        'hide-login': hideLoginOverlay,
        offline: useOffline,
        'show-change-password': showChangePasswordLoggedIn,
        'show-delete-account': showDeleteOwnAccount,
        'show-admin': showAdminPanel,
        logout: handleLogout,
        pull: pullNow,
        push: pushNow
    };
    const action = actions[control.dataset.action];
    if (action) { event.preventDefault(); action(); }
});
document.addEventListener('submit', event => {
    const actions = { login: handleLogin, signup: handleSignup, 'change-password': handleChangePassword, 'delete-account': handleDeleteAccount };
    const action = actions[event.target.dataset.submitAction];
    if (action) { event.preventDefault(); action(); }
});
// Enter completes an item and starts the next one; Shift+Enter inserts a line break.
document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || !event.target.matches('textarea.editable-item')) return;
    event.preventDefault();
    const input = event.target, box = input.closest('.list-box');
    const itemIndex = Array.from(box.querySelectorAll('textarea.editable-item')).indexOf(input);
    if (itemIndex < 0) return;
    const isEmpty = input.value.trim() === '';
    if (box.dataset.type === 'sharedList') {
        if (isEmpty) input.blur();
        else { updateSharedListItem(Number(box.dataset.shareId), Number(box.dataset.index), itemIndex, input.value); input.blur(); }
    } else if (box.dataset.type === 'sharedSubList') {
        if (isEmpty) input.blur();
        else { updateSharedSubsectionValue(Number(box.dataset.shareId), box.dataset.subPath, 'item', Number(box.dataset.index), itemIndex, 'text', input.value); input.blur(); }
    } else if (box.dataset.type === 'subList') {
        if (isEmpty) input.blur();
        else { updateSubItemInSub(box.dataset.subPath, Number(box.dataset.index), itemIndex, input.value); input.blur(); }
    } else {
        if (isEmpty) input.blur();
        else { updateSubItem(Number(box.dataset.sectionId), Number(box.dataset.index), itemIndex, input.value); input.blur(); }
    }
});
// A list or note card can be selected without putting a text field into edit mode.
// Keep that selection after renders caused by edits, deletion, ratings, or adding items.
window.selectedBoxKey = null;
window.boxSelectionKey = box => [box.dataset.type || 'note', box.dataset.sectionId || '', box.dataset.subPath || '', box.dataset.index || ''].join('|');
window.selectBox = box => {
    if (!box) return;
    window.itemSelection = [];
    document.querySelectorAll('.sub-list-item.item-selected').forEach(item => item.classList.remove('item-selected'));
    window.selectedBoxKey = window.boxSelectionKey(box);
    document.querySelectorAll('.note-box.box-selected, .list-box.box-selected').forEach(item => item.classList.remove('box-selected'));
    box.classList.add('box-selected');
};
window.restoreSelectedBox = () => {
    if (!window.selectedBoxKey) return;
    const box = Array.from(document.querySelectorAll('.note-box, .list-box')).find(item => window.boxSelectionKey(item) === window.selectedBoxKey);
    if (box) box.classList.add('box-selected');
    else window.selectedBoxKey = null;
};
document.addEventListener('click', event => {
    const box = event.target.closest('.note-box, .list-box');
    if (!box || event.target.closest('input, textarea, a, button, [data-onclick], .star-half')) return;
    window.selectBox(box);
});

document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.target.matches('input, textarea')) return;
    const box = document.querySelector('.list-box.box-selected');
    if (!box) return;
    event.preventDefault();
    if (box.dataset.type === 'sharedSubList') addSharedSubItem(Number(box.dataset.shareId), box.dataset.subPath, Number(box.dataset.index));
    else if (box.dataset.type === 'subList') addSubItemToSub(box.dataset.subPath, Number(box.dataset.index));
    else addSubItem(Number(box.dataset.sectionId), Number(box.dataset.index));
});
// Copy and paste complete note/list cards between sections and subsections.
window.cardClipboard = null;
// Ctrl/Cmd-click selects item rows; Ctrl/Cmd+C and Ctrl/Cmd+V copy them between personal lists.
window.itemSelection = [];
window.itemClipboard = null;
window.itemListFor = function(box) {
    if (!box) return null;
    if (box.dataset.type === 'sharedList') {
        const share = sharedSections.find(item => item.id === Number(box.dataset.shareId));
        return share?.section?.items?.[Number(box.dataset.index)] || null;
    }
    if (box.dataset.type === 'sharedSubList') {
        const share = sharedSections.find(item => item.id === Number(box.dataset.shareId));
        const subsection = getSharedSubsection(share, box.dataset.subPath);
        return subsection?.items?.[Number(box.dataset.index)] || null;
    }
    const section = sections.find(item => item.id === selectedSectionId);
    if (!section) return null;
    const container = box.dataset.type === 'subList'
        ? getSubsectionByPath(section, box.dataset.subPath.split('/').filter(Boolean))
        : section;
    return container?.items?.[Number(box.dataset.index)] || null;
};
window.canEditItemList = function(box) {
    if (box?.dataset.type !== 'sharedList' && box?.dataset.type !== 'sharedSubList') return true;
    const share = sharedSections.find(item => item.id === Number(box.dataset.shareId));
    return !!share && canEditSharedSection(share);
};
window.saveSharedItemListChanges = function(boxes) {
    const changedShares = new Set();
    boxes.forEach(box => {
        if (box?.dataset.type !== 'sharedList' && box?.dataset.type !== 'sharedSubList') return;
        const share = sharedSections.find(item => item.id === Number(box.dataset.shareId));
        if (share) changedShares.add(share);
    });
    changedShares.forEach(saveSharedSection);
};
document.addEventListener('click', event => {
    const row = event.target.closest('.list-box .sub-list-item');
    const box = row?.closest('.list-box');
    if (!row || !box || event.target.closest('button, a, [data-onclick], .star-half')) return;
    const index = Array.from(box.querySelectorAll('.sub-list-item')).indexOf(row);
    const selectedIndex = window.itemSelection.findIndex(entry => entry.box === box && entry.index === index);
    // First click selects the row; a second click on its text opens the editor.
    if (event.target.closest('textarea.editable-item') && selectedIndex >= 0 && !(event.ctrlKey || event.metaKey)) return;
    const selectedInAnotherCard = window.itemSelection.some(entry => entry.box !== box);
    if (selectedInAnotherCard) {
        window.itemSelection = [];
        document.querySelectorAll('.sub-list-item.item-selected').forEach(item => item.classList.remove('item-selected'));
    }
    window.selectedBoxKey = null;
    document.querySelectorAll('.note-box.box-selected, .list-box.box-selected').forEach(card => card.classList.remove('box-selected'));
    if (!(event.ctrlKey || event.metaKey)) {
        document.activeElement?.blur();
        event.preventDefault();
        event.stopPropagation();
        document.querySelectorAll('.sub-list-item.item-selected').forEach(item => item.classList.remove('item-selected'));
        window.itemSelection = [{ box, index }];
        row.classList.add('item-selected');
        return;
    }
    document.activeElement?.blur();
    event.preventDefault();
    event.stopPropagation();
    if (selectedIndex >= 0) {
        window.itemSelection.splice(selectedIndex, 1);
        row.classList.remove('item-selected');
    } else {
        window.itemSelection.push({ box, index });
        row.classList.add('item-selected');
    }
}, true);
document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'backspace' && window.itemSelection.length && !event.target.matches('input, textarea')) {
        const groups = new Map();
        const editedBoxes = [...new Set(window.itemSelection.filter(({ box }) => window.canEditItemList(box)).map(({ box }) => box))];
        window.itemSelection.forEach(({ box, index }) => {
            if (!window.canEditItemList(box)) return;
            const list = window.itemListFor(box);
            if (!list?.items) return;
            const indexes = groups.get(list) || [];
            indexes.push(index);
            groups.set(list, indexes);
        });
        let deleted = 0;
        groups.forEach((indexes, list) => {
            [...new Set(indexes)].sort((a, b) => b - a).forEach(index => {
                if (index >= 0 && index < list.items.length) { list.items.splice(index, 1); deleted++; }
            });
        });
        if (!deleted) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.saveSharedItemListChanges(editedBoxes);
        window.itemSelection = [];
        render();
        showSaveIndicator(`${deleted} item${deleted === 1 ? '' : 's'} deleted`);
    } else if (!(event.ctrlKey || event.metaKey) || event.target.matches('input, textarea')) {
        return;
    } else if (key === 'c' && window.itemSelection.length) {
        const copies = window.itemSelection.map(({ box, index }) => window.itemListFor(box)?.items?.[index]).filter(Boolean).map(item => JSON.parse(JSON.stringify(item)));
        if (!copies.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.itemClipboard = copies;
        showSaveIndicator(`${copies.length} item${copies.length === 1 ? '' : 's'} copied`);
    } else if (key === 'v' && window.itemClipboard?.length) {
        const destinationBox = document.querySelector('.list-box.box-selected');
        const destination = window.itemListFor(destinationBox);
        if (!destination || !window.canEditItemList(destinationBox)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        destination.items = destination.items || [];
        destination.items.push(...window.itemClipboard.map(item => JSON.parse(JSON.stringify(item))));
        window.saveSharedItemListChanges([destinationBox]);
        window.itemSelection = [];
        render();
        showSaveIndicator(`${window.itemClipboard.length} item${window.itemClipboard.length === 1 ? '' : 's'} pasted`);
    }
});
document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.target.matches('input, textarea')) return;
    const key = event.key.toLowerCase();
    if (key === 'c') {
        const box = document.querySelector('.note-box.box-selected, .list-box.box-selected');
        if (!box) return;
        const section = sections.find(item => item.id === selectedSectionId);
        const isSub = box.dataset.type === 'subNote' || box.dataset.type === 'subList';
        const container = isSub ? getSubsectionByPath(section, box.dataset.subPath.split('/').filter(Boolean)) : section;
        const collection = box.classList.contains('note-box') ? container?.notes : container?.items;
        const source = collection?.[Number(box.dataset.index)];
        if (!source) return;
        event.preventDefault();
        window.cardClipboard = { kind: box.classList.contains('note-box') ? 'note' : 'list', value: JSON.parse(JSON.stringify(source)) };
        showSaveIndicator('Card copied');
    }
    if (key === 'v' && window.cardClipboard) {
        const section = sections.find(item => item.id === selectedSectionId);
        if (!section) return;
        event.preventDefault();
        const isSub = selectedSubsectionPath.length > 0;
        const container = isSub ? getSubsectionByPath(section, selectedSubsectionPath) : section;
        if (!container) return;
        const field = window.cardClipboard.kind === 'note' ? 'notes' : 'items';
        const copies = container[field] || (container[field] = []);
        const copy = JSON.parse(JSON.stringify(window.cardClipboard.value));
        copy.x = (copy.x || 10) + 20; copy.y = (copy.y || 10) + 20;
        const index = copies.push(copy) - 1;
        window.selectedBoxKey = isSub
            ? `${window.cardClipboard.kind === 'note' ? 'subNote' : 'subList'}||${selectedSubsectionPath.join('/')}|${index}`
            : `${window.cardClipboard.kind}|${section.id}||${index}`;
        render();
        showSaveIndicator('Card pasted');
    }
});
// CSP-safe delegated execution for legacy action metadata. No inline attribute is executable.
(function () {
  const splitArgs = source => { const out=[]; let value='', quote='', depth=0; for (let i=0;i<source.length;i++){const c=source[i]; if(quote){value+=c;if(c===quote&&source[i-1]!=='\\')quote='';continue;} if(c==='"'||c==="'"){quote=c;value+=c;continue;} if(c==='('||c==='['||c==='{')depth++; if(c===')'||c===']'||c==='}')depth--; if(c===','&&depth===0){out.push(value.trim());value='';}else value+=c;} if(value.trim())out.push(value.trim()); return out; };
  const argument = (value, element, event) => { value=value.trim(); if(value==='this.value') return element.value; if(value==='event') return event; if(/^[-+]?\d+(\.\d+)?$/.test(value)) return Number(value); if(value==='true'||value==='false') return value==='true'; if((value.startsWith("'")&&value.endsWith("'"))||(value.startsWith('"')&&value.endsWith('"'))) return value.slice(1,-1).replace(/\\'/g,"'").replace(/\\"/g,'"').replace(/\\\\/g,'\\'); return value; };
  const invoke = (expression, event, element) => { expression=expression.trim(); if(!expression||expression==='return false') return expression==='return false'; if(expression==='event.stopPropagation()'){event.stopPropagation();return;} if(expression==='event.preventDefault()'){event.preventDefault();return;} if(expression==='isSharedSectionsView=false'){window.isSharedSectionsView=false;return;} const focus=expression.match(/^document\.querySelector\((['"])(.*?)\1\)\.focus\(\)$/); if(focus){document.querySelector(focus[2])?.focus();return;} const call=expression.match(/^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\((.*)\)$/); if(!call)return; let target=window; for(const part of call[1].split('.'))target=target?.[part]; if(typeof target!=='function')return; const scopedEvent = new Proxy(event, { get(target, property) { if (property === 'currentTarget') return element; const value = Reflect.get(target, property, target); return typeof value === 'function' ? value.bind(target) : value; } }); const args=splitArgs(call[2]).map(value=>argument(value,element,scopedEvent)); target(...args); };
  const run = (event, attribute) => { const element=event.target.closest(`[${attribute}]`); if(!element)return; const source=element.getAttribute(attribute)||''; let statement='',quote='',depth=0; for(let i=0;i<=source.length;i++){const c=source[i]||';'; if(quote){statement+=c;if(c===quote&&source[i-1]!=='\\')quote='';continue;} if(c==='"'||c==="'"){quote=c;statement+=c;continue;} if(c==='(')depth++; if(c===')')depth--; if(c===';'&&depth===0){const result=invoke(statement,event,element); if(result)event.preventDefault(); statement='';} else statement+=c;} };
  [['click','data-onclick'],['input','data-oninput'],['change','data-onchange'],['mousedown','data-onmousedown'],['dragstart','data-ondragstart'],['dragover','data-ondragover'],['dragleave','data-ondragleave'],['drop','data-ondrop']].forEach(([type,attribute])=>document.addEventListener(type,event=>run(event,attribute)));
})();

// Double-click a list card's non-editable surface to expand it to all items.
document.addEventListener('dblclick', event => {
    const box = event.target.closest('#boxGrid > .list-box');
    const interactive = event.target.closest('input, textarea, button, a, .star-half, .box-actions, .sub-list-item');
    if (!box || interactive) return;
    event.preventDefault();
    window.selectBox?.(box);
    fitListBoxToContents(box);
    showSaveIndicator('List fitted to all items');
});

window.addEventListener('resize', () => requestAnimationFrame(updateCanvasExtent));

// Keep the active editor visible inside both the canvas and the visual viewport.
// Typing temporarily replaces Organize with an explicit confirmation action.
let activeTypingField = null;
let typingActionState = null;
let editorVisibilityFrame = null;

function isTextEditor(element) {
    return element?.matches?.('.editable-title, .editable-content, .editable-item');
}

function keepTextEditorVisible(field) {
    if (!isTextEditor(field) || !field.isConnected) return;
    cancelAnimationFrame(editorVisibilityFrame);
    editorVisibilityFrame = requestAnimationFrame(() => {
        field.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
        const viewport = window.visualViewport;
        const top = (viewport?.offsetTop || 0) + 12;
        const bottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - 12;
        const rect = field.getBoundingClientRect();
        if (rect.top < top) window.scrollBy({ top: rect.top - top, behavior: 'auto' });
        else if (rect.bottom > bottom) window.scrollBy({ top: rect.bottom - bottom, behavior: 'auto' });
    });
}

function restoreTypingAction() {
    const state = typingActionState;
    typingActionState = null;
    if (!state?.button?.isConnected) return;
    state.button.className = state.className;
    state.button.innerHTML = state.html;
    state.button.removeAttribute('data-typing-confirm');
    state.button.title = state.title;
    state.button.setAttribute('aria-label', state.ariaLabel);
    state.dock?.classList.remove('typing-active');
}

function showTypingAction(field) {
    activeTypingField = field;
    keepTextEditorVisible(field);
    const dock = document.getElementById('mobileOrganizeDock');
    const button = document.getElementById('mobileOrganizeBtn');
    if (!dock || !button) return;
    if (typingActionState?.button?.isConnected) return;
    typingActionState = {
        button,
        dock,
        className: button.className,
        html: button.innerHTML,
        title: button.title,
        ariaLabel: button.getAttribute('aria-label') || 'Organize cards'
    };
    dock.classList.add('typing-active');
    button.classList.add('typing-confirm-btn');
    button.innerHTML = '<i class="fas fa-check"></i><span>Confirm</span>';
    button.title = 'Finish typing';
    button.setAttribute('aria-label', 'Finish typing');

    button.setAttribute('data-typing-confirm', 'true');
}
window.finishTyping = function() {
    const field = activeTypingField;
    if (isTextEditor(field) && field.isConnected) {
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.blur();
    }
    activeTypingField = null;
    restoreTypingAction();
};

document.addEventListener('focusin', event => {
    if (!isTextEditor(event.target)) return;
    activeTypingField = event.target;
    keepTextEditorVisible(event.target);
});
document.addEventListener('input', event => {
    if (!isTextEditor(event.target)) return;
    showTypingAction(event.target);
});
document.addEventListener('focusout', event => {
    if (!isTextEditor(event.target)) return;
    if (event.relatedTarget?.matches?.('[data-typing-confirm]')) return;
    setTimeout(() => {
        if (isTextEditor(document.activeElement)) return;
        activeTypingField = null;
        restoreTypingAction();
    }, 0);
});
window.visualViewport?.addEventListener('resize', () => {
    if (isTextEditor(document.activeElement)) keepTextEditorVisible(document.activeElement);
});

// Subsections are navigation-only. Drag/drop remains available only for
// top-level section titles, where it changes section order.
function disableSubsectionDragAndDrop(root = document) {
    const selector = '.subsection-list li, .hierarchy-subsection, .shared-hierarchy-subsection';
    root.querySelectorAll(selector).forEach(subsection => {
        subsection.draggable = false;
        ['draggable', 'data-ondragstart', 'data-ondragover', 'data-ondragleave', 'data-ondrop'].forEach(attribute => subsection.removeAttribute(attribute));
        subsection.ondragstart = null;
        subsection.ondragover = null;
        subsection.ondragleave = null;
        subsection.ondrop = null;
        subsection.classList.remove('hierarchy-dragging', 'hierarchy-drop-target');
    });
}

const renderWithSectionOrderOnly = render;
render = function(...args) {
    const result = renderWithSectionOrderOnly(...args);
    disableSubsectionDragAndDrop();
    return result;
};

document.addEventListener('DOMContentLoaded', () => disableSubsectionDragAndDrop());
document.addEventListener('dragstart', event => {
    if (!event.target.closest('.subsection-list li, .hierarchy-subsection, .shared-hierarchy-subsection')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
}, true);
