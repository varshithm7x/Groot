import React from "react";
import { BacklinksPanel } from "../panels/BacklinksPanel";
import { OutgoingLinksPanel } from "../panels/OutgoingLinksPanel";
import { OutlinePane } from "../panels/OutlinePane";
import { UnlinkedMentionsPanel } from "../panels/UnlinkedMentionsPanel";
import { ForgePanel } from "../panels/ForgePanel";
import { resourceContentPath } from "../../utils/resource-paths";
import { getAPI } from "../../utils/api";
import { getPluginScopeClass } from "../../lib/pluginStyles";
import type { Theme, FileEntry } from "../../types";

const AIPage = React.lazy(() => import("../ai/AIPage").then(m => ({ default: m.AIPage })));

export type RightSidebarTabType = "backlinks" | "outgoing" | "outline" | "ai" | "forge" | string;

interface PluginViewHostProps {
  view: { containerEl: HTMLElement; pluginId?: string };
}

function PluginViewHost({ view }: PluginViewHostProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !view) return;

    // Clear previous content
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Apply plugin CSS scope class
    if (view.pluginId) {
      const scopeClass = getPluginScopeClass(view.pluginId);
      view.containerEl.classList.add(scopeClass);
    }

    // Mount the plugin's DOM element
    container.appendChild(view.containerEl);

    // Notify the view of resize so canvas-based plugins initialize properly
    const notifyResize = () => {
      (view as any).onResize?.();
    };
    const resizeTimer = setTimeout(notifyResize, 50);

    return () => {
      clearTimeout(resizeTimer);
      // Don't destroy the element on unmount — just detach it
      if (view.containerEl.parentNode === container) {
        container.removeChild(view.containerEl);
      }
    };
  }, [view]);

  return <div ref={containerRef} className="h-full w-full overflow-auto" />;
}

interface RightSidebarProps {
  selectionContext?: { text: string; path: string } | null;
  onClearSelectionContext?: () => void;
  activeTab: RightSidebarTabType;
  currentContent: string;
  allNoteNames: { name: string; path: string }[];
  handleLinkClick: (name: string, heading?: string) => void;
  backlinks: string[];
  openFile: (path: string, mode?: any) => void | Promise<void>;
  activeFilePath: string | null;
  activeFileName: string;
  showUnlinkedMentions?: boolean;
  width: number;
  vaultPath?: string | null;
  theme?: Theme;
  fileTree?: FileEntry[];
  onClose?: () => void;
  onHideOutline?: () => void;
  readNoteContent?: (path: string) => Promise<string>;
  rightPluginViews?: Array<{
    viewType: string;
    displayText: string;
    icon: string;
    containerEl: HTMLElement;
    side: "left" | "right" | "main";
    pluginId?: string;
  }>;
  onClosePluginView?: (viewType: string) => void;
}

export function RightSidebar({
  selectionContext,
  onClearSelectionContext,
  activeTab,
  currentContent,
  allNoteNames,
  handleLinkClick,
  backlinks,
  openFile,
  activeFilePath,
  activeFileName,
  showUnlinkedMentions = true,
  width,
  vaultPath,
  theme,
  fileTree = [],
  onClose,
  onHideOutline,
  readNoteContent,
  rightPluginViews = [],
  onClosePluginView,
}: RightSidebarProps) {
  const isPdf = /\.pdf$/i.test(activeFilePath || "");
  const companion = isPdf && activeFilePath ? resourceContentPath(activeFilePath) : null;
  const sourcePath = isPdf ? allNoteNames.find(note => note.path === companion)?.path || null : activeFilePath;
  const reader = React.useRef(readNoteContent);
  reader.current = readNoteContent;
  const [pdfText, setPdfText] = React.useState<{ path: string; vault: string; content: string } | null>(null);
  React.useEffect(() => {
    setPdfText(null);
    if (!isPdf || !sourcePath || !vaultPath) return;
    let cancelled = false;
    void (reader.current ? reader.current(sourcePath) : getAPI().readFile(sourcePath))
      .then(content => { if (!cancelled) setPdfText({ path: sourcePath, vault: vaultPath, content }); })
      .catch(() => { if (!cancelled) setPdfText(null); });
    return () => { cancelled = true; };
  }, [isPdf, sourcePath, vaultPath]);
  const pdfReady = pdfText?.path === sourcePath && pdfText?.vault === vaultPath;
  const forgePath = isPdf && !pdfReady ? null : sourcePath;
  const sourceContent = isPdf ? pdfReady ? pdfText.content : "" : currentContent;
  const pdfSources = React.useMemo(() => {
    const sources = new Map<string, string>();
    function collect(entries: FileEntry[]) {
      for (const entry of entries) {
        if (entry.isDirectory) collect(entry.children || []);
        else if (/\.pdf$/i.test(entry.path)) sources.set(resourceContentPath(entry.path), entry.path);
      }
    }
    collect(fileTree);
    if (isPdf && activeFilePath && companion) sources.set(companion, activeFilePath);
    return sources;
  }, [fileTree, isPdf, activeFilePath, companion]);
  const sourceNotes = allNoteNames.map(note => {
    const original = pdfSources.get(note.path);
    return original ? { ...note, name: original.split("/").pop() || note.name } : note;
  });
  const openSource = (path: string) => { void openFile(pdfSources.get(path) || path); };
  const [hasOpenedAI, setHasOpenedAI] = React.useState(activeTab === "ai");
  React.useEffect(() => { if (activeTab === "ai") setHasOpenedAI(true); }, [activeTab]);
  const [hasOpenedForge, setHasOpenedForge] = React.useState(activeTab === "forge");
  React.useEffect(() => { if (activeTab === "forge") setHasOpenedForge(true); }, [activeTab]);
  const activePluginView = rightPluginViews.find((v) => v.viewType === activeTab);

  return (
    <div
      className="right-sidebar-panel flex flex-col h-full bg-[var(--bg-tree,var(--bg-secondary))] select-none overflow-hidden"
      style={{ width: `${width}px` }}
    >
      {/* Active Tab Panel Body */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "outline" && (
          <div className="right-sidebar-view h-full">
            <OutlinePane
              content={currentContent}
              onHeadingClick={(line) => {
                document.dispatchEvent(
                  new CustomEvent("editor:goto-line", { detail: line })
                );
              }}
              onHide={onHideOutline}
              visible={true}
            />
          </div>
        )}

        {activeTab === "outgoing" && (
          <div className="right-sidebar-view h-full">
            <OutgoingLinksPanel
              content={currentContent}
              allNoteNames={allNoteNames}
              activeFileName={activeFileName}
              onLinkClick={handleLinkClick}
              visible={true}
            />
          </div>
        )}

        {activeTab === "backlinks" && (
          <div className="right-sidebar-view flex flex-col h-full overflow-y-auto">
            {/* Linked Mentions */}
            <div className="shrink-0">
              <BacklinksPanel
                backlinks={backlinks}
                currentNoteName={activeFileName}
                onBacklinkClick={async (path, line) => {
                  await openFile(path);
                  if (line) {
                    setTimeout(() => {
                      document.dispatchEvent(
                        new CustomEvent("editor:goto-line", { detail: line })
                      );
                    }, 150);
                  }
                }}
              />
            </div>
            {showUnlinkedMentions && (
              <div className="flex-1 border-t border-(--border-subtle)">
                <UnlinkedMentionsPanel
                  currentNotePath={activeFilePath}
                  currentNoteName={activeFileName}
                  visible={true}
                  onNavigate={async (path, line) => {
                    await openFile(path);
                    if (line) {
                      setTimeout(() => {
                        document.dispatchEvent(
                          new CustomEvent("editor:goto-line", { detail: line })
                        );
                      }, 150);
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        {(activeTab === "forge" || hasOpenedForge) && (
          <div className="right-sidebar-view h-full" hidden={activeTab !== "forge"} inert={activeTab !== "forge"} style={{ display: activeTab === "forge" ? undefined : "none" }}>
            <ForgePanel
              key={vaultPath || "no-vault"}
              onClose={onClose}
              vaultPath={vaultPath}
              currentContent={sourceContent}
              activeFilePath={forgePath}
              activeFileName={activeFileName}
              allNoteNames={sourceNotes}
              onOpenSource={openSource}
              activeNote={forgePath ? { name: activeFileName, path: forgePath } : null}
              notes={sourceNotes.filter(note => /\.md$/i.test(note.path))}
              readNoteContent={readNoteContent}
              onOpenNote={openSource}
            />
          </div>
        )}

        {(activeTab === "ai" || hasOpenedAI) && vaultPath && (
          <div className="right-sidebar-view flex flex-col h-full overflow-hidden" hidden={activeTab !== "ai"} inert={activeTab !== "ai"} style={{ display: activeTab === "ai" ? undefined : "none" }}>
            <React.Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">Loading AI...</div>}>
              <AIPage
                vaultPath={vaultPath}
                theme={theme || "dark"}
                fileTree={fileTree}
                activeNotePath={sourcePath}
                selectionContext={selectionContext}
                onClearSelectionContext={onClearSelectionContext}
                onOpenNote={(path) => {
                  openSource(path);
                }}
                onClose={() => onClose?.()}
                isFullScreen={false}
              />
            </React.Suspense>
          </div>
        )}

        {activePluginView && (
          <div className="right-sidebar-plugin-view flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <PluginViewHost view={activePluginView} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
