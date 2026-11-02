import type { Projeto } from '../types/portfolio';

interface ProjetoMidiaProps {
  projeto: Projeto;
  compact?: boolean;
  className?: string;
}

/** Uma tela para projetos web ou três telas verticais para projetos mobile. */
export function ProjetoMidia({ projeto, compact = false, className = '' }: ProjetoMidiaProps) {
  const imagens = projeto.galeria?.length
    ? projeto.galeria
    : [{ src: projeto.imagem, alt: projeto.imagemAlt }];

  return (
    <span className={[
      'projeto-midia',
      compact ? 'projeto-midia--compact' : 'projeto-midia--detalhe',
      imagens.length === 3 ? 'projeto-midia--tripla' : 'projeto-midia--unica',
      className,
    ].filter(Boolean).join(' ')}>
      {imagens.map((imagem, indice) => (
        <img
          key={imagem.src}
          src={imagem.src}
          alt={compact ? '' : imagem.alt}
          loading={compact ? 'lazy' : 'eager'}
          decoding="async"
          data-imagem-indice={indice + 1}
        />
      ))}
    </span>
  );
}
