# Equitie Backend API

A Node.js/Express backend API for investment portfolio management with Prisma ORM and PostgreSQL.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- PostgreSQL
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd equitie-backend

# Install dependencies
npm install

# Set up environment variables
cp env-template.txt .env
# Edit .env with your database credentials

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

## 📋 API Endpoints

### Public Routes

#### GET `/public/stats`
Get landing page statistics and portfolio overview.

**Response:**
```json
{
  "portfolio": {
    "totalAum": 15000000,
    "totalPortfolioValue": 18500000,
    "averageMoic": 2.3,
    "successRate": 85.5,
    "totalRealizedGains": 2500000,
    "totalUnrealizedGains": 1000000
  },
  "metrics": {
    "totalInvestors": 150,
    "totalDeals": 25,
    "totalCompanies": 18,
    "activeDeals": 20
  },
  "recentDeals": [
    {
      "dealId": 1,
      "dealName": "Tech Startup Series A",
      "companyName": "TechCorp",
      "sector": "Technology",
      "dealDate": "2024-01-15T00:00:00.000Z",
      "dealType": "SERIES_A",
      "entryValuation": 10000000
    }
  ],
  "performance": {
    "irrPortfolio": 0.25,
    "geographicDiversification": 0.8,
    "sectorDiversification": 0.75
  }
}
```

#### POST `/public/interested`
Submit investor interest form.

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phoneNumber": "+1234567890",
  "message": "Interested in investment opportunities"
}
```

**Response:**
```json
{
  "message": "Interest submitted successfully",
  "id": 1,
  "status": "NEW"
}
```

### Investor Routes

#### GET `/investor/portfolio?investorId=2`
Get detailed investor portfolio with all investments and metrics.

**Response:**
```json
{
  "portfolio": {
    "currentValue": 3221669.93,
    "totalReturnPercent": 104.21,
    "moic": 2.04,
    "firstInvestmentDate": "2020-05-01T00:00:00.000Z",
    "totalInvested": 1577597.7,
    "capitalEarned": 1644072.23
  },
  "investments": [
    {
      "dealId": 11,
      "dealName": "Multi-Company Fund",
      "companyNames": "Company A, Company B, Company C",
      "currentValue": 1500000,
      "investedAmount": 750000,
      "dealDate": "2021-03-15T00:00:00.000Z",
      "moic": 2.0,
      "dealType": "FUND",
      "dealStatus": "ACTIVE",
      "isMultipleCompanyDeal": true,
      "companies": [
        {
          "companyName": "Company A",
          "currentValue": 500000,
          "investedAmount": 250000,
          "moic": 2.0,
          "entryValuation": 10000000,
          "latestValuation": 20000000,
          "latestValuationDate": "2024-01-15T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

#### GET `/investor/portfolio/overview?investorId=2`
Get portfolio summary (same data as portfolio but without detailed investments).

**Response:**
```json
{
  "currentValue": 3221669.93,
  "totalReturnPercent": 104.21,
  "moic": 2.04,
  "firstInvestmentDate": "2020-05-01T00:00:00.000Z",
  "totalInvested": 1577597.7,
  "capitalEarned": 1644072.23
}
```

#### GET `/investor/investments/:dealId?investorId=2`
Get detailed information about a specific investment.

**Response:**
```json
{
  "investment": {
    "dealId": 11,
    "currentValue": 1500000,
    "investedAmount": 750000,
    "dealDate": "2021-03-15T00:00:00.000Z",
    "moic": 2.0,
    "dealType": "FUND",
    "dealStatus": "ACTIVE"
  },
  "companies": [
    {
      "companyName": "Company A",
      "sector": "Technology",
      "description": "AI-powered software company",
      "entryValuation": 10000000,
      "latestValuation": 20000000,
      "currentValue": 500000,
      "investedAmount": 250000,
      "moic": 2.0
    }
  ],
  "deal": {
    "fundVehicle": "FUND",
    "partner": "Investment Partner",
    "description": "Multi-company investment fund",
    "numberOfCompanies": 3,
    "isSingleCompanyDeal": false
  },
  "fees": {
    "managementFee": 15000,
    "performanceFee": 75000,
    "totalFees": 90000
  }
}
```

#### GET `/investor/portfolio/companies?investorId=2`
Get company distribution across the portfolio.

**Response:**
```json
[
  {
    "companyName": "Company A",
    "amount": 500000,
    "percentage": 33.33
  },
  {
    "companyName": "Company B",
    "amount": 500000,
    "percentage": 33.33
  },
  {
    "companyName": "Company C",
    "amount": 500000,
    "percentage": 33.34
  }
]
```

#### GET `/investor/portfolio/industries?investorId=2`
Get industry/sector distribution across the portfolio.

**Response:**
```json
[
  {
    "industry": "Technology",
    "amount": 1000000,
    "percentage": 66.67
  },
  {
    "industry": "Healthcare",
    "amount": 500000,
    "percentage": 33.33
  }
]
```

#### GET `/investor/portfolio/monthly-returns?investorId=2`
Get monthly returns based on actual valuations.

**Response:**
```json
[
  {
    "month": "2021-03",
    "invested": 750000,
    "currentValue": 1500000,
    "returnPercent": 100.0
  },
  {
    "month": "2021-06",
    "invested": 1000000,
    "currentValue": 2200000,
    "returnPercent": 120.0
  }
]
```

### Admin Routes

#### GET `/admin/investors`
List all investors (requires ADMIN authentication).

**Response:**
```json
[
  {
    "id": 1,
    "email": "investor@example.com",
    "fullName": "John Investor",
    "id_checked": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST `/admin/investors/:id/approve`
Approve an investor (requires ADMIN authentication).

**Response:**
```json
{
  "message": "Investor approved successfully",
  "investor": {
    "id": 1,
    "id_checked": true
  }
}
```

#### GET `/admin/deals`
List all deals (requires ADMIN authentication).

**Response:**
```json
[
  {
    "id": 1,
    "deal_name": "Tech Startup Series A",
    "deal_type": "SERIES_A",
    "deal_status": "ACTIVE",
    "deal_date": "2024-01-15T00:00:00.000Z",
    "entry_valuation": 10000000,
    "underlying_company": {
      "id": 1,
      "company_name": "TechCorp",
      "company_sector": "Technology"
    }
  }
]
```

#### PUT `/admin/valuations/:companyId`
Update company valuations (requires ADMIN authentication).

**Request Body:**
```json
{
  "valuation_post_money": 20000000,
  "valuation_pre_money": 15000000,
  "investment_amount": 5000000,
  "description": "Series A funding round"
}
```

**Response:**
```json
{
  "message": "Valuation updated successfully",
  "valuation": {
    "id": 1,
    "company_id": 1,
    "valuation_post_money": 20000000,
    "valuation_pre_money": 15000000,
    "investment_amount": 5000000,
    "description": "Series A funding round",
    "valuation_date": "2024-01-15T00:00:00.000Z"
  }
}
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file based on `env-template.txt`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/equitie_db"
JWT_SECRET="your-secret-key"
PORT=3000
```

### Database Setup
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Open Prisma Studio (optional)
npm run prisma:studio
```

## 🏗️ Project Structure

```
src/
├── controllers/          # Route handlers
│   ├── admin.controller.ts
│   ├── auth.controller.ts
│   ├── investor.controller.ts
│   └── public.controller.ts
├── middleware/           # Authentication & authorization
│   ├── auth.ts
│   └── roles.ts
├── routes/              # Route definitions
│   ├── admin.routes.ts
│   ├── auth.routes.ts
│   ├── investor.routes.ts
│   └── public.routes.ts
├── services/            # Business logic
│   └── database.service.ts
├── types/               # TypeScript type definitions
│   └── express.d.ts
└── index.ts            # Application entry point
```

## 🚀 Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

## 🔐 Authentication

Most routes require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

Admin routes require ADMIN role in addition to authentication.

## 📊 Data Models

The API uses Prisma with PostgreSQL and includes models for:
- Investors
- Deals
- Companies
- Valuations
- Transactions
- Portfolio Analytics
- Interested Investors

## 🛠️ Development

### Adding New Routes
1. Create controller function in appropriate controller file
2. Add route definition in routes file
3. Update this README with new endpoint documentation

### Database Changes
1. Update Prisma schema in `prisma/schema.prisma`
2. Run `npm run prisma:migrate` to create migration
3. Run `npm run prisma:generate` to update client 