import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { HistoryConflict, historySchema, type HistoryStore } from './history';

export function createFileHistoryStore(path: string): HistoryStore {
  function read() {
    let contents: string;
    try {
      contents = readFileSync(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    // ASVS 2.2.1: corrupt history must never silently become an empty document.
    if (Buffer.byteLength(contents) > 1_000_000) throw new Error('History exceeds size limit');
    return {
      document: historySchema.parse(JSON.parse(contents)),
      etag: createHash('sha256').update(contents).digest('hex')
    };
  }
  return {
    read: async () => read(),
    async write(document, etag) {
      // ASVS 15.4.1: the Pages workflow serializes all writers; stale revisions are rejected.
      if (read()?.etag !== etag) throw new HistoryConflict();
      const contents = JSON.stringify(historySchema.parse(document), null, 2) + '\n';
      mkdirSync(dirname(path), { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        // ASVS 15.4.2: atomic replacement prevents a failed write leaving partial history.
        writeFileSync(temporary, contents, { flag: 'wx' });
        renameSync(temporary, path);
      } finally {
        try {
          unlinkSync(temporary);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
    }
  };
}
