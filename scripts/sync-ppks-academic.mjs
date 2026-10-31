// Uso: node scripts/sync-ppks-academic.mjs
// Atualiza somente o snapshot público usando knowledge/ppks/academic no backend dev.
// Ausência de acesso à rede falha sem alterar os dados publicados.
import { writeFile } from 'node:fs/promises';
const root = 'https://raw.githubusercontent.com/SladeSouzaSantos/phasscode-platform/dev/knowledge/ppks/academic';
const branch = 'https://api.github.com/repos/SladeSouzaSantos/phasscode-platform/branches/dev';
const get = async url => {
  const response = await fetch(url, { headers: { 'User-Agent': 'PHASSCODE-Academic-Sync' } });
  if (!response.ok) throw new Error(`Falha ao consultar PPKS (${response.status})`);
  return response.json();
};
const [metadata, educations, tracks] = await Promise.all([
  get(branch), get(`${root}/educations.json`), get(`${root}/tracks.json`)
]);
if (educations.schemaVersion !== '1.1' || tracks.schemaVersion !== '1.1')
  throw new Error('Versão do schema PPKS incompatível');
if (tracks.tracks.reduce((sum, track) => sum + track.courses.length, 0) !== 42)
  throw new Error('Catálogo de cursos divergente');
const snapshot = {
  schemaVersion: '1.1',
  sourceRepository: 'SladeSouzaSantos/phasscode-platform',
  sourceBranch: 'dev',
  sourceCommit: metadata.commit.sha,
  educations: educations.educations.map(e => ({
    id:e.id,title:e.title,level:e.level,institution:e.institution,issuer:e.issuer,
    status:e.status,completedAt:e.completedAt,expectedWindow:e.expectedWindow,
    competencies:e.competencies,
    coursework:e.coursework.map(c => ({name:c.name,status:c.status}))
  })),
  tracks: tracks.tracks.map(t => ({
    id:t.id,name:t.name,courses:t.courses.map(c => ({
      id:c.id,title:c.title,provider:c.provider,status:c.status,hours:c.hours
    }))
  }))
};
const cs=snapshot.educations.find(x=>x.id==='formacao-computacao');
if(cs?.status !== 'pending_completion' || !cs.expectedWindow.includes('2028'))
  throw new Error('UNISUL: registro ou previsão inconsistentes');
await writeFile('src/data/ppks-academic.snapshot.json', JSON.stringify(snapshot,null,2)+'\n');
console.info(`Snapshot gerado a partir de ${metadata.commit.sha}: ${snapshot.educations.length} formações, ${snapshot.tracks.length} trilhas.`);
