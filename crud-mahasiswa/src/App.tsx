import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
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
  Settings
} from 'lucide-react';
import { GuestbookMessage, ProjectItem, SkillItem, PortfolioConfig } from './types';
import { 
  subscribeToGuestbook, 
  addGuestbookMessage, 
  subscribeToLikes, 
  incrementProjectLike,
  subscribeToConfig,
  savePortfolioConfig
} from './lib/dbService';

// Import custom generated images
import profileAvatar from './assets/images/profile_avatar_1782629622587.jpg';
import projectAgritech from './assets/images/project_agritech_1782629638750.jpg';
import projectElearning from './assets/images/project_elearning_1782629654102.jpg';
import projectAkadcrud from './assets/images/project_akadcrud_1782629673745.jpg';


export default function App() {
  // Database states
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbSource, setDbSource] = useState<'firebase' | 'local'>('local');

  // Track liked projects to prevent double-upvoting
  const [likedProjects, setLikedProjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('portfolio_liked_projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Portfolio Configuration States (Dynamic GitHub & Live Deploy URLs)
  const [portfolioConfig, setPortfolioConfig] = useState<PortfolioConfig>({
    githubUrl: 'https://github.com/habibihabibullah/tugas-uas-profil-final-project',
    deployUrl: window.location.origin
  });
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [editGithubUrl, setEditGithubUrl] = useState('');
  const [editDeployUrl, setEditDeployUrl] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Network Status State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Form states (Guestbook)
  const [nama, setNama] = useState('');
  const [pesan, setPesan] = useState('');

  // Form states (Contact Form - Async Submission demo)
  const [contactNama, setContactNama] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPesan, setContactPesan] = useState('');
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);

  // Filter skills state
  const [skillFilter, setSkillFilter] = useState<'all' | 'frontend' | 'backend' | 'tools'>('all');

  // Notification / Alert message state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // PWA & Push Notification permission state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNotification({
        type: 'success',
        message: 'Koneksi kembali online! Mensinkronisasi database...'
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setNotification({
        type: 'info',
        message: 'Anda sedang offline. Aplikasi berjalan lancar dengan Cache PWA & Database Lokal!'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Request push notification permission
  const requestNotificationPermission = async () => {
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
          message: 'Notifikasi Push PWA berhasil diaktifkan! 🔔'
        });
        triggerLocalNotification(
          'Notifikasi Aktif! 🔔', 
          'Terima kasih telah mengaktifkan notifikasi di Portfolio Habibi.'
        );
      } else {
        setNotification({
          type: 'error',
          message: 'Izin notifikasi ditolak.'
        });
      }
    } catch (err) {
      console.error("Gagal meminta izin notifikasi:", err);
    }
  };

  // Helper to trigger standard or SW-based notification
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
      console.warn("Notification fallback triggered:", err);
      try {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      } catch (innerErr) {
        console.error("Failed to trigger notification:", innerErr);
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

  // Subscribe to real-time Guestbook & Project Likes on mount
  useEffect(() => {
    setIsLoading(true);
    
    // Subscribe to Guestbook
    const unsubscribeGuestbook = subscribeToGuestbook(
      (data, source) => {
        setMessages(data);
        setDbSource(source);
        setIsLoading(false);
      },
      (err) => {
        setIsLoading(false);
        console.warn("Database reading offline or slow:", err);
      }
    );

    // Subscribe to Likes
    const unsubscribeLikes = subscribeToLikes((likesMap) => {
      setLikes(likesMap);
    });

    // Subscribe to Config
    const unsubscribeConfig = subscribeToConfig((config) => {
      setPortfolioConfig(config);
      // Pre-fill edit fields
      setEditGithubUrl(config.githubUrl);
      setEditDeployUrl(config.deployUrl);
    });

    return () => {
      unsubscribeGuestbook();
      unsubscribeLikes();
      unsubscribeConfig();
    };
  }, []);

  // Handle posting a message to the Guestbook
  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim() || !pesan.trim()) {
      setNotification({
        type: 'error',
        message: 'Mohon isi nama dan pesan Anda.'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await addGuestbookMessage({
        nama: nama.trim(),
        pesan: pesan.trim()
      });

      // Clear fields
      setNama('');
      setPesan('');

      setNotification({
        type: 'success',
        message: result.source === 'firebase'
          ? 'Pesan berhasil diposting ke Cloud Database! (Synced) 🟢'
          : 'Pesan disimpan di Offline Cache Lokal! (Akan disinkronisasi saat online) 🟡'
      });

      // Trigger Service Worker Push Notification
      triggerLocalNotification(
        'Pesan Baru Terkirim! ✍️', 
        `Terima kasih ${nama.trim()} telah mengisi Buku Tamu kami.`
      );

    } catch (err: any) {
      setNotification({
        type: 'error',
        message: 'Gagal mengirim pesan: ' + (err.message || 'Error tidak diketahui')
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle saving the custom links config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGithubUrl.trim() || !editDeployUrl.trim()) {
      setNotification({
        type: 'error',
        message: 'Mohon isi kedua URL dengan benar.'
      });
      return;
    }

    try {
      setIsSavingConfig(true);
      await savePortfolioConfig({
        githubUrl: editGithubUrl.trim(),
        deployUrl: editDeployUrl.trim()
      });

      setNotification({
        type: 'success',
        message: 'Link Penilaian Tugas berhasil disimpan ke Cloud Firestore! 🟢'
      });

      setIsEditingConfig(false);

      triggerLocalNotification(
        'Link Portfolio Diperbarui! ⚙️',
        'Repository GitHub dan Link Terdeploy berhasil disinkronkan.'
      );
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: 'Gagal menyimpan: ' + (err.message || 'Error tidak diketahui')
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handle liking a project (upvotes)
  const handleLikeProject = async (projectId: string, projectTitle: string) => {
    if (likedProjects.includes(projectId)) {
      setNotification({
        type: 'info',
        message: `Anda sudah memberikan upvote untuk "${projectTitle}"! 😊`
      });
      return;
    }

    try {
      const newCount = await incrementProjectLike(projectId);
      
      const updatedLiked = [...likedProjects, projectId];
      setLikedProjects(updatedLiked);
      try {
        localStorage.setItem('portfolio_liked_projects', JSON.stringify(updatedLiked));
      } catch (err) {
        console.warn("localStorage quota or access error:", err);
      }
      
      setNotification({
        type: 'success',
        message: `Terima kasih atas upvote Anda untuk "${projectTitle}"! ❤️`
      });

      triggerLocalNotification(
        'Karya Diapresiasi! ❤️', 
        `Anda menyukai project: ${projectTitle}. Total upvote sekarang: ${newCount}!`
      );
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Contact Form Submit (Async JS demonstration)
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactNama.trim() || !contactEmail.trim() || !contactPesan.trim()) {
      setNotification({
        type: 'error',
        message: 'Mohon isi seluruh data kontak form.'
      });
      return;
    }

    try {
      setIsContactSubmitting(true);
      // Simulate real async API server processing with service worker trigger
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setNotification({
        type: 'success',
        message: `Terima kasih ${contactNama.trim()}! Pesan Anda berhasil dikirim secara async.`
      });

      triggerLocalNotification(
        'Pesan Hubungi Kami Terkirim 📬',
        `Pesan dari ${contactNama.trim()} sedang diproses oleh sistem.`
      );

      setContactNama('');
      setContactEmail('');
      setContactPesan('');
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Gagal mengirim formulir kontak.'
      });
    } finally {
      setIsContactSubmitting(false);
    }
  };

  // Static items for Portfolio
  const projects: ProjectItem[] = [
    {
      id: 'agritech',
      title: 'Smart Agri-Tech IoT Dashboard',
      description: 'Aplikasi PWA monitoring kelembaban tanah & sistem irigasi otomatis real-time berbasis IoT dan Cloud Firestore.',
      tags: ['React', 'Firebase', 'PWA', 'Tailwind CSS', 'IoT'],
      likes: 12,
      imageUrl: projectAgritech
    },
    {
      id: 'elearning',
      title: 'E-Learning & Interactive Quiz Platform',
      description: 'Sistem pembelajaran online interaktif dilengkapi dengan real-time progress tracker, push notifications, dan offline course modules.',
      tags: ['Vite', 'React', 'Firestore', 'Service Worker'],
      likes: 8,
      imageUrl: projectElearning
    },
    {
      id: 'akadcrud',
      title: 'Sistem Informasi CRUD Mahasiswa PWA',
      description: 'Sistem pengelolaan data mahasiswa terintegrasi dengan database Cloud Firestore, Service Worker Caching, dan Push Notification.',
      tags: ['React', 'Cloud Firestore', 'Tailwind', 'Push API'],
      likes: 15,
      imageUrl: projectAkadcrud
    }
  ];

  const skills: SkillItem[] = [
    { name: 'React / Next.js', level: 90, category: 'frontend' },
    { name: 'Tailwind CSS / Framer Motion', level: 92, category: 'frontend' },
    { name: 'Node.js / Express', level: 85, category: 'backend' },
    { name: 'Cloud Firestore / Firebase', level: 88, category: 'backend' },
    { name: 'Git & GitHub Workflows', level: 86, category: 'tools' },
    { name: 'PWA / Service Workers', level: 85, category: 'tools' }
  ];

  const filteredSkills = skills.filter(
    (s) => skillFilter === 'all' || s.category === skillFilter
  );

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Dynamic Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#070b13]/85 border-b border-slate-900 transition-colors">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center font-bold text-white shadow-lg">
              HH
            </div>
            <div>
              <p className="font-bold text-white tracking-tight leading-tight">Habibi Habibullah</p>
              <p className="text-[10px] text-slate-400 font-mono">Web Developer & PWA Specialist</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Indicator */}
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Online (Synced)</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                  <span>Offline Mode</span>
                </>
              )}
            </div>

            {/* PWA Badge */}
            <span className="hidden sm:inline-block px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md text-xs font-bold uppercase tracking-wider">
              PWA Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-16">

        {/* Floating Custom Notification Banner */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 right-4 z-50 max-w-md"
            >
              <div className={`p-4 rounded-xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
                notification.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
                  : notification.type === 'error'
                  ? 'bg-rose-950/90 border-rose-500/30 text-rose-300'
                  : 'bg-slate-900/95 border-slate-800 text-slate-300'
              }`}>
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : notification.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-xs font-semibold">{notification.message}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HERO SECTION */}
        <section id="hero" className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-4">
          <div className="md:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" />
              <span>Full-Stack & PWA Portfolio</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Hai, Saya <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">Habibi Habibullah</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              Saya adalah pengembang aplikasi web interaktif yang berfokus pada teknologi modern <span className="font-semibold text-white">React (Vite)</span>, integrasi database real-time <span className="font-semibold text-white">Cloud Firestore</span>, dan implementasi <span className="font-semibold text-white">Progressive Web Apps (PWA)</span> dengan integrasi Service Worker yang handal serta Push Notification.
            </p>

            {/* Quick Stats & Controls panel */}
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sumber Sinkronisasi Database</p>
                <p className="text-xs font-mono font-bold mt-1 flex items-center gap-1.5 text-white">
                  {dbSource === 'firebase' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Cloud Firestore 🟢
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                      Local Storage Cache 🟡
                    </>
                  )}
                </p>
              </div>

              {/* Push Notification permission activator */}
              <button
                onClick={requestNotificationPermission}
                className={`w-full px-3 py-2 border rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all duration-300 cursor-pointer ${
                  notificationPermission === 'granted'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/60'
                    : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700 animate-pulse'
                }`}
              >
                <span>
                  {notificationPermission === 'granted' 
                    ? '🔔 Notifikasi Aktif' 
                    : '🔔 Aktifkan Push Notif'}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <a 
                href="#guestbook" 
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all text-sm flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Isi Buku Tamu</span>
              </a>
              <button 
                onClick={() => {
                  triggerLocalNotification('CV Diunduh! 📄', 'Mengunduh CV Habibi Habibullah secara virtual.');
                  setNotification({
                    type: 'success',
                    message: 'CV virtual Anda berhasil disiapkan!'
                  });
                }}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl font-bold transition-all text-sm flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Unduh CV</span>
              </button>
            </div>
          </div>

          {/* Decorative Profile Card Grid */}
          <div className="md:col-span-5 relative flex justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-3xl -z-10 rounded-full" />
            
            <div className="w-full max-w-sm rounded-3xl bg-slate-900/60 border border-slate-800/80 p-6 shadow-xl space-y-6 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-indigo-500/30 bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center font-extrabold text-xl text-white shadow-lg shrink-0 relative">
                  <img 
                    src={profileAvatar} 
                    alt="Habibi Habibullah" 
                    className="absolute inset-0 w-full h-full object-cover z-10"
                    referrerPolicy="no-referrer"
                  />
                  <span className="z-0">HH</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Habibi Habibullah</h3>
                  <p className="text-xs text-indigo-400 font-mono">Backend & PWA Specialist</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono">habibihabibullah136@gmail.com</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/40 rounded-xl border border-slate-900">
                  <span className="text-slate-400 flex items-center gap-1.5"><Code className="w-3.5 h-3.5 text-indigo-400" /> Framework</span>
                  <span className="font-bold text-white">React & Vite</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/40 rounded-xl border border-slate-900">
                  <span className="text-slate-400 flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-emerald-400" /> Database</span>
                  <span className="font-bold text-white">Cloud Firestore</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/40 rounded-xl border border-slate-900">
                  <span className="text-slate-400 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-pink-400" /> Offline Sync</span>
                  <span className="font-bold text-white">Service Worker PWA</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SUBMISSION LINKS CONTROL CARD */}
        <section id="links-submission" className="p-6 rounded-3xl bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-indigo-950/20 border border-slate-800/80 shadow-2xl space-y-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                <Code className="w-3.5 h-3.5" />
                <span>Repository & URL Deploy</span>
              </div>
              <h2 className="text-xl font-bold text-white">Repository GitHub & URL Deploy</h2>
              <p className="text-xs text-slate-400">Gunakan panel interaktif ini untuk menyimpan, menampilkan, dan menyalin link repository GitHub serta URL deploy yang tersinkronisasi di Firestore.</p>
            </div>
            
            <button
              id="btn-edit-penilaian"
              onClick={() => setIsEditingConfig(!isEditingConfig)}
              className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/35 active:scale-95 text-xs font-bold rounded-xl border border-indigo-500/40 text-indigo-300 transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-indigo-500/10"
            >
              <Settings className="w-4 h-4 animate-[spin_8s_linear_infinite]" />
              <span>{isEditingConfig ? 'Batal' : 'Repository GitHub & URL Deploy'}</span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {isEditingConfig ? (
              <motion.form
                key="edit-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSaveConfig}
                className="space-y-4 max-w-2xl bg-slate-950/40 p-4 rounded-2xl border border-slate-900"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Link Repository GitHub
                    </label>
                    <input
                      type="url"
                      required
                      value={editGithubUrl}
                      onChange={(e) => setEditGithubUrl(e.target.value)}
                      placeholder="https://github.com/username/repo..."
                      className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Link Website Terdeploy
                    </label>
                    <input
                      type="url"
                      required
                      value={editDeployUrl}
                      onChange={(e) => setEditDeployUrl(e.target.value)}
                      placeholder="https://ais-dev-...run.app..."
                      className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 text-xs font-bold rounded-xl text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {isSavingConfig ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan ke Firestore...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-3.5 h-3.5" />
                        <span>Simpan ke Cloud Firestore</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="display-links"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {/* GitHub Repo Card */}
                <div className="p-4 rounded-2xl bg-slate-950/30 border border-slate-900 flex flex-col justify-between gap-4 hover:border-slate-800 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                      <Github className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Repository GitHub Tugas</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 break-all">
                        {portfolioConfig.githubUrl}
                      </p>
                      {portfolioConfig.githubUrl.includes('habibi-portfolio-pwa') && (
                        <p className="text-[9px] text-amber-400/90 mt-1.5 leading-snug">
                          ⚠️ Ini adalah link placeholder bawaan. Klik tombol <span className="font-semibold text-amber-300">"Edit Link Penilaian"</span> di atas untuk menggantinya dengan link repository GitHub asli Anda.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={portfolioConfig.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Kunjungi Repo</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(portfolioConfig.githubUrl);
                        setNotification({
                          type: 'success',
                          message: 'Link GitHub berhasil disalin ke papan klip! 📋'
                        });
                        triggerLocalNotification('Disalin! 📋', 'Link repository GitHub berhasil disalin.');
                      }}
                      className="px-3.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/15 hover:border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="Salin Link"
                    >
                      Salin Link
                    </button>
                  </div>
                </div>

                {/* Live Deploy Card */}
                <div className="p-4 rounded-2xl bg-slate-950/30 border border-slate-900 flex flex-col justify-between gap-4 hover:border-slate-800 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                      <ExternalLink className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Link Live Terdeploy</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 break-all">
                        {portfolioConfig.deployUrl}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={portfolioConfig.deployUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/15 text-emerald-400 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Website</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(portfolioConfig.deployUrl);
                        setNotification({
                          type: 'success',
                          message: 'Link URL terdeploy berhasil disalin ke papan klip! 📋'
                        });
                        triggerLocalNotification('Disalin! 📋', 'Link URL website yang terdeploy berhasil disalin.');
                      }}
                      className="px-3.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/15 hover:border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="Salin Link"
                    >
                      Salin Link
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* SKILLS SECTION */}
        <section id="skills" className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-4">
            <div>
              <h2 className="text-2xl font-extrabold text-white">Keahlian & Teknologi</h2>
              <p className="text-sm text-slate-400">Teknologi yang saya gunakan untuk membangun sistem.</p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'frontend', 'backend', 'tools'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSkillFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
                    skillFilter === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  {cat === 'all' ? 'Semua' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredSkills.map((skill, index) => (
                <motion.div
                  key={skill.name}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/60 flex flex-col justify-between hover:border-slate-700/80 transition-all group"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">
                      {skill.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-400/5 px-2 py-0.5 rounded border border-indigo-500/10 capitalize">
                      {skill.category}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>Proficiency</span>
                      <span>{skill.level}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${skill.level}%` }}
                        transition={{ duration: 0.8, delay: index * 0.05 }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* PROJECTS SHOWCASE */}
        <section id="projects" className="space-y-6">
          <div className="border-b border-slate-900 pb-4">
            <h2 className="text-2xl font-extrabold text-white">Project Unggulan & Showcase</h2>
            <p className="text-sm text-slate-400">Tekan tombol hati (Like) untuk menguji integrasi basis data real-time Firestore secara langsung.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div 
                key={project.id}
                className="rounded-3xl bg-slate-900/20 border border-slate-800/80 overflow-hidden flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-xl group"
              >
                <div>
                  <div className="h-44 overflow-hidden relative border-b border-slate-900/60">
                    <img 
                      src={project.imageUrl} 
                      alt={project.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                    
                    <div className="absolute bottom-3 right-3 text-[10px] font-mono text-slate-300 bg-slate-950/80 backdrop-blur-md border border-slate-800/80 px-2 py-0.5 rounded font-semibold tracking-wider uppercase">
                      {project.id === 'agritech' ? 'IoT Platform' : project.id === 'elearning' ? 'LMS Webapp' : 'CRUD System'}
                    </div>

                    {/* Floating Tech Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                      {project.tags.slice(0, 2).map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800/50 backdrop-blur-md text-[9px] font-bold text-indigo-300 tracking-wide uppercase">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors leading-snug">
                      {project.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {project.description}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0 border-t border-slate-900/60 mt-auto flex items-center justify-between">
                  {/* Real-time Likes Button */}
                  <button
                    onClick={() => handleLikeProject(project.id, project.title)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all font-bold cursor-pointer ${
                      likedProjects.includes(project.id)
                        ? "text-white bg-rose-600/90 border-rose-500/80 shadow-md shadow-rose-600/20"
                        : "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/10 hover:border-rose-500/20 active:scale-90"
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${likedProjects.includes(project.id) ? 'fill-white text-white' : 'fill-rose-400 text-rose-400'}`} />
                    <span>
                      {likedProjects.includes(project.id) ? 'Upvoted' : 'Upvote'} ({likes[project.id] !== undefined ? likes[project.id] : project.likes})
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      triggerLocalNotification('Membuka Project! 🚀', `Mengarahkan ke live demo project "${project.title}".`);
                      setNotification({
                        type: 'info',
                        message: `Membuka simulasi live demo untuk "${project.title}"`
                      });
                    }}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Live Demo</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM GRID: GUESTBOOK & CONTACT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">

          {/* REAL-TIME GUESTBOOK / BUKU TAMU (7 columns) */}
          <section id="guestbook" className="lg:col-span-7 space-y-6">
            <div className="border-b border-slate-900 pb-4">
              <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                <span>Buku Tamu Interaktif</span>
                <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  Real-Time
                </span>
              </h2>
              <p className="text-sm text-slate-400">Tinggalkan pesan dukungan, sapaan, atau masukan yang disinkronkan secara real-time melalui Firestore.</p>
            </div>

            {/* Guestbook Form */}
            <form onSubmit={handlePostMessage} className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800/60 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="nama" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nama Anda
                  </label>
                  <input
                    id="nama"
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Masukkan nama lengkap..."
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="pesan" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Isi Pesan
                  </label>
                  <textarea
                    id="pesan"
                    rows={3}
                    value={pesan}
                    onChange={(e) => setPesan(e.target.value)}
                    placeholder="Tulis pesan atau masukan Anda..."
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:bg-indigo-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirimkan...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim Pesan Buku Tamu</span>
                  </>
                )}
              </button>
            </form>

            {/* Guestbook Entries Stream */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-xs font-mono">Menghubungkan ke Cloud Firestore...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-slate-900 bg-slate-950/30 text-slate-400">
                  <p className="text-xs">Buku tamu masih kosong. Jadilah yang pertama meninggalkan pesan!</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 rounded-xl bg-slate-950/50 border border-slate-900 flex flex-col gap-1 hover:border-slate-800/80 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-400" />
                          {msg.nama}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {new Date(msg.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed pl-5 whitespace-pre-wrap">
                        {msg.pesan}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>

          {/* CONTACT FORM (5 columns) */}
          <section id="contact" className="lg:col-span-5 space-y-6">
            <div className="border-b border-slate-900 pb-4">
              <h2 className="text-2xl font-extrabold text-white">Hubungi Saya</h2>
              <p className="text-sm text-slate-400">Kirimkan penawaran kerja sama atau project Anda.</p>
            </div>

            <form onSubmit={handleContactSubmit} className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800/60 space-y-4">
              <div className="space-y-3">
                <div>
                  <label htmlFor="contactName" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nama
                  </label>
                  <input
                    id="contactName"
                    type="text"
                    required
                    value={contactNama}
                    onChange={(e) => setContactNama(e.target.value)}
                    placeholder="Nama Lengkap..."
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="contactEmail" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    id="contactEmail"
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contoh@domain.com..."
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="contactMsg" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Isi Pesan / Kolaborasi
                  </label>
                  <textarea
                    id="contactMsg"
                    rows={3}
                    required
                    value={contactPesan}
                    onChange={(e) => setContactPesan(e.target.value)}
                    placeholder="Tuliskan tawaran atau rincian project Anda..."
                    className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isContactSubmitting}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:bg-indigo-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isContactSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sedang mengirimkan...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Kirim Penawaran</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Contact Info */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Kontak Langsung</h4>
              <div className="space-y-2 text-xs text-slate-400">
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  <span>habibihabibullah136@gmail.com</span>
                </p>
                <p className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>085741027488</span>
                </p>
              </div>
            </div>
          </section>

        </div>

      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-900 bg-slate-950/40 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <p className="font-bold text-slate-400">Habibi Habibullah Portfolio</p>
            <p className="mt-0.5">© 2026. All rights reserved. Full-Stack React PWA.</p>
          </div>
          <div className="flex gap-4">
            <a 
              href={portfolioConfig.githubUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
