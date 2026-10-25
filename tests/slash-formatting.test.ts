// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { formatSlashCompletion } from '../src/editor/formatSlashCompletion';

const complete = (doc: string) => formatSlashCompletion(new CompletionContext(EditorState.create({ doc, extensions: [markdown()] }), doc.length, false));
describe('format insertion slash menu', () => {
  it('offers block insertion commands and filters the query', async () => {
    const result = await complete('/hea');
    expect(result?.options.map(option => option.label)).toEqual(['Heading 1', 'Heading 2', 'Heading 3']);
    expect((await complete('/'))?.options.map(option => option.label)).toContain('Code block');
  });
  it('does not offer insertion commands inside fenced code or ordinary prose', async () => {
    expect(await complete('```\n/hea')).toBeNull();
    expect(await complete('A sentence /hea')).toBeNull();
  });
  it('removes the slash query and dispatches the existing active-editor command', async () => {
    const result = await complete('/table');
    const dispatch = vi.fn(); const focus = vi.fn();
    const listener = vi.fn(); document.addEventListener('editor:format', listener);
    const option = result!.options[0];
    (option.apply as Function)({ dispatch, focus }, option, 0, 6);
    expect(dispatch).toHaveBeenCalledWith({ changes: { from: 0, to: 6, insert: '' }, selection: { anchor: 0 } });
    expect(listener.mock.calls[0][0].detail.command).toBe('table');
    document.removeEventListener('editor:format', listener);
  });
});
