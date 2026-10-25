import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Files,
  Search,
  Blocks,
  PanelsTopLeft,
  Sparkles,
  MoreHorizontal,
  Pin,
  PinOff,
  Settings,
  Bookmark,
  Calendar,
  Home,
  Users,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import type { PluginRibbonAction } from "../../types/plugin";
import { setIcon } from "../../lib/obsidian-api/utils";
import {
  fitDockTools,
  normalizePinnedTools,
  readStudioPreference,
  writeStudioPreference,
} from "../../utils/studioTools";

export interface StudioTool {
  id: string;
  label: string;
  icon: string;
  run: (event: React.MouseEvent) => void;
  contextMenu?: (event: React.MouseEvent) => void;
  category?: string;
  disabled?: boolean;
}
interface RibbonProps {
  onToggleExplorer?: () => void;
  onHome?: () => void;
  extraTools?: StudioTool[];
  activeToolIds?: string[];
  onForge: () => void;
  onSettings: () => void;
  onDailyNote?: () => void;
  onThoughtModel?: () => void;
  onSpaces?: () => void;
  onCanvas?: () => void;
  onSearch?: () => void;
  onBookmarks?: () => void;
  pluginRibbonActions?: PluginRibbonAction[];
  showSettingsButton?: boolean;
  hasWallpaper?: boolean;
  activeLeftPluginView?: { pluginId?: string; viewType?: string } | null;
  leftPluginViews?: Array<{
    viewType: string;
    displayText: string;
    icon: string;
    pluginId?: string;
  }>;
  onSelectLeftPluginView?: (viewType: string) => void;
}

const DEFAULT_PINS = ["library", "search", "forge", "canvas", "ai"];
const icons = {
  library: Files,
  search: Search,
  forge: Blocks,
  canvas: PanelsTopLeft,
  ai: Sparkles,
  settings: Settings,
  bookmarks: Bookmark,
  daily: Calendar,
  home: Home,
  spaces: Users,
};
function ToolIcon({ tool }: { tool: StudioTool }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) setIcon(ref.current, tool.icon);
  }, [tool.icon]);
  const Icon = icons[tool.id as keyof typeof icons];
  return Icon ? (
    <Icon size={18} strokeWidth={1.6} />
  ) : (
    <span ref={ref} className="studio-tool-icon" />
  );
}
function RibbonComponent(props: RibbonProps) {
  const [pins, setPins] = useState(() =>
    normalizePinnedTools(readStudioPreference<unknown[]>("dock", DEFAULT_PINS)),
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customizing, setCustomizing] = useState(false);
  const [width, setWidth] = useState(window.innerWidth);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    writeStudioPreference("dock", pins);
  }, [pins]);
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const dismiss = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        more.current?.focus();
      }
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  useEffect(() => {
    const ribbon = (window as any).__oo_app?.workspace?.leftRibbon;
    if (!ribbon) return;
    const previous = ribbon.containerEl;
    ribbon.containerEl = root.current;
    ribbon.ribbonItemsEl = root.current;
    return () => {
      ribbon.containerEl = previous;
      ribbon.ribbonItemsEl = previous;
    };
  }, []);
  const tools: StudioTool[] = [];
  const add = (id: string, label: string, icon: string, run?: () => void) => {
    if (run) tools.push({ id, label, icon, run, category: "Workspace" });
  };
  add("library", "Library", "files", props.onToggleExplorer);
  add("search", "Search", "search", props.onSearch);
  add("forge", "Forge", "blocks", props.onForge);
  add("canvas", "Canvas", "frame", props.onCanvas);
  add("ai", "Ask GROOT", "sparkles", props.onThoughtModel);
  add("bookmarks", "Bookmarks", "bookmark", props.onBookmarks);
  add("daily", "Daily note", "calendar", props.onDailyNote);
  add("home", "Home", "home", props.onHome);
  add("spaces", "Spaces", "users", props.onSpaces);
  add("settings", "Settings", "settings", props.onSettings);
  tools.push(...(props.extraTools || []));
  for (const action of props.pluginRibbonActions || []) {
    tools.push({
      id: `plugin:${action.pluginId}:${(action as any).id || action.title}`,
      label: action.title,
      icon: action.icon,
      category: "Plugins",
      run: (event) => {
        if (action.el)
          action.el.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
        else action.callback(event.nativeEvent);
      },
      contextMenu: (event) => {
        if (action.el) {
          event.preventDefault();
          action.el.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: event.clientX,
              clientY: event.clientY,
            }),
          );
        }
      },
    });
  }
  for (const view of props.leftPluginViews || [])
    tools.push({
      id: `view:${view.viewType}`,
      label: view.displayText,
      icon: view.icon,
      category: "Plugins",
      run: () => props.onSelectLeftPluginView?.(view.viewType),
    });
  const pinned = pins
    .map((id) => tools.find((t) => t.id === id))
    .filter((t): t is StudioTool => !!t);
  const visible = fitDockTools(pinned, Math.min(width - 24, 960));
  const visibleIds = new Set(visible.map(tool => tool.id));
  const listedTools = tools.filter(tool => customizing || !visibleIds.has(tool.id));
  const togglePin = (id: string) =>
    setPins((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const move = (id: string, direction: number) =>
    setPins((current) => {
      const next = [...current];
      const from = next.indexOf(id);
      const to = from + direction;
      if (from >= 0 && to >= 0 && to < next.length)
        [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  // The workspace clips its children and creates a stacking context below the
  // status bar. Mount the viewport dock outside it so the footer cannot cover it.
  return createPortal(
    <div ref={root} className="studio-dock" aria-label="Workspace tools">
      <div className="studio-dock-items" role="toolbar" aria-label="Dock">
        {visible.map((tool) => (
          <button
            type="button"
            key={tool.id}
            className="studio-dock-button"
            aria-label={tool.label}
            disabled={tool.disabled}
            aria-pressed={props.activeToolIds?.includes(tool.id) || false}
            title={`${tool.label} · Right-click for options`}
            onClick={tool.run}
            onContextMenu={(event) => {
              if (tool.contextMenu) tool.contextMenu(event);
              else {
                event.preventDefault();
                setQuery(tool.label);
                setOpen(true);
              }
            }}
          >
            <ToolIcon tool={tool} />
            <span>{tool.label}</span>
          </button>
        ))}
        <button
          type="button"
          ref={more}
          className="studio-dock-button"
          aria-label="More tools"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            setQuery("");
            setCustomizing(false);
            setOpen(!open);
          }}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </div>
      {open && (
        <div
          ref={menu}
          className="studio-tools-menu"
          role="dialog"
          aria-label="Tools"
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            const elements = Array.from(
              menu.current?.querySelectorAll<HTMLElement>(
                "input, button:not(:disabled)",
              ) || [],
            );
            const index = elements.indexOf(
              document.activeElement as HTMLElement,
            );
            event.preventDefault();
            elements[
              (index + (event.key === "ArrowDown" ? 1 : -1) + elements.length) %
                elements.length
            ]?.focus();
          }}
        >
          <div className="studio-tools-heading">{customizing && <button type="button" aria-label="Back to tools" onClick={() => setCustomizing(false)}><ArrowLeft size={17} /></button>}<h2>{customizing ? "Customize dock" : "Tools"}</h2></div>
          <label className="studio-tool-search">
            <Search size={17} />
            <input
              ref={search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a tool…"
              aria-label="Find a tool"
            />
          </label>
          <div className="studio-tools-list">
            {["Workspace", "Plugins", "Commands"].map((category) => {
              const matches = listedTools.filter(
                (tool) =>
                  (tool.category || "Workspace") === category &&
                  tool.label
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
              );
              return (
                matches.length > 0 && (
                  <section key={category}>
                    <h3>{category}</h3>
                    {matches.map((tool) => (
                      <div key={tool.id} className="studio-tool-row">
                        <button
                          type="button"
                          className="studio-tool-action"
                          disabled={tool.disabled}
                          title={
                            tool.disabled
                              ? "Available when this command has an active editor or matching context"
                              : tool.label
                          }
                          onClick={(event) => {
                            tool.run(event);
                            setOpen(false);
                          }}
                        >
                          <ToolIcon tool={tool} />
                          <span>{tool.label}</span>
                        </button>
                        {customizing && pins.includes(tool.id) && (
                          <>
                            <button
                              type="button"
                              title={`Move ${tool.label} left`}
                              aria-label={`Move ${tool.label} left`}
                              disabled={pins.indexOf(tool.id) === 0}
                              onClick={() => move(tool.id, -1)}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              title={`Move ${tool.label} right`}
                              aria-label={`Move ${tool.label} right`}
                              disabled={
                                pins.indexOf(tool.id) === pins.length - 1
                              }
                              onClick={() => move(tool.id, 1)}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="studio-tool-pin"
                          title={`${pins.includes(tool.id) ? "Unpin" : "Pin"} ${tool.label}`}
                          aria-label={`${pins.includes(tool.id) ? "Unpin" : "Pin"} ${tool.label}`}
                          aria-pressed={pins.includes(tool.id)}
                          onClick={() => togglePin(tool.id)}
                        >
                          {pins.includes(tool.id) ? (
                            <PinOff size={15} />
                          ) : (
                            <Pin size={15} />
                          )}
                        </button>
                      </div>
                    ))}
                  </section>
                )
              );
            })}
            {!listedTools.some((tool) =>
              tool.label.toLowerCase().includes(query.toLowerCase()),
            ) && <p className="studio-tools-empty">No tools found.</p>}
          </div>
          <div className="studio-tools-footer">
            {customizing ? <button type="button" className="studio-reset-dock" onClick={() => setPins(DEFAULT_PINS)}>Reset dock to defaults</button> : <button type="button" className="studio-customize-dock" onClick={() => { setCustomizing(true); setQuery(""); search.current?.focus(); }}>Customize dock…</button>}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
export const Ribbon = React.memo(RibbonComponent);
