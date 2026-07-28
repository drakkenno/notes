// ============================================================
//  AUTHENTICATION - Login, Signup, Change Password
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

    // Check localStorage for saved session
    const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('🔑 Restored session for:', currentUser.username);
            hideLoginOverlay();
            updateUserDisplay();
        } catch (e) {
            console.warn('Failed to restore session:', e);
            currentUser = null;
            localStorage.removeItem(AUTH_STORAGE_KEY);
        }
    }

    // If no session, show login overlay
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
    // Disable main content interaction
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
    // Re-enable main content
    const main = document.getElementById('mainContent');
    if (main) main.style.pointerEvents = '';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.pointerEvents = '';
}

// ============================================================
//  UPDATE UI WITH USER INFO
// ============================================================
function updateUserDisplay() {
    const userDisplay = document.getElementById('currentUserDisplay');
    if (userDisplay && currentUser) {
        userDisplay.innerHTML = `<i class="fas fa-user"></i> ${esc(currentUser.username)}`;
        userDisplay.style.display = 'inline-flex';
    }
    // Show logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && currentUser) {
        logoutBtn.style.display = 'inline-flex';
    }
    // Update status text
    const statusTextEl = document.getElementById('statusText');
    if (statusTextEl && currentUser) {
        statusTextEl.innerHTML = `Cloud sync: <span class="connected">connected</span> <span style="color:#7a7a5a;font-size:0.75rem;">(${esc(currentUser.username)})</span>`;
    }
}

// ============================================================
//  SWITCH BETWEEN LOGIN / SIGNUP / CHANGE PASSWORD VIEWS
// ============================================================
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('changePasswordForm').style.display = 'none';
    document.getElementById('authError').textContent = '';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').textContent = '';
    document.getElementById('authSuccess').style.display = 'none';
}

function showSignupForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('changePasswordForm').style.display = 'none';
    document.getElementById('authError').textContent = '';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').textContent = '';
    document.getElementById('authSuccess').style.display = 'none';
}

function showChangePasswordForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('changePasswordForm').style.display = 'block';
    document.getElementById('authError').textContent = '';
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authSuccess').textContent = '';
    document.getElementById('authSuccess').style.display = 'none';
}

// ============================================================
//  AUTH API CALLS
// ============================================================

async function apiAuth(action, body) {
    const url = `${AUTH_API_URL}?action=${action}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        currentUser = { username: data.username, gistId: data.gistId };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
        hideLoginOverlay();
        updateUserDisplay();
        // Reload data for this user
        if (isVercelConfigured) {
            await syncFromVercel();
        }
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
        // Switch to login form
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
        // Clear fields
        document.getElementById('changeCurrentPassword').value = '';
        document.getElementById('changeNewPassword').value = '';
        document.getElementById('changeConfirmNewPassword').value = '';
        // Switch back to login view after a moment
        setTimeout(() => {
            showLoginForm();
        }, 2000);
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
//  LOGOUT
// ============================================================
function handleLogout() {
    if (!confirm('Are you sure you want to log out?')) return;
    currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sections = [];
    nextId = 1;
    selectedSectionId = null;
    selectedSubsection = null;
    render();
    showLoginForm();
    showLoginOverlay();
    const userDisplay = document.getElementById('currentUserDisplay');
    if (userDisplay) userDisplay.style.display = 'none';
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.style.display = 'none';
    console.log('🔒 Logged out');
}

// ============================================================
//  KEYBOARD SUPPORT - Enter key to submit
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // Login form - Enter key
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
        loginPassword.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });
    }

    // Signup form - Enter key
    const signupConfirm = document.getElementById('signupConfirmPassword');
    if (signupConfirm) {
        signupConfirm.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSignup();
            }
        });
    }

    // Change password form - Enter key
    const changeConfirm = document.getElementById('changeConfirmNewPassword');
    if (changeConfirm) {
        changeConfirm.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleChangePassword();
            }
        });
    }
});