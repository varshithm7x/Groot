import type { PluginCommand } from "../types/plugin";

interface ActiveEditor {
  editor: unknown;
  [key: string]: unknown;
}

export function canRunPluginTool(
  command: PluginCommand,
  activeEditor?: ActiveEditor | null,
): boolean {
  if (command.editorCallback || command.editorCheckCallback) {
    if (!activeEditor?.editor) return false;
    return (
      command.editorCheckCallback?.(true, activeEditor.editor, activeEditor) !==
      false
    );
  }
  if (command.checkCallback) return command.checkCallback(true) !== false;
  return Boolean(command.callback);
}

export function runPluginTool(
  command: PluginCommand,
  activeEditor?: ActiveEditor | null,
): void {
  if (!canRunPluginTool(command, activeEditor)) return;
  if (command.editorCallback && activeEditor)
    command.editorCallback(activeEditor.editor, activeEditor);
  else if (command.editorCheckCallback && activeEditor)
    command.editorCheckCallback(false, activeEditor.editor, activeEditor);
  else if (command.checkCallback) command.checkCallback(false);
  else command.callback?.();
}
