import type { Projeto } from '../types/portfolio';

// Missões complementares; os cinco destaques permanecem somente na Guilda.
// Capturas não fornecidas são representadas por ilustrações SVG originais.
export const arquivoProjetos: Projeto[] = [
  {
    "id": "task-manager-flask",
    "nome": "TASK MANAGER",
    "subtitulo": "Tarefas e observabilidade",
    "tipo": "BACKEND & DEVSECOPS",
    "categoria": "backend",
    "icone": "▣",
    "descricao": "Aplicação de gestão de tarefas com Flask, autenticação de usuários, persistência e testes. O repositório documenta uma infraestrutura de observabilidade e práticas de DevSecOps como estudo de caso.",
    "detalhes": [
      "Separação de rotas, autenticação e persistência com Flask e SQLAlchemy.",
      "Testes automatizados e análise de segurança integrados à pipeline.",
      "Observabilidade com Prometheus, Grafana, Loki, Promtail e Alertmanager."
    ],
    "tecnologias": [
      "Python",
      "Flask",
      "SQLAlchemy",
      "pytest",
      "Docker",
      "Grafana"
    ],
    "repositorio": "https://github.com/SladeSouzaSantos/task-manager-using-flask",
    "demonstracao": "",
    "observacao": "Estudo de caso técnico em desenvolvimento seguro e observabilidade.",
    "imagem": "/assets/img/projetos/arquivo/task-manager-flask.svg",
    "imagemAlt": "Ilustração conceitual de TASK MANAGER, sem representar captura do aplicativo."
  },
  {
    "id": "stranger-things-experience",
    "nome": "STRANGER THINGS",
    "subtitulo": "Landing page cinematográfica",
    "tipo": "FRONT-END & ANIMAÇÃO",
    "categoria": "frontend",
    "icone": "✦",
    "descricao": "Landing page temática produzida como prática de animações web, com transições cinematográficas, efeitos de rolagem e técnicas de composição com GSAP.",
    "detalhes": [
      "Animações baseadas no scroll com ScrollTrigger e ScrollSmoother.",
      "Introdução animada e tratamento de tipografia com SplitText.",
      "Estudo de responsividade e performance em interfaces visuais."
    ],
    "tecnologias": [
      "HTML",
      "CSS",
      "JavaScript",
      "GSAP",
      "ScrollTrigger"
    ],
    "repositorio": "https://github.com/SladeSouzaSantos/stranger-things-experience",
    "demonstracao": "",
    "observacao": "Projeto de aprendizado com temática de obra existente; a ilustração é original e não representa um screenshot.",
    "imagem": "/assets/img/projetos/arquivo/stranger-things-experience.svg",
    "imagemAlt": "Ilustração conceitual de STRANGER THINGS, sem representar captura do aplicativo."
  },
  {
    "id": "erp-api",
    "nome": "ERP API",
    "subtitulo": "Gestão empresarial e JWT",
    "tipo": "BACKEND & API REST",
    "categoria": "backend",
    "icone": "▦",
    "descricao": "API de gestão empresarial construída com Django REST Framework, incluindo autenticação, funcionários, grupos e permissões em endpoints documentados.",
    "detalhes": [
      "Endpoints CRUD para funcionários e grupos de uma empresa.",
      "Autenticação e autorização com Simple JWT.",
      "Estrutura de aplicações Django separada por responsabilidades."
    ],
    "tecnologias": [
      "Python",
      "Django",
      "Django REST Framework",
      "JWT",
      "REST"
    ],
    "repositorio": "https://github.com/SladeSouzaSantos/sistema_gestao_empresarial_api",
    "demonstracao": "",
    "observacao": "O frontend associado utiliza um template; esta ficha destaca a API backend.",
    "imagem": "/assets/img/projetos/arquivo/erp-api.svg",
    "imagemAlt": "Ilustração conceitual de ERP API, sem representar captura do aplicativo."
  },
  {
    "id": "shadow-sim-pro",
    "nome": "SHADOW SIM PRO",
    "subtitulo": "Trajetória solar e sombras",
    "tipo": "PYTHON & ENGENHARIA",
    "categoria": "engenharia",
    "icone": "☀",
    "descricao": "Ferramenta de estudo de sombreamento que calcula posições solares por localização e data, com visualizações de trajetória e relatórios horários.",
    "detalhes": [
      "Cálculos astronômicos de azimute e altitude solar.",
      "Dashboard e gráficos interativos com Streamlit e Plotly.",
      "Pipeline de deploy com Docker Swarm, Tailscale e GitHub Actions descrita no README."
    ],
    "tecnologias": [
      "Python",
      "Streamlit",
      "Plotly",
      "Docker Swarm",
      "GitHub Actions"
    ],
    "repositorio": "https://github.com/SladeSouzaSantos/shadow_simulator",
    "demonstracao": "",
    "observacao": "Simulador geométrico de sombreamento, distinto do HSP Simulator.",
    "imagem": "/assets/img/projetos/arquivo/shadow-sim-pro.svg",
    "imagemAlt": "Ilustração conceitual de SHADOW SIM PRO, sem representar captura do aplicativo."
  },
  {
    "id": "gemini-nano-browser",
    "nome": "GEMINI NANO",
    "subtitulo": "IA local no navegador",
    "tipo": "IA & JAVASCRIPT",
    "categoria": "ia",
    "icone": "✧",
    "descricao": "Experimento com modelos de linguagem locais via APIs do navegador, integrando interação textual, tradução e detecção de idioma.",
    "detalhes": [
      "Uso experimental de Prompt API, Translation API e Language Detection API.",
      "Processamento no cliente em navegadores e versões compatíveis.",
      "Exploração de privacidade e latência em modelos pequenos executados localmente."
    ],
    "tecnologias": [
      "JavaScript",
      "HTML",
      "CSS",
      "Web AI APIs",
      "Gemini Nano"
    ],
    "repositorio": "https://github.com/SladeSouzaSantos/web-ai-gemini-nano-browser",
    "demonstracao": "",
    "observacao": "Depende do suporte às APIs de IA do navegador; não há garantia de compatibilidade universal.",
    "imagem": "/assets/img/projetos/arquivo/gemini-nano-browser.svg",
    "imagemAlt": "Ilustração conceitual de GEMINI NANO, sem representar captura do aplicativo."
  },
  {
    "id": "smart-model-router",
    "nome": "SMART MODEL ROUTER",
    "subtitulo": "Gateway para múltiplas LLMs",
    "tipo": "BACKEND & IA",
    "categoria": "ia",
    "icone": "⬡",
    "descricao": "Gateway experimental para centralizar integrações com modelos de linguagem e escolher modelos segundo critérios operacionais, incluindo fallback quando necessário.",
    "detalhes": [
      "Estrutura de integração e padronização de chamadas a modelos.",
      "Políticas de escolha entre modelos orientadas a preço, latência e throughput.",
      "Estudo de falhas e fallback entre provedores disponíveis."
    ],
    "tecnologias": [
      "TypeScript",
      "Node.js",
      "Fastify",
      "OpenRouter",
      "LLMs"
    ],
    "repositorio": "https://github.com/SladeSouzaSantos/integracao_apis_llms/tree/main/smart-model-router-gateway",
    "demonstracao": "",
    "observacao": "Projeto experimental do laboratório de integração de APIs LLM.",
    "imagem": "/assets/img/projetos/arquivo/smart-model-router.svg",
    "imagemAlt": "Ilustração conceitual de SMART MODEL ROUTER, sem representar captura do aplicativo."
  },
  {
    "id": "teclado-sound",
    "nome": "TECLADO SOUND",
    "subtitulo": "Teclado de efeitos sonoros",
    "tipo": "MINIJOGO & ESTUDO",
    "categoria": "minijogos",
    "icone": "♫",
    "descricao": "Teclado interativo com nove botões e efeitos de áudio, desenvolvido como prática de HTML, CSS e JavaScript da Alura.",
    "detalhes": [
      "Seleção e manipulação de elementos do DOM.",
      "Eventos de clique, Enter e Espaço para acionar sons.",
      "Reprodução de arquivos de áudio por botões associados."
    ],
    "tecnologias": [
      "HTML",
      "CSS",
      "JavaScript",
      "DOM",
      "Áudio"
    ],
    "repositorio": "https://github.com/SladeSouzaSantos/alura-teclado-som",
    "demonstracao": "https://projetos.phasscode.com/projetos/teclado_som/",
    "demonstracaoRotulo": "EXPERIMENTAR ↗",
    "observacao": "Exercício prático de curso da Alura, disponível para interação no navegador.",
    "imagem": "/assets/img/projetos/arquivo/teclado-sound.svg",
    "imagemAlt": "Ilustração conceitual de TECLADO SOUND, sem representar captura do aplicativo."
  },
  {
    "id": "numero-secreto",
    "nome": "NÚMERO SECRETO",
    "subtitulo": "Adivinhação por voz",
    "tipo": "MINIJOGO & ESTUDO",
    "categoria": "minijogos",
    "icone": "?",
    "descricao": "Jogo de adivinhação de números de 1 a 1000 com reconhecimento de voz, indicações de maior ou menor e opção de reiniciar.",
    "detalhes": [
      "Integração com a Web Speech API para reconhecer números falados.",
      "Validação de palpites e feedback sobre o valor secreto.",
      "Tratamento de vitória e reinício; requer navegador compatível e acesso ao microfone."
    ],
    "tecnologias": [
      "HTML",
      "CSS",
      "JavaScript",
      "Web Speech API"
    ],
    "repositorio": "https://github.com/SladeSouzaSantos/n-secreto",
    "demonstracao": "https://projetos.phasscode.com/projetos/n_secreto/",
    "demonstracaoRotulo": "JOGAR ↗",
    "observacao": "Exercício prático da Alura; requer reconhecimento de voz compatível.",
    "imagem": "/assets/img/projetos/arquivo/numero-secreto.svg",
    "imagemAlt": "Ilustração conceitual de NÚMERO SECRETO, sem representar captura do aplicativo."
  }
];
