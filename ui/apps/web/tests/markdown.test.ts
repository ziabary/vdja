import {describe,it,expect} from 'vitest';
import {renderMarkdownTrusted} from '../../../packages/ui-core/src/rich-content/render.server.js';
describe('shared Markdown security boundary',()=>{
  it('escapes raw HTML, disables images and rejects unsafe links',()=>{
    const result=renderMarkdownTrusted('<script>alert(1)</script> ![x](https://evil.test/a.png) [bad](javascript:alert(1)) **safe**');
    expect(result).not.toContain('<script>');expect(result).not.toContain('<img');expect(result).not.toContain('href="javascript:');expect(result).toContain('<strong>safe</strong>');
  });
  it('adds safe external link attributes and table markup',()=>{
    const result=renderMarkdownTrusted('[site](https://example.test)\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(result).toContain('rel="noopener noreferrer"');expect(result).toContain('<table>');
  });
});
