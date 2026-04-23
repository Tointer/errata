import {
  deleteCharacterChatConversationRecord,
  listCharacterChatConversationIds,
  readCharacterChatConversationRecord,
  writeCharacterChatConversationRecord,
} from './file-store'

// --- Types ---

export type PersonaMode =
  | { type: 'character'; characterId: string }
  | { type: 'stranger' }
  | { type: 'custom'; prompt: string }

export interface CharacterChatMessage {
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  createdAt: string
}

export interface CharacterChatConversation {
  id: string
  characterId: string
  persona: PersonaMode
  storyPointFragmentId: string | null
  title: string
  messages: CharacterChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface CharacterChatConversationSummary {
  id: string
  characterId: string
  persona: PersonaMode
  storyPointFragmentId: string | null
  title: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

// --- ID generation ---

export function generateConversationId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `cc-${ts}-${rand}`
}

// --- CRUD ---

export async function saveConversation(
  dataDir: string,
  storyId: string,
  conversation: CharacterChatConversation,
): Promise<void> {
  await writeCharacterChatConversationRecord(dataDir, storyId, conversation.id, conversation)
}

export async function getConversation(
  dataDir: string,
  storyId: string,
  conversationId: string,
): Promise<CharacterChatConversation | null> {
  return readCharacterChatConversationRecord(dataDir, storyId, conversationId)
}

export async function listConversations(
  dataDir: string,
  storyId: string,
  characterId?: string,
): Promise<CharacterChatConversationSummary[]> {
  const summaries: CharacterChatConversationSummary[] = []

  for (const conversationId of await listCharacterChatConversationIds(dataDir, storyId)) {
    const conv = await readCharacterChatConversationRecord<CharacterChatConversation>(dataDir, storyId, conversationId)
    if (!conv) continue

    if (characterId && conv.characterId !== characterId) continue

    summaries.push({
      id: conv.id,
      characterId: conv.characterId,
      persona: conv.persona,
      storyPointFragmentId: conv.storyPointFragmentId,
      title: conv.title,
      messageCount: conv.messages.length,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    })
  }

  // Sort newest first
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return summaries
}

export async function deleteConversation(
  dataDir: string,
  storyId: string,
  conversationId: string,
): Promise<boolean> {
  return deleteCharacterChatConversationRecord(dataDir, storyId, conversationId)
}
