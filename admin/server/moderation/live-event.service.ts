type ModerationLiveEvent = {
  type: 'post.approved' | 'post.rejected'
  postId: number
  authorId: number
}

export async function sendModerationLiveEvent(
  event: ModerationLiveEvent,
): Promise<void> {
  const url = process.env.LIVE_INTERNAL_URL
  const secret = process.env.LIVE_INTERNAL_SECRET

  if (!url || !secret) {
    console.error('Live event configuration is missing.')
    return
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      console.error(`Live event delivery failed (${response.status}).`)
    }
  } catch (error) {
    console.error('Live event delivery failed:', error)
  }
}
