/**
 * FormattingToolbar — Onyx-style rich-text formatting strip
 * Dispatches markdown formatting commands to the active CodeMirror editor.
 */

import React, { useState, useEffect, useRef } from "react";
import { positionAdjacentPopover } from "../../utils/selectionPopover";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline,
  Heading,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  Image,
  Table,
  Highlighter,
  RemoveFormatting,
  ChevronDown,
  ChevronRight,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  MoreHorizontal,
  Sigma,
} from "lucide-react";

const toolbarClass =
  "onyx-toolbar flex h-9 min-h-9 shrink-0 items-center gap-0.5 overflow-visible border-b border-[var(--divider-color)] bg-[var(--bg-toolbar,var(--bg-secondary))] px-2";
const groupClass = "flex items-center gap-0.5";
const sepClass = "mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]";
const btnClass =
  "flex h-7 min-w-7 cursor-pointer items-center justify-center gap-0.5 rounded-[4px] border-0 bg-transparent px-1.5 text-[var(--text-secondary)] transition-colors duration-100 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]";
const btnWideClass = `${btnClass} px-2 text-[12px] font-medium`;
const menuClass =
  "fixed z-[10000] rounded-lg border border-[var(--border-subtle,#2c2c2e)] bg-[var(--bg-elevated,#1e1e1f)] py-1 shadow-lg";
const menuItemClass =
  "flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-[12px] font-medium border-0 bg-transparent transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]";
type ToolbarMenu = "heading" | "font-size" | "align";

function dispatchFormat(command: string) {
  document.dispatchEvent(
    new CustomEvent("editor:format", { detail: { command } }),
  );
}

function dispatchFileMenu(button: HTMLButtonElement | null) {
  const rect = button?.getBoundingClientRect();
  document.dispatchEvent(
    new CustomEvent("editor:open-file-menu", {
      detail: rect
        ? { x: rect.right, y: rect.bottom }
        : { x: window.innerWidth - 16, y: 48 },
    }),
  );
  dispatchFormat("more");
}

interface ToolBtnProps {
  title: string;
  command?: string;
  onClick?: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

function ToolBtn({ title, command, onClick, children, wide }: ToolBtnProps) {
  return (
    <button
      type="button"
      className={wide ? btnWideClass : btnClass}
      title={title}
      aria-label={title}
      onClick={() => {
        if (onClick) onClick();
        else if (command) dispatchFormat(command);
      }}
    >
      {children}
    </button>
  );
}

export function FormattingToolbar({ compact = false, pinnable = false, selectionHeading }: { compact?: boolean; pinnable?: boolean; selectionHeading?: number | null } = {}) {
  const [pinned, setPinned] = useState(() => { try { return localStorage.getItem("openonyx.studio.formatting") === "true"; } catch { return false; } });
  const [expanded, setExpanded] = useState(false);
  const [overflowPosition, setOverflowPosition] = useState({ left: 8, top: 60, width: 236 });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const overflowButtonRef = useRef<HTMLButtonElement>(null);
  const positionOverflow = (button: HTMLButtonElement) => {
    const anchor = button.closest<HTMLElement>(".studio-selection-toolbar");
    const rect = anchor?.getBoundingClientRect() || button.getBoundingClientRect();
    const width = 236;
    const height = overflowRef.current?.getBoundingClientRect().height || Math.min(370, window.innerHeight - 128);
    setOverflowPosition({
      ...positionAdjacentPopover(rect, { left: 0, top: 51, right: window.innerWidth, bottom: window.innerHeight - 60 }, width, height),
      width,
    });
  };
  useEffect(() => {
    const toggle = () => setPinned(value => { try { localStorage.setItem("openonyx.studio.formatting", String(!value)); } catch {} return !value; });
    document.addEventListener("studio:toggle-formatting", toggle);
    return () => document.removeEventListener("studio:toggle-formatting", toggle);
  }, []);
  const [openMenu, setOpenMenu] = useState<ToolbarMenu | null>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const [activeHeading, setActiveHeading] = useState<number | null>(null);
  const currentHeading = selectionHeading === undefined ? activeHeading : selectionHeading;
  const currentStyleLabel = currentHeading ? `Heading ${currentHeading}` : "Normal text";

  const headingRef = useRef<HTMLButtonElement>(null);
  const fontSizeRef = useRef<HTMLButtonElement>(null);
  const alignRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setOpenMenu(null);
  const toggleMenu = (menu: ToolbarMenu, button: HTMLButtonElement | null, width = 150) => {
    if (!button) return;
    if (compact && menu === "heading") {
      const card = button.closest<HTMLElement>(".studio-selection-toolbar");
      if (card) {
        setMenuPosition(positionAdjacentPopover(
          card.getBoundingClientRect(),
          { left: 0, top: 51, right: window.innerWidth, bottom: window.innerHeight - 60 },
          160,
          160,
        ));
        setOpenMenu((current) => current === menu ? null : menu);
        return;
      }
    }
    const rect = button.getBoundingClientRect();
    setMenuPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 210)),
    });
    setOpenMenu((current) => current === menu ? null : menu);
  };
  const runMenuCommand = (command: string) => {
    dispatchFormat(command);
    closeMenu();
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (target instanceof Element && target.closest("[data-selection-menu]")) return;
      if (
        toolbarRef.current?.contains(target) ||
        overflowRef.current?.contains(target) ||
        menuRef.current?.contains(target) ||
        headingRef.current?.contains(target) ||
        fontSizeRef.current?.contains(target) ||
        alignRef.current?.contains(target)
      ) return;
      closeMenu();
      setExpanded(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { closeMenu(); setExpanded(false); }
    };
    const handleWindowChange = (event: Event) => {
      if (event.type === "scroll" && event.target instanceof Element && event.target.closest("[data-selection-menu]")) return;
      closeMenu(); setExpanded(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, []);

  useEffect(() => {
    const handleFormatState = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveHeading(customEvent.detail.heading);
      }
    };
    document.addEventListener("editor:format-state", handleFormatState);
    return () => {
      document.removeEventListener("editor:format-state", handleFormatState);
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [openMenu]);

  const menu = openMenu ? createPortal(
    <div
      ref={menuRef}
      className={menuClass}
      style={{ left: menuPosition.left, top: menuPosition.top, minWidth: compact ? 160 : 140, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)" }}
      role="menu"
      data-selection-menu
      onMouseDown={event => event.preventDefault()}
      onKeyDown={event => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") || []);
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault(); items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }}
    >
      {openMenu === "heading" && [
        { label: "Heading 1", cmd: "heading-1", level: 1 },
        { label: "Heading 2", cmd: "heading-2", level: 2 },
        { label: "Heading 3", cmd: "heading-3", level: 3 },
        { label: "Heading 4", cmd: "heading-4", level: 4 },
        { label: "Normal Text", cmd: "heading-normal", level: null },
      ].map((opt) => (
        <button
          key={opt.cmd}
          type="button"
          role="menuitem"
          className={`${menuItemClass} ${currentHeading === opt.level ? "text-[var(--color-accent)] bg-[var(--bg-hover)]" : ""}`}
          onClick={() => runMenuCommand(opt.cmd)}
        >
          {opt.label}
        </button>
      ))}
      {openMenu === "font-size" && [
        { label: "Small (85%)", cmd: "font-size-small" },
        { label: "Normal (100%)", cmd: "font-size-normal" },
        { label: "Medium (120%)", cmd: "font-size-medium" },
        { label: "Large (150%)", cmd: "font-size-large" },
        { label: "Max", cmd: "font-size-xl" },
      ].map((opt) => (
        <button key={opt.cmd} type="button" role="menuitem" className={menuItemClass} onClick={() => runMenuCommand(opt.cmd)}>
          {opt.label}
        </button>
      ))}
      {openMenu === "align" && [
        { label: "Align Left", cmd: "align-left", icon: AlignLeft },
        { label: "Align Center", cmd: "align-center", icon: AlignCenter },
        { label: "Align Right", cmd: "align-right", icon: AlignRight },
        { label: "Align Justify", cmd: "align-justify", icon: AlignJustify },
      ].map((opt) => {
        const Icon = opt.icon;
        return (
          <button key={opt.cmd} type="button" role="menuitem" className={`${menuItemClass} gap-2`} onClick={() => runMenuCommand(opt.cmd)}>
            <Icon size={13} strokeWidth={1.75} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  ) : null;

  useEffect(() => {
    if (!expanded || !overflowButtonRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (overflowButtonRef.current) positionOverflow(overflowButtonRef.current);
      overflowRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  if (pinnable && !pinned) return null;
  if (compact) return <div ref={toolbarRef} className="studio-primary-formatting" role="toolbar" aria-label="Formatting" onMouseDown={event => event.preventDefault()}>
    <button type="button" ref={headingRef} className="studio-selection-text-style" title={`Text style: ${currentStyleLabel}`} aria-label={`Text style: ${currentStyleLabel}`} aria-haspopup="menu" aria-expanded={openMenu === "heading"} onClick={() => { setExpanded(false); toggleMenu("heading", headingRef.current); }}>
      <Type size={16} strokeWidth={1.7} /><span>{currentStyleLabel}</span><ChevronRight size={14} strokeWidth={1.7} />
    </button>
    <div className="studio-selection-format-grid">
      <ToolBtn title="Text color" command="text-color"><span className="studio-selection-color-icon">A</span></ToolBtn>
      <ToolBtn title="Bold (Ctrl+B)" command="bold"><Bold size={16} /></ToolBtn>
      <ToolBtn title="Italic (Ctrl+I)" command="italic"><Italic size={16} /></ToolBtn>
      <ToolBtn title="Underline" command="underline"><Underline size={16} /></ToolBtn>
      <ToolBtn title="Clear formatting" command="clear-format"><RemoveFormatting size={16} /></ToolBtn>
      <ToolBtn title="Link" command="link"><Link2 size={16} /></ToolBtn>
      <ToolBtn title="Strikethrough" command="strikethrough"><Strikethrough size={16} /></ToolBtn>
      <ToolBtn title="Inline code" command="code"><Code size={16} /></ToolBtn>
      <ToolBtn title="Math" command="math"><Sigma size={16} /></ToolBtn>
      <button type="button" ref={overflowButtonRef} className={btnClass} title="Formatting options" aria-label="Formatting options" aria-expanded={expanded} aria-haspopup="dialog" onClick={event => { closeMenu(); positionOverflow(event.currentTarget); setExpanded(value => !value); }}><MoreHorizontal size={17} /></button>
    </div>
    {menu}
    {expanded && createPortal(<div ref={overflowRef} className="studio-format-overflow" role="dialog" aria-label="Additional formatting" data-selection-menu style={{ left: overflowPosition.left, top: overflowPosition.top, width: overflowPosition.width }} onMouseDown={event => event.preventDefault()} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setExpanded(false); overflowButtonRef.current?.focus(); } }}>
      <div className="studio-format-overflow-label">Insert and format</div>
      {[
        { label: "Highlight", command: "highlight", icon: Highlighter },
        { label: "Bullet list", command: "bullet-list", icon: List },
        { label: "Numbered list", command: "numbered-list", icon: ListOrdered },
        { label: "Blockquote", command: "blockquote", icon: Quote },
        { label: "Code block", command: "code-block", icon: Code },
        { label: "Image", command: "image", icon: Image },
        { label: "Table", command: "table", icon: Table },
      ].map(({ label, command, icon: Icon }) => <button key={command} type="button" onClick={() => { dispatchFormat(command); setExpanded(false); }}><Icon size={15} strokeWidth={1.7} />{label}</button>)}
      <div className="studio-format-overflow-label">Alignment</div>
      {[
        { label: "Align left", command: "align-left", icon: AlignLeft },
        { label: "Align center", command: "align-center", icon: AlignCenter },
        { label: "Align right", command: "align-right", icon: AlignRight },
        { label: "Justify", command: "align-justify", icon: AlignJustify },
      ].map(({ label, command, icon: Icon }) => <button key={command} type="button" onClick={() => { dispatchFormat(command); setExpanded(false); }}><Icon size={15} strokeWidth={1.7} />{label}</button>)}
      <div className="studio-format-overflow-label">Text size</div>
      {[
        { label: "Small", command: "font-size-small" },
        { label: "Normal", command: "font-size-normal" },
        { label: "Medium", command: "font-size-medium" },
        { label: "Large", command: "font-size-large" },
        { label: "Extra large", command: "font-size-xl" },
      ].map(({ label, command }) => <button key={command} type="button" onClick={() => { dispatchFormat(command); setExpanded(false); }}><Type size={15} strokeWidth={1.7} />{label}</button>)}
    </div>, document.body)}
  </div>;

  return (
    <div
      ref={toolbarRef}
      onMouseDown={event => event.preventDefault()}
      className={toolbarClass}
      role="toolbar"
      aria-label="Formatting"
      style={{ backgroundColor: 'var(--bg-toolbar, var(--bg-secondary))' }}
    >
      <div className={groupClass}>
        <div className="relative">
          <button
            type="button"
            className={btnWideClass}
            title="Heading"
            aria-label="Text style"
            aria-haspopup="menu"
            aria-expanded={openMenu === "heading"}
            ref={headingRef}
            onClick={() => toggleMenu("heading", headingRef.current)}
          >
            <span>
              {activeHeading === 1
                ? "Heading 1"
                : activeHeading === 2
                ? "Heading 2"
                : activeHeading === 3
                ? "Heading 3"
                : activeHeading === 4
                ? "Heading 4"
                : "Normal Text"}
            </span>
            <ChevronDown size={12} strokeWidth={2} className="opacity-60" />
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            className={btnWideClass}
            title="Font size"
            aria-haspopup="menu"
            aria-expanded={openMenu === "font-size"}
            ref={fontSizeRef}
            onClick={() => toggleMenu("font-size", fontSizeRef.current)}
          >
            <Type size={14} strokeWidth={1.75} />
            <ChevronDown size={12} strokeWidth={2} className="opacity-60" />
          </button>
        </div>
      </div>

      <div className={sepClass} />

      <div className={groupClass}>
        <ToolBtn title="Bold (Ctrl+B)" command="bold">
          <Bold size={15} strokeWidth={2.25} />
        </ToolBtn>
        <ToolBtn title="Italic (Ctrl+I)" command="italic">
          <Italic size={15} strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn title="Underline" command="underline">
          <Underline size={15} strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn title="Strikethrough" command="strikethrough">
          <Strikethrough size={15} strokeWidth={1.75} />
        </ToolBtn>
      </div>

      <div className={sepClass} />

      <div className={groupClass}>
        <ToolBtn title="Highlight" command="highlight">
          <Highlighter size={15} strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn title="Text color" command="text-color">
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="text-[13px] font-semibold leading-none">A</span>
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--text-muted)]" />
          </span>
        </ToolBtn>
        <ToolBtn title="Clear formatting" command="clear-format">
          <RemoveFormatting size={15} strokeWidth={1.75} />
        </ToolBtn>
      </div>

      <div className={sepClass} />

      <div className={groupClass}>
        <ToolBtn title="Bullet list" command="bullet-list">
          <List size={15} strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn title="Numbered list" command="numbered-list">
          <ListOrdered size={15} strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn title="Blockquote" command="blockquote">
          <Quote size={15} strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn title="Math" command="math"><Sigma size={15} strokeWidth={1.75} /></ToolBtn>
        <ToolBtn title="Code block" command="code-block"><Code size={15} strokeWidth={1.75} /></ToolBtn>
        <ToolBtn title="Inline code" command="code">
          <Code size={15} strokeWidth={1.75} />
        </ToolBtn>
      </div>

      <div className={sepClass} />

      <div className={groupClass}>
        <ToolBtn title="Link" command="link">
          <Link2 size={15} strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn title="Image" command="image">
          <Image size={15} strokeWidth={1.75} />
        </ToolBtn>
        <ToolBtn title="Table" command="table">
          <Table size={15} strokeWidth={1.75} />
        </ToolBtn>
        
        <div className="relative">
          <button
            type="button"
            className={btnClass}
            title="Align text"
            aria-haspopup="menu"
            aria-expanded={openMenu === "align"}
            ref={alignRef}
            onClick={() => toggleMenu("align", alignRef.current)}
          >
            <AlignLeft size={15} strokeWidth={1.75} />
            <ChevronDown size={11} strokeWidth={2} className="opacity-60 -ml-0.5" />
          </button>
        </div>
      </div>

      <div className="flex-1" />

      <div className={groupClass}>
        <button
          type="button"
          ref={moreRef}
          className={btnClass}
          title="More"
          aria-label="Document actions"
          onClick={() => dispatchFileMenu(moreRef.current)}
        >
          <MoreHorizontal size={15} strokeWidth={1.75} />
        </button>
      </div>
      {menu}
    </div>
  );
}
