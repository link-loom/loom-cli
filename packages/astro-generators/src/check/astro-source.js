/** The parts of an .astro file the rules read: frontmatter, the template, and its <style> and <script> blocks. */
export const splitAstro = (source) => {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(source);
  const body = frontmatter ? source.slice(frontmatter[0].length) : source;
  const styles = [...body.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]);
  const template = body.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
  return { frontmatter: frontmatter?.[1] || '', template, styles };
};

/** The 1-based line of `index` in `text`. */
export const lineAt = (text, index) => text.slice(0, index).split('\n').length;

/**
 * The template with every `{…}` expression blanked (same length, so offsets keep their lines): what is left is
 * markup and literal text.
 */
export const withoutExpressions = (template) => {
  let depth = 0;
  let out = '';
  for (const char of template) {
    if (char === '{') depth += 1;
    out += depth > 0 && char !== '\n' ? ' ' : char;
    if (char === '}' && depth > 0) depth -= 1;
  }

  return out;
};
