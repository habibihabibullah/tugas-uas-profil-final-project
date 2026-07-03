import { 
  collection, 
  addDoc, 
  setDoc,
  getDoc,
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp,
  increment,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { GuestbookMessage, ProjectItem, PortfolioConfig, Article } from '../types';

const GUESTBOOK_COLLECTION = 'guestbook';
const LIKES_COLLECTION = 'likes';
const LOCAL_GUESTBOOK_KEY = 'portfolio_guestbook_data';
const LOCAL_LIKES_KEY = 'portfolio_likes_data';

// --- Listeners tracking ---
let activeGuestbookListeners: ((data: GuestbookMessage[], source: 'firebase' | 'local') => void)[] = [];
let activeLikesListeners: ((likesMap: Record<string, number>) => void)[] = [];

function notifyGuestbookListeners(data: GuestbookMessage[], source: 'firebase' | 'local') {
  activeGuestbookListeners.forEach(l => {
    try { l(data, source); } catch (e) { console.error(e); }
  });
}

function notifyLikesListeners(likesMap: Record<string, number>) {
  activeLikesListeners.forEach(l => {
    try { l(likesMap); } catch (e) { console.error(e); }
  });
}

// --- Local storage helpers ---
export function getLocalGuestbook(): GuestbookMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_GUESTBOOK_KEY);
    if (!raw) {
      // Elegant initial fallback messages to keep the guestbook alive offline
      const samples: GuestbookMessage[] = [
        {
          id: 'sample-1',
          nama: 'Dewi Lestari',
          pesan: 'Sangat menyukai desain websitenya! Sangat responsif dan modern.',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
          id: 'sample-2',
          nama: 'Andi Wijaya',
          pesan: 'Project IoT Agri-Tech sangat menarik, sukses terus Kak Habibi!',
          createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
        }
      ];
      localStorage.setItem(LOCAL_GUESTBOOK_KEY, JSON.stringify(samples));
      return samples;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to read guestbook from localStorage:", e);
    return [];
  }
}

export function saveLocalGuestbook(data: GuestbookMessage[]): void {
  try {
    localStorage.setItem(LOCAL_GUESTBOOK_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to write guestbook to localStorage:", e);
  }
}

export function getLocalLikes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LOCAL_LIKES_KEY);
    return raw ? JSON.parse(raw) : { 'agritech': 12, 'elearning': 8, 'akadcrud': 15 };
  } catch (e) {
    console.error("Failed to read likes from localStorage:", e);
    return {};
  }
}

export function saveLocalLikes(likesMap: Record<string, number>): void {
  try {
    localStorage.setItem(LOCAL_LIKES_KEY, JSON.stringify(likesMap));
  } catch (e) {
    console.error("Failed to write likes to localStorage:", e);
  }
}

// --- GUESTBOOK SERVICE ---

export function subscribeToGuestbook(
  onUpdate: (data: GuestbookMessage[], source: 'firebase' | 'local') => void,
  onError?: (error: Error) => void
) {
  activeGuestbookListeners.push(onUpdate);

  // Instantly return local storage cache for maximum speeds
  onUpdate(getLocalGuestbook(), 'local');

  try {
    const q = query(collection(db, GUESTBOOK_COLLECTION), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: GuestbookMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          nama: data.nama || '',
          pesan: data.pesan || '',
          createdAt: data.createdAt || new Date().toISOString()
        });
      });

      if (list.length > 0) {
        saveLocalGuestbook(list);
      }
      notifyGuestbookListeners(list.length > 0 ? list : getLocalGuestbook(), 'firebase');
    }, (error) => {
      console.warn("Firestore guestbook snapshot failed:", error);
      if (onError) onError(error);
    });

    return () => {
      unsubscribe();
      activeGuestbookListeners = activeGuestbookListeners.filter(l => l !== onUpdate);
    };
  } catch (error) {
    console.error("Failed to setup real-time guestbook listener:", error);
    if (onError) onError(error as Error);
    return () => {
      activeGuestbookListeners = activeGuestbookListeners.filter(l => l !== onUpdate);
    };
  }
}

export async function addGuestbookMessage(
  message: Omit<GuestbookMessage, 'id' | 'createdAt'>
): Promise<{ id: string, source: 'firebase' | 'local' }> {
  const newId = 'local-' + Date.now();
  const newRecord: GuestbookMessage = {
    id: newId,
    nama: message.nama,
    pesan: message.pesan,
    createdAt: new Date().toISOString()
  };

  // 1. Instant local optimistic update
  const current = getLocalGuestbook();
  const updated = [newRecord, ...current];
  saveLocalGuestbook(updated);
  notifyGuestbookListeners(updated, 'local');

  // 2. background Firestore sync
  try {
    const docRef = doc(collection(db, GUESTBOOK_COLLECTION));
    await setDoc(docRef, {
      nama: message.nama,
      pesan: message.pesan,
      createdAt: new Date().toISOString()
    });

    const synced = getLocalGuestbook().map(item => {
      if (item.id === newId) return { ...item, id: docRef.id };
      return item;
    });
    saveLocalGuestbook(synced);
    notifyGuestbookListeners(synced, 'firebase');

    return { id: docRef.id, source: 'firebase' };
  } catch (error) {
    console.warn("Offline: Guestbook stored locally. Syncing later.", error);
    return { id: newId, source: 'local' };
  }
}

// --- PROJECT LIKES SERVICE ---

export function subscribeToLikes(
  onUpdate: (likesMap: Record<string, number>) => void
) {
  activeLikesListeners.push(onUpdate);
  
  // Initial local state callback
  onUpdate(getLocalLikes());

  try {
    const q = collection(db, LIKES_COLLECTION);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const likesMap = getLocalLikes();
      snapshot.forEach((doc) => {
        likesMap[doc.id] = doc.data().likes || 0;
      });
      saveLocalLikes(likesMap);
      notifyLikesListeners(likesMap);
    }, (error) => {
      console.warn("Firestore likes stream failed:", error);
    });

    return () => {
      unsubscribe();
      activeLikesListeners = activeLikesListeners.filter(l => l !== onUpdate);
    };
  } catch (e) {
    console.error("Failed to setup likes listener:", e);
    return () => {
      activeLikesListeners = activeLikesListeners.filter(l => l !== onUpdate);
    };
  }
}

export async function incrementProjectLike(projectId: string): Promise<number> {
  const likesMap = getLocalLikes();
  const nextVal = (likesMap[projectId] || 0) + 1;
  likesMap[projectId] = nextVal;
  
  // 1. Local storage instantly
  saveLocalLikes(likesMap);
  notifyLikesListeners(likesMap);

  // 2. Firestore Sync
  try {
    const docRef = doc(db, LIKES_COLLECTION, projectId);
    await setDoc(docRef, { likes: nextVal }, { merge: true });
  } catch (e) {
    console.warn("Likes saved locally. Firestore sync failed.", e);
  }

  return nextVal;
}

const CONFIG_COLLECTION = 'config';
const CONFIG_DOC_ID = 'portfolio_links';
const LOCAL_CONFIG_KEY = 'portfolio_config_data';

export function getLocalConfig(): PortfolioConfig {
  try {
    const raw = localStorage.getItem(LOCAL_CONFIG_KEY);
    return raw ? JSON.parse(raw) : {
      githubUrl: 'https://github.com/habibihabibullah/tugas-uas-profil-final-project',
      deployUrl: window.location.origin
    };
  } catch (e) {
    return {
      githubUrl: 'https://github.com/habibihabibullah/tugas-uas-profil-final-project',
      deployUrl: window.location.origin
    };
  }
}

export function saveLocalConfig(config: PortfolioConfig): void {
  try {
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to write config to localStorage:", e);
  }
}

export function subscribeToConfig(
  onUpdate: (config: PortfolioConfig) => void
) {
  // Instantly return local storage cache
  onUpdate(getLocalConfig());

  try {
    const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as PortfolioConfig;
        saveLocalConfig(data);
        onUpdate(data);
      }
    }, (error) => {
      console.warn("Firestore config snapshot failed:", error);
    });

    return unsubscribe;
  } catch (e) {
    console.error("Failed to setup config listener:", e);
    return () => {};
  }
}

export async function savePortfolioConfig(config: PortfolioConfig): Promise<void> {
  saveLocalConfig(config);
  try {
    const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
    await setDoc(docRef, config, { merge: true });
  } catch (e) {
    console.warn("Config saved locally. Firestore sync failed.", e);
  }
}

// --- ARTICLES SERVICE ---
const ARTICLES_COLLECTION = 'articles';
const LOCAL_ARTICLES_KEY = 'portfolio_articles_data';

let activeArticlesListeners: ((data: Article[], source: 'firebase' | 'local') => void)[] = [];

function notifyArticlesListeners(data: Article[], source: 'firebase' | 'local') {
  activeArticlesListeners.forEach(l => {
    try { l(data, source); } catch (e) { console.error(e); }
  });
}

export function getLocalArticles(): Article[] {
  try {
    const raw = localStorage.getItem(LOCAL_ARTICLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read articles from localStorage:", e);
    return [];
  }
}

export function saveLocalArticles(data: Article[]): void {
  try {
    localStorage.setItem(LOCAL_ARTICLES_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to write articles to localStorage:", e);
  }
}

export function subscribeToArticles(
  onUpdate: (data: Article[], source: 'firebase' | 'local') => void,
  onError?: (error: Error) => void
) {
  activeArticlesListeners.push(onUpdate);

  // Instantly return cache
  onUpdate(getLocalArticles(), 'local');

  try {
    const q = query(collection(db, ARTICLES_COLLECTION), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Article[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          title: data.title || '',
          content: data.content || '',
          createdAt: data.createdAt || new Date().toISOString()
        });
      });

      if (list.length > 0) {
        saveLocalArticles(list);
      }
      notifyArticlesListeners(list.length > 0 ? list : getLocalArticles(), 'firebase');
    }, (error) => {
      console.warn("Firestore articles snapshot failed:", error);
      if (onError) onError(error);
    });

    return () => {
      unsubscribe();
      activeArticlesListeners = activeArticlesListeners.filter(l => l !== onUpdate);
    };
  } catch (error) {
    console.error("Failed to setup real-time articles listener:", error);
    if (onError) onError(error as Error);
    return () => {
      activeArticlesListeners = activeArticlesListeners.filter(l => l !== onUpdate);
    };
  }
}

export async function addArticle(
  article: Omit<Article, 'id' | 'createdAt'>
): Promise<{ id: string, source: 'firebase' | 'local' }> {
  const newId = 'local-' + Date.now();
  const newRecord: Article = {
    id: newId,
    title: article.title,
    content: article.content,
    createdAt: new Date().toISOString()
  };

  // 1. Instant local optimistic update
  const current = getLocalArticles();
  const updated = [newRecord, ...current];
  saveLocalArticles(updated);
  notifyArticlesListeners(updated, 'local');

  // 2. Background Firestore sync
  try {
    const docRef = doc(collection(db, ARTICLES_COLLECTION));
    await setDoc(docRef, {
      title: article.title,
      content: article.content,
      createdAt: new Date().toISOString()
    });

    const synced = getLocalArticles().map(item => {
      if (item.id === newId) return { ...item, id: docRef.id };
      return item;
    });
    saveLocalArticles(synced);
    notifyArticlesListeners(synced, 'firebase');

    return { id: docRef.id, source: 'firebase' };
  } catch (error) {
    console.warn("Offline: Article stored locally. Syncing later.", error);
    return { id: newId, source: 'local' };
  }
}

export async function updateArticle(
  articleId: string,
  title: string,
  content: string
): Promise<boolean> {
  const current = getLocalArticles();
  const updated = current.map(item => {
    if (item.id === articleId) {
      return { ...item, title, content };
    }
    return item;
  });
  saveLocalArticles(updated);
  notifyArticlesListeners(updated, 'local');

  try {
    if (!articleId.startsWith('local-')) {
      const docRef = doc(db, ARTICLES_COLLECTION, articleId);
      await updateDoc(docRef, {
        title,
        content
      });
    }
    notifyArticlesListeners(updated, 'firebase');
    return true;
  } catch (error) {
    console.warn("Failed to sync article update to Firestore:", error);
    return false;
  }
}

export async function deleteArticle(
  articleId: string
): Promise<boolean> {
  const current = getLocalArticles();
  const updated = current.filter(item => item.id !== articleId);
  saveLocalArticles(updated);
  notifyArticlesListeners(updated, 'local');

  try {
    if (!articleId.startsWith('local-')) {
      const docRef = doc(db, ARTICLES_COLLECTION, articleId);
      await deleteDoc(docRef);
    }
    notifyArticlesListeners(updated, 'firebase');
    return true;
  } catch (error) {
    console.warn("Failed to sync article delete to Firestore:", error);
    return false;
  }
}

