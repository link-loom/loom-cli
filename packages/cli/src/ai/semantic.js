import { INTENT_PROTOTYPES, OFF_TOPIC_PROTOTYPES } from './prototypes.js';
import { similarity } from './model/embedder.js';

// Below this cosine a request is about nothing the CLI does; above it, it must still beat the off-topic phrasings.
export const MIN_SIMILARITY = 0.42;
const OFF_TOPIC = 'off_topic';

const LANDING_ONLY = new Set(['add_section', 'add_blog_post']);
const WEBAPP_ONLY = new Set(['add_entity', 'add_component', 'add_service', 'brand_colors']);

const prototypeCache = new WeakMap();

const prototypesOf = async (embedder) => {
  if (!prototypeCache.has(embedder)) {
    const entries = await Promise.all(
      [...Object.entries(INTENT_PROTOTYPES), [OFF_TOPIC, OFF_TOPIC_PROTOTYPES]].map(async ([intent, phrases]) => [
        intent,
        await Promise.all(phrases.map((phrase) => embedder.embed(phrase))),
      ]),
    );
    prototypeCache.set(embedder, entries);
  }

  return prototypeCache.get(embedder);
};

/**
 * The intent whose phrasings are closest to the request, with that closeness; the project type rules some out. Null
 * when the closest phrasings are small talk.
 */
export const semanticIntent = async (embedder, text, { type } = {}) => {
  const vector = await embedder.embed(text);
  const unavailable = type === 'landing' ? WEBAPP_ONLY : LANDING_ONLY;
  const ranked = (await prototypesOf(embedder))
    .filter(([intent]) => !unavailable.has(intent))
    .map(([intent, vectors]) => ({
      intent,
      similarity: Math.max(...vectors.map((other) => similarity(vector, other))),
    }))
    .sort((left, right) => right.similarity - left.similarity);
  return !ranked.length || ranked[0].intent === OFF_TOPIC ? null : ranked[0];
};
