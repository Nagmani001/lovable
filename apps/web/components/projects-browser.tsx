"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ProjectCard } from "@repo/ui/components/project-card";
import { listProjects } from "@/lib/api";

const tabs = [
  { id: "recent", label: "Recently viewed" },
  { id: "projects", label: "My projects" },
  { id: "templates", label: "Templates" },
];

interface Project {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export function ProjectsBrowser() {
  const [activeTab, setActiveTab] = useState("recent");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    listProjects()
      .then(({ projects }) => setProjects(projects))
      .catch(() => setProjects([]))
      .finally(() => setIsLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const emojiForProject = (title: string): string => {
    const emojis = ["🚀", "🎨", "📦", "🛒", "📝", "📊", "🔧", "💡"];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = (hash << 5) - hash + title.charCodeAt(i);
    }
    return emojis[Math.abs(hash) % emojis.length] ?? "🚀";
  };

  return (
    <div className="relative z-10 bg-background border-t border-border px-6 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            Browse all
            <ArrowRight size={14} />
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No projects yet. Create one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
              >
                <ProjectCard
                  name={project.title}
                  date={formatDate(project.createdAt)}
                  emoji={emojiForProject(project.title)}
                  onClick={() => router.push(`/project/${project.id}`)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
