import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot } from '../../scripts/sync-ppks-academic.mjs';

function fixture() {
  return {
    metadata: { commit: { sha: 'a'.repeat(40) } },
    educations: {
      schemaVersion: '1.1',
      educations: [{
        id: 'formacao-computacao',
        title: 'Ciência da Computação',
        level: 'bachelor',
        institution: 'UNISUL',
        issuer: 'UNISUL',
        status: 'pending_completion',
        completedAt: null,
        expectedWindow: '2027 ou 2028',
        competencies: ['Algoritmos'],
        coursework: [{ name: 'Programação', status: 'approved' }]
      }]
    },
    tracks: {
      schemaVersion: '1.1',
      tracks: [{
        id: 'cursos-java',
        name: 'Java',
        courses: Array.from({ length: 42 }, (_, i) => ({
          id: 'curso-' + i,
          title: 'Curso ' + i,
          provider: 'Alura',
          status: 'completed',
          hours: null
        }))
      }]
    }
  };
}

function build(f) {
  return buildSnapshot(f.metadata, f.educations, f.tracks);
}

test('cria snapshot somente com campos públicos validados e revisão imutável', () => {
  const f = fixture();
  f.educations.educations[0].credential = 'dado que não deve ser publicado';
  const snapshot = build(f);
  assert.equal(snapshot.sourceCommit, 'a'.repeat(40));
  assert.equal(snapshot.sourceBranch, 'dev');
  assert.equal(snapshot.educations.length, 1);
  assert.equal(snapshot.tracks[0].courses.length, 42);
  assert.equal(Object.hasOwn(snapshot.educations[0], 'credential'), false);
});

test('bloqueia SHA inválido', () => {
  const f = fixture();
  f.metadata.commit.sha = '../branch';
  assert.throws(() => build(f), /SHA/);
});

test('bloqueia schema incompatível', () => {
  const f = fixture();
  f.tracks.schemaVersion = '2.0';
  assert.throws(() => build(f), /schema/);
});

test('bloqueia campos ausentes e tipos inesperados', () => {
  const f = fixture();
  f.educations.educations[0].competencies = 'Java';
  assert.throws(() => build(f), /lista/);
});

test('bloqueia caracteres de controle em texto importado', () => {
  const f = fixture();
  f.educations.educations[0].title = 'Curso\ninjetado';
  assert.throws(() => build(f), /texto inválido/);
});

test('bloqueia identificadores inválidos e duplicados', () => {
  const f = fixture();
  f.tracks.tracks[0].courses[0].id = '../fora';
  assert.throws(() => build(f), /identificador/);
  f.tracks.tracks[0].courses[0].id = 'curso-1';
  assert.throws(() => build(f), /duplicado/);
});

test('bloqueia catálogo incompleto', () => {
  const f = fixture();
  f.tracks.tracks[0].courses.pop();
  assert.throws(() => build(f), /catálogo/);
});

test('preserva a regra acadêmica da UNISUL', () => {
  const f = fixture();
  f.educations.educations[0].status = 'completed';
  assert.throws(() => build(f), /UNISUL/);
});

test('bloqueia hora inválida', () => {
  const f = fixture();
  f.tracks.tracks[0].courses[0].hours = -200;
  assert.throws(() => build(f), /carga horária/);
});
