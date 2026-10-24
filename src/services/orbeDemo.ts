import type { ChatReply } from '../types/orbe';

/** Production keeps the existing demonstration until its API is explicitly enabled. */
export function sendDemoMessage(message: string, signal: AbortSignal, reducedMotion: boolean): Promise<ChatReply> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      reject(new DOMException('Consulta cancelada.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      const normalized = message.toLocaleLowerCase('pt-BR');
      const answer = normalized.includes('projeto')
        ? 'Pedro desenvolveu projetos como o SDGP (Dimensionamento Solar em Flutter), o Lithology (Logs Geológicos em Java) e o ReserGas (Cálculos de Fluidos de Reservatórios).'
        : /contato|contacto|email|e-mail/.test(normalized)
          ? 'Você pode entrar em contato diretamente pelo LinkedIn ou GitHub oficial de Pedro Santos! Os links estão na apresentação do portfólio.'
          : 'Este guia tem respostas demonstrativas. Pedro Santos possui experiência em Engenharia e Desenvolvimento de Software (Java, Dart, Flutter, Python, PHP e C++). Experimente perguntar sobre projetos ou contato.';
      resolve({ conversationId: 'demo', answer, sources: [], meta: { provider: 'mock', simulated: true, promptVersion: 'demo-v1' } });
    }, reducedMotion ? 0 : 700);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
