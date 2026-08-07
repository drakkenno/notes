// ============================================================
//  AUTHENTICATION - Login, Signup, Change Password, Admin
//  All frontend auth logic for the Notes App
// ============================================================

// ============================================================
//  AUTH STATE
// ============================================================
let isAuthInitialized = false;

// ============================================================
//  INIT - Check if user is already logged in
// ============================================================
function initAuth() {
    if (isAuthInitialized) return;
    isAuthInitialized = true;

    const savedUser = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            if (!currentUser.token) {
                throw new Error('Your old session must be renewed');
            }
            console.log('🔑 Restored session for:', currentUser.username);
            hideLoginOverlay();
            updateUserDisplay();
        } catch (e) {
            console.warn('Failed to restore session:', e);
            currentUser = null;
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
        }
    }

    if (!currentUser) {
        showLoginOverlay();
    }
}

// ============================================================
//  SHOW / HIDE LOGIN OVERLAY
// ============================================================
function showLoginOverlay() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) {
        overlay.classList.add('visible');
        overlay.classList.remove('hidden');
    }
    const main = document.getElementById('mainContent');
    if (main) main.style.pointerEvents = 'none';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.pointerEvents = 'none';
}

function hideLoginOverlay() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
        overlay.classList.add('hidden');
    }
    const main = document.getElementById('mainContent');
    if (main) main.style.pointerEvents = '';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.pointerEvents = '';
}

// ============================================================
//  OFFLINE MODE - Use the app without authentication
// ============================================================
window.useOffline = function() {
    currentUser = null;
    hideLoginOverlay();
    updateSyncStatus('local');
    const statusTextEl = document.getElementById('statusText');
    if (statusTextEl) {
        statusTextEl.innerHTML = `Cloud sync: <span class="disconnected">offline mode</span>`;
    }
    console.log('📝 Using Notes in offline mode');
};

// ============================================================
//  UPDATE UI WITH USER INFO
// ============================================================
function updateUserDisplay() {
    const userDisplay = document.getElementById('currentUserDisplay');
    const userActions = document.getElementById('userActions');
    const adminBtn = document.getElementById('adminPanelBtn');
    const deleteBtn = document.getElementById('deleteMyAccountBtn');

    if (currentUser) {
        // Show user name
        if (userDisplay) {
            const isAdmin = currentUser.username === 'drakeno';
            userDisplay.innerHTML = `<i class="fas ${isAdmin ? 'fa-shield-alt' : 'fa-user'}"></i> ${esc(currentUser.username)}`;
            userDisplay.style.display = 'inline-flex';
        }
        // Show action buttons
        if (userActions) userActions.style.display = 'flex';
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
        // Show admin button only for drakeno
        if (adminBtn) {
            adminBtn.style.display = currentUser.username === 'drakeno' ? 'inline-flex' : 'none';
        }
    }

    // Update status text
    const statusTextEl = document.getElementById('statusText');
    if (statusTextEl && currentUser) {
        statusTextEl.innerHTML = `Cloud sync: <span class="connected">connected</span> <span style="color:#7a7a5a;font-size:0.75rem;">(${esc(currentUser.username)})</span>`;
    }
}

// ============================================================
//  SWITCH VIEWS
// ============================================================
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('changePasswordForm').style.display = 'none';
    document.getElementById('deleteAccountForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('authError').textContent = '';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').textContent = '';
    document.getElementById('authSuccess').style.display = 'none';
}

function showSignupForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('changePasswordForm').style.display = 'none';
    document.getElementById('deleteAccountForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('authError').textContent = '';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').textContent = '';
    document.getElementById('authSuccess').style.display = 'none';
}

function showChangePasswordForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('changePasswordForm').style.display = 'block';
    document.getElementById('deleteAccountForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('authError').textContent = '';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').textContent = '';
    document.getElementById('authSuccess').style.display = 'none';
}

function showDeleteAccountForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('changePasswordForm').style.display = 'none';
    document.getElementById('deleteAccountForm').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('authError').textContent = '';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').textContent = '';
    document.getElementById('authSuccess').style.display = 'none';
}

// ============================================================
//  CHANGE PASSWORD (from sidebar button)
// ============================================================
function showChangePasswordLoggedIn() {
    showChangePasswordForm();
    showLoginOverlay();
}

// ============================================================
//  DELETE OWN ACCOUNT (from sidebar button)
// ============================================================
function showDeleteOwnAccount() {
    showLoginOverlay();
    showDeleteAccountForm();
    // Pre-fill with current user
    if (currentUser) {
        document.getElementById('deleteUsername').value = currentUser.username;
        document.getElementById('deleteUsername').readOnly = true;
        document.getElementById('deletePassword').focus();
    }
}

// ============================================================
//  ADMIN PANEL
// ============================================================
function showAdminPanel() {
    if (!currentUser || currentUser.username !== 'drakeno') {
        alert('Only admin can access this panel');
        return;
    }
    showLoginOverlay();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('changePasswordForm').style.display = 'none';
    document.getElementById('deleteAccountForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('authError').textContent = '';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').textContent = '';
    document.getElementById('authSuccess').style.display = 'none';
    // Load user list
    loadAdminUserList();
}

function hideAdminPanel() {
    hideLoginOverlay();
}

async function loadAdminUserList() {
    const listEl = document.getElementById('adminUserList');
    const loadingEl = document.getElementById('adminLoading');
    if (!listEl) return;

    loadingEl.style.display = 'block';
    listEl.innerHTML = '';

    try {
        // No password needed since drakeno is already logged in
        const data = await apiAuth('list-users', {
            username: currentUser.username
        });
        if (!data || !data.users) return;

        loadingEl.style.display = 'none';
        data.users.forEach(user => {
            const row = document.createElement('div');
            row.className = 'admin-user-row';
            const isSelf = user.username === 'drakeno';
            row.innerHTML = `
                <span class="admin-user-name">
                    ${isSelf ? '<i class="fas fa-shield-alt" style="color:#f5e56b;"></i>' : '<i class="fas fa-user" style="color:#7a7a5a;"></i>'}
                    ${esc(user.username)}
                    ${isSelf ? ' <span style="color:#f5e56b;font-size:0.7rem;">(admin)</span>' : ''}
                </span>
                <span class="admin-user-date">${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
                ${!isSelf ? `<button class="admin-delete-btn" onclick="adminDeleteUser('${user.username}')" title="Delete user"><i class="fas fa-trash-alt"></i></button><button class="admin-delete-btn" onclick="adminResetPassword('${user.username}')" title="Reset password"><i class="fas fa-key"></i></button>` : ''}
            `;
            listEl.appendChild(row);
        });
    } catch (error) {
        loadingEl.style.display = 'none';
        listEl.innerHTML = `<div class="auth-message auth-error" style="display:block;">${esc(error.message)}</div>`;
    }
}

async function adminDeleteUser(targetUsername) {
    if (!currentUser || currentUser.username !== 'drakeno') return;
    if (targetUsername === 'drakeno') return;

    if (!confirm(`⚠️ Delete user "${targetUsername}"?\n\nThis will permanently delete all their notes.`)) return;

    try {
        await apiAuth('admin-delete', {
            adminUsername: 'drakeno',
            targetUsername
        });
        // Reload the list
        loadAdminUserList();
        const successEl = document.getElementById('authSuccess');
        if (successEl) {
            successEl.textContent = `✅ User "${targetUsername}" deleted`;
            successEl.style.display = 'block';
            setTimeout(() => { successEl.style.display = 'none'; }, 3000);
        }
    } catch (error) {
        const errorEl = document.getElementById('authError');
        if (errorEl) {
            errorEl.textContent = error.message || 'Failed to delete';
            errorEl.style.display = 'block';
            setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
        }
    }
}

// ============================================================
//  AUTH API CALLS
// ============================================================
window.adminResetPassword = async function(targetUsername) {
    const newPassword = prompt("New password for " + targetUsername + ":");
    if (!newPassword) return;
    if (newPassword.length < 3) { alert("Password must be at least 3 characters"); return; }
    const adminPassword = prompt("Confirm your admin password:");
    if (!adminPassword) return;
    try {
        await apiAuth("admin-change-password", { adminUsername: currentUser.username, adminPassword, targetUsername, newPassword });
        alert("Password updated for " + targetUsername);
    } catch (error) {
        alert(error.message || "Password reset failed");
    }
};

async function apiAuth(action, body) {
    const url = `${AUTH_API_URL}?action=${action}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}) },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
}

// ============================================================
//  LOGIN
// ============================================================
async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('authError');
    const successEl = document.getElementById('authSuccess');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!username || !password) {
        errorEl.textContent = 'Please enter username and password';
        errorEl.style.display = 'block';
        return;
    }

    const btn = document.querySelector('#loginForm .auth-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    btn.disabled = true;

    try {
        const data = await apiAuth('login', { username, password });
        currentUser = { username: data.username, gistId: data.gistId, token: data.token };
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
        hideLoginOverlay();
        updateUserDisplay();
        // Cloud data is loaded only when the user presses Pull.
        // Shared sections load when the user opens Shared Sections.
        console.log(`✅ Logged in as "${username}"`);
    } catch (error) {
        errorEl.textContent = error.message || 'Login failed';
        errorEl.style.display = 'block';
        console.error('Login error:', error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ============================================================
//  SIGNUP
// ============================================================
async function handleSignup() {
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const errorEl = document.getElementById('authError');
    const successEl = document.getElementById('authSuccess');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!username || !password) {
        errorEl.textContent = 'Please enter username and password';
        errorEl.style.display = 'block';
        return;
    }

    if (username.length < 2) {
        errorEl.textContent = 'Username must be at least 2 characters';
        errorEl.style.display = 'block';
        return;
    }

    if (password.length < 3) {
        errorEl.textContent = 'Password must be at least 3 characters';
        errorEl.style.display = 'block';
        return;
    }

    if (password !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.style.display = 'block';
        return;
    }

    const btn = document.querySelector('#signupForm .auth-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    btn.disabled = true;

    try {
        const data = await apiAuth('signup', { username, password });
        successEl.textContent = 'Account created! You can now log in.';
        successEl.style.display = 'block';
        setTimeout(() => {
            showLoginForm();
            document.getElementById('loginUsername').value = username;
            document.getElementById('loginPassword').value = '';
        }, 1500);
        console.log(`✅ User "${username}" created`);
    } catch (error) {
        errorEl.textContent = error.message || 'Signup failed';
        errorEl.style.display = 'block';
        console.error('Signup error:', error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ============================================================
//  CHANGE PASSWORD
// ============================================================
async function handleChangePassword() {
    const currentPassword = document.getElementById('changeCurrentPassword').value;
    const newPassword = document.getElementById('changeNewPassword').value;
    const confirmNewPassword = document.getElementById('changeConfirmNewPassword').value;
    const errorEl = document.getElementById('authError');
    const successEl = document.getElementById('authSuccess');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!currentUser) {
        errorEl.textContent = 'You must be logged in to change password';
        errorEl.style.display = 'block';
        return;
    }

    if (!currentPassword || !newPassword) {
        errorEl.textContent = 'Please fill in all fields';
        errorEl.style.display = 'block';
        return;
    }

    if (newPassword.length < 3) {
        errorEl.textContent = 'New password must be at least 3 characters';
        errorEl.style.display = 'block';
        return;
    }

    if (newPassword !== confirmNewPassword) {
        errorEl.textContent = 'New passwords do not match';
        errorEl.style.display = 'block';
        return;
    }

    const btn = document.querySelector('#changePasswordForm .auth-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...';
    btn.disabled = true;

    try {
        const data = await apiAuth('change-password', {
            username: currentUser.username,
            currentPassword,
            newPassword
        });
        successEl.textContent = 'Password changed successfully!';
        successEl.style.display = 'block';
        document.getElementById('changeCurrentPassword').value = '';
        document.getElementById('changeNewPassword').value = '';
        document.getElementById('changeConfirmNewPassword').value = '';
        setTimeout(() => { hideLoginOverlay(); }, 2000);
        console.log('✅ Password changed');
    } catch (error) {
        errorEl.textContent = error.message || 'Failed to change password';
        errorEl.style.display = 'block';
        console.error('Change password error:', error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ============================================================
//  DELETE ACCOUNT
// ============================================================
async function handleDeleteAccount() {
    const username = document.getElementById('deleteUsername').value.trim();
    const password = document.getElementById('deletePassword').value;
    const errorEl = document.getElementById('authError');
    const successEl = document.getElementById('authSuccess');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!username || !password) {
        errorEl.textContent = 'Please enter username and password';
        errorEl.style.display = 'block';
        return;
    }

    if (!confirm(`⚠️ PERMANENTLY DELETE account "${username}"?\n\nThis will delete all notes and cannot be undone!`)) {
        return;
    }

    const btn = document.querySelector('#deleteAccountForm .auth-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    btn.disabled = true;

    try {
        await apiAuth('delete', { username, password });
        successEl.textContent = 'Account deleted successfully';
        successEl.style.display = 'block';
        if (currentUser && currentUser.username === username) {
            currentUser = null;
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
            sections = [];
            nextId = 1;
            selectedSectionId = null;
            selectedSubsection = null;
            render();
            const userDisplay = document.getElementById('currentUserDisplay');
            if (userDisplay) userDisplay.style.display = 'none';
            const userActions = document.getElementById('userActions');
            if (userActions) userActions.style.display = 'none';
        }
        setTimeout(() => {
            showLoginForm();
            document.getElementById('deleteUsername').value = '';
            document.getElementById('deletePassword').value = '';
            document.getElementById('deleteUsername').readOnly = false;
        }, 2000);
        console.log(`🗑️ Account "${username}" deleted`);
    } catch (error) {
        errorEl.textContent = error.message || 'Failed to delete account';
        errorEl.style.display = 'block';
        console.error('Delete account error:', error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ============================================================
//  LOGOUT
// ============================================================
function handleLogout() {
    if (!confirm('Are you sure you want to log out?')) return;
    currentUser = null;
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sections = [];
    nextId = 1;
    selectedSectionId = null;
    selectedSubsection = null;
    isSharedView = false;
    sharedFolders = [];
    render();
    showLoginForm();
    showLoginOverlay();
    const userDisplay = document.getElementById('currentUserDisplay');
    if (userDisplay) userDisplay.style.display = 'none';
    const userActions = document.getElementById('userActions');
    if (userActions) userActions.style.display = 'none';
    console.log('🔒 Logged out');
}

// ============================================================
//  KEYBOARD SUPPORT
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
        loginPassword.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); handleLogin(); }
        });
    }

    const signupConfirm = document.getElementById('signupConfirmPassword');
    if (signupConfirm) {
        signupConfirm.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); handleSignup(); }
        });
    }

    const changeConfirm = document.getElementById('changeConfirmNewPassword');
    if (changeConfirm) {
        changeConfirm.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); handleChangePassword(); }
        });
    }
});