export type RenderContext = 'profile' | 'post' | 'comment' | 'message'

export interface RenderOptions {
  context?: RenderContext
}

export const RENDER_CONTEXT_LIMITS: Record<RenderContext, number> = {
  profile: 20_000,
  post: 100_000,
  comment: 10_000,
  message: 20_000,
}

export const DEFAULT_RENDER_CONTEXT: RenderContext = 'post'
