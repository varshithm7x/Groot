import { describe, expect, it, vi } from 'vitest';
import { canRunPluginTool, runPluginTool } from '../src/utils/pluginToolCommands';

describe('registered plugin tools', () => {
  it('executes commands implemented only through checkCallback', () => {
    const checkCallback = vi.fn((_checking: boolean) => true);
    const command = { id: 'plugin:open', pluginId: 'plugin', name: 'Open', checkCallback };
    runPluginTool(command);
    expect(checkCallback.mock.calls.map(args => args[0])).toEqual([true, false]);
  });
  it('keeps editor commands unavailable without an active editor', () => {
    const editorCallback = vi.fn();
    const command = { id: 'plugin:format', pluginId: 'plugin', name: 'Format', editorCallback };
    expect(canRunPluginTool(command, null)).toBe(false);
    runPluginTool(command, null);
    expect(editorCallback).not.toHaveBeenCalled();
    const active = { editor: { id: 'focused-pane' }, file: { path: 'Note.md' } };
    runPluginTool(command, active);
    expect(editorCallback).toHaveBeenCalledWith(active.editor, active);
  });
  it('respects a command that rejects the current context', () => {
    const checkCallback = vi.fn((_checking: boolean) => false);
    const command = { id: 'plugin:context', pluginId: 'plugin', name: 'Context', checkCallback };
    runPluginTool(command);
    expect(checkCallback).toHaveBeenCalledTimes(1);
    expect(checkCallback).toHaveBeenCalledWith(true);
  });
});
