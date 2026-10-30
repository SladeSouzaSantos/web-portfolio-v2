import { ProjetoMidia } from './ProjetoMidia';
import type { Projeto } from '../types/portfolio';

interface CartazMissaoProps {
  projeto: Projeto;
  indice: number;
  onOpen: () => void;
  arquivo?: boolean;
}

/** Cartaz único para a Guilda e o Arquivo: pergaminho original e verso com mídia. */
export function CartazMissao({ projeto, indice, onOpen, arquivo = false }: CartazMissaoProps) {
  return (
    <button
      className="guilda-cartaz"
      key={projeto.id}
      type="button"
      data-guilda-projeto={arquivo ? undefined : projeto.id}
      data-projeto={arquivo ? projeto.id : undefined}
      aria-label={arquivo ? `Ver detalhes de ${projeto.nome}` : `${projeto.nome} — abrir detalhes`}
      onClick={onOpen}
    >
      <span className="guilda-cartaz__folha">
        <span className="guilda-cartaz__face guilda-cartaz__face--frente">
          <span className="guilda-cartaz__conteudo">
            <span className="guilda-cartaz__numero">MISSÃO {String(indice + 1).padStart(2, '0')}</span>
            <span className="guilda-cartaz__titulo">{projeto.nome}</span>
            <span className="guilda-cartaz__linha" aria-hidden="true" />
            <span className="guilda-cartaz__tipo">{projeto.tipo}</span>
            <span className="guilda-cartaz__subtitulo">{projeto.subtitulo}</span>
            <span className="guilda-cartaz__chamada">[ INSPECIONAR ]</span>
          </span>
        </span>
        <span className="guilda-cartaz__face guilda-cartaz__face--verso" aria-hidden="true">
          <span className="guilda-cartaz__miniatura"><ProjetoMidia projeto={projeto} compact /></span>
          <span className="guilda-cartaz__verso-rotulo">{projeto.nome}</span>
          <span className="guilda-cartaz__verso-acao">[ ABRIR MISSÃO ]</span>
        </span>
      </span>
    </button>
  );
}
