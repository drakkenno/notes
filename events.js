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
});// CSP-safe delegated execution for legacy action metadata. No inline attribute is executable.
(function () {
  const splitArgs = source => { const out=[]; let value='', quote='', depth=0; for (let i=0;i<source.length;i++){const c=source[i]; if(quote){value+=c;if(c===quote&&source[i-1]!=='\\')quote='';continue;} if(c==='"'||c==="'"){quote=c;value+=c;continue;} if(c==='('||c==='['||c==='{')depth++; if(c===')'||c===']'||c==='}')depth--; if(c===','&&depth===0){out.push(value.trim());value='';}else value+=c;} if(value.trim())out.push(value.trim()); return out; };
  const argument = (value, element, event) => { value=value.trim(); if(value==='this.value') return element.value; if(value==='event') return event; if(/^[-+]?\d+(\.\d+)?$/.test(value)) return Number(value); if(value==='true'||value==='false') return value==='true'; if((value.startsWith("'")&&value.endsWith("'"))||(value.startsWith('"')&&value.endsWith('"'))) return value.slice(1,-1).replace(/\\'/g,"'").replace(/\\"/g,'"').replace(/\\\\/g,'\\'); return value; };
  const invoke = (expression, event, element) => { expression=expression.trim(); if(!expression||expression==='return false') return expression==='return false'; if(expression==='event.stopPropagation()'){event.stopPropagation();return;} if(expression==='event.preventDefault()'){event.preventDefault();return;} if(expression==='isSharedSectionsView=false'){window.isSharedSectionsView=false;return;} const focus=expression.match(/^document\.querySelector\((['"])(.*?)\1\)\.focus\(\)$/); if(focus){document.querySelector(focus[2])?.focus();return;} const call=expression.match(/^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\((.*)\)$/); if(!call)return; let target=window; for(const part of call[1].split('.'))target=target?.[part]; if(typeof target!=='function')return; const scopedEvent = new Proxy(event, { get(target, property) { if (property === 'currentTarget') return element; const value = Reflect.get(target, property, target); return typeof value === 'function' ? value.bind(target) : value; } }); const args=splitArgs(call[2]).map(value=>argument(value,element,scopedEvent)); target(...args); };
  const run = (event, attribute) => { const element=event.target.closest(`[${attribute}]`); if(!element)return; const source=element.getAttribute(attribute)||''; let statement='',quote='',depth=0; for(let i=0;i<=source.length;i++){const c=source[i]||';'; if(quote){statement+=c;if(c===quote&&source[i-1]!=='\\')quote='';continue;} if(c==='"'||c==="'"){quote=c;statement+=c;continue;} if(c==='(')depth++; if(c===')')depth--; if(c===';'&&depth===0){const result=invoke(statement,event,element); if(result)event.preventDefault(); statement='';} else statement+=c;} };
  [['click','data-onclick'],['change','data-onchange'],['mousedown','data-onmousedown'],['dragstart','data-ondragstart'],['dragover','data-ondragover'],['dragleave','data-ondragleave'],['drop','data-ondrop']].forEach(([type,attribute])=>document.addEventListener(type,event=>run(event,attribute)));
})();
