/** DTOs from the published /api/v1/openapi.json; independent of React/backend packages. */
export interface ChatSource {
  type: 'profile' | 'project' | 'service' | 'platform';
  id: string;
  title: string;
  url?: string;
}

export interface ChatMeta {
  provider: 'mock' | 'openai' | 'openai-compatible';
  simulated: boolean;
  promptVersion: string;
}

/** Published response DTO. conversationToken is returned only for a new conversation. */
export interface ChatResponse {
  conversationId: string;
  conversationToken?: string;
  answer: string;
  sources: ChatSource[];
  meta: ChatMeta;
}

/** Safe result exposed to the UI. Conversation credentials stay inside the client. */
export type ChatReply = Omit<ChatResponse, 'conversationToken'>;

export type ChatApiResponse = ChatResponse;

export interface ChatApiError {
  error: {
    code: string;
    message: string;
    correlationId: string;
  };
}
