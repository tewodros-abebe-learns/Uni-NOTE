// Browser-test adapter only. Delivered by a Playwright route; never imported by production.
import { loadGuestNotes, saveGuestNotes, loadGuestFolders, saveGuestFolders } from '/src/demoData.ts';
import { authDiagnostic } from '/src/lib/authDiagnostics.ts';
import { registerLocalBlob } from '/src/utils/mediaStore.ts';
const listeners = new Set();
const auth = { currentUser: null };
const control = window.__stage3 = {
  observations: 0, reads: 0, paused: false, waiting: [], authError: null,
  emit(uid) {
    auth.currentUser = uid ? { uid, email: `${uid}@example.com`, displayName: uid } : null;
    localStorage.setItem('__stage3_user', uid || '');
    for (const callback of listeners) callback(auth.currentUser);
  },
  release() { control.paused = false; for (const resolve of control.waiting.splice(0)) resolve(); }
};
auth.currentUser = localStorage.getItem('__stage3_user') ? { uid: localStorage.getItem('__stage3_user'), displayName: localStorage.getItem('__stage3_user'), email: 'test@example.com' } : null;
export const getFirebaseAuth = () => auth;
export const observeAuth = callback => {
  control.observations++; listeners.add(callback);
  const timer = setTimeout(() => { if (listeners.has(callback)) callback(auth.currentUser); }, 0);
  return () => { clearTimeout(timer); listeners.delete(callback); };
};
export const preflightGoogleAuth = async () => undefined;
export const googleAuthDiagnostic = () => authDiagnostic(location.hostname, 'test-project');
export const signInWithGoogle = async () => { if (control.authError) throw Object.assign(new Error('Test auth failure'), { code: control.authError }); control.emit('alice'); return auth.currentUser; };
export const logout = async () => control.emit(null);
export const registerUserDoc = async () => true;
export const retryAccountSync = async () => undefined;
const wait = async () => { control.reads++; if (control.paused) await new Promise(resolve => control.waiting.push(resolve)); };
export const getAllNotes = async uid => { await wait(); return loadGuestNotes(uid); };
export const getAllFolders = async uid => { await wait(); return loadGuestFolders(uid); };
export const getNotes = getAllNotes;
export const getFolders = getAllFolders;
export const getTimestampMs = value => typeof value === 'number' ? value : 0;
export const saveNoteDirect = async (uid, note) => {
  if (auth.currentUser?.uid !== uid) throw new Error('Account changed');
  saveGuestNotes([note, ...loadGuestNotes(uid).filter(n => n.id !== note.id)], uid); return note;
};
export const saveFolderDirect = async (uid, folder) => { saveGuestFolders([...loadGuestFolders(uid).filter(f => f.id !== folder.id), folder], uid); return folder; };
export const createNote = async (uid, folderId, title) => saveNoteDirect(uid, { id: crypto.randomUUID(), folderId, title, sections: [{ id: 's', title: 'One', content: '' }], createdAt: Date.now() });
export const createFolder = async (uid, name, parentId, level) => saveFolderDirect(uid, { id: crypto.randomUUID(), name, parentId, level, createdAt: Date.now() });
export const updateNote = async (uid, id, data) => saveNoteDirect(uid, { ...loadGuestNotes(uid).find(n => n.id === id), ...data });
export const renameFolder = async () => undefined;
export const moveFolder = async () => undefined;
export const deleteNote = async () => undefined;
export const deleteFolderRecursive = async () => undefined;
export const getNote = async (uid, id) => loadGuestNotes(uid).find(n => n.id === id) || null;
export const getFirebaseDb = () => { throw new Error('Live Firestore is forbidden in this test'); };
export const uploadImageFile = async (_, file, name) => registerLocalBlob(file, name);
