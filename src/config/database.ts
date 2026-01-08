import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Initialize Prisma Client for Neon PostgreSQL
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('✓ PostgreSQL connected successfully');
  } catch (error) {
    logger.error('PostgreSQL connection error:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
};

// In-memory cache replacement for Redis
const inMemoryCache = new Map<string, { value: any; expiry?: number }>();

export const redisClient = {
  incr: async (key: string): Promise<number> => {
    const current = inMemoryCache.get(key);
    const newValue = (current?.value || 0) + 1;
    inMemoryCache.set(key, { value: newValue, expiry: current?.expiry });
    return newValue;
  },
  expire: async (key: string, seconds: number): Promise<boolean> => {
    const current = inMemoryCache.get(key);
    if (current) {
      inMemoryCache.set(key, { value: current.value, expiry: Date.now() + seconds * 1000 });
    }
    return true;
  },
  setEx: async (key: string, seconds: number, value: string): Promise<string> => {
    inMemoryCache.set(key, { value, expiry: Date.now() + seconds * 1000 });
    return 'OK';
  },
  exists: async (key: string): Promise<number> => {
    const item = inMemoryCache.get(key);
    if (!item) return 0;
    if (item.expiry && item.expiry < Date.now()) {
      inMemoryCache.delete(key);
      return 0;
    }
    return 1;
  },
  set: async (key: string, value: string): Promise<string> => {
    inMemoryCache.set(key, { value });
    return 'OK';
  },
  get: async (key: string): Promise<string | null> => {
    const item = inMemoryCache.get(key);
    if (!item) return null;
    if (item.expiry && item.expiry < Date.now()) {
      inMemoryCache.delete(key);
      return null;
    }
    return item.value;
  },
  del: async (key: string): Promise<number> => {
    return inMemoryCache.delete(key) ? 1 : 0;
  }
};

// Clean up expired items periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of inMemoryCache.entries()) {
    if (item.expiry && item.expiry < now) {
      inMemoryCache.delete(key);
    }
  }
}, 60000); // Clean up every minute
