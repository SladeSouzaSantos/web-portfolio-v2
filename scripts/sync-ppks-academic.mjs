// Uso: npm run sync:academic
// Importa apenas o snapshot público de uma revisão imutável do backend DEV.
// Dados de rede são não confiáveis: limites, schema e campos validados antes da escrita.
import { writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY = 'SladeSouzaSantos/phasscode-platform';
const BRANCH_API = 'https://api.github.com/repos/' + REPOSITORY + '/branches/dev';
const RAW_BASE = 'https://raw.githubusercontent.com/' + REPOSITORY + '/';
const OUTPUT_FILE = fileURLToPath(new URL('../src/data/ppks-academic.snapshot.json', import.meta.url));
const MAX_RESPONSE_BYTES = 512_000;
const MAX_SNAPSHOT_BYTES = 256_000;

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('PPKS: objeto inválido em ' + path);
  }
  return value;
}

function field(value, path, max = 320) {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error('PPKS: texto inválido em ' + path);
  }
  return value;
}

function optionalField(value, path, max = 320) {
  return value === null ? null : field(value, path, max);
}

function identifier(value, path) {
  const id = field(value, path, 120);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id)) {
    throw new Error('PPKS: identificador inválido em ' + path);
  }
  return id;
}

function status(value, path) {
  const result = field(value, path, 64);
  if (!/^[a-z][a-z0-9_]*$/u.test(result)) {
    throw new Error('PPKS: status inválido em ' + path);
  }
  return result;
}

function list(value, path, max) {
  if (!Array.isArray(value) || value.length > max) {
    throw new Error('PPKS: lista inválida em ' + path);
  }
  return value;
}

function uniqueIds(items, path) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error('PPKS: id duplicado em ' + path);
    ids.add(item.id);
  }
  return items;
}

function courseHours(value, path) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 20_000) {
    throw new Error('PPKS: carga horária inválida em ' + path);
  }
  return value;
}

export function buildSnapshot(metadata, educations, tracks) {
  const sha = field(record(record(metadata, 'metadata').commit, 'metadata.commit').sha, 'metadata.commit.sha', 40);
  if (!/^[a-f0-9]{40}$/u.test(sha)) throw new Error('PPKS: SHA inválido');

  if (record(educations, 'educations').schemaVersion !== '1.1' ||
      record(tracks, 'tracks').schemaVersion !== '1.1') {
    throw new Error('PPKS: versão do schema incompatível');
  }

  const validatedEducations = uniqueIds(
    list(educations.educations, 'educations.educations', 30).map((raw, index) => {
      const path = 'educations[' + index + ']';
      const e = record(raw, path);
      return {
        id: identifier(e.id, path + '.id'),
        title: field(e.title, path + '.title'),
        level: status(e.level, path + '.level'),
        institution: field(e.institution, path + '.institution'),
        issuer: field(e.issuer, path + '.issuer'),
        status: status(e.status, path + '.status'),
        completedAt: optionalField(e.completedAt, path + '.completedAt', 40),
        expectedWindow: optionalField(e.expectedWindow, path + '.expectedWindow', 500),
        competencies: list(e.competencies, path + '.competencies', 100)
          .map((value, i) => field(value, path + '.competencies[' + i + ']')),
        coursework: list(e.coursework, path + '.coursework', 150)
          .map((rawCourse, i) => {
            const course = record(rawCourse, path + '.coursework[' + i + ']');
            return {
              name: field(course.name, path + '.coursework[' + i + '].name'),
              status: status(course.status, path + '.coursework[' + i + '].status')
            };
          })
      };
    }), 'educations'
  );

  const validatedTracks = uniqueIds(
    list(tracks.tracks, 'tracks.tracks', 20).map((raw, index) => {
      const path = 'tracks[' + index + ']';
      const track = record(raw, path);
      return {
        id: identifier(track.id, path + '.id'),
        name: field(track.name, path + '.name'),
        courses: uniqueIds(list(track.courses, path + '.courses', 100)
          .map((rawCourse, i) => {
            const coursePath = path + '.courses[' + i + ']';
            const course = record(rawCourse, coursePath);
            return {
              id: identifier(course.id, coursePath + '.id'),
              title: field(course.title, coursePath + '.title'),
              provider: field(course.provider, coursePath + '.provider'),
              status: status(course.status, coursePath + '.status'),
              hours: courseHours(course.hours, coursePath + '.hours')
            };
          }), path + '.courses')
      };
    }), 'tracks'
  );

  if (validatedTracks.reduce((sum, track) => sum + track.courses.length, 0) !== 42) {
    throw new Error('PPKS: catálogo de cursos divergente');
  }

  const cs = validatedEducations.find(e => e.id === 'formacao-computacao');
  if (cs?.status !== 'pending_completion' || !cs.expectedWindow?.includes('2028')) {
    throw new Error('PPKS: UNISUL com registro ou previsão inconsistentes');
  }

  return {
    schemaVersion: '1.1',
    sourceRepository: REPOSITORY,
    sourceBranch: 'dev',
    sourceCommit: sha,
    educations: validatedEducations,
    tracks: validatedTracks
  };
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'PHASSCODE-Academic-Sync', Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error('Falha ao consultar PPKS (HTTP ' + response.status + ')');
  const advertisedLength = Number(response.headers.get('content-length') || 0);
  if (advertisedLength > MAX_RESPONSE_BYTES || !response.body) {
    throw new Error('PPKS: resposta remota excessiva ou vazia');
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > MAX_RESPONSE_BYTES) throw new Error('PPKS: resposta remota excede limite');
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('PPKS: JSON remoto inválido');
  }
}

export async function syncAcademic() {
  // A revisão vem da API do GitHub, nunca de URL ou caminho recebido no JSON.
  const metadata = await getJson(BRANCH_API);
  const sha = record(record(metadata, 'metadata').commit, 'metadata.commit').sha;
  if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/u.test(sha)) {
    throw new Error('PPKS: SHA remoto inválido');
  }
  const revisionRoot = RAW_BASE + sha + '/knowledge/ppks/academic/';
  const [educations, tracks] = await Promise.all([
    getJson(revisionRoot + 'educations.json'),
    getJson(revisionRoot + 'tracks.json')
  ]);
  const snapshot = buildSnapshot(metadata, educations, tracks);
  const content = JSON.stringify(snapshot, null, 2) + '\n';
  if (Buffer.byteLength(content, 'utf8') > MAX_SNAPSHOT_BYTES) {
    throw new Error('PPKS: snapshot excede limite de publicação');
  }

  // Apenas um destino estático, sem interpolar paths vindos da rede.
  // A substituição só ocorre depois de todas as validações e da escrita temporária.
  const tempFile = OUTPUT_FILE + '.tmp-' + process.pid;
  try {
    await writeFile(tempFile, content, { flag: 'wx', mode: 0o600 });
    await rename(tempFile, OUTPUT_FILE);
  } catch (error) {
    await rm(tempFile, { force: true }).catch(() => {});
    throw error;
  }
  console.info('Snapshot acadêmico validado, revisão ' + sha + ': ' +
    snapshot.educations.length + ' formações, ' + snapshot.tracks.length + ' trilhas.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await syncAcademic();
}
