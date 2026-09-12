"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { listProjects, deleteProject, updateProject } from "@/lib/api";
import { toast } from "@repo/ui/lib/toast";

interface SidebarProject {
  id: string;
  title: string | null;
  initialPrompt: string;
  isPinned: boolean;
  createdAt: string;
}

const EXPANDED_WIDTH = 264;
const COLLAPSED_WIDTH = 44;

function projectName(project: SidebarProject): string {
  return project.title?.trim() || "Untitled project";
}

export function ProjectSidebar({
  activeProjectId,
}: {
  activeProjectId: string;
}) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [renameTarget, setRenameTarget] = useState<SidebarProject | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SidebarProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then(({ projects }) => {
        if (!cancelled) setProjects(projects);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Refresh when switching projects so renames/pins are reflected.
  }, [activeProjectId]);

  const navigate = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };

  const openRename = (project: SidebarProject) => {
    setRenameTarget(project);
    setRenameValue(projectName(project));
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title || title === projectName(renameTarget)) {
      setRenameTarget(null);
      return;
    }

    setIsRenaming(true);
    try {
      await updateProject(renameTarget.id, { title });
      setProjects((prev) =>
        prev.map((p) => (p.id === renameTarget.id ? { ...p, title } : p)),
      );
      setRenameTarget(null);
    } catch {
      toast.error("Failed to rename project");
    } finally {
      setIsRenaming(false);
    }
  };

  const togglePin = async (project: SidebarProject) => {
    try {
      await updateProject(project.id, { isPinned: !project.isPinned });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id ? { ...p, isPinned: !p.isPinned } : p,
        ),
      );
    } catch {
      toast.error("Failed to update project");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await deleteProject(deleteTarget.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      if (deleteTarget.id === activeProjectId) {
        router.push("/projects");
      }
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  };

  const pinned = projects.filter((p) => p.isPinned);
  const others = projects.filter((p) => !p.isPinned);

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="h-full border-r border-border bg-background flex flex-col overflow-hidden flex-shrink-0"
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1 py-2">
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
            <button
              onClick={() => router.push("/projects")}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="New project"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-3 h-11 border-b border-border flex-shrink-0">
              <span className="text-sm font-semibold text-foreground">
                Projects
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => router.push("/projects")}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="New project"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="p-2 space-y-4">
                  {pinned.length > 0 && (
                    <ProjectGroup
                      label="Pinned"
                      projects={pinned}
                      activeProjectId={activeProjectId}
                      onSelect={navigate}
                      onRename={openRename}
                      onTogglePin={togglePin}
                      onDelete={(p) => setDeleteTarget(p)}
                    />
                  )}
                  {others.length > 0 && (
                    <ProjectGroup
                      label="Projects"
                      projects={others}
                      activeProjectId={activeProjectId}
                      onSelect={navigate}
                      onRename={openRename}
                      onTogglePin={togglePin}
                      onDelete={(p) => setDeleteTarget(p)}
                    />
                  )}
                  {projects.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                      No projects yet
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </motion.aside>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              Give your project a clear name so you can find it easily.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
            className="space-y-4"
          >
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRenaming || !renameValue.trim()}
              >
                {isRenaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget ? projectName(deleteTarget) : ""}&quot; will
              be permanently deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectGroup({
  label,
  projects,
  activeProjectId,
  onSelect,
  onRename,
  onTogglePin,
  onDelete,
}: {
  label: string;
  projects: SidebarProject[];
  activeProjectId: string;
  onSelect: (id: string) => void;
  onRename: (project: SidebarProject) => void;
  onTogglePin: (project: SidebarProject) => void;
  onDelete: (project: SidebarProject) => void;
}) {
  return (
    <div>
      <p className="px-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <div className="space-y-0.5">
        {projects.map((project) => {
          const active = project.id === activeProjectId;
          return (
            <div
              key={project.id}
              className={`group flex items-center gap-1 rounded-md pr-1 cursor-pointer transition-colors ${
                active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              }`}
              onClick={() => onSelect(project.id)}
            >
              {project.isPinned && (
                <Pin className="h-3.5 w-3.5 ml-2 text-muted-foreground flex-shrink-0" />
              )}
              <span className="flex-1 text-sm truncate py-1.5 pl-1">
                {projectName(project)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={`p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-foreground hover:bg-muted transition-opacity ${
                      active ? "opacity-100" : ""
                    }`}
                    title="Project options"
                    aria-label="Project options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem onClick={() => onRename(project)}>
                    <Pencil className="size-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onTogglePin(project)}>
                    {project.isPinned ? (
                      <PinOff className="size-4" />
                    ) : (
                      <Pin className="size-4" />
                    )}
                    {project.isPinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(project)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </div>
  );
}
