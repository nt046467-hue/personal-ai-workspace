import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthPayload {
  userId: string;
  workspaceId: string;
  email: string;
  name: string;
  role: string;
  tokenVersion: number;
}

export function generateAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: '15m',
  });
}

export function generateRefreshToken(payload: { userId: string; sessionId: string }): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: '30d',
  });
}

export function generateToken(payload: AuthPayload): string {
  return generateAccessToken(payload);
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: string; sessionId: string } | null {
  try {
    return jwt.verify(token, config.jwtSecret) as { userId: string; sessionId: string };
  } catch {
    return null;
  }
}
