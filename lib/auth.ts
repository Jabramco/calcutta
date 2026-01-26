import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export interface TokenPayload {
  userId: number
  username: string
  role: string
}

export async function generateToken(payload: TokenPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
  
  return token
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as TokenPayload
  } catch (error) {
    return null
  }
}

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  
  if (!token) return null
  
  return verifyToken(token)
}

export function requireAuth(role?: 'admin'): (req: Request) => Promise<TokenPayload> {
  return async (req: Request) => {
    const token = req.headers.get('cookie')?.split('auth_token=')[1]?.split(';')[0]
    
    if (!token) {
      throw new Error('Unauthorized')
    }
    
    const user = await verifyToken(token)
    
    if (!user) {
      throw new Error('Invalid token')
    }
    
    if (role && user.role !== role) {
      throw new Error('Insufficient permissions')
    }
    
    return user
  }
}
