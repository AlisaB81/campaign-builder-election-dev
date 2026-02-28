// Check if current user can see admin notifications (app_owner or isAdmin with manage_users)
// Uses credentials: 'include' so cookie-based auth works (no reliance on localStorage token)
async function isAdminForNav() {
    try {
        const userResponse = await fetch('/api/user', { credentials: 'include' });
        if (!userResponse.ok) return false;
        const userData = await userResponse.json();
        if (userData.userType === 'app_owner') return true;
        if (userData.isAdmin !== true) return false;
        var perms = userData.permissions || [];
        return perms.includes('manage_users') || perms.includes('*');
    } catch (e) { return false; }
}

// Show or hide badge by count; use inline display so it works even if Tailwind hidden is purged
function setBadgeVisible(el, visible) {
    if (!el) return;
    el.classList.toggle('hidden', !visible);
    el.style.display = visible ? 'inline-flex' : 'none';
}

// Load help ticket counts for admin users (app_owner or isAdmin with manage_users)
async function loadHelpTicketCounts() {
    try {
        if (!(await isAdminForNav())) return;
        const response = await fetch('/api/admin/help-tickets/count', { credentials: 'include' });
        if (response.ok) {
            const counts = await response.json();
            var notClosed = (counts.open || 0) + (counts.inProgress || 0);
            var updateBadge = function(el, numEl, count) {
                if (el && numEl) {
                    numEl.textContent = count;
                    setBadgeVisible(el, count > 0);
                }
            };
            updateBadge(document.getElementById('helpTicketsCountDesktop'), document.getElementById('helpTicketsCountNumberDesktop'), notClosed);
            updateBadge(document.getElementById('helpTicketsCountTablet'), document.getElementById('helpTicketsCountNumberTablet'), notClosed);
            updateBadge(document.getElementById('helpTicketsCountMobile'), document.getElementById('helpTicketsCountNumberMobile'), notClosed);
        } else {
            ['helpTicketsCountDesktop', 'helpTicketsCountTablet', 'helpTicketsCountMobile'].forEach(function(id) {
                setBadgeVisible(document.getElementById(id), false);
            });
        }
    } catch (e) {
        ['helpTicketsCountDesktop', 'helpTicketsCountTablet', 'helpTicketsCountMobile'].forEach(function(id) {
            setBadgeVisible(document.getElementById(id), false);
        });
    }
}

// Load requests count (new/unread) for admin – red badge on Requests nav item
async function loadRequestsCount() {
    try {
        if (!(await isAdminForNav())) return;
        const response = await fetch('/api/admin/requests/count', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        var count = data.count || 0;
        document.querySelectorAll('.nav-requests-count').forEach(function(el) { el.textContent = count; });
        document.querySelectorAll('.nav-requests-badge').forEach(function(el) {
            setBadgeVisible(el, count > 0);
        });
    } catch (e) {
        document.querySelectorAll('.nav-requests-badge').forEach(function(el) {
            setBadgeVisible(el, false);
        });
    }
}

function toggleMobileAdmin() {
    var dropdown = document.getElementById('mobileAdminDropdown'), arrow = document.getElementById('mobileAdminArrow');
    if (dropdown.classList.contains('hidden')) { dropdown.classList.remove('hidden'); arrow.style.transform = 'rotate(180deg)'; }
    else { dropdown.classList.add('hidden'); arrow.style.transform = 'rotate(0deg)'; }
}
function initNavBadges() {
    if (document.getElementById('page-scrutineering')) return;
    loadHelpTicketCounts();
    loadRequestsCount();
    setInterval(loadHelpTicketCounts, 30000);
    setInterval(loadRequestsCount, 30000);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavBadges);
} else {
    initNavBadges();
}
