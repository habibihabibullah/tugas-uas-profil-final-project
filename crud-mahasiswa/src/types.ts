export interface GuestbookMessage {
  id?: string;
  nama: string;
  pesan: string;
  createdAt: string; // ISO string
}

export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  likes: number;
  imageUrl: string;
}

export interface SkillItem {
  name: string;
  level: number; // 0-100
  category: 'frontend' | 'backend' | 'tools' | 'other';
}

export interface PortfolioConfig {
  githubUrl: string;
  deployUrl: string;
}
