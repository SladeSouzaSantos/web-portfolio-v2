export const perfil = {
  nome: 'PEDRO SANTOS',
  cargo: 'DESENVOLVEDOR DE SOFTWARE',
  especialidade: 'JAVA • IA APLICADA',
  // Tecnologias em foco; a animação não equivale a experiência profissional em todas elas.
  stacksDestaque: [
    'JAVA • SPRING BOOT',
    'JAVA • QUARKUS',
    'JAVA • JPA / HIBERNATE',
    'JAVA • LANGCHAIN4J',
    'IA • RAG & EMBEDDINGS',
    'IA • LANGCHAIN / LANGGRAPH',
    'IA • AGENTES & MCP',
    'IA • BASES VETORIAIS',
    'IA • GUARDRAILS',
  ],
  redes: [
    { nome: 'LinkedIn', url: 'https://linkedin.com/in/phasscode', icone: 'icon-orb-linkedin' },
    { nome: 'GitHub', url: 'https://github.com/SladeSouzaSantos', icone: 'icon-orb-github' },
    { nome: 'Instagram', url: 'https://instagram.com/phassantos', icone: 'icon-orb-instagram' },
    { nome: 'E-mail', url: 'mailto:phassantos.dev@gmail.com', icone: 'icon-orb-email' },
  ],
  competencias: [
    {
      titulo: 'BACKEND JAVA & ARQUITETURA',
      resumo: 'Desenvolvimento e manutenção de sistemas Java, com foco atual em APIs e arquitetura de software.',
      habilidades: ['Java · Hibernate · JBoss', 'PostgreSQL · SQL', 'POO · boas práticas de código'],
      aprofundamento: 'Spring Boot, Quarkus, Clean Architecture e testes Java.',
      evidencias: [
        { nome: 'Experiência no SIGAA', url: '/#experiencia', descricao: 'Java, Hibernate, JBoss e PostgreSQL em sistema acadêmico.' },
        { nome: 'Estudo Spring Boot / JPA', url: 'https://github.com/SladeSouzaSantos/webservice-springboot3-jpa', descricao: 'Repositório público de estudo do ecossistema Java.' },
      ],
    },
    {
      titulo: 'ENGENHARIA DE IA APLICADA',
      resumo: 'Integração de modelos de linguagem a aplicações e experimentação com extração e validação de dados.',
      habilidades: ['APIs de LLMs · Gemini · OpenRouter', 'Extração de datasheets com IA', 'Guardrails · roteamento de modelos'],
      aprofundamento: 'RAG, embeddings, LangChain/LangGraph, agentes e MCP.',
      evidencias: [
        { nome: 'GreenCity OS', url: 'https://github.com/SladeSouzaSantos/greencity-os', descricao: 'Leitura de fichas técnicas e fallback entre provedores.' },
        { nome: 'Laboratório de Guardrails', url: 'https://github.com/SladeSouzaSantos/integracao_apis_llms/tree/main/safeguard-prompt-injection', descricao: 'Experimentos didáticos com segurança de LLMs.' },
      ],
    },
    {
      titulo: 'APIS, DADOS & AUTOMAÇÃO',
      resumo: 'Serviços e aplicações para integrar informações, automatizar processos e gerar resultados úteis.',
      habilidades: ['PHP / Laravel · APIs REST', 'Python · FastAPI · simulações', 'SQL · PostgreSQL · MySQL'],
      aprofundamento: 'Modelagem de dados, integrações e pipelines.',
      evidencias: [
        { nome: 'GreenCity API', url: 'https://github.com/SladeSouzaSantos/greencity-api-orcamento', descricao: 'API Laravel para gerar propostas comerciais em PDF.' },
        { nome: 'HSP Simulator', url: 'https://github.com/SladeSouzaSantos/hsp_simulator', descricao: 'Simulação e análise de dados solares com Python.' },
      ],
    },
    {
      titulo: 'ENTREGA, TESTES & DEVOPS',
      resumo: 'Automação de build, testes e publicação de aplicações em infraestrutura própria.',
      habilidades: ['Git · GitHub Actions · CI/CD', 'Docker · Docker Swarm · Linux', 'Testes automatizados · deploy'],
      aprofundamento: 'Observabilidade, segurança de software e orquestração.',
      evidencias: [
        { nome: 'PHASSCODE', url: 'https://github.com/SladeSouzaSantos/web-portfolio-v2', descricao: 'Pipelines de testes, validações e publicação de imagens.' },
        { nome: 'Shadow Sim Pro', url: 'https://github.com/SladeSouzaSantos/shadow_simulator', descricao: 'Aplicação Python com pipeline e Docker Swarm.' },
      ],
    },
  ],
};
