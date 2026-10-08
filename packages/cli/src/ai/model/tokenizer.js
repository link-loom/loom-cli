/**
 * The BERT WordPiece tokenizer of all-MiniLM-L6-v2, read from its tokenizer.json: lower case without accents,
 * punctuation split off, each word cut into the longest pieces the vocabulary knows (`##` marks a continuation),
 * wrapped in [CLS] … [SEP] and cut at the model's 128 tokens.
 */
const MAX_TOKENS = 128;
const MAX_WORD_CHARS = 100;

// BERT's punctuation: every ASCII non-alphanumeric symbol, and Unicode punctuation (not other symbols, like ⌘).
const isPunctuation = (char) => /[!-/:-@[-`{-~]/.test(char) || /\p{P}/u.test(char);
const isControl = (char) => /[\p{Cc}\p{Cf}]/u.test(char) && !/\s/.test(char);
const isChinese = (char) => /\p{Script=Han}/u.test(char);

const normalize = (text) =>
  [...String(text)]
    .filter((char) => char !== '\u0000' && char !== '�' && !isControl(char))
    .map((char) => (isChinese(char) ? ` ${char} ` : char))
    .join('')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');

const preTokenize = (text) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => {
      const pieces = [];
      let current = '';
      for (const char of word) {
        if (!isPunctuation(char)) {
          current += char;
          continue;
        }

        if (current) pieces.push(current);
        pieces.push(char);
        current = '';
      }

      if (current) pieces.push(current);
      return pieces;
    });

export const createTokenizer = (tokenizerJson) => {
  const vocab = new Map(Object.entries(tokenizerJson.model.vocab));
  const unknown = vocab.get('[UNK]');
  const cls = vocab.get('[CLS]');
  const sep = vocab.get('[SEP]');

  const wordPieces = (word) => {
    if (word.length > MAX_WORD_CHARS) {
      return [unknown];
    }

    const ids = [];
    let start = 0;
    while (start < word.length) {
      let end = word.length;
      let found = null;
      while (start < end) {
        const piece = `${start > 0 ? '##' : ''}${word.slice(start, end)}`;
        if (vocab.has(piece)) {
          found = vocab.get(piece);
          break;
        }

        end -= 1;
      }

      if (found === null) {
        return [unknown];
      }

      ids.push(found);
      start = end;
    }

    return ids;
  };

  /** Token ids of `text` with [CLS] and [SEP], at most 128. */
  const encode = (text) => {
    const ids = preTokenize(normalize(text))
      .flatMap(wordPieces)
      .slice(0, MAX_TOKENS - 2);
    return [cls, ...ids, sep];
  };

  return { encode };
};
