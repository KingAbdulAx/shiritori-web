// Remembers which room this tab is in, so a reload or a dropped connection can take the seat back.
const KEY = 'tailword.session';

export function loadSession() {
    try {
        const raw = sessionStorage.getItem(KEY);
        const s = raw ? JSON.parse(raw) : null;
        return s && typeof s.code === 'string' && typeof s.token === 'string' ? s : null;
    } catch {
        return null;
    }
}

export function saveSession(session) {
    try {
        sessionStorage.setItem(KEY, JSON.stringify(session));
    } catch {
        // storage unavailable (private mode); play still works, just without resume
    }
}

export function clearSession() {
    try {
        sessionStorage.removeItem(KEY);
    } catch {
        // nothing to clear
    }
}
