export type SecaoId = 'sobre' | 'projetos' | 'experiencia' | 'academico';

export interface Projeto {
  id: string;
  nome: string;
  subtitulo: string;
  tipo: string;
  descricao: string;
  tecnologias: string[];
  repositorio: string;
  demonstracao: string;
  categoria: 'ia' | 'mobile' | 'ferramentas';
  icone: string;
}

export interface Experiencia {
  id: string;
  empresa: string;
  periodo: string;
  periodoCompleto: string;
  cargo: string;
  resumo: string;
  descricao: string;
  responsabilidades: string[];
  tecnologias: string[];
}

export interface Formacao {
  id: string;
  titulo: string;
  tipo: string;
  instituicao: string;
  periodo: string;
  situacao: string;
  cor: string;
  icone: string;
  descricao: string;
  comprovante: string;
}

export interface Trilha {
  id: string;
  titulo: string;
  descricao: string;
  icone: string;
}
