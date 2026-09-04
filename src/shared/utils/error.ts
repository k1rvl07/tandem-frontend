interface ErrorResponse {
  response?: {
    data?: {
      error?: string
    }
  }
}

export function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const res = (e as ErrorResponse).response
    if (res?.data?.error) {
      return res.data.error
    }
  }
  return 'something went wrong'
}
