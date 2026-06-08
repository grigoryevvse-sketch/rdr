import { verifyAccountLinkToken } from './lib/account-link-token.js'
import { createSupabaseAdmin } from './lib/notification-helpers.js'

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

async function readBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')
  return rawBody ? JSON.parse(rawBody) : {}
}

function getBearerToken(request) {
  const authorization = request.headers.authorization || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

function hasGoogleIdentity(user) {
  return (
    user?.app_metadata?.provider === 'google' ||
    user?.app_metadata?.providers?.includes('google') ||
    user?.identities?.some((identity) => identity.provider === 'google')
  )
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  let body

  try {
    body = await readBody(request)
  } catch {
    sendJson(response, 400, { error: 'Invalid JSON body' })
    return
  }

  const accessToken = getBearerToken(request)
  const linkToken = String(body?.linkToken || '')

  if (!accessToken || !linkToken) {
    sendJson(response, 400, { error: 'Google session and link token are required' })
    return
  }

  try {
    const tokenData = verifyAccountLinkToken(linkToken)
    const supabase = createSupabaseAdmin()
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)

    if (authError || !authData?.user) {
      throw authError || new Error('Could not verify Google session')
    }

    const googleUser = authData.user

    if (!hasGoogleIdentity(googleUser)) {
      throw new Error('Current session is not a Google account')
    }

    if (googleUser.id !== tokenData.primaryUserId) {
      const { error: linkError } = await supabase
        .from('account_links')
        .upsert({
          primary_user_id: tokenData.primaryUserId,
          linked_user_id: googleUser.id,
          provider: 'google',
          linked_email: googleUser.email || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'linked_user_id,provider' })

      if (linkError) throw linkError

      await Promise.all([
        supabase.from('scheduled_tasks').update({ user_id: tokenData.primaryUserId }).eq('user_id', googleUser.id),
        supabase.from('inbox_tasks').update({ user_id: tokenData.primaryUserId }).eq('user_id', googleUser.id),
      ])
    }

    sendJson(response, 200, {
      ok: true,
      primaryUserId: tokenData.primaryUserId,
      linkedUserId: googleUser.id,
      provider: 'google',
    })
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Could not link Google account' })
  }
}
