/** Puts `text` on the clipboard; answers whether it could. */
export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(String(text));
    return true;
  } catch {
    return false;
  }
};
