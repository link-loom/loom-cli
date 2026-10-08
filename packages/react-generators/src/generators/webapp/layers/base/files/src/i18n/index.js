import { getActiveLocale } from "@link-loom/react-shell";

import en from "./en.js";
import es from "./es.js";

export const DICTIONARIES = Object.freeze({ en, es });

/** The copy of the active locale for code that is not a component (helpers, column definitions). Components use `useCopy`. */
export const getCopy = () => DICTIONARIES[getActiveLocale()] || en;

export { useCopy, useLocale, getActiveLocale } from "@link-loom/react-shell";
