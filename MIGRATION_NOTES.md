# MongoDB to PostgreSQL Migration Notes

## Summary

This project has been successfully migrated from MongoDB/Mongoose to PostgreSQL/Prisma using Neon as the database provider.

## What Changed

### Database
- **Before**: MongoDB with Mongoose ODM
- **After**: PostgreSQL (Neon) with Prisma ORM

### Schema Changes
All MongoDB models have been converted to Prisma schema:
- `User` - User accounts with authentication
- `ApiKey` - API keys for authentication
- `Challenge` - CAPTCHA challenges
- `Usage` - Usage tracking
- `AbuseLog` - Abuse detection logs
- `Blacklist` - IP/fingerprint blacklist

### Enum Values
Enum values have been standardized to uppercase:
- Tier: `FREE`, `BASIC`, `PRO`, `ENTERPRISE`
- RiskLevel: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- Severity: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- BlacklistType: `IP`, `FINGERPRINT`, `EMAIL`

### File Changes

#### Removed
- `/src/models/` - All Mongoose model files removed

#### Modified
- `package.json` - Replaced mongoose with @prisma/client and prisma
- `.env` - Changed MONGODB_URI to DATABASE_URL
- `src/config/database.ts` - Now uses PrismaClient
- `src/routes/auth.ts` - Converted to Prisma queries
- `src/routes/apiKeys.ts` - Converted to Prisma queries
- `src/routes/challenge.ts` - Converted to Prisma queries
- `src/routes/billing.ts` - Converted to Prisma queries
- `src/services/abuseDetection.ts` - Converted to Prisma queries
- `src/middleware/auth.ts` - Converted to Prisma queries
- `src/middleware/rateLimiter.ts` - Updated tier enum values
- `src/index.ts` - Added Prisma disconnect on shutdown

#### Added
- `prisma/schema.prisma` - Complete database schema
- `MIGRATION_NOTES.md` - This file

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file with your Neon PostgreSQL connection:
```env
DATABASE_URL=postgresql://username:password@your-neon-host.neon.tech/dbname?sslmode=require
```

### 3. Initialize Database
```bash
npx prisma generate
npx prisma db push
```

### 4. Run the Application
```bash
npm run dev
```

## Prisma Commands

### Generate Client
```bash
npx prisma generate
```

### Push Schema to Database
```bash
npx prisma db push
```

### Open Prisma Studio (Database GUI)
```bash
npx prisma studio
```

### Create Migration
```bash
npx prisma migrate dev --name migration_name
```

### Apply Migrations (Production)
```bash
npx prisma migrate deploy
```

## Query Differences

### MongoDB (Mongoose) vs PostgreSQL (Prisma)

#### Find One
```typescript
// Before (Mongoose)
await User.findOne({ email });

// After (Prisma)
await prisma.user.findUnique({ where: { email } });
```

#### Create
```typescript
// Before (Mongoose)
const user = new User(data);
await user.save();

// After (Prisma)
await prisma.user.create({ data });
```

#### Update
```typescript
// Before (Mongoose)
user.name = 'New Name';
await user.save();

// After (Prisma)
await prisma.user.update({
  where: { id: user.id },
  data: { name: 'New Name' }
});
```

#### Delete
```typescript
// Before (Mongoose)
await User.deleteMany({ tier: 'free' });

// After (Prisma)
await prisma.user.deleteMany({ where: { tier: 'FREE' } });
```

#### Count
```typescript
// Before (Mongoose)
await Usage.countDocuments({ userId });

// After (Prisma)
await prisma.usage.count({ where: { userId } });
```

#### Relations
```typescript
// Before (Mongoose)
await ApiKey.findOne({ key }).populate('userId');

// After (Prisma)
await prisma.apiKey.findUnique({
  where: { key },
  include: { user: true }
});
```

## Benefits of PostgreSQL + Prisma

1. **Type Safety**: Full TypeScript support with auto-generated types
2. **Relations**: Proper foreign keys and referential integrity
3. **Migrations**: Version-controlled database schema changes
4. **Performance**: Optimized queries and connection pooling
5. **Neon Features**: Serverless, autoscaling, branching for development
6. **Developer Experience**: Prisma Studio for database inspection

## Notes

- All IDs are now UUIDs (using `@default(uuid())`)
- Timestamps use `@default(now())` and `@updatedAt`
- Indexes are defined in the schema for better performance
- Cascade deletes are configured for proper data cleanup
- All queries maintain the same business logic as before

## Testing

After migration, thoroughly test:
1. User registration and login
2. API key creation and authentication
3. Challenge creation and verification
4. Billing and subscription updates
5. Abuse detection and blacklisting
6. Rate limiting functionality

## Support

For Prisma documentation: https://www.prisma.io/docs
For Neon documentation: https://neon.tech/docs
