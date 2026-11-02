import type { Formacao as FormacaoItem, Trilha } from '../types/portfolio';
import academicSnapshot from './ppks-academic.snapshot.json';

const academicById = new Map(academicSnapshot.educations.map(education => [education.id, education]));
const academicRecordIds: Record<string,string> = {
  'computacao': 'formacao-computacao',
  'gestao-ti': 'formacao-gestao-ti',
  'petroleo': 'formacao-petroleo',
  'eletrica': 'formacao-energia-eletrica',
  'eletrotecnica': 'formacao-eletrotecnica',
  'eolica': 'formacao-eolica',
  'java-applied': 'formacao-unipds-java',
  'engenharia-ia': 'formacao-unipds-ia',
};
export const origemAcademica = {
  schemaVersion: academicSnapshot.schemaVersion,
  sourceCommit: academicSnapshot.sourceCommit,
  sourceBranch: academicSnapshot.sourceBranch,
};


// Catálogo preservado da versão original; revisar datas e situação antes de publicar.
const formacoesLayout: FormacaoItem[] = [
  {
    id: 'computacao', titulo: 'Ciência da Computação', tipo: 'Graduação', instituicao: 'UNISUL',
    periodo: 'Previsão indicativa: fim de 2027 / início de 2028', situacao: 'Conclusão pendente',
    cor: '#164b91', icone: 'capelo',
    descricao: 'Disciplinas aprovadas de algoritmos, programação, engenharia de software, sistemas distribuídos, IA e dados. A graduação ainda não foi concluída.', observacao: 'Atividades de extensão com visitas presenciais pendentes; previsão de conclusão não garantida.', comprovante: '',
  },
  {
    id: 'gestao-ti', titulo: 'Gestão da Tecnologia da Informação', tipo: 'Tecnólogo', instituicao: 'UNIBF',
    periodo: 'Concluída: 08/2025', situacao: 'Concluído',
    cor: '#17744f', icone: 'engrenagem',
    descricao: 'Tecnólogo superior concluído, com disciplinas de algoritmos, POO, banco de dados, IA, engenharia de software e testes.', observacao: 'Diploma emitido pelo Centro Universitário ETEP; UNIBF é a identificação usada no portfólio.', comprovante: '',
  },
  {
    id: 'petroleo', titulo: 'Engenharia de Petróleo e Gás', tipo: 'Graduação', instituicao: 'UnP',
    periodo: 'Concluída: 12/2014', situacao: 'Concluído',
    cor: '#982e3a', icone: 'torre',
    descricao: 'Formação em engenharia com enfoque em sistemas e operações na indústria de petróleo e gás.', comprovante: '',
  },
  {
    id: 'eletrica', titulo: 'Engenharia Elétrica e Sistemas de Energia', tipo: 'Pós-graduação', instituicao: 'Unyleya',
    periodo: 'Concluída: 09/2020', situacao: 'Concluído',
    cor: '#7340a6', icone: 'raio',
    descricao: 'Especialização em sistemas elétricos e tecnologias de energia.', comprovante: '',
  },
  {
    id: 'eletrotecnica', titulo: 'Eletrotécnica', tipo: 'Curso técnico', instituicao: 'Escola Politécnica',
    periodo: 'Concluída: 10/2022', situacao: 'Concluído',
    cor: '#ab741c', icone: 'circuito',
    descricao: 'Formação técnica em instalações, circuitos e sistemas elétricos.', comprovante: '',
  },
  {
    id: 'eolica', titulo: 'Energia Eólica', tipo: 'Especialização técnica', instituicao: 'CTGAS-ER',
    periodo: 'Concluída: 09/2017', situacao: 'Concluído',
    cor: '#138a79', icone: 'vento',
    descricao: 'Especialização técnica em tecnologias e sistemas de geração eólica.', comprovante: '',
  },
  {
    id: 'java-applied', titulo: 'Java Applied Engineering', tipo: 'Pós-graduação', instituicao: 'UNIPDS',
    periodo: '2026–2027', situacao: 'Em andamento',
    cor: '#b77518', icone: 'codigo',
    descricao: 'Especialização em engenharia avançada no ecossistema Java, arquitetura e construção de software.', comprovante: '',
  },
  {
    id: 'engenharia-ia', titulo: 'Engenharia de IA Aplicada', tipo: 'Pós-graduação', instituicao: 'UNIPDS',
    periodo: '2026–2027', situacao: 'Em andamento',
    cor: '#265fa4', icone: 'cerebro',
    descricao: 'Especialização em engenharia de software aplicada a sistemas inteligentes, integração de IA e soluções baseadas em modelos de linguagem.', comprovante: '',
  },
  {
    id: 'pos-computacao-tic', titulo: 'Computação e TIC — 5 Especializações', tipo: 'Pós-graduações', instituicao: 'FacPrisma',
    periodo: 'Previsão informada: 07/2026', situacao: 'Conclusão a confirmar',
    cor: '#395a9b', icone: 'blocos',
    descricao: 'Cinco especializações lato sensu em áreas da computação, registradas no currículo. O conjunto fica em um único medalhão para preservar a composição da Academia.',
    especializacoes: [
      'Arquitetura de Software',
      'Big Data',
      'Desenvolvimento de Aplicações para Dispositivos Móveis',
      'Inteligência Artificial',
      'Segurança da Informação',
    ],
    observacao: 'Previsão de conclusão extraída do currículo; situação final e certificados ainda não verificados.',
    comprovante: '',
  },
];

// Cursos dos currículos: conclusão confirmada pelo próprio autor em 30/10/2026.
// Cursos do Hackers do Bem: títulos e cargas horárias conferidos nos quatro certificados enviados.
// Os PDFs não integram o repositório público e os links de comprovantes ficam para depois.

// O snapshot é gerado da base PPKS canônica do backend dev. A apresentação é local e
// não depende da API durante a renderização da página (mantém preloader e navegação).
export const formacoes: FormacaoItem[] = formacoesLayout.map(card => {
  const record = academicById.get(academicRecordIds[card.id] ?? '');
  if (!record) return card;
  // FacPrisma continua com medalhão agregado e situações individuais não verificadas.
  if (card.id === 'computacao' || card.id === 'gestao-ti') return card;
  if (record.status === 'completed' && card.situacao !== 'Concluído')
    return { ...card, situacao: 'Concluído' };
  if (record.status === 'in_progress' && card.situacao !== 'Em andamento')
    return { ...card, situacao: 'Em andamento' };
  return card;
});

const trilhasVisuais: Record<string, Omit<Trilha, 'cursos'>> = {
  "cursos-java-arquitetura": {
    "id": "java",
    "titulo": "Java & Arquitetura",
    "descricao": "Java · POO · Clean Code · TDD",
    "icone": "codigo",
    "aprofundamento": "Spring Boot, Quarkus, integração com IA e arquitetura moderna de aplicações Java."
  },
  "cursos-ia-dados": {
    "id": "ia",
    "titulo": "IA & Dados",
    "descricao": "Python · Algoritmos · Redes Neurais",
    "icone": "cerebro",
    "aprofundamento": "Engenharia de IA aplicada: RAG, embeddings, agentes, LangChain, LangGraph e MCP (pós-graduação)."
  },
  "cursos-frontend-mobile": {
    "id": "frontend",
    "titulo": "Frontend & Mobile",
    "descricao": "JavaScript · TypeScript · Flutter",
    "icone": "janela",
    "aprofundamento": "Arquitetura de interfaces, React e integração de aplicativos com APIs."
  },
  "cursos-engenharia-software": {
    "id": "arquitetura",
    "titulo": "Engenharia de Software",
    "descricao": "Requisitos · UML · Modelagem · UX",
    "icone": "blocos",
    "aprofundamento": "Projetos de software orientados a domínio, arquitetura, manutenção e qualidade."
  },
  "cursos-bancos-dados": {
    "id": "dados",
    "titulo": "Bancos de Dados",
    "descricao": "SQL · NoSQL · MongoDB · SQL Server",
    "icone": "dados",
    "aprofundamento": "Modelagem, persistência, consultas e integração entre bases relacionais e NoSQL."
  },
  "cursos-devops-qualidade": {
    "id": "qualidade",
    "titulo": "DevOps & Qualidade",
    "descricao": "Docker · Git · DevSecOps · Segurança",
    "icone": "escudo",
    "aprofundamento": "CI/CD, testes automatizados, segurança de aplicações e observabilidade."
  }
};
export const trilhas: Trilha[] = academicSnapshot.tracks.map(track => {
  const visual = trilhasVisuais[track.id];
  if (!visual) throw new Error(`Trilha acadêmica sem layout: ${track.id}`);
  return {
    ...visual,
    cursos: track.courses.map(course => ({
      titulo: course.title,
      instituicao: course.provider,
      situacao: course.status === 'completed' ? 'Concluído' as const : 'A confirmar' as const,
      ...(course.hours !== null ? { cargaHoraria: course.hours } : {}),
    })),
  };
});
