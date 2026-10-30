import { useEffect, useRef } from 'react';
import Typed from 'typed.js';
import { perfil } from '../data/perfil';
import { useReducedMotion } from '../hooks/useMediaQuery';

/** A animação é puramente visual; leitores de tela recebem uma descrição estável. */
export function StacksDigitadas() {
  const elemento = useRef<HTMLSpanElement>(null);
  const reduzirMovimento = useReducedMotion();

  useEffect(() => {
    const destino = elemento.current;
    if (!destino) return;

    if (reduzirMovimento) {
      destino.textContent = perfil.especialidade;
      return;
    }

    destino.textContent = '';
    const typed = new Typed(destino, {
      strings: perfil.stacksDestaque,
      // Strings técnicas com '&' são texto, não entidades HTML.
      // O modo HTML do Typed.js tenta consumir '&' até ';' e pode travar a digitação.
      contentType: 'null',
      startDelay: 300,
      typeSpeed: 48,
      backSpeed: 27,
      backDelay: 1500,
      loop: true,
      smartBackspace: false,
      showCursor: false, // Cursor visual em CSS: evita nós extras no DOM/acessibilidade.
    });

    // StrictMode, navegação por hash e mudança de preferências não acumulam timers.
    return () => typed.destroy();
  }, [reduzirMovimento]);

  return (
    <div
      className="perfil-especialidades-container"
      role="group"
      aria-label={`Stacks em foco: ${perfil.stacksDestaque.join(', ')}`}
    >
      <span className={`especialidade-tag${reduzirMovimento ? '' : ' especialidade-tag--digitando'}`}>
        <span ref={elemento} data-typed-stack aria-hidden="true" />
      </span>
    </div>
  );
}
