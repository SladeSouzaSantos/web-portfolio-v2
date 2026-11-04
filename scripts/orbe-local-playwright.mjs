#!/usr/bin/env node
/**
 * Orbe recruiter E2E through a REAL Chromium browser; standalone local runner.
 * No GitHub Actions, no mocks, no deployments, no branch changes, no retries.
 * Explicit --execute and strict request cap protect production/LLM budgets.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const TARGETS = Object.freeze({
  dev: { frontend: 'https://devgbc.phasscode.com', api: 'https://devapi.phasscode.com' },
  main: { frontend: 'https://gbc.phasscode.com', api: 'https://api.phasscode.com' },
});
const REFUSAL = 'Posso apresentar a experiência profissional, as competências, a formação e os projetos de Pedro Santos.';
const FULL_DURATION = /10\s+anos\s+e\s+10\s+meses/i;
const JOB_IDS = ['experiencia-acrux','experiencia-sig','experiencia-geowellex','experiencia-greencity'];

const SCENARIOS = [
  { id: 'contexto-anos-go', mode: 'smoke', turns: [
    { question: 'Pedro tem experiência com programação?', kind: 'programming' },
    { question: 'Quabtos anos?', kind: 'duration-followup' },
    { question: 'E sobre Go?', kind: 'go' },
  ] },
  { id: 'typo-carreira-go', mode: 'smoke', turns: [
    { question: 'Pedtro têm experiência?', kind: 'career' },
    { question: 'E com o GO?', kind: 'go' },
  ] },
  { id: 'java-direto', mode: 'smoke', turns: [
    { question: 'Pedro sabe Java?', kind: 'java' },
  ] },
  { id: 'java-react', mode: 'extended', turns: [
    { question: 'Pedro tem experiência profissional com Java?', kind: 'java' },
    { question: 'E quais projetos React?', kind: 'react' },
  ] },
  { id: 'ia-aplicada', mode: 'extended', turns: [
    { question: 'O que podes falar sobre Pedro com relação a IA?', kind: 'ai' },
  ] },
  { id: 'duracao-direta', mode: 'extended', turns: [
    { question: 'Quantos anos de experiência Pedro tem com programação?', kind: 'duration' },
  ] },
  { id: 'flutter', mode: 'extended', turns: [
    { question: 'Pedro tem experiência com Flutter?', kind: 'flutter' },
  ] },
  { id: 'graduacao', mode: 'extended', turns: [
    { question: 'Pedro já concluiu Ciência da Computação na UNISUL?', kind: 'education' },
  ] },
];

function usage() {
  console.log(`Orbe Playwright local — sem GitHub Actions

  node scripts/orbe-local-playwright.mjs --env dev --suite smoke
  node scripts/orbe-local-playwright.mjs --env dev --suite smoke --execute
  node scripts/orbe-local-playwright.mjs --env main --suite smoke --execute
  node scripts/orbe-local-playwright.mjs --env both --suite extended --max-requests 24 --execute

Opções:
  --env dev|main|both        Destino (main = produção; independe da branch local)
  --suite smoke|extended    6 ou 12 mensagens por ambiente
  --execute                 Autoriza chamadas reais à API e ao modelo (sem retries)
  --max-requests N          Limite global; padrão 12, máximo 40
  --headed                  Abre Chromium visível (padrão headless)
  --tag IDENTIFICADOR       Ex.: shadow-on ou baseline; não comprova modo remoto
  --report-dir CAMINHO      Pasta base de relatórios (padrão reports/orbe-local)
  --self-test               Valida verificadores offline; não acessa rede
  --help                    Ajuda

A execução envia perguntas reais, pode consumir quota LLM e persistir conversas
no ambiente selecionado. Não captura screenshots, tracing, vídeos ou credenciais.
`);
}
function parseArgs(args) {
  const parsed = { env: undefined, suite: 'smoke', execute: false, selfTest: false, maxRequests: 12, headed: false, tag: 'manual', reportDir: 'reports/orbe-local' };
  for (let i=0; i<args.length; i++) {
    const flag=args[i];
    if (flag==='--help'||flag==='-h') return null;
    if (flag==='--execute'||flag==='--headed'||flag==='--self-test') { parsed[flag==='--self-test'?'selfTest':flag.slice(2)] = true; continue; }
    if (['--env','--suite','--max-requests','--tag','--report-dir'].includes(flag)) {
      if (!args[i+1] || args[i+1].startsWith('--')) throw new Error(`Faltando valor para ${flag}`);
      const value=args[++i];
      const key=({ '--max-requests':'maxRequests', '--report-dir':'reportDir' })[flag] ?? flag.slice(2);
      parsed[key]=value;
      continue;
    }
    throw new Error(`Argumento não reconhecido: ${flag}`);
  }
  if (parsed.selfTest) return parsed;
  if (!['dev','main','both'].includes(parsed.env)) throw new Error('Use --env dev|main|both');
  if (!['smoke','extended'].includes(parsed.suite)) throw new Error('Use --suite smoke|extended');
  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(parsed.tag)) throw new Error('--tag deve conter 1 a 48 caracteres alfanuméricos, _ ou -');
  if (!/^(?:[1-9]|[1-3][0-9]|40)$/.test(String(parsed.maxRequests))) throw new Error('--max-requests deve estar entre 1 e 40');
  parsed.maxRequests=Number(parsed.maxRequests);
  return parsed;
}
function redact(value) {
  return String(value ?? '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]{8,}/gi,'Bearer [REDACTED]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|AIza[A-Za-z0-9_-]{20,})\b/g,'[REDACTED_KEY]')
    .replace(/\b[A-Za-z0-9_-]{70,}\b/g,'[REDACTED_LONG_VALUE]');
}
function sourceSafe(source) {
  let url;
  try { if(source.url) {const u=new URL(source.url);if(['http:','https:'].includes(u.protocol))url=u.origin+u.pathname; } } catch { /* omit invalid URL */ }
  return {id: redact(String(source.id??'').slice(0,120)),title:redact(String(source.title??'').slice(0,160)),...(url?{url}: {})};
}
const plain = value => String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function assess(turn, answer, sourceIds, response) {
  const checks=[];
  const check=(name,ok,kind='fail')=>checks.push({name,status:ok?'pass':kind});
  const normalized=plain(answer);
  const has=(expression)=>expression.test(normalized);
  check('resposta substantiva',answer.trim().length>=35);
  check('sem resposta genérica de escopo',!answer.includes(REFUSAL));
  check('fontes públicas presentes',sourceIds.length>0 && sourceIds.length<=10);
  check('LLM real (não mock)',response?.meta?.simulated!==true&&response?.meta?.provider!=='mock');
  if(turn.kind==='programming') check('evidência de programação',has(/java|php|python|flutter|programa|sigaa|typescript/));
  if(turn.kind==='career') {
    for(const id of JOB_IDS)check(`fonte ${id}`,sourceIds.includes(id));
    check('não reduz carreira a subtotal exclusivo',!has(/\b19 meses\b|\b1 ano e 7 meses\b/));
  }
  if(turn.kind==='duration'||turn.kind==='duration-followup') {
    check('duração total 10a10m documentada',FULL_DURATION.test(answer));
    check('não nega cálculo consolidado',!has(/nao ha calculo consolidado|nao existe calculo consolidado/));
    for(const id of JOB_IDS)check(`duração inclui ${id}`,sourceIds.includes(id));
  }
  if(turn.kind==='go') {
    check('tema Go/Golang preservado',has(/\bgo\b|golang/));
    check('não atribui experiência direta Go indevidamente',has(/nao ha experiencia|sem experiencia profissional|nao possui experiencia|nunca trabalhou|nao foi documentad|nao ha registro/));
    check('competências transferíveis contextualizadas',has(/java|typescript|backend|api|transfer/),'review');
  }
  if(turn.kind==='java') {
    check('experiência Java identificada',has(/\bjava\b/));
    check('evidência SIGAA ou ACRUX',sourceIds.some(id=>['experiencia-sig','experiencia-acrux'].includes(id)));
  }
  if(turn.kind==='react')check('projeto React identificado',has(/react/) && sourceIds.some(id=>id==='web-portfolio-v2'));
  if(turn.kind==='flutter')check('Flutter contextualizado',has(/flutter/) && sourceIds.some(id=>['experiencia-greencity','greencity-os','greencity-sdgp'].includes(id)));
  if(turn.kind==='ai') {
    check('projetos concretos de IA',has(/phasscode|greencity os|langchain|llm/));
    check('evita lista de lacunas não solicitadas',!has(/pytorch.{0,50}tensorflow|nao ha comprovacao.{0,100}sql server|nao ha comprovacao.{0,100}certific/),'review');
    check('revisar associação de HSP a treinamento/ML',!has(/hsp simulator.{0,110}(ia aplicada|inteligencia artificial|machine learning)/),'review');
  }
  if(turn.kind==='education')check('UNISUL não apresentada como concluída',has(/unisul|ciencia da computacao/)&&has(/nao conclu|pendente|em andamento|nao finaliz/));
  return checks;
}
function escapeMd(value) { return String(value??'').replace(/\r/g,'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\|/g,'\\|').replace(/```/g,'` ` `'); }
function verdict(checks){return checks.some(c=>c.status==='fail')?'FAIL':checks.some(c=>c.status==='review')?'REVIEW':'PASS';}
function summarize(report){const turns=report.turns;return {total:turns.length,pass:turns.filter(x=>x.verdict==='PASS').length,review:turns.filter(x=>x.verdict==='REVIEW').length,fail:turns.filter(x=>x.verdict==='FAIL').length,latencyMs:turns.filter(x=>Number.isFinite(x.durationMs)).map(x=>x.durationMs)};}
async function render(report, folder) {
  const s=summarize(report);
  const name=`${report.target}`;
  const jsonPath=resolve(folder,`${name}.json`);
  const mdPath=resolve(folder,`${name}.md`);
  await writeFile(jsonPath,JSON.stringify({...report,summary:s},null,2)+'\n','utf8');
  const lines=[
    `# Orbe — Playwright local — ${report.target.toUpperCase()}`,'',
    `**Coleta:** ${report.startedAt}  |  **Suíte:** ${report.suite}  |  **Tag informada:** ${report.tag}`,
    `**Frontend:** ${report.frontend}  |  **API:** ${report.api}`,
    '**Shadow:** não verificável pelo chat público. A tag é apenas uma anotação do operador.','',
    `**Resumo:** ${s.total} respostas: ${s.pass} PASS, ${s.review} REVIEW, ${s.fail} FAIL.`,'',
    '| Cenário | Pergunta | Resultado | HTTP | Duração | Fontes |','|---|---|---|---:|---:|---:|',
  ];
  for (const turn of report.turns)lines.push(`| ${escapeMd(turn.scenario)} | ${escapeMd(turn.question)} | ${turn.verdict} | ${turn.httpStatus??'—'} | ${turn.durationMs??'—'} ms | ${turn.sources.length} |`);
  lines.push('','## Respostas e critérios','');
  for (const [i,turn] of report.turns.entries()) {
    lines.push(`### ${i+1}. ${escapeMd(turn.question)}`,'',`**Cenário:** ${escapeMd(turn.scenario)} · **Resultado:** ${turn.verdict} · **HTTP:** ${turn.httpStatus??'—'} · **Tempo:** ${turn.durationMs??'—'} ms`,'',
      '**Resposta pública:**','',escapeMd(turn.answer||'(sem resposta)'),'','**Fontes:**',
      turn.sources.map(s=>`- ${escapeMd(s.id)} — ${escapeMd(s.title)}${s.url?` (${escapeMd(s.url)})`:''}`).join('\n')||'- Nenhuma','',
      '**Critérios:**',...turn.checks.map(c=>`- ${c.status.toUpperCase()}: ${escapeMd(c.name)}`),'');
  }
  lines.push('## Interpretação','','PASS/REVIEW/FAIL são verificações automatizadas, não auditoria factual completa.','Não atribua diferenças de respostas ao GraphRAG shadow: nesse modo o grafo não altera a resposta pública.','Arquivos não contêm conversationId, conversationToken, cookies nem headers de autenticação. O texto da resposta pública é redigido contra padrões comuns de credenciais.','');
  await writeFile(mdPath,lines.join('\n'),'utf8');
  return {jsonPath,mdPath};
}
function getScenarios(suite){return SCENARIOS.filter(item=>suite==='extended'||item.mode==='smoke');}
async function runOne(target, opts, browser, folder) {
  const endpoints=TARGETS[target];
  const report={schemaVersion:1,runner:'standalone-playwright',target,tag:opts.tag,suite:opts.suite,startedAt:new Date().toISOString(),frontend:endpoints.frontend,api:endpoints.api,turns:[],notes:[]};
  let stopForBudget=false;
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  try {
    for(const scenario of getScenarios(opts.suite)){
      if(stopForBudget)break;
      const page=await context.newPage();
      let previous;
      try {
        await page.goto(endpoints.frontend+'/#sobre',{waitUntil:'domcontentloaded',timeout:35_000});
        await page.getByRole('button',{name:'Abrir guia do portfólio',exact:true}).click({timeout:20_000});
        const dialog=page.getByRole('dialog',{name:/CONSULTAR ORBE MÁGICO/});
        await dialog.waitFor({state:'visible',timeout:20_000});
        const input=dialog.getByRole('textbox',{name:'Sua pergunta ao orbe',exact:true});
        const send=dialog.getByRole('button',{name:'ENVIAR',exact:true});
        for(const turn of scenario.turns){
          const started=Date.now();let httpStatus=null,answer='',sources=[],checks=[],responseMeta=null;
          try{
            const responsePromise=page.waitForResponse(resp=>resp.url()===endpoints.api+'/api/v1/chat'&&resp.request().method()==='POST',{timeout:90_000});
            await input.fill(turn.question,{timeout:15_000});
            await send.click({timeout:20_000});
            const reply=await responsePromise;
            httpStatus=reply.status();
            const request=reply.request();
            const requestPayload=request.postDataJSON();
            if(requestPayload?.message!==turn.question)throw new Error('Mensagem enviada pelo navegador não corresponde à pergunta.');
            const body=await reply.json().catch(()=>null);
            if(httpStatus===429||httpStatus===503||httpStatus===402){stopForBudget=true;report.notes.push(`Interrompido após HTTP ${httpStatus} para evitar consumo/retries adicionais.`);}
            if(!reply.ok())throw new Error(`API respondeu HTTP ${httpStatus}`);
            if(!body||typeof body.answer!=='string'||!Array.isArray(body.sources)||!body.meta)throw new Error('Resposta fora do contrato público.');
            if(previous){
              checks.push({name:'continuidade de conversa preservada',status:
                body.conversationId===previous.conversationId&&requestPayload.conversationId===previous.conversationId&&
                Boolean(request.headers()['x-conversation-token'])&&!Object.hasOwn(body,'conversationToken')?'pass':'fail'});
            }else{
              checks.push({name:'nova conversa autenticada pelo frontend',status:
                typeof body.conversationToken==='string'&&typeof body.conversationId==='string'&&
                !requestPayload.conversationId?'pass':'fail'});
            }
            previous={conversationId:body.conversationId}; // no persisted IDs or tokens
            answer=redact(body.answer.slice(0,7500));
            sources=body.sources.slice(0,12).map(sourceSafe);
            responseMeta={provider:String(body.meta.provider??''),simulated:body.meta.simulated===true};
            checks.push(...assess(turn,answer,sources.map(s=>s.id),body));
          }catch(error){
            const message=error instanceof Error?error.message:'Falha desconhecida';
            checks.push({name:redact(message).slice(0,220),status:'fail'});
          }
          const record={scenario:scenario.id,kind:turn.kind,question:turn.question,httpStatus,durationMs:Date.now()-started,answer,sources,provider:responseMeta?.provider??null,simulated:responseMeta?.simulated??null,checks,verdict:verdict(checks)};
          report.turns.push(record);
          console.log(`[${target}] ${record.verdict.padEnd(6)} ${String(httpStatus??'ERR').padEnd(3)} ${String(record.durationMs).padStart(6)}ms ${scenario.id} — ${turn.question}`);
          if(record.verdict==='FAIL'||stopForBudget)break;
        }
      }catch(error){
        const message=redact(error instanceof Error?error.message:'Não foi possível abrir o Orbe').slice(0,220);
        report.turns.push({scenario:scenario.id,kind:'ui',question:'Abrir Orbe no navegador',httpStatus:null,durationMs:null,answer:'',sources:[],provider:null,simulated:null,checks:[{name:message,status:'fail'}],verdict:'FAIL'});
        console.log(`[${target}] FAIL   UI — ${scenario.id}: ${message}`);
      }finally{await page.close().catch(()=>{});}
    }
  }finally{await context.close().catch(()=>{});}
  const files=await render(report,folder);
  return {report,summary:summarize(report),files};
}
async function compareReports(first,second,folder){
  const key=t=>`${t.scenario}::${t.question}`;
  const map=new Map(second.turns.map(t=>[key(t),t]));
  const rows=[];
  for(const a of first.turns){const b=map.get(key(a));if(!b)continue;
    const h=x=>createHash('sha256').update(x.answer??'').digest('hex').slice(0,12);
    const overlap=new Set(a.sources.map(s=>s.id));
    rows.push({scenario:a.scenario,question:a.question,dev:a.verdict,main:b.verdict,devMs:a.durationMs,mainMs:b.durationMs,answerSame:h(a)===h(b),sharedSources:b.sources.filter(s=>overlap.has(s.id)).length});
  }
  const out={comparison:'descriptive',createdAt:new Date().toISOString(),note:'Diferenças não provam efeito causal de GraphRAG shadow; código, ambiente, LLM e amostragem podem diferir.',rows};
  await writeFile(resolve(folder,'comparison.json'),JSON.stringify(out,null,2)+'\n');
  const md=['# Comparação DEV × MAIN','',out.note,'','| Pergunta | DEV | MAIN | DEV ms | MAIN ms | Resposta igual? | Fontes comuns |','|---|---|---|---:|---:|---|---:|'];
  for(const r of rows)md.push(`| ${escapeMd(r.question)} | ${r.dev} | ${r.main} | ${r.devMs??'—'} | ${r.mainMs??'—'} | ${r.answerSame?'sim':'não'} | ${r.sharedSources} |`);
  await writeFile(resolve(folder,'comparison.md'),md.join('\n')+'\n');
}
function selfTest(){
  assert.equal(getScenarios('smoke').reduce((n,s)=>n+s.turns.length,0),6);
  assert.equal(getScenarios('extended').reduce((n,s)=>n+s.turns.length,0),12);
  assert.equal(redact('Bearer SECRET_ABCDEFGHIJKLMNOPQRST').includes('SECRET_'),false);
  const ai={meta:{provider:'openai-compatible',simulated:false}};
  const ids=JOB_IDS;
  assert.equal(verdict(assess({kind:'duration'},'Pedro possui aproximadamente 10 anos e 10 meses. Geowellex e Greencity.',ids,ai)),'PASS');
  assert.equal(verdict(assess({kind:'duration-followup'},'Pedro tem 19 meses e não há cálculo consolidado.',ids.slice(0,2),ai)),'FAIL');
  assert.equal(verdict(assess({kind:'go'},REFUSAL,ids.slice(0,1),ai)),'FAIL');
  assert.equal(verdict(assess({kind:'go'},'Não há experiência profissional com Go (Golang) comprovada. Experiência em Java e APIs permite competências transferíveis.',ids,ai)),'PASS');
  assert.equal(verdict(assess({kind:'java'},'Sim, Java e SIGAA.',ids,{meta:{provider:'mock',simulated:true}})),'FAIL');
  console.log('SELF_TEST_OK: limites, redação e verificadores funcionais (sem chamadas externas)');
}
async function main(){
  let opts;try{opts=parseArgs(process.argv.slice(2));}catch(error){console.error(error.message);usage();process.exitCode=2;return;}
  if(opts===null){usage();return;}
  if(opts.selfTest){selfTest();return;}
  const targets=opts.env==='both'?['dev','main']:[opts.env];
  const planned=targets.length*getScenarios(opts.suite).reduce((sum,item)=>sum+item.turns.length,0);
  console.log(`Destino: ${targets.join(' + ')} | Suíte: ${opts.suite} | Chamadas planejadas: ${planned} | Limite global: ${opts.maxRequests}`);
  console.log('Não usa workflows, mocks, screenshots, vídeos, traces ou credenciais de visitante no relatório.');
  if(!opts.execute){console.log('MODO PLANEJAMENTO — nenhum endpoint consultado. Adicione --execute para executar.');return;}
  if(planned>opts.maxRequests){console.error(`Bloqueado: plano de ${planned} mensagens excede --max-requests ${opts.maxRequests}.`);process.exitCode=2;return;}
  const safeStamp=new Date().toISOString().replace(/[:.]/g,'-');
  const folder=resolve(opts.reportDir,`${safeStamp}-${opts.env}-${opts.suite}-${opts.tag}`);
  await mkdir(folder,{recursive:true});
  let chromium;
  try{({chromium}=await import('@playwright/test'));}catch{
    console.error('Dependência @playwright/test ausente. Execute: npm ci');process.exitCode=2;return;
  }
  let browser;
  try{browser=await chromium.launch({headless:!opts.headed});}catch{
    console.error('Não foi possível iniciar Chromium. Execute: npx playwright install chromium');process.exitCode=2;return;
  }
  const results={};
  try{for(const target of targets)results[target]=await runOne(target,opts,browser,folder);}finally{await browser.close();}
  if(results.dev&&results.main)await compareReports(results.dev.report,results.main.report,folder);
  console.log(`\nRELATORIOS: ${folder}`);
  for(const [name,res] of Object.entries(results))console.log(`${name}: ${res.summary.pass} PASS, ${res.summary.review} REVIEW, ${res.summary.fail} FAIL — ${res.files.mdPath}`);
  console.log('Compartilhe os arquivos .md e .json; não envie nenhum token, header ou segredo.');
  if(Object.values(results).some(v=>v.summary.fail>0))process.exitCode=1;
}
main().catch(error=>{console.error('Falha inesperada no executor:',redact(error instanceof Error?error.message:String(error)));process.exitCode=2;});