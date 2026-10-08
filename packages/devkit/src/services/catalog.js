/**
 * The services a Link Loom frontend can talk to, with the environment variables each one reads. Secret keys only
 * ever live in .env.local; .env.sample keeps every key with an empty value as the template.
 */
export const SERVICES = Object.freeze({
  backend: {
    label: "This app's backend",
    env: [{ key: 'VITE_APP_BACKEND_URL', url: true }],
  },
  veripass: {
    label: 'Veripass (identity)',
    env: [
      { key: 'VITE_APP_SERVICE_VERIPASS_URL', url: true },
      { key: 'VITE_APP_VERIPASS_API_KEY', secret: true },
      { key: 'VITE_APP_ORGANIZATION_SLUG' },
      { key: 'VITE_APP_BLACKWOOD_APPS_ENVIRONMENT' },
    ],
  },
  'link-loom-cloud': {
    label: 'Link Loom Cloud (App Engine, App Store, billing, help center)',
    layer: 'stoneos',
    env: [{ key: 'VITE_LOOM_CLOUD_BACKEND_URL', url: true }],
  },
  sommatic: {
    label: 'Sommatic (Command Center)',
    layer: 'command-center',
    env: [{ key: 'VITE_APP_SOMMATIC_BACKEND_URL', url: true }, { key: 'VITE_SOMMATIC_ENABLED' }],
  },
  'image-generation': {
    label: 'Image generation (Replicate or Gemini), for `link-loom images generate`',
    env: [
      { key: 'REPLICATE_API_TOKEN', secret: true },
      { key: 'REPLICATE_MODEL' },
      { key: 'GEMINI_API_KEY', secret: true },
    ],
  },
  'cloudflare-pages': {
    label: 'Cloudflare Pages (deploy)',
    env: [
      { key: 'CLOUDFLARE_ACCOUNT_ID' },
      { key: 'CLOUDFLARE_API_TOKEN', secret: true },
      { key: 'CLOUDFLARE_PAGES_PROJECT' },
    ],
  },
});

export const serviceIds = () => Object.keys(SERVICES);
