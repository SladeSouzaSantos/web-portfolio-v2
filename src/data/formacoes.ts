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
export const trilhas: Trilha[] = [
  {
    "id": "java",
    "titulo": "Java & Arquitetura",
    "descricao": "Java · POO · Clean Code · TDD",
    "icone": "codigo",
    "aprofundamento": "Spring Boot, Quarkus, integração com IA e arquitetura moderna de aplicações Java.",
    "cursos": [
      {
        "titulo": "Formação Java e Clean Architecture",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação Java e Domain Driven Design",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação SOLID com Java",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação Design Patterns em Java",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação TDD e Java — JUnit",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação em Java: POO, DDD e APIs REST",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      },
      {
        "titulo": "Java Completo — Programação Orientada a Objetos",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      },
      {
        "titulo": "Clean Code na Prática",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      },
      {
        "titulo": "Padrões de Projeto em Java",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      }
    ]
  },
  {
    "id": "ia",
    "titulo": "IA & Dados",
    "descricao": "Python · Algoritmos · Redes Neurais",
    "icone": "cerebro",
    "aprofundamento": "Engenharia de IA aplicada: RAG, embeddings, agentes, LangChain, LangGraph e MCP (pós-graduação).",
    "cursos": [
      {
        "titulo": "Estruturas de Dados e Algoritmos em Python",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      },
      {
        "titulo": "Redes Neurais Artificiais em Python",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação Python Fundamentals",
        "instituicao": "DIO",
        "situacao": "Concluído"
      },
      {
        "titulo": "Linguagem R para Análise de Dados",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação Power BI Analyst",
        "instituicao": "DIO",
        "situacao": "Concluído"
      }
    ]
  },
  {
    "id": "frontend",
    "titulo": "Frontend & Mobile",
    "descricao": "JavaScript · TypeScript · Flutter",
    "icone": "janela",
    "aprofundamento": "Arquitetura de interfaces, React e integração de aplicativos com APIs.",
    "cursos": [
      {
        "titulo": "Formação HTML e CSS — responsividade e mobile-first",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação JavaScript — DOM, formulários e APIs",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação TypeScript",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação Dart",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação Flutter — estados, APIs e testes",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação Firebase Authentication",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Desenvolvimento Frontend com Angular",
        "instituicao": "DIO",
        "situacao": "Concluído"
      }
    ]
  },
  {
    "id": "arquitetura",
    "titulo": "Engenharia de Software",
    "descricao": "Requisitos · UML · Modelagem · UX",
    "icone": "blocos",
    "aprofundamento": "Projetos de software orientados a domínio, arquitetura, manutenção e qualidade.",
    "cursos": [
      {
        "titulo": "Formação Engenharia de Requisitos",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação UML — modelagem e BPMN",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Design Thinking",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação UI Design",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Figma — layouts de aplicativos mobile",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Aprendendo Domain Driven Design (DDD) do Zero",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      }
    ]
  },
  {
    "id": "dados",
    "titulo": "Bancos de Dados",
    "descricao": "SQL · NoSQL · MongoDB · SQL Server",
    "icone": "dados",
    "aprofundamento": "Modelagem, persistência, consultas e integração entre bases relacionais e NoSQL.",
    "cursos": [
      {
        "titulo": "Formação SQL Database Specialist",
        "instituicao": "DIO",
        "situacao": "Concluído"
      },
      {
        "titulo": "SQL Server Completo — Formação DBA",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      },
      {
        "titulo": "Curso NoSQL — MongoDB e Neo4j",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação Power BI + SQL Server",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      }
    ]
  },
  {
    "id": "qualidade",
    "titulo": "DevOps & Qualidade",
    "descricao": "Docker · Git · DevSecOps · Segurança",
    "icone": "escudo",
    "aprofundamento": "CI/CD, testes automatizados, segurança de aplicações e observabilidade.",
    "cursos": [
      {
        "titulo": "Formação Docker — containers",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Git e GitHub — controle de versão",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Git e GitHub do Básico ao Avançado",
        "instituicao": "Udemy",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação Automação de Testes com Cypress",
        "instituicao": "DIO",
        "situacao": "Concluído"
      },
      {
        "titulo": "HTTP — entendendo a Web",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Webpack — módulos em aplicações Web",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Formação Performance Web",
        "instituicao": "Alura",
        "situacao": "Concluído"
      },
      {
        "titulo": "Hackers do Bem — Nivelamento",
        "instituicao": "Programa Hackers do Bem",
        "situacao": "Concluído",
        "cargaHoraria": 80
      },
      {
        "titulo": "Hackers do Bem — Básico",
        "instituicao": "Programa Hackers do Bem",
        "situacao": "Concluído",
        "cargaHoraria": 64
      },
      {
        "titulo": "Hackers do Bem — Fundamental",
        "instituicao": "Programa Hackers do Bem",
        "situacao": "Concluído",
        "cargaHoraria": 96
      },
      {
        "titulo": "Hackers do Bem — Especialização em DevOps e DevSecOps",
        "instituicao": "Programa Hackers do Bem",
        "situacao": "Concluído",
        "cargaHoraria": 80
      }
    ]
  }
];
