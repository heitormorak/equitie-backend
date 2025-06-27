# Equitie Backend

Backend API for the Equitie investment platform.

## Setup

### 1. Environment Variables

Copy the `env-template.txt` file to `.env` and fill in your Supabase credentials:

```bash
cp env-template.txt .env
```

#### Required Environment Variables:

**Supabase PostgreSQL Database:**
- `DATABASE_URL`: Your Supabase PostgreSQL connection string
- `DB_HOST`: Supabase database host
- `DB_PORT`: Database port (usually 5432)
- `DB_NAME`: Database name (usually 'postgres')
- `DB_USER`: Database user (usually 'postgres')
- `DB_PASSWORD`: Your database password

**JWT Configuration:**
- `JWT_SECRET`: Secret key for JWT token signing

**Server Configuration:**
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

**Optional Supabase Client:**
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

### 2. Getting Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings > Database
3. Copy the connection string from "Connection string" section
4. Replace `[YOUR-PASSWORD]` with your database password
5. Replace `[YOUR-PROJECT-REF]` with your project reference

### 3. Install Dependencies

```bash
npm install
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate
```

**Note:** This project uses an existing Supabase database with real data. No seeding is required.

### 5. Run Development Server

```bash
npm run dev
```

## API Endpoints

### Public Routes

#### GET /public/stats
Returns landing page statistics including portfolio metrics and recent deals.

**Response:**
```json
{
  "portfolio": {
    "totalAum": 215000,
    "totalPortfolioValue": 387000,
    "averageMoic": 1.8,
    "successRate": 85.5,
    "totalRealizedGains": 0,
    "totalUnrealizedGains": 172000
  },
  "metrics": {
    "totalInvestors": 3,
    "totalDeals": 3,
    "totalCompanies": 3,
    "activeDeals": 3
  },
  "recentDeals": [
    {
      "dealId": 1,
      "dealName": "Figure.AI Series A",
      "companyName": "Figure.AI",
      "sector": "Technology",
      "dealDate": "2024-05-01T00:00:00.000Z",
      "dealType": "SPV",
      "entryValuation": 2000000000
    }
  ],
  "performance": {
    "irrPortfolio": 0.25,
    "geographicDiversification": 0.8,
    "sectorDiversification": 0.9
  }
}
```

#### POST /public/interested
Submit investor interest form.

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john.doe@example.com",
  "phoneNumber": "+1-555-0123",
  "message": "Interested in investment opportunities"
}
```

**Response:**
```json
{
  "message": "Interest submitted successfully",
  "id": "uuid-here",
  "status": "NEW"
}
```

### Investor Routes

#### GET /investor/portfolio
Returns the investor's portfolio overview including:
- Current portfolio value and returns
- List of investments with current values and MOIC
- Company distribution
- Industry distribution
- Profit distribution by industry
- Monthly returns

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "portfolio": {
    "currentValue": 1250000,
    "totalReturnPercent": 225,
    "moic": 3.6,
    "firstInvestmentDate": "2021-04-12T00:00:00.000Z",
    "totalInvested": 500000,
    "capitalEarned": 750000
  },
  "investments": [
    {
      "dealId": 1,
      "companyName": "Figure.AI",
      "currentValue": 98000,
      "investedAmount": 25000,
      "dealDate": "2024-05-01T00:00:00.000Z",
      "moic": 1.4,
      "dealType": "SPV",
      "dealStatus": "ACTIVE"
    }
  ],
  "companyDistribution": [...],
  "industryDistribution": [...],
  "profitDistribution": [...],
  "monthlyReturns": [...]
}
```

#### GET /investor/investments/:dealId
Returns detailed information about a specific investment.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "investment": {
    "dealId": 1,
    "companyName": "Figure.AI",
    "currentValue": 98000,
    "investedAmount": 25000,
    "dealDate": "2024-05-01T00:00:00.000Z",
    "moic": 1.4,
    "dealType": "SPV",
    "dealStatus": "ACTIVE"
  },
  "company": {
    "entryValuation": 2000000000,
    "latestValuation": 7700000000,
    "sector": "Technology",
    "description": "AI robotics company"
  },
  "deal": {
    "fundVehicle": "SPV",
    "spvName": "Equitie Soul LLC",
    "partner": "Align",
    "description": "Series A investment in Figure.AI"
  },
  "fees": {
    "managementFee": 250,
    "performanceFee": 3750,
    "totalFees": 4000
  }
}
```

## Database Connection

The project uses Prisma ORM to connect to Supabase PostgreSQL. The connection is configured in `prisma/schema.prisma` and provides type-safe database operations.

**Note:** This project connects to an existing Supabase database with real investment data. The schema is based on the actual database structure.

## Project Structure

```
src/
├── config/
│   └── database.ts          # Database configuration (legacy)
├── controllers/
│   ├── investor.controller.ts # Investor API controllers
│   └── public.controller.ts   # Public API controllers
├── middleware/
│   ├── auth.ts             # Authentication middleware
│   └── roles.ts            # Role-based authorization
├── routes/
│   ├── investor.routes.ts  # Investor API routes
│   ├── admin.routes.ts     # Admin API routes
│   ├── auth.routes.ts      # Authentication routes
│   └── public.routes.ts    # Public API routes
├── services/
│   └── database.service.ts # Database service utilities (legacy)
├── types/
│   └── express.d.ts        # Express type extensions
└── index.ts               # Main application entry point

prisma/
└── schema.prisma          # Database schema
```

## Features

### Public Landing Page
- Portfolio performance statistics
- Recent deals showcase
- Investor interest form submission
- Success metrics and diversification scores

### Portfolio Management
- Real-time portfolio value calculation
- MOIC (Multiple on Invested Capital) tracking
- Investment distribution analysis
- Monthly return tracking
- Industry and company diversification metrics

### Investment Details
- Detailed investment information
- Company valuation history
- Fee structure breakdown
- Deal partner information
- SPV and fund vehicle details

### Security
- JWT-based authentication
- Role-based authorization
- Secure database connections with SSL
- Environment variable configuration

## Development

### Database Operations
```bash
# View database in Prisma Studio
npm run prisma:studio

# Generate Prisma client after schema changes
npm run prisma:generate

# Run migrations (if needed)
npm run prisma:migrate
```

### Building for Production
```bash
npm run build
npm start
``` 