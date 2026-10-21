import type { Formacao as FormacaoItem, Trilha } from '../types/portfolio';

// Catálogo preservado da versão original; revisar datas e situação antes de publicar.
export const formacoes: FormacaoItem[] = [
  {
    id: 'computacao', titulo: 'Ciência da Computação', tipo: 'Graduação', instituicao: 'UNISUL',
    periodo: 'Início: 07/2023 · Previsão: 12/2026', situacao: 'Situação a confirmar',
    cor: '#164b91', icone: 'capelo',
    descricao: 'Formação em computação, fundamentos de software, algoritmos e desenvolvimento de sistemas.', comprovante: '',
  },
  {
    id: 'gestao-ti', titulo: 'Gestão da Tecnologia da Informação', tipo: 'Tecnólogo', instituicao: 'UNIBF',
    periodo: 'Concluída: 07/2025', situacao: 'Concluído',
    cor: '#17744f', icone: 'engrenagem',
    descricao: 'Gestão de tecnologia da informação, processos e soluções organizacionais.', comprovante: '',
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
];

// Áreas de estudo, não declarações de certificações concluídas.
export const trilhas: Trilha[] = [
  { id: 'java', titulo: 'Java & Ecossistema', descricao: 'Java · Spring · APIs · Boas práticas', icone: 'codigo' },
  { id: 'frontend', titulo: 'React & Frontend', descricao: 'React · JavaScript · Interfaces', icone: 'janela' },
  { id: 'ia', titulo: 'Inteligência Artificial', descricao: 'LLMs · Agentes · LangChain · RAG', icone: 'cerebro' },
  { id: 'arquitetura', titulo: 'Arquitetura de Software', descricao: 'SOLID · Design Patterns · Clean Architecture', icone: 'blocos' },
  { id: 'dados', titulo: 'Dados & Bancos', descricao: 'SQL · NoSQL · Pipelines · Big Data', icone: 'dados' },
  { id: 'qualidade', titulo: 'Segurança & Qualidade', descricao: 'Testes · TDD · Segurança da Informação', icone: 'escudo' },
];
