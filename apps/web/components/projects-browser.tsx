"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ProjectCard } from "@repo/ui/components/project-card";
import { listProjects } from "@/lib/api";
import { useChatImage } from "@/hooks/use-chat-image";

const PROJECTS_PAGE_SIZE = 15;

type ProjectTab = "pinned" | "projects";

const tabs: { id: ProjectTab; label: string }[] = [
  { id: "pinned", label: "Pinned projects" },
  { id: "projects", label: "My projects" },
];

interface Project {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  initialPrompt: string;
  thumbnailKey?: string | null;
  isPinned: boolean;
}

interface ProjectPageState {
  projects: Project[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
}

const createPageState = (): ProjectPageState => ({
  projects: [],
  nextCursor: null,
  hasMore: true,
  isLoading: true,
  isLoadingMore: false,
});

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

const initialForProject = (initialPrompt: string): string => {
  return initialPrompt.trim().charAt(0).toUpperCase() || "?";
};

function ProjectCardItem({
  project,
  index,
}: {
  project: Project;
  index: number;
}) {
  const router = useRouter();
  const thumbnailUrl = useChatImage(
    project.id,
    project.thumbnailKey ?? undefined,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.08 }}
    >
      <ProjectCard
        name={project.title ?? "Untitled project"}
        date={formatDate(project.createdAt)}
        initial={initialForProject(project.initialPrompt)}
        imageUrl={thumbnailUrl}
        onClick={() => router.push(`/project/${project.id}`)}
      />
    </motion.div>
  );
}

export function ProjectsBrowser() {
  const [activeTab, setActiveTab] = useState<ProjectTab>("projects");
  const [pages, setPages] = useState<Record<ProjectTab, ProjectPageState>>({
    pinned: createPageState(),
    projects: createPageState(),
  });

  const activePage = pages[activeTab];

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listProjects({ limit: PROJECTS_PAGE_SIZE }),
      listProjects({ limit: PROJECTS_PAGE_SIZE, pinned: true }),
    ])
      .then(([allProjects, pinnedProjects]) => {
        if (cancelled) return;
        setPages({
          projects: {
            projects: allProjects.projects,
            nextCursor: allProjects.nextCursor,
            hasMore: allProjects.hasMore,
            isLoading: false,
            isLoadingMore: false,
          },
          pinned: {
            projects: pinnedProjects.projects,
            nextCursor: pinnedProjects.nextCursor,
            hasMore: pinnedProjects.hasMore,
            isLoading: false,
            isLoadingMore: false,
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPages({
          pinned: { ...createPageState(), hasMore: false, isLoading: false },
          projects: { ...createPageState(), hasMore: false, isLoading: false },
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = async () => {
    const page = pages[activeTab];
    if (!page.hasMore || page.isLoading || page.isLoadingMore) return;

    setPages((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], isLoadingMore: true },
    }));

    try {
      const data = await listProjects({
        cursor: page.nextCursor,
        limit: PROJECTS_PAGE_SIZE,
        pinned: activeTab === "pinned" ? true : undefined,
      });
      setPages((prev) => ({
        ...prev,
        [activeTab]: {
          projects: [...prev[activeTab].projects, ...data.projects],
          nextCursor: data.nextCursor,
          hasMore: data.hasMore,
          isLoading: false,
          isLoadingMore: false,
        },
      }));
    } catch {
      setPages((prev) => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], isLoadingMore: false },
      }));
    }
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
          <button
            onClick={() => setActiveTab("projects")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Browse all
            <ArrowRight size={14} />
          </button>
        </div>

        {activePage.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : activePage.projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>
              {activeTab === "pinned"
                ? "No pinned projects yet."
                : "No projects yet. Create one above!"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {activePage.projects.map((project, i) => (
                <ProjectCardItem key={project.id} project={project} index={i} />
              ))}
            </div>
            {activePage.hasMore && (
              <div className="flex justify-center pt-6">
                <button
                  onClick={loadMore}
                  disabled={activePage.isLoadingMore}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-60 transition-colors"
                >
                  {activePage.isLoadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
