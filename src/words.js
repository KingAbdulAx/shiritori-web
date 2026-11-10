// Loads the word list for pass-and-play. Online games validate on the server instead.
import wordsUrl from '../server/words.txt?url';
import { createDictionary } from '../server/dictionary.js';

let loading = null;

export function loadDictionary() {
    if (!loading) {
        loading = fetch(wordsUrl)
            .then((res) => {
                if (!res.ok) throw new Error(`Word list failed to load (${res.status})`);
                return res.text();
            })
            .then(createDictionary)
            .catch((err) => {
                loading = null; // allow a retry
                throw err;
            });
    }
    return loading;
}
