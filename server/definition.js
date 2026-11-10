// Best-effort definition lookup for display only. Never used to decide whether a word is valid.

export async function fetchDefinition(word, { timeoutMs = 2500 } = {}) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meaning = data?.[0]?.meanings?.[0];
    const definition = meaning?.definitions?.[0]?.definition || null;
    if (!definition) return null;
    return { word, definition, partOfSpeech: meaning?.partOfSpeech || null };
  } catch {
    return null;
  }
}
