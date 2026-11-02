import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const FIELDS = ["claim", "source", "observed", "how", "recheckWhen"];

export function observation(name) {
  const where = `observations/${name}.json`;
  const record = JSON.parse(readFileSync(path.join(HERE, `${name}.json`), "utf8"));
  for (const field of FIELDS) {
    if (typeof record[field] !== "string" || record[field].trim() === "") throw new Error(`${where} has no ${field}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.observed)) throw new Error(`${where} gives "observed" as ${record.observed}, not a date`);
  if (("evidence" in record) === ("evidenceFile" in record)) throw new Error(`${where} needs exactly one of evidence and evidenceFile`);
  if (!("evidenceFile" in record)) return record;
  const text = readFileSync(path.join(HERE, path.dirname(name), record.evidenceFile), "utf8");
  const loaded = { ...record, evidence: record.evidenceFile.endsWith(".json") ? JSON.parse(text) : text };
  delete loaded.evidenceFile;
  return loaded;
}
