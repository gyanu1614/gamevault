import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()

function constantTimeEqual(
  left: string,
  right: string,
): boolean {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const maxLength = Math.max(
    leftBytes.length,
    rightBytes.length,
  )

  let difference =
    leftBytes.length ^ rightBytes.length

  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      (leftBytes[index] ?? 0) ^
      (rightBytes[index] ?? 0)
  }

  return difference === 0
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  })
}

export async function POST(
  request: Request,
): Promise<Response> {
  const expectedSecret =
    process.env.SAB_MARKET_REVALIDATE_SECRET

  if (!expectedSecret) {
    console.error(
      'SAB_MARKET_REVALIDATE_SECRET is not configured',
    )

    return jsonResponse(
      {
        ok: false,
        error: 'Server is not configured',
      },
      500,
    )
  }

  const suppliedSecret =
    request.headers.get('x-revalidate-secret') ?? ''

  if (
    !constantTimeEqual(
      suppliedSecret,
      expectedSecret,
    )
  ) {
    return jsonResponse(
      {
        ok: false,
        error: 'Unauthorized',
      },
      401,
    )
  }

  const paths = [
    '/steal-a-brainrot/values',
    '/steal-a-brainrot/value-calculator',
    '/steal-a-brainrot/trade-calculator',
  ]

  for (const path of paths) {
    revalidatePath(path)
  }

  revalidatePath(
    '/steal-a-brainrot/values/[brainrotSlug]',
    'page',
  )

  return jsonResponse({
    ok: true,
    revalidated: [
      ...paths,
      '/steal-a-brainrot/values/[brainrotSlug]',
    ],
    revalidated_at: new Date().toISOString(),
  })
}
