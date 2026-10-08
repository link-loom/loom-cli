import { pruneUnused, rewriteLinks } from '../src/transform.js';

describe('pruneUnused', () => {
  it('drops the imported names nobody reads and keeps React', () => {
    const source = `import React, { useEffect, useState } from 'react';
import { Alert } from '@link-loom/react-sdk';
import { unused } from './helpers';
import './styles.css';

export default function Page() {
  const [open, setOpen] = useState(false);
  return <Alert open={open} onClose={() => setOpen(false)} />;
}
`;
    const pruned = pruneUnused(source, 'Page.jsx');
    expect(pruned).toContain("import React, { useState } from 'react';");
    expect(pruned).toContain("import { Alert } from '@link-loom/react-sdk';");
    expect(pruned).not.toContain('./helpers');
    expect(pruned).toContain("import './styles.css';");
  });

  it('keeps names read through JSX, member objects and shorthand properties', () => {
    const source = `import { Icons } from './icons';
import { format } from './format';
import { theme } from './theme';

export const Row = () => <Icons.Check value={{ format }} color={theme.primary} />;
`;
    expect(pruneUnused(source, 'Row.jsx')).toBe(source);
  });

  it('drops the binding of a catch that ignores its error', () => {
    const source = `export const load = async () => {
  try {
    return await fetch('/x');
  } catch (error) {
    return null;
  }
};
export const read = () => {
  try {
    return JSON.parse('x');
  } catch (error) {
    return error.message;
  }
};
`;
    const pruned = pruneUnused(source, 'load.js');
    expect(pruned).toContain('} catch {\n    return null;');
    expect(pruned).toContain('} catch (error) {\n    return error.message;');
  });
});

describe('rewriteLinks', () => {
  it('points legacy paths at their new place, the longest first, in strings and template heads', () => {
    const source = `const a = "/admin/account/overview";
const b = \`/admin/account/overview/\${id}\`;
const c = "/admin/accounting";
navigate("/admin/account");
`;
    const rewritten = rewriteLinks(source, 'links.js', {
      '/admin/account/overview/': '/admin/account/profile/',
      '/admin/account/overview': '/admin/account/profile',
      '/admin/account': '/admin/settings',
    });
    expect(rewritten).toContain('const a = "/admin/account/profile";');
    expect(rewritten).toContain('const b = `/admin/account/profile/${id}`;');
    expect(rewritten).toContain('const c = "/admin/accounting";');
    expect(rewritten).toContain('navigate("/admin/settings");');
  });
});
