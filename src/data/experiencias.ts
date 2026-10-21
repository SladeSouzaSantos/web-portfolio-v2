import type { Experiencia } from '../types/portfolio';

// Registros da linha do tempo original. Confirmar períodos antes da publicação.
export const experiencias: Experiencia[] = [
  {
    id: 'acrux',
    empresa: 'ACRUX',
    periodo: '2014 — 2015',
    periodoCompleto: 'Fevereiro de 2014 — Janeiro de 2015',
    cargo: 'Estagiário como Programador de Sistemas',
    resumo: 'Implementação e manutenção de funcionalidades em sistemas ligados à engenharia.',
    descricao: 'Atuação no desenvolvimento e manutenção de soluções de software voltadas a atividades técnicas, com colaboração em equipe multidisciplinar.',
    responsabilidades: [
      'Apoio ao desenvolvimento e à manutenção de sistemas.',
      'Participação em atividades técnicas junto a profissionais de diferentes áreas.',
    ],
    tecnologias: [],
  },
  {
    id: 'sig',
    empresa: 'SIG Software e Consultoria em TI',
    periodo: '2016 — 2017',
    periodoCompleto: 'Junho de 2016 — Fevereiro de 2017',
    cargo: 'Desenvolvedor de Sistemas',
    resumo: 'Desenvolvimento e manutenção de sistemas de gestão acadêmica.',
    descricao: 'Desenvolvimento e customização de sistemas corporativos, com atuação no ecossistema Java e em funcionalidades do SIGAA utilizadas em instituições de ensino.',
    responsabilidades: [
      'Implementação e manutenção de funcionalidades em aplicações Java.',
      'Customizações e evolução de módulos do SIGAA.',
      'Integração com banco de dados e colaboração com a equipe de desenvolvimento.',
    ],
    tecnologias: ['Java', 'Hibernate', 'JBoss', 'PostgreSQL', 'Scrum'],
  },
  {
    id: 'geowellex',
    empresa: 'Geowellex',
    periodo: '2017 — 2018',
    periodoCompleto: 'Março de 2017 — Outubro de 2018',
    cargo: 'Mud Logging / Desenvolvedor de Sistemas',
    resumo: 'Dados geológicos, operações de campo e ferramentas digitais de apoio.',
    descricao: 'Monitoramento e tratamento de dados técnicos de operações em campo, juntamente com desenvolvimento de ferramentas para apoiar processos operacionais.',
    responsabilidades: [
      'Acompanhamento e organização de dados de Mud Logging.',
      'Desenvolvimento de sistema web para controle de estoque.',
      'Geração e organização de informações técnicas e relatórios.',
    ],
    tecnologias: ['HTML', 'CSS', 'JavaScript', 'PHP', 'MySQL'],
  },
  {
    id: 'greencity',
    empresa: 'Greencity Sustainable Energy',
    periodo: '2019 — ATUALMENTE',
    periodoCompleto: 'Fevereiro de 2019 — Atualmente',
    cargo: 'Engenheiro de Projetos Fotovoltaicos / Desenvolvedor Web e Mobile',
    resumo: 'Engenharia fotovoltaica e desenvolvimento de soluções digitais.',
    descricao: 'Atuação em projetos de energia renovável, aliando engenharia e desenvolvimento de soluções para dimensionamento de sistemas, propostas comerciais e automação de processos.',
    responsabilidades: [
      'Dimensionamento e desenvolvimento de projetos fotovoltaicos.',
      'Criação de ferramentas web e mobile para atividades técnicas e comerciais.',
      'Integração de processos, dados e geração de documentos.',
    ],
    tecnologias: ['Flutter', 'Dart', 'Firebase', 'Python', 'PHP'],
  },
];
