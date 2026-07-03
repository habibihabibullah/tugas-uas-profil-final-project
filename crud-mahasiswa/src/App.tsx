import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Users,
  Plus, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Heart, 
  Send, 
  Github, 
  ExternalLink, 
  Code, 
  Database, 
  Wrench, 
  Layers, 
  Wifi, 
  WifiOff, 
  Mail, 
  FileText,
  Smartphone,
  Phone,
  Settings,
  Download,
  Share2,
  Check,
  Sparkles,
  BookOpen,
  MapPin,
  Trash2,
  Calendar,
  Compass,
  MessageSquare,
  ChevronRight,
  Eye,
  EyeOff,
  Award,
  Edit2,
  LogIn,
  LogOut,
  Lock
} from 'lucide-react';
import { GuestbookMessage, ProjectItem, SkillItem, PortfolioConfig, Article } from './types';
import { 
  subscribeToGuestbook, 
  addGuestbookMessage, 
  subscribeToLikes, 
  incrementProjectLike,
  subscribeToConfig,
  savePortfolioConfig,
  subscribeToArticles,
  addArticle,
  updateArticle,
  deleteArticle
} from './lib/dbService';
import { auth } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInAnonymously
} from 'firebase/auth';

// Import profile image from local assets
import profileAvatar from './assets/images/profile_avatar_1782629622587.jpg';

export default function App() {
  // Database / Real-time states
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingArticles, setIsLoadingLoadingArticles] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingArticle, setIsSubmittingArticle] = useState(false);
  const [dbSource, setDbSource] = useState<'firebase' | 'local'>('local');

  // Authentication states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [demoLoginName, setDemoLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Article edit states
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editArticleTitle, setEditArticleTitle] = useState('');
  const [editArticleContent, setEditArticleContent] = useState('');
  const [isSubmittingEditArticle, setIsSubmittingEditArticle] = useState(false);

  // Track liked projects to prevent double-upvoting
  const [likedProjects, setLikedProjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('portfolio_liked_projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Network Status State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Form states (Guestbook)
  const [nama, setNama] = useState('');
  const [pesan, setPesan] = useState('');

  // Form states (Article creation)
  const [articleTitle, setArticleTitle] = useState('');
  const [articleContent, setArticleContent] = useState('');

  // Form states (Contact Form)
  const [contactNama, setContactNama] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPesan, setContactPesan] = useState('');
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);

  // Notification / Toast state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // PWA & Push Notification permission state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Local clock state
  const [currentTime, setCurrentTime] = useState<string>('');

  // Copy status indicator
  const [isCopied, setIsCopied] = useState(false);

  // PWA Install prompt helpers
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Location / Geolocation tracker state
  const [gpsError, setGpsError] = useState<string>('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Helper to update user marker and center map on the live instance
  const updateUserMarker = (L: any, map: any, userCoords: { lat: number; lng: number }) => {
    if (!L || !map) return;
    try {
      if ((window as any).userMarkerInstance) {
        map.removeLayer((window as any).userMarkerInstance);
      }
      if ((window as any).userCircleInstance) {
        map.removeLayer((window as any).userCircleInstance);
      }

      // Custom glowing blue pulsing icon using Tailwind classes
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `<div class="relative flex items-center justify-center">
          <div class="absolute w-5 h-5 rounded-full bg-indigo-500 animate-ping opacity-60"></div>
          <div class="relative w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white shadow-lg"></div>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup(`
          <div class="text-slate-900 font-sans p-1">
            <p class="font-bold text-xs">Lokasi Anda (Real-time)</p>
            <p class="text-[9px] text-slate-500 font-mono">${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)}</p>
          </div>
        `);

      const circle = L.circle([userCoords.lat, userCoords.lng], {
        color: '#4f46e5',
        fillColor: '#818cf8',
        fillOpacity: 0.15,
        radius: 120
      }).addTo(map);

      (window as any).userMarkerInstance = marker;
      (window as any).userCircleInstance = circle;

      // Smoothly pan map to user coordinates
      map.setView([userCoords.lat, userCoords.lng], 15);
    } catch (e) {
      console.warn("Failed to update user marker:", e);
    }
  };

  // Run updates when coords changes
  useEffect(() => {
    const L = (window as any).L;
    const map = (window as any).leafletMapInstance;
    if (L && map && coords) {
      updateUserMarker(L, map, coords);
    }
  }, [coords]);

  // Dynamic Leaflet Map setup and watchPosition tracking
  useEffect(() => {
    let mapInstance: any = null;
    let watchId: number | null = null;

    // 1. Load Leaflet CSS
    let link = document.querySelector('link[href*="leaflet.css"]') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    const initMap = (L: any) => {
      const container = document.getElementById('leaflet-map');
      if (!container) return;

      // Clean up any existing map container reference or state
      if ((window as any).leafletMapInstance) {
        try {
          (window as any).leafletMapInstance.remove();
        } catch (e) {
          console.warn("Error removing old map instance from window:", e);
        }
        (window as any).leafletMapInstance = null;
      }

      if ((container as any)._leaflet_id !== undefined && (container as any)._leaflet_id !== null) {
        (container as any)._leaflet_id = null;
      }

      // UNUGHA Cilacap exact coordinates
      const unughaCoords = [-7.7188481, 109.023246];
      try {
        // Fix Leaflet default icon path issues in Vite/Vercel production builds
        try {
          if (L && L.Icon && L.Icon.Default) {
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
              iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
              iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
              shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });
          }
        } catch (iconPatchErr) {
          console.warn("Could not patch Leaflet default marker icons:", iconPatchErr);
        }

        mapInstance = L.map('leaflet-map', {
          center: unughaCoords,
          zoom: 14,
          zoomControl: true,
          scrollWheelZoom: false
        });
        (window as any).leafletMapInstance = mapInstance;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance);

        // Beautiful, responsive, zero-asset custom marker for UNUGHA
        const unughaIcon = L.divIcon({
          className: 'custom-unugha-marker-pin',
          html: `<div class="relative flex items-center justify-center">
            <!-- Pulsing outer ring -->
            <div class="absolute w-8 h-8 rounded-full bg-emerald-500/30 animate-ping opacity-60"></div>
            <!-- Outer border ring -->
            <div class="relative w-5 h-5 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center">
              <!-- Inner gold/amber core -->
              <div class="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
            </div>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        // Custom UNUGHA Marker
        L.marker(unughaCoords, { icon: unughaIcon }).addTo(mapInstance)
          .bindPopup(`
            <div class="text-slate-900 font-sans p-1">
              <p class="font-bold text-xs">UNUGHA Cilacap</p>
              <p class="text-[10px] text-slate-500">Universitas Nahdlatul Ulama Al-Ghozali</p>
            </div>
          `);

        // If coordinates already loaded prior to map initialization, apply user location immediately
        if (coords) {
          updateUserMarker(L, mapInstance, coords);
        }
      } catch (err) {
        console.error("Map initialization failed:", err);
      }
    };

    // Check if L is already available
    const L = (window as any).L;
    let script: HTMLScriptElement | null = null;
    if (L) {
      initMap(L);
    } else {
      // 2. Load Leaflet JS
      script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.crossOrigin = '';
      script.async = true;
      script.onload = () => {
        const LoadedL = (window as any).L;
        if (LoadedL) {
          initMap(LoadedL);
        }
      };
      document.head.appendChild(script);
    }

    // Geolocation Real-time Tracking using watchPosition
    if (navigator.geolocation) {
      setGpsError(''); // clear default
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCoords(newCoords);
          setGpsError('');
        },
        (error) => {
          let msg = 'Gagal melacak GPS perangkat.';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'Akses GPS ditolak. Silakan berikan izin lokasi di browser Anda.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = 'Posisi lokasi tidak tersedia.';
          } else if (error.code === error.TIMEOUT) {
            msg = 'Waktu permintaan lokasi habis.';
          }
          setGpsError(msg);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      setGpsError('Geolocation tidak didukung oleh browser Anda.');
    }

    return () => {
      // Cleanup watchPosition
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      // Cleanup map instance
      if (mapInstance) {
        try {
          mapInstance.remove();
        } catch (e) {
          // ignore
        }
      }
      if ((window as any).leafletMapInstance) {
        try {
          (window as any).leafletMapInstance.remove();
          (window as any).leafletMapInstance = null;
        } catch (e) {
          // ignore
        }
      }
      if (script && document.head.contains(script)) {
        try {
          document.head.removeChild(script);
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Track Firebase Auth and Local Demo Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          displayName: user.displayName || 'Pengguna Google',
          email: user.email,
          photoURL: user.photoURL,
          isGoogle: true
        });
        setIsAuthLoading(false);
      } else {
        const savedDemo = localStorage.getItem('portfolio_demo_user');
        if (savedDemo) {
          try {
            setCurrentUser(JSON.parse(savedDemo));
          } catch {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
        setIsAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Track online/offline status, install prompt, and clock
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNotification({
        type: 'success',
        message: 'Koneksi online aktif! Database berhasil disinkronisasi.'
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setNotification({
        type: 'info',
        message: 'Mode offline aktif! Semua fitur berjalan lancar dengan Cache PWA.'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB');
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(clockInterval);
    };
  }, []);

  // Subscribe to Firestore Services on mount
  useEffect(() => {
    setIsLoading(true);
    setIsLoadingLoadingArticles(true);

    const unsubscribeGuestbook = subscribeToGuestbook(
      (data, source) => {
        setMessages(data);
        setDbSource(source);
        setIsLoading(false);
      },
      (err) => {
        setIsLoading(false);
        console.warn("Database reading offline:", err);
      }
    );

    const unsubscribeArticles = subscribeToArticles(
      (data) => {
        setArticles(data);
        setIsLoadingLoadingArticles(false);
      },
      (err) => {
        setIsLoadingLoadingArticles(false);
        console.warn("Articles reading offline:", err);
      }
    );

    const unsubscribeLikes = subscribeToLikes((likesMap) => {
      setLikes(likesMap);
    });

    return () => {
      unsubscribeGuestbook();
      unsubscribeArticles();
      unsubscribeLikes();
    };
  }, []);

  // Request notifications permission and send standard system notification
  const handleRequestPushAndTrigger = async () => {
    if (!('Notification' in window)) {
      setNotification({
        type: 'error',
        message: 'Browser Anda tidak mendukung notifikasi push.'
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        setNotification({
          type: 'success',
          message: 'Izin sistem aktif! Mengirimkan Push Notification...'
        });
        triggerLocalNotification(
          'Notifikasi Sistem Habibi! 🔔', 
          'Halo! Anda baru saja menguji sistem notifikasi. Berjalan dengan lancar!'
        );
      } else {
        setNotification({
          type: 'error',
          message: 'Izin notifikasi ditolak oleh perangkat Anda.'
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerLocalNotification = async (title: string, body: string) => {
    try {
      if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification(title, {
          body,
          icon: profileAvatar,
          badge: profileAvatar,
          vibrate: [100, 50, 100],
        } as any);
      } else if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch (err) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    }
  };

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Add a new guestbook message
  const handlePostGuestbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim() || !pesan.trim()) {
      setNotification({
        type: 'error',
        message: 'Harap isi seluruh formulir buku tamu.'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await addGuestbookMessage({
        nama: nama.trim(),
        pesan: pesan.trim()
      });

      setNama('');
      setPesan('');

      setNotification({
        type: 'success',
        message: 'Pesan berhasil dipublikasikan di Buku Tamu!'
      });

      triggerLocalNotification('Buku Tamu Diisi! ✍️', `Terima kasih ${nama.trim()} telah meninggalkan jejak.`);
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Gagal mengirim pesan.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add a new Article
  const handlePostArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleTitle.trim() || !articleContent.trim()) {
      setNotification({
        type: 'error',
        message: 'Harap isi judul dan isi artikel.'
      });
      return;
    }

    try {
      setIsSubmittingArticle(true);
      await addArticle({
        title: articleTitle.trim(),
        content: articleContent.trim()
      });

      setArticleTitle('');
      setArticleContent('');

      setNotification({
        type: 'success',
        message: 'Artikel baru berhasil diterbitkan!'
      });

      triggerLocalNotification('Artikel Baru Terbit! 📝', `Judul: ${articleTitle.trim()}`);
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Gagal menerbitkan artikel.'
      });
    } finally {
      setIsSubmittingArticle(false);
    }
  };

  // Handle contact form submissions
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactNama.trim() || !contactEmail.trim() || !contactPesan.trim()) {
      setNotification({
        type: 'error',
        message: 'Mohon lengkapi data form kontak.'
      });
      return;
    }

    try {
      setIsContactSubmitting(true);
      // Simulate real asynchronous network dispatch
      await new Promise((resolve) => setTimeout(resolve, 1200));

      setNotification({
        type: 'success',
        message: `Terima kasih ${contactNama.trim()}! Pesan Anda berhasil dikirim.`
      });

      triggerLocalNotification('Kontak Terkirim! 📬', `Terima kasih telah menghubungi saya.`);

      setContactNama('');
      setContactEmail('');
      setContactPesan('');
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Gagal mengirim pesan kontak.'
      });
    } finally {
      setIsContactSubmitting(false);
    }
  };

  // Download contact card as a standard vCard (.VCF)
  const handleDownloadVCard = () => {
    const vcardContent = `BEGIN:VCARD
VERSION:3.0
N:Nandes;Habibi;Habibullah;Hiroshi;
FN:Habibi Habibullah Hiroshi Nandes
TITLE:Web Developer & Informatics Student
ORG:UNUGHA Cilacap
TEL;TYPE=CELL,VOICE:+6285741027488
EMAIL;TYPE=PREF,INTERNET:habibihabibullah136@gmail.com
URL:https://profile-pwa.vercel.app/
NOTE:Informatics Student at UNUGHA Cilacap. Web Developer, React & PWA Specialist.
REV:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
END:VCARD`;

    const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Habibi_Habibullah_Hiroshi_Nandes.vcf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setNotification({
      type: 'success',
      message: 'Kartu kontak (.vcf) berhasil dibuat dan diunduh! 🗂️'
    });
  };

  // Download CV / Resume as formatted plain text (.TXT)
  const handleDownloadCV = () => {
    const cvText = `===========================================================
               RESUME / CURRICULUM VITAE               
===========================================================

DATA PRIBADI
------------
Nama Lengkap : Habibi Habibullah Hiroshi Nandes
Pekerjaan    : Mahasiswa Informatika & Web Developer
Instansi     : Universitas Nahdlatul Ulama Al-Ghozali Cilacap (Semester 4)
Email        : habibihabibullah136@gmail.com
Telepon      : +62 857-4102-7488
Pendidikan   : S1 Teknik Informatika - UNUGHA Cilacap

TENTANG SAYA
------------
Halo, saya Habibi Habibullah Hiroshi Nandes, mahasiswa Informatika semester 4 di
Universitas Nahdlatul Ulama Al-Ghozali Cilacap. Saya memiliki ketertarikan yang sangat
besar di dunia teknologi, khususnya pada pengembangan web dan pemrograman. Saya sedang
fokus mempelajari HTML, CSS, JavaScript, dan backend development untuk membangun aplikasi
web modern yang responsif dan interaktif. Saya juga aktif mengembangkan logika pemrograman,
sistem basis data, dan CRUD.

KEAHLIAN / SKILL
----------------
- HTML5, CSS3, JavaScript ES6+
- React.js / Vite
- Tailwind CSS
- Backend development basics (Node.js, Express)
- Database (Firebase Firestore, LocalStorage caching)
- Progressive Web Applications (PWA, Service Workers)

HOBI
----
1. Main game
2. Menonton YouTube
3. Browsing internet
4. Bersantai
5. Olahraga (Futsal & Sepak Bola)

TIGA GOALS UTAMA
----------------
1. Menjadi orang sukses
2. Pengin menjadi orang yang berguna bagi nusa dan bangsa
3. Mendapatkan nilai A dalam matakuliah web programming

FAVORITE THINGS
---------------
- Olahraga Favorit  : Badminton, Rcl, Futsal, Joging
- Film Terfavorit   : End Games, Amazing Spiderman 2, John Wick, Oppenheimer

===========================================================
    Unduhan Resmi Portfolio Habibi Habibullah Hiroshi Nandes
===========================================================`;

    const blob = new Blob([cvText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'CV_Habibi_Habibullah_Hiroshi_Nandes.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setNotification({
      type: 'success',
      message: 'CV Profesional (.txt) berhasil diunduh! 📄'
    });
  };

  // Trigger PWA Native Installation
  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      setNotification({
        type: 'info',
        message: 'Aplikasi sudah terpasang atau gunakan opsi manual "Tambah ke Layar Utama" di browser Anda.'
      });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setNotification({
        type: 'success',
        message: 'Terima kasih telah memasang aplikasi portfolio PWA ini! 🎉'
      });
    }
  };

  // Copy shareable link
  const handleCopyShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setNotification({
      type: 'success',
      message: 'Link disalin ke clipboard! Bagikan profil ini. 🔗'
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Instant Classmate/Visitor Login
  const handleInstantClassroomLogin = () => {
    const defaultUser = {
      uid: 'semester-4-' + Date.now(),
      displayName: 'Teman Semester 4 🎓',
      email: 'semester4@unugha.ac.id',
      isGoogle: false
    };
    localStorage.setItem('portfolio_demo_user', JSON.stringify(defaultUser));
    setCurrentUser(defaultUser);
    setNotification({
      type: 'success',
      message: 'Selamat datang! Anda berhasil masuk secara instan sebagai Teman Semester 4.'
    });
    triggerLocalNotification('Halo Teman Semester 4! 🎓', 'Terima kasih telah berkunjung ke portofolio saya.');
    setIsLoginOpen(false);
  };

  // Google Sign-In via Firebase Auth
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setNotification({
          type: 'success',
          message: `Berhasil login sebagai ${result.user.displayName || 'User'}!`
        });
        setIsLoginOpen(false);
      }
    } catch (err: any) {
      console.error("Google Login failed:", err);
      setNotification({
        type: 'error',
        message: 'Gagal login Google (diblokir iframe/sandbox). Silakan gunakan opsi Login Pengunjung Demo!'
      });
    }
  };

  // Demo Sign-In (Local Admin bypass)
  const handleDemoLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = demoLoginName.trim();
    const password = loginPassword.trim();

    if (!name || !password) {
      setNotification({
        type: 'error',
        message: 'Username dan password wajib diisi!'
      });
      return;
    }

    if (password.length < 4) {
      setNotification({
        type: 'error',
        message: 'Password minimal harus 4 karakter demi keamanan!'
      });
      return;
    }

    const demoUser = {
      uid: 'demo-' + Date.now(),
      displayName: name,
      email: name.includes('@') ? name : `${name.toLowerCase()}@example.com`,
      isGoogle: false
    };
    localStorage.setItem('portfolio_demo_user', JSON.stringify(demoUser));
    setCurrentUser(demoUser);
    setNotification({
      type: 'success',
      message: `Berhasil masuk sebagai ${name}! Sesi interaktif Anda telah aktif.`
    });
    setDemoLoginName('');
    setLoginPassword('');
    setIsLoginOpen(false);
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('portfolio_demo_user');
    setCurrentUser(null);
    setNotification({
      type: 'info',
      message: 'Sesi login telah diakhiri.'
    });
  };

  // Edit article handler
  const handleStartEditArticle = (art: Article) => {
    setEditingArticleId(art.id);
    setEditArticleTitle(art.title);
    setEditArticleContent(art.content);
  };

  const handleSaveEditArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticleId) return;
    if (!editArticleTitle.trim() || !editArticleContent.trim()) {
      setNotification({
        type: 'error',
        message: 'Judul dan isi artikel tidak boleh kosong.'
      });
      return;
    }

    try {
      setIsSubmittingEditArticle(true);
      const success = await updateArticle(editingArticleId, editArticleTitle.trim(), editArticleContent.trim());
      if (success) {
        setNotification({
          type: 'success',
          message: 'Artikel berhasil diperbarui!'
        });
        setEditingArticleId(null);
        setEditArticleTitle('');
        setEditArticleContent('');
      } else {
        setNotification({
          type: 'error',
          message: 'Gagal memperbarui artikel.'
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Gagal memperbarui artikel.'
      });
    } finally {
      setIsSubmittingEditArticle(false);
    }
  };

  // Delete article handler
  const handleDeleteArticle = async (articleId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus artikel ini?')) {
      return;
    }

    try {
      const success = await deleteArticle(articleId);
      if (success) {
        setNotification({
          type: 'success',
          message: 'Artikel berhasil dihapus!'
        });
      } else {
        setNotification({
          type: 'error',
          message: 'Gagal menghapus artikel.'
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Gagal menghapus artikel.'
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#070914] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-8 relative overflow-x-hidden">
      
      {/* Visual Ambient Blur Lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-0 left-[-20%] w-[60%] h-[50%] rounded-full bg-indigo-900/15 blur-[140px]" />
        <div className="absolute top-[35%] right-[-20%] w-[60%] h-[50%] rounded-full bg-purple-900/10 blur-[140px]" />
        <div className="absolute bottom-[2%] left-[10%] w-[50%] h-[40%] rounded-full bg-emerald-950/15 blur-[120px]" />
      </div>

      {/* TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#070914]/80 border-b border-slate-900/80 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
              <img 
                src={profileAvatar} 
                alt="Habibi Profile" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <p className="font-bold text-white tracking-tight text-xs leading-tight">Habibi Habibullah H.N.</p>
              <p className="text-[9px] text-slate-400 font-mono">Informatics UNUGHA</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Realtime dynamic clock widget */}
            <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-950/60 border border-slate-900 rounded-lg text-[10px] font-mono text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              <span>{currentTime || 'Sistem Aktif'}</span>
            </div>

            {/* Connection state */}
            <div className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 border ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
            }`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            </div>

            {/* Auth State Button */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-1 border-l border-slate-900">
                <div className="hidden sm:flex flex-col items-end">
                  <p className="text-[10px] font-bold text-white leading-tight">{currentUser.displayName}</p>
                  <p className="text-[8px] text-slate-400 font-mono">Logged In</p>
                </div>
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt={currentUser.displayName} className="w-6 h-6 rounded-lg border border-slate-800" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                    {currentUser.displayName.charAt(0)}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  title="Log Out"
                  className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-900 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-[10px] font-bold text-white rounded-lg transition-all pl-2.5 cursor-pointer"
              >
                <LogIn className="w-3 h-3" />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* TOAST SYSTEM */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-4 left-4 z-50 max-w-sm mx-auto"
          >
            <div className={`p-4 rounded-xl shadow-2xl border flex items-start gap-3 backdrop-blur-xl ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
                : 'bg-slate-900/95 border-slate-800 text-slate-200'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : notification.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-xs leading-relaxed font-medium">{notification.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN LAYOUT (Single-View responsive layout structured perfectly like the mobile bio portfolio app) */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SIDEBAR COLUMN (Highly Structured & Aligned) */}
          <div className="md:col-span-5 space-y-6">
            
            {/* HERO HEADER BIOGRAPHY CARD */}
            <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-[#0e1124]/90 to-[#070914]/90 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-indigo-500/20">
              <div className="absolute top-0 right-0 p-3">
                <button 
                  onClick={handleCopyShare}
                  className="p-2 rounded-xl bg-slate-950/60 border border-slate-900 text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer shadow-sm"
                  title="Bagikan Profil"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                {/* Custom Glowing Profile Image Container */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full blur-md opacity-60 animate-pulse" />
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500/80 bg-[#0c1024] p-1 shadow-2xl relative z-10">
                    <img 
                      src={profileAvatar} 
                      alt="Habibi Habibullah" 
                      className="w-full h-full object-cover rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="absolute bottom-1 right-2 w-4.5 h-4.5 rounded-full bg-emerald-500 border-2 border-[#070914] z-20 flex items-center justify-center shadow-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  </span>
                </div>

                {/* Profile Info */}
                <div className="space-y-2 z-10">
                  <h1 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
                    Habibi Habibullah Hiroshi Nandes
                  </h1>
                  
                  <span className="inline-block text-[10px] font-bold font-mono tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full">
                    Mahasiswa Informatika S1
                  </span>
                  
                  <p className="text-xs text-slate-300 font-medium max-w-sm pt-1">
                    Universitas Nahdlatul Ulama Al-Ghozali Cilacap
                    <button
                      onClick={handleInstantClassroomLogin}
                      className="block mx-auto mt-1.5 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/30 px-2 py-0.5 rounded-md font-mono transition-all duration-300 cursor-pointer shadow-sm group active:scale-95"
                      title="Teman Semester 4? Klik disini untuk Login Instan tanpa Google!"
                    >
                      <span className="underline decoration-emerald-500/50 underline-offset-2">Semester 4 (Klik untuk Login Instan)</span>
                    </button>
                  </p>
                  
                  <div className="pt-2 border-t border-slate-900/60">
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed italic">
                      "Memiliki minat besar di bidang teknologi dan pemrograman web modern."
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* EXPLICIT SAVING & DOWNLOAD SUITE */}
            <section id="download-features" className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-[#0e1124]/60 to-[#070914]/60 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-indigo-500/20">
              <div className="flex items-center gap-2.5 border-b border-slate-900/80 pb-3 mb-4">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Pusat Download & Simpan</h3>
                  <p className="text-[9px] text-slate-400 mt-0.5">Simpan kontak, unduh resume, atau pasang PWA.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {/* 1. vCard (.VCF) */}
                <button
                  onClick={handleDownloadVCard}
                  className="p-3 bg-[#070914]/80 border border-slate-900 hover:border-emerald-500/30 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all duration-300 hover:bg-slate-900/40 group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-inner">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-200">Kontak</span>
                  <span className="text-[8px] text-slate-500 font-mono">.VCF Card</span>
                </button>

                {/* 2. Resume CV (.TXT) */}
                <button
                  onClick={handleDownloadCV}
                  className="p-3 bg-[#070914]/80 border border-slate-900 hover:border-indigo-500/30 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all duration-300 hover:bg-slate-900/40 group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform shadow-inner">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-200">Unduh CV</span>
                  <span className="text-[8px] text-slate-500 font-mono">Resume</span>
                </button>

                {/* 3. Install PWA */}
                <button
                  onClick={handleInstallPWA}
                  className="p-3 bg-[#070914]/80 border border-slate-900 hover:border-purple-500/30 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all duration-300 hover:bg-slate-900/40 group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform shadow-inner">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-200">Simpan App</span>
                  <span className="text-[8px] text-slate-500 font-mono">PWA</span>
                </button>
              </div>
            </section>

            {/* GOALS & FAVORITES GRID GROUP - Perfect visual balance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-6">
              
              {/* MY TOP 3 GOALS */}
              <section id="goals-section" className="rounded-2xl border border-slate-800/80 bg-[#0c0e1a]/40 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-indigo-500/10">
                <div className="flex items-center gap-2.5 border-b border-slate-900/80 pb-3 mb-4">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Compass className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">My Top 3 Goals</h2>
                </div>
                <div className="space-y-3">
                  {[
                    'Menjadi orang sukses',
                    'Pengin menjadi orang yang berguna bagi nusa dan bangsa',
                    'Mendapatkan nilai A dalam matakuliah web programming'
                  ].map((goal, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center font-mono text-[9px] font-bold text-indigo-400 shrink-0 mt-0.5 shadow-sm">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-slate-300 font-medium leading-relaxed pt-0.5">{goal}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* FAVORITE THINGS */}
              <section id="favorites-section" className="rounded-2xl border border-slate-800/80 bg-[#0c0e1a]/40 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-indigo-500/10">
                <div className="flex items-center gap-2.5 border-b border-slate-900/80 pb-3 mb-4">
                  <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                    <Heart className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Favorite Things</h2>
                </div>
                
                <div className="overflow-hidden border border-slate-900 rounded-xl shadow-inner">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-900 font-mono uppercase text-[9px] tracking-wider">
                        <th className="p-3 font-extrabold text-indigo-400">Sport</th>
                        <th className="p-3 font-extrabold text-indigo-400 border-l border-slate-900">Movie</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60 bg-slate-950/20">
                      {[
                        { sport: 'Badminton', movie: 'End Games' },
                        { sport: 'Rcl', movie: 'Amazing Spiderman 2' },
                        { sport: 'Futsal', movie: 'John Wick' },
                        { sport: 'Joging', movie: 'Oppenheimer' }
                      ].map((row, idx) => (
                        <tr key={idx} className="hover:bg-indigo-950/20 transition-all font-medium">
                          <td className="p-3 text-slate-200">{row.sport}</td>
                          <td className="p-3 text-slate-200 border-l border-slate-900">{row.movie}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* SISTEM PUSH NOTIFICATION */}
            <section id="push-notif-checker" className="rounded-2xl border border-slate-800/80 bg-[#0c0e1a]/40 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-indigo-500/10 text-center">
              <div className="flex items-center justify-center gap-2 pb-2.5 border-b border-slate-900/80 mb-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sistem Push Notification</h2>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto mb-4">
                Uji responsivitas PWA dengan mengirimkan notifikasi instan langsung ke perangkat sistem Anda.
              </p>
              <button
                onClick={handleRequestPushAndTrigger}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/15 active:scale-95 transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
              >
                <span>🔔 Cek Notifikasi Sistem</span>
              </button>
            </section>

          </div>

          {/* RIGHT COLUMN */}
          <div className="md:col-span-7 space-y-6">

            {/* ROW 1: ABOUT & HOBBIES GRID - Saves huge vertical space with perfect same-height stretch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
              
              {/* TENTANG SAYA SECTION */}
              <section id="about-section" className="rounded-2xl border border-slate-800/80 bg-[#0c0e1a]/40 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all duration-300 hover:border-indigo-500/10">
                <div>
                  <div className="flex items-center gap-2.5 border-b border-slate-900/80 pb-3 mb-4">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Tentang Saya</h2>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed text-justify">
                    Halo 👋, saya <strong>Habibi Habibullah</strong> mahasiswa Informatika semester 4 di Universitas Nahdlatul Ulama Al-Ghozali Cilacap. Saya memiliki ketertarikan di dunia teknologi, khususnya pada pengembangan web dan pemrograman. Saya sedang fokus belajar tentang HTML, CSS, JavaScript, dan backend development untuk membangun aplikasi web yang lebih modern dan interaktif. Saya juga sedang mengembangkan kemampuan dalam memahami logika pemrograman, database, dan sistem CRUD. Di luar dunia coding, saya juga memiliki beberapa hobi seperti olahraga (futsal dan sepak bola), serta aktivitas yang membantu menjaga keseimbangan hidup.
                  </p>
                </div>
              </section>

              {/* HOBI SAYA GRID */}
              <section id="hobbies-section" className="rounded-2xl border border-slate-800/80 bg-[#0c0e1a]/40 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all duration-300 hover:border-indigo-500/10">
                <div>
                  <div className="flex items-center gap-2.5 border-b border-slate-900/80 pb-3 mb-4">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Award className="w-4 h-4" />
                    </div>
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Hobi Saya</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { title: 'Main Game', desc: 'Strategi & Koordinasi' },
                      { title: 'Menonton YouTube', desc: 'Edukasi & Pemrograman' },
                      { title: 'Browsing Internet', desc: 'Mencari teknologi terbaru' },
                      { title: 'Bersantai', desc: 'Menjaga keseimbangan hidup' }
                    ].map((hobby, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950/40 border border-slate-900/80 flex flex-col justify-center hover:border-indigo-500/20 hover:bg-slate-950/70 transition-all duration-300">
                        <h4 className="text-xs font-bold text-white leading-tight flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block shrink-0 shadow-sm shadow-indigo-500/50" />
                          <span>{hobby.title}</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 ml-3.5 mt-0.5 leading-normal">{hobby.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            {/* ROW 2: ARTICLES AND FORM GRID - Side-by-side on large screens with identical heights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* BUAT ARTIKEL SECTION */}
              <section id="create-article" className="rounded-2xl border border-slate-800/80 bg-[#0c0e1a]/40 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-indigo-500/10">
                <div className="flex items-center gap-2.5 border-b border-slate-900/80 pb-3 mb-4">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Buat Artikel Baru</h2>
                </div>

                <form onSubmit={handlePostArticle} className="space-y-4">
                  <div>
                    <label htmlFor="art-title" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Judul Artikel</label>
                    <input
                      id="art-title"
                      type="text"
                      required
                      value={articleTitle}
                      onChange={(e) => setArticleTitle(e.target.value)}
                      placeholder="Tulis judul artikel..."
                      className="w-full bg-slate-950/80 border border-slate-900 focus:border-indigo-500/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all duration-300"
                    />
                  </div>

                  <div>
                    <label htmlFor="art-content" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Isi Artikel</label>
                    <textarea
                      id="art-content"
                      rows={4}
                      required
                      value={articleContent}
                      onChange={(e) => setArticleContent(e.target.value)}
                      placeholder="Tulis konten atau materi artikel disini..."
                      className="w-full bg-slate-950/80 border border-slate-900 focus:border-indigo-500/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all duration-300 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingArticle}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10"
                  >
                    {isSubmittingArticle ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mempublikasikan...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Terbitkan Artikel</span>
                      </>
                    )}
                  </button>
                </form>
              </section>

              {/* ARTIKEL SAYA */}
              <section id="articles-feed" className="rounded-2xl border border-slate-800/80 bg-[#0c0e1a]/40 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-indigo-500/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-900/80 pb-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Artikel Saya</span>
                        <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider animate-pulse">
                          Live
                        </span>
                      </h3>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">Auto-Sync</span>
                  </div>

                  <div className="space-y-3.5 max-h-[305px] overflow-y-auto pr-1.5 custom-scrollbar">
                    {isLoadingArticles ? (
                      <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2.5 bg-slate-950/40 border border-slate-900/80 rounded-xl">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        <p className="text-[10px] font-mono text-slate-400">Sinkronisasi artikel...</p>
                      </div>
                    ) : articles.length === 0 ? (
                      <div className="p-8 text-center bg-slate-950/40 border border-slate-900/80 rounded-xl space-y-2">
                        <p className="text-xs text-slate-300 font-bold">Belum ada artikel yang ditulis.</p>
                        <p className="text-[10px] text-slate-500 leading-normal">Gunakan formulir disamping untuk memposting artikel perdana Anda.</p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {articles.map((art) => (
                          editingArticleId === art.id ? (
                            <form onSubmit={handleSaveEditArticle} key={art.id} className="p-4 rounded-xl bg-indigo-950/10 border border-indigo-500/25 space-y-3">
                              <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                <span>Mengubah Artikel</span>
                              </p>
                              <div>
                                <input
                                  type="text"
                                  required
                                  value={editArticleTitle}
                                  onChange={(e) => setEditArticleTitle(e.target.value)}
                                  placeholder="Judul Artikel..."
                                  className="w-full bg-slate-950/80 border border-slate-900 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-colors font-semibold"
                                />
                              </div>
                              <div>
                                <textarea
                                  rows={3}
                                  required
                                  value={editArticleContent}
                                  onChange={(e) => setEditArticleContent(e.target.value)}
                                  placeholder="Isi Artikel..."
                                  className="w-full bg-slate-950/80 border border-slate-900 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-colors resize-none text-justify"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="submit"
                                  disabled={isSubmittingEditArticle}
                                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  {isSubmittingEditArticle ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  <span>Simpan</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingArticleId(null)}
                                  className="px-3 py-1.5 bg-slate-950/60 border border-slate-900 hover:bg-slate-900 text-slate-400 hover:text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div key={art.id} className="p-4 rounded-xl bg-[#070914]/40 border border-slate-900 hover:border-indigo-500/20 transition-all duration-300 group">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="space-y-1">
                                  <h4 className="text-xs font-bold text-white leading-snug group-hover:text-indigo-400 transition-colors">{art.title}</h4>
                                  <p className="text-[9px] font-mono text-slate-500">
                                    {new Date(art.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </p>
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => {
                                      if (!currentUser) {
                                        setNotification({
                                          type: 'info',
                                          message: 'Silakan Login terlebih dahulu untuk mengedit artikel!'
                                        });
                                        setIsLoginOpen(true);
                                        return;
                                      }
                                      handleStartEditArticle(art);
                                    }}
                                    title={currentUser ? "Edit Artikel" : "Login untuk mengedit"}
                                    className={`p-1.5 rounded-lg border text-xs transition-all flex items-center justify-center cursor-pointer ${
                                      currentUser 
                                        ? 'bg-[#070914]/80 border-slate-900 hover:border-indigo-500/30 text-indigo-400 hover:bg-slate-900' 
                                        : 'bg-[#070914]/20 border-transparent text-slate-600 hover:text-indigo-400'
                                    }`}
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!currentUser) {
                                        setNotification({
                                          type: 'info',
                                          message: 'Silakan Login terlebih dahulu untuk menghapus artikel!'
                                        });
                                        setIsLoginOpen(true);
                                        return;
                                      }
                                      handleDeleteArticle(art.id);
                                    }}
                                    title={currentUser ? "Hapus Artikel" : "Login untuk menghapus"}
                                    className={`p-1.5 rounded-lg border text-xs transition-all flex items-center justify-center cursor-pointer ${
                                      currentUser 
                                        ? 'bg-[#070914]/80 border-slate-900 hover:border-rose-500/30 text-rose-400 hover:bg-slate-900' 
                                        : 'bg-[#070914]/20 border-transparent text-slate-600 hover:text-rose-400'
                                    }`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed text-justify whitespace-pre-wrap mt-2.5 pt-2 border-t border-slate-900/40">{art.content}</p>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* ROW 3: GUESTBOOK & CONTACT GRID - Perfect alignment and height compression */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* REAL-TIME BUKU TAMU (GUESTBOOK) */}
              <section id="pwa-guestbook" className="rounded-2xl border border-slate-800/80 bg-[#0c0e1a]/40 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-indigo-500/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-900/80 pb-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Users className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Buku Tamu Interaktif</span>
                        <span className="text-[8px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                          Live
                        </span>
                      </h3>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">Firestore Sync</span>
                  </div>

                  <form onSubmit={handlePostGuestbook} className="space-y-4 mb-5">
                    <div>
                      <label htmlFor="guest-nama" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Nama Anda
                      </label>
                      <input
                        id="guest-nama"
                        type="text"
                        required
                        value={nama}
                        onChange={(e) => setNama(e.target.value)}
                        placeholder="Masukkan nama lengkap..."
                        className="w-full bg-slate-950/80 border border-slate-900 focus:border-indigo-500/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all duration-300"
                      />
                    </div>

                    <div>
                      <label htmlFor="guest-pesan" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Isi Pesan
                      </label>
                      <textarea
                        id="guest-pesan"
                        rows={2}
                        required
                        value={pesan}
                        onChange={(e) => setPesan(e.target.value)}
                        placeholder="Tulis pesan atau masukan Anda..."
                        className="w-full bg-slate-950/80 border border-slate-900 focus:border-indigo-500/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all duration-300 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengirim...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Kirim Pesan Buku Tamu</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* Guestbook entries list */}
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1.5 custom-scrollbar border-t border-slate-900/60 pt-4">
                    {isLoading ? (
                      <div className="p-6 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        <p className="text-[10px] font-mono text-slate-500">Sinkronisasi pesan...</p>
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-[11px] text-slate-500 text-center py-4 font-mono">Belum ada pesan di Buku Tamu.</p>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className="p-3 bg-slate-950/40 border border-slate-900/80 rounded-xl space-y-1 hover:border-indigo-500/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-indigo-400">{msg.nama}</p>
                            <span className="text-[8px] font-mono text-slate-500">
                              {new Date(msg.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-normal">{msg.pesan}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              {/* CONTACT US FORM WIDGET */}
              <section id="contact-us" className="rounded-2xl border border-slate-800/80 bg-[#0c0e1a]/40 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-indigo-500/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 border-b border-slate-900/80 pb-3 mb-4">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Let's Connect</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    Terima kasih telah mengunjungi website profil saya. Silakan hubungi saya untuk kolaborasi atau sekedar menyapa!
                  </p>

                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="contact-nama" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Nama Lengkap
                      </label>
                      <input
                        id="contact-nama"
                        type="text"
                        required
                        value={contactNama}
                        onChange={(e) => setContactNama(e.target.value)}
                        placeholder="Masukkan nama..."
                        className="w-full bg-slate-950/80 border border-slate-900 focus:border-indigo-500/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all duration-300"
                      />
                    </div>

                    <div>
                      <label htmlFor="contact-email" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Alamat Email
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="alamat@email.com"
                        className="w-full bg-slate-950/80 border border-slate-900 focus:border-indigo-500/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all duration-300"
                      />
                    </div>

                    <div>
                      <label htmlFor="contact-pesan" className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Pesan Anda
                      </label>
                      <textarea
                        id="contact-pesan"
                        rows={3}
                        required
                        value={contactPesan}
                        onChange={(e) => setContactPesan(e.target.value)}
                        placeholder="Tulis pesan..."
                        className="w-full bg-slate-950/80 border border-slate-900 focus:border-indigo-500/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all duration-300 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isContactSubmitting}
                      className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10"
                    >
                      {isContactSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengirim...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Kirim Pesan</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </section>
            </div>

          </div>

        </div>

        {/* LOKASI SAYA SECTION (Leaflet Live Map & Geo fallback) - Widened full-width section */}
        <section id="location-section" className="p-6 rounded-3xl bg-slate-900/30 border border-white/5 space-y-4 backdrop-blur-md w-full">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500 animate-bounce" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lokasi Saya</h2>
            </div>
            <span className="text-[10px] text-rose-400 font-mono font-bold bg-rose-500/5 px-2.5 py-0.5 rounded border border-rose-500/10">
              UNUGHA Cilacap
            </span>
          </div>

          {/* Fallback GPS Info */}
          {gpsError && (
            <div className="p-2.5 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <p className="font-semibold">{gpsError}</p>
            </div>
          )}

          {/* Leaflet Live Map container */}
          <div className="relative">
            <div 
              id="leaflet-map" 
              className="h-60 sm:h-72 md:h-80 w-full rounded-2xl border border-slate-900/80 overflow-hidden relative z-10"
              style={{ minHeight: '260px' }}
            />
            {/* Attribution footer overlay resembling standard leaflet maps */}
            <div className="absolute bottom-1 right-2 z-20 text-[8px] text-slate-400 font-mono bg-slate-950/80 px-2 py-0.5 rounded border border-slate-900">
              Leaflet | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:underline">OpenStreetMap</a> contributors
            </div>
          </div>
        </section>

        {/* BRUTALIST SUB-FOOTER LOGO */}
        <footer className="pt-4 pb-2 text-center border-t border-slate-900">
          <p className="text-[10px] text-slate-500 font-mono">
            Designed for Progressive Web Applications (PWA)
          </p>
          <p className="text-[11px] text-slate-400 font-bold tracking-tight mt-1">
            &copy; 2026 Habibi Habibullah Hiroshi Nandes
          </p>
        </footer>

      </main>

      {/* LOGIN DIALOG / OVERLAY MODAL */}
      <AnimatePresence>
        {isLoginOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoginOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl bg-[#0b0e1e] border border-white/5 p-6 shadow-2xl space-y-4 text-left overflow-hidden z-10"
            >
              {/* Decorative light effect */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent blur-[1px]" />
              
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-white font-sans">Sistem Login Portofolio</h3>
                <p className="text-[10px] text-slate-400 leading-normal">Silakan login untuk mengedit atau menghapus artikel.</p>
              </div>

              <div className="space-y-3 pt-2">
                {/* 1. Google Sign-In */}
                <button
                  onClick={handleGoogleLogin}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-900 flex items-center justify-center gap-2 text-xs font-bold text-slate-200 hover:text-white transition-all active:scale-[0.98] cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Login dengan Google</span>
                </button>

                {/* Instant Classmate Login Option */}
                <button
                  onClick={handleInstantClassroomLogin}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 flex items-center justify-center gap-2 text-xs font-bold text-white transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  <Users className="w-4 h-4 text-emerald-100" />
                  <span>Login Instan Semester 4 (Tanpa Google)</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-900/60"></div>
                  <span className="flex-shrink mx-3 text-[9px] text-slate-500 font-mono uppercase">Atau</span>
                  <div className="flex-grow border-t border-slate-900/60"></div>
                </div>

                {/* 2. Username & Password Login Form */}
                <form onSubmit={handleDemoLoginSubmit} className="space-y-3.5">
                  <div>
                    <label htmlFor="demo-name" className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Username / Email</label>
                    <input
                      id="demo-name"
                      type="text"
                      required
                      value={demoLoginName}
                      onChange={(e) => setDemoLoginName(e.target.value)}
                      placeholder="e.g. habibi atau admin"
                      className="w-full bg-slate-950/70 border border-slate-900 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="demo-password" className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                    <div className="relative">
                      <input
                        id="demo-password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Masukkan password..."
                        className="w-full bg-slate-950/70 border border-slate-900 focus:border-indigo-500 rounded-xl pl-3 pr-10 py-2 text-xs text-white focus:outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors p-1"
                        title={showPassword ? "Sembunyikan Password" : "Tampilkan Password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Masuk dengan Kredensial</span>
                  </button>
                </form>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setIsLoginOpen(false)}
                className="absolute top-2.5 right-2.5 p-1 rounded-full text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
