import { authApi, usersApi, profilesApi, mediaApi } from './lib/api'

export async function testUserApi() {
  console.log('Starting API tests...')

  const users = await usersApi.list()
  console.log('1. List users: OK', users.data)

  const user = users.data[0]

  if (!user) {
    throw new Error('No authenticated user returned')
  }

  const result = await usersApi.get(user.id)
  console.log('2. Get user: OK', result.data)

  const profile = await profilesApi.get(user.id)
  console.log('3. Get public profile: OK', profile.data)

  const updated = await usersApi.update(user.id, {
    nameIsPublic: !user.nameIsPublic,
  })
  console.log('4. Update user: OK', updated.data)

  await usersApi.update(user.id, {
    nameIsPublic: user.nameIsPublic,
  })
  console.log('5. Restore user: OK')

  console.log('All user API tests passed!')

  return {
    success: true,
    tested: ['list', 'get', 'public profile', 'update', 'restore'],
  }
}

export async function loginAndTestUserApi(email: string, password: string) {
  // Authenticate through the API
  const login = await authApi.login({ email, password })

  console.log('Login successful:', login.user)

  // Test authenticated endpoints
  const users = await usersApi.list()
  console.log('Users:', users.data)

  const user = users.data[0]

  if (!user) {
    throw new Error('No authenticated user returned')
  }

  const result = await usersApi.get(user.id)
  console.log('User:', result.data)

  // Test public profile
  const profile = await profilesApi.get(user.id)
  console.log('Public profile:', profile.data)

  // Test update and restore
  const updated = await usersApi.update(user.id, {
    nameIsPublic: !user.nameIsPublic,
  })

  console.log('Updated:', updated.data)

  await usersApi.update(user.id, {
    nameIsPublic: user.nameIsPublic,
  })

  console.log('All user API tests passed.')
}

export async function registerAlice() {
  const result = await authApi.register({
    email: 'alice-test@example.com',
    password: 'TestPassword123!',
    username: 'alice_test',
    name: 'Alice Test',
  })

  console.log('Registration successful:', result)
}

export async function testMediaUpload(file: File) {
  console.log('Starting media upload...', file.name)

  // Create upload, upload to B2 and complete.
  const result = await mediaApi.upload(file)

  console.log('1. Upload completed:', result)

  // Retrieve temporary download URL.
  const download = await mediaApi.getOriginalDownloadUrl(result.id)

  console.log('2. Download URL:', download.url)
  console.log('Expires in:', download.expiresIn, 'seconds')

  return {
    success: true,
    mediaId: result.id,
    status: result.status,
    downloadUrl: download.url,
  }
}

declare global {
  interface Window {
    testMediaUpload: typeof testMediaUpload
  }
}

window.testMediaUpload = testMediaUpload
