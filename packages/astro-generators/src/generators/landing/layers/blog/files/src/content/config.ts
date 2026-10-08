/*
 * The blog collection. One post per language:
 *   post-slug.md     English
 *   post-slug.es.md  Spanish
 * Both carry `base_slug: post-slug`, so the addresses are parallel: /en/blog/post-slug and /es/blog/post-slug.
 * `npx link-loom add blog-post` writes both.
 */
import { defineCollection, z } from 'astro:content';
import { BLOG_AUTHOR, BLOG_CATEGORIES } from '../data/blog';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pub_date: z.coerce.date(),
    category: z.enum(BLOG_CATEGORIES).default(BLOG_CATEGORIES[0]),
    author: z.string().default(BLOG_AUTHOR),
    cover_image: z.string().optional(),
    og_image: z.string().optional(),
    is_draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    locale: z.enum(['en', 'es']).default('en'),
    base_slug: z.string().optional(),
  }),
});

export const collections = { blog };
