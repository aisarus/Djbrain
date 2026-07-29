import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class JsonlStore {
  constructor(path) {
    if (!path) throw new TypeError('path is required');
    this.path = path;
  }

  async init() {
    await mkdir(dirname(this.path), { recursive: true });
    try { await appendFile(this.path, '', 'utf8'); } catch (error) { throw new Error(`store_init_failed:${error.message}`); }
    return this;
  }

  async append(record) {
    validateRecord(record);
    await this.init();
    await appendFile(this.path, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  async readAll() {
    await this.init();
    const raw = await readFile(this.path, 'utf8');
    const records = [];
    const errors = [];
    raw.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      try { records.push(JSON.parse(line)); }
      catch (error) { errors.push({ line: index + 1, error: error.message }); }
    });
    return { records, errors };
  }

  async compact(selectLatest = defaultSelectLatest) {
    const { records, errors } = await this.readAll();
    if (errors.length) return { compacted: false, errors };
    const compacted = selectLatest(records);
    const temp = `${this.path}.tmp`;
    await writeFile(temp, compacted.map((record) => JSON.stringify(record)).join('\n') + (compacted.length ? '\n' : ''), 'utf8');
    await rename(temp, this.path);
    return { compacted: true, count: compacted.length };
  }
}

function defaultSelectLatest(records) {
  const map = new Map();
  for (const record of records) map.set(record.id, record);
  return [...map.values()];
}

function validateRecord(record) {
  if (!record || typeof record !== 'object') throw new TypeError('record must be an object');
  if (!record.id) throw new TypeError('record.id is required');
}
