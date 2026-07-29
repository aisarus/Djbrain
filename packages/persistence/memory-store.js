export class MemoryStore {
  constructor(seed = []) {
    this.records = structuredClone(seed);
  }

  async init() {
    return this;
  }

  async append(record) {
    validateRecord(record);
    this.records.push(structuredClone(record));
    return record;
  }

  async readAll() {
    return { records: structuredClone(this.records), errors: [] };
  }

  async compact(selectLatest = defaultSelectLatest) {
    this.records = structuredClone(selectLatest(this.records));
    return { compacted: true, count: this.records.length };
  }

  clear() {
    this.records = [];
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
