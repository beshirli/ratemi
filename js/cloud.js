// Firebase: kullanıcı adı + şifreyle giriş, yöneticinin kullanıcı oluşturması ve kullanım olayları.
// Firebase e-posta ister; kullanıcı adı "ad@<proje>.firebaseapp.com" biçiminde görünmez bir e-postaya çevrilir.
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where, limit, orderBy, getDocs, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const config = {
  apiKey: 'AIzaSyB3yLNEnA-r-xkJl2ECTKGEsqw_HR6K_bg',
  authDomain: 'ratemi-b8cc2.firebaseapp.com',
  projectId: 'ratemi-b8cc2',
  storageBucket: 'ratemi-b8cc2.firebasestorage.app',
  messagingSenderId: '382364004985',
  appId: '1:382364004985:web:3615e94d0f783e6f281aa8',
};
const DOMAIN = 'ratemi-b8cc2.firebaseapp.com';

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

const TR = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u' };
/** "Ahmet Yılmaz" → "ahmetyilmaz" (e-posta yazılırsa @ öncesi): küçük harf, Türkçe harfler sadeleşir, yalnız a-z 0-9 . _ - kalır. */
export const cleanUsername = (s) => String(s || '').split('@')[0].toLocaleLowerCase('tr').replace(/[çğıöşü]/g, (c) => TR[c]).replace(/[^a-z0-9._-]/g, '');
export const validUsername = (u) => /^[a-z0-9][a-z0-9._-]{2,23}$/.test(u);

const emailOf = (username, n) => `${username}${n ? '.' + n : ''}@${DOMAIN}`;

/** Okunur hata mesajı. */
export function errorText(e) {
  const c = e && e.code;
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found') return 'Kullanıcı adı ya da şifre hatalı.';
  if (c === 'auth/too-many-requests') return 'Çok fazla deneme yapıldı; biraz sonra tekrar dene.';
  if (c === 'auth/weak-password') return 'Şifre en az 6 karakter olmalı.';
  if (c === 'auth/email-already-in-use') return 'Bu kullanıcı adı zaten var.';
  if (c === 'auth/network-request-failed' || c === 'unavailable') return 'İnternet bağlantısı yok.';
  if (c === 'permission-denied') return 'Bu işlem için yetkin yok.';
  return (e && e.message) || 'Bir hata oluştu.';
}

/** Hesap bilgisi (kullanıcı adı, ad, rol, aktif mi); hesabı olmayan ya da durdurulmuş kullanıcıda null. */
async function accountOf(user) {
  const snap = await getDocs(query(collection(db, 'accounts'), where('uid', '==', user.uid), limit(1)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  const a = d.data();
  return a.active ? { username: d.id, name: a.name || d.id, role: a.role || 'user', uid: user.uid } : null;
}

/** Oturum değişince cb({ username, name, role, uid } | null) çağrılır. */
let sessionCb = null;
// Kurulum ya da giriş sürerken hesap kaydı henüz yokken oturum kapatılmasın (yarım kalan yazmalar takılır).
let busy = false;

async function emit(user) {
  if (!sessionCb) return;
  if (!user) return sessionCb(null);
  try {
    const a = await accountOf(user);
    if (!a && busy) return;
    if (!a) await signOut(auth);
    sessionCb(a);
  } catch (e) {
    sessionCb({ error: e });
  }
}

export function watchSession(cb) {
  sessionCb = cb;
  return onAuthStateChanged(auth, emit);
}

/** Yönetici hesabı kuruldu mu (ilk açılışta "Yönetici hesabını oluştur" gösterilir). */
export async function adminExists() {
  return (await getDoc(doc(db, 'config', 'admin'))).exists();
}

export async function setupAdmin(username, name, password) {
  busy = true;
  try {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, emailOf(username), password);
    } catch (e) {
      // Önceki denemede giriş hesabı açılıp kayıt yarım kaldıysa aynı şifreyle devam edilir.
      if (e.code !== 'auth/email-already-in-use') throw e;
      cred = await signInWithEmailAndPassword(auth, emailOf(username), password);
    }
    const uid = cred.user.uid;
    await setDoc(doc(db, 'config', 'admin'), { uid, username, createdAt: serverTimestamp() });
    await setDoc(doc(db, 'logins', username), { email: emailOf(username) });
    await setDoc(doc(db, 'accounts', username), { uid, name, role: 'admin', active: true, createdAt: serverTimestamp() });
    await track('login', {}, { username, uid });
  } finally {
    busy = false;
  }
  await emit(auth.currentUser);
}

export async function login(username, password) {
  const l = await getDoc(doc(db, 'logins', username));
  if (!l.exists()) throw Object.assign(new Error('Kullanıcı adı ya da şifre hatalı.'), { code: 'auth/user-not-found' });
  busy = true;
  let a;
  try {
    const cred = await signInWithEmailAndPassword(auth, l.data().email, password);
    a = await accountOf(cred.user);
    if (!a) {
      await signOut(auth);
      throw new Error('Bu kullanıcı durdurulmuş. Uygulama sahibine danış.');
    }
    await track('login', {}, a);
  } finally {
    busy = false;
  }
  await emit(auth.currentUser);
  return a;
}

export async function logout(session) {
  if (session) await track('logout', {}, session).catch(() => {});
  await signOut(auth);
}

// --- Yönetici ---

/** Firebase hesabını ikinci bir bağlantıda açar ki yöneticinin oturumu kapanmasın. */
async function createAuthUser(email, password) {
  const tmp = initializeApp(config, 'olustur-' + Date.now());
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(tmp), email, password);
    await signOut(getAuth(tmp));
    return cred.user.uid;
  } finally {
    await deleteApp(tmp);
  }
}

export async function createUser(username, name, password) {
  if ((await getDoc(doc(db, 'logins', username))).exists()) throw Object.assign(new Error(), { code: 'auth/email-already-in-use' });
  const email = emailOf(username);
  const uid = await createAuthUser(email, password);
  await setDoc(doc(db, 'accounts', username), { uid, name: name || username, role: 'user', active: true, password, createdAt: serverTimestamp() });
  await setDoc(doc(db, 'logins', username), { email });
}

/**
 * Şifre sıfırlama: Firebase ücretsiz planda başkasının şifresini değiştirmeye izin vermez; bu yüzden aynı kullanıcı
 * adına yeni bir giriş hesabı açılır ve kullanıcı adı ona bağlanır. Kullanım geçmişi kullanıcı adında kalır.
 */
export async function resetPassword(username, password) {
  const email = emailOf(username, Date.now().toString(36));
  const uid = await createAuthUser(email, password);
  await updateDoc(doc(db, 'accounts', username), { uid, password });
  await setDoc(doc(db, 'logins', username), { email });
}

export const setActive = (username, active) => updateDoc(doc(db, 'accounts', username), { active });
export const renameUser = (username, name) => updateDoc(doc(db, 'accounts', username), { name });

export async function listAccounts() {
  const snap = await getDocs(collection(db, 'accounts'));
  return snap.docs.map((d) => ({ username: d.id, ...d.data() }));
}

/** Son olaylar (en yeni önce). */
export async function listEvents(max = 3000) {
  const snap = await getDocs(query(collection(db, 'events'), orderBy('at', 'desc'), limit(max)));
  return snap.docs.map((d) => {
    const e = d.data();
    return { id: d.id, ...e, at: e.at ? e.at.toMillis() : Date.now() };
  });
}

// --- Kullanım olayları ---

let current = null;
export const setSession = (s) => { current = s; };

const device = () => (/Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'telefon' : 'bilgisayar');

/** Olay kaydı: giriş, çıkış, açılış, plan, kayıt, şablon, PDF, teklif, çevirici. Hata uygulamayı durdurmaz. */
export function track(type, detail = {}, who = current) {
  if (!who || !who.uid) return Promise.resolve();
  return addDoc(collection(db, 'events'), {
    username: who.username, uid: who.uid, type, detail, device: device(), at: serverTimestamp(),
  }).catch(() => {});
}
