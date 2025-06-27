
CREATE TYPE "public"."enum_companies_company_type" AS ENUM (
    'PORTFOLIO',
    'PARTNER',
    'HOLDING'
);


ALTER TYPE "public"."enum_companies_company_type" OWNER TO "postgres";


CREATE TYPE "public"."enum_deals_deal_type" AS ENUM (
    'FACILITATED_DIRECT',
    'FACILITATED_INVESTORS',
    'ADVISORY',
    'SPV',
    'PARTNERSHIP',
    'EQUITIE'
);


ALTER TYPE "public"."enum_deals_deal_type" OWNER TO "postgres";


CREATE TYPE "public"."enum_documents_related_entity_type" AS ENUM (
    'INVESTOR',
    'DEAL',
    'PROJECT',
    'TRANSACTION'
);


ALTER TYPE "public"."enum_documents_related_entity_type" OWNER TO "postgres";


CREATE TYPE "public"."enum_investors_investor_type" AS ENUM (
    'INDIVIDUAL',
    'COMPANY'
);


ALTER TYPE "public"."enum_investors_investor_type" OWNER TO "postgres";


CREATE TYPE "public"."enum_projects_status" AS ENUM (
    'PLANNING',
    'ACTIVE',
    'CLOSED'
);


ALTER TYPE "public"."enum_projects_status" OWNER TO "postgres";


CREATE TYPE "public"."enum_projects_type" AS ENUM (
    'INVESTMENT',
    'ADVISORY'
);


ALTER TYPE "public"."enum_projects_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_portfolio_analytics"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.portfolio_analytics (
    calculation_date,
    total_aum,
    total_portfolio_value,
    active_deals_count,
    total_investors_count,
    average_moic
  )
  SELECT 
    CURRENT_DATE,
    COALESCE(SUM(t.gross_capital), 0) as total_aum,
    COALESCE(SUM(d.entry_valuation), 0) as total_portfolio_value,
    COUNT(DISTINCT CASE WHEN d.deal_status != 'closed' THEN d.deal_id END) as active_deals_count,
    COUNT(DISTINCT i.id) as total_investors_count,
    CASE 
      WHEN COUNT(d.deal_id) > 0 THEN 
        AVG(CASE WHEN t.gross_capital > 0 THEN d.entry_valuation / t.gross_capital ELSE 0 END)
      ELSE 0 
    END as average_moic
  FROM public.transactions t
  LEFT JOIN public.deals d ON t.deal_id = d.deal_id
  LEFT JOIN public.investors i ON t.investor_id = i.id
  ON CONFLICT (calculation_date) DO UPDATE SET
    total_aum = EXCLUDED.total_aum,
    total_portfolio_value = EXCLUDED.total_portfolio_value,
    active_deals_count = EXCLUDED.active_deals_count,
    total_investors_count = EXCLUDED.total_investors_count,
    average_moic = EXCLUDED.average_moic,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."calculate_portfolio_analytics"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agreement_types" (
    "id" integer NOT NULL,
    "type_code" character varying(50) NOT NULL,
    "type_name" character varying(100) NOT NULL,
    "description" "text",
    "is_binding" boolean DEFAULT true,
    "required_signatures" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agreement_types" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."agreement_types_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."agreement_types_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."agreement_types_id_seq" OWNED BY "public"."agreement_types"."id";



CREATE TABLE IF NOT EXISTS "public"."companies" (
    "company_id" integer NOT NULL,
    "company_name" character varying(255) NOT NULL,
    "company_type" "public"."enum_companies_company_type" NOT NULL,
    "company_description" "text",
    "country_incorporation" character varying(255),
    "company_sector" "text",
    "incorporation_date" "date",
    "portfolio_company_website" "text",
    "funding_round_stage" "text",
    "founding_year" integer,
    "lead_contact_name" "text",
    "lead_contact_email" "text",
    "last_pitch_deck_path" "text",
    "data_room_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."companies_company_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."companies_company_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."companies_company_id_seq" OWNED BY "public"."companies"."company_id";



CREATE TABLE IF NOT EXISTS "public"."deal_analytics" (
    "id" integer NOT NULL,
    "deal_id" integer NOT NULL,
    "calculation_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "current_valuation" numeric(15,2),
    "total_invested" numeric(15,2),
    "moic" numeric(8,2),
    "irr" numeric(8,4),
    "holding_period_days" integer,
    "unrealized_gain_loss" numeric(15,2),
    "risk_score" numeric(5,2),
    "liquidity_score" numeric(5,2),
    "performance_quartile" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deal_analytics" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."deal_analytics_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."deal_analytics_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."deal_analytics_id_seq" OWNED BY "public"."deal_analytics"."id";



CREATE TABLE IF NOT EXISTS "public"."deal_company_investments" (
    "id" integer NOT NULL,
    "deal_id" integer NOT NULL,
    "company_id" integer NOT NULL,
    "investment_amount" numeric(20,2) NOT NULL,
    "entry_valuation" numeric(20,2) NOT NULL,
    "investment_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deal_company_investments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."deal_company_investments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."deal_company_investments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."deal_company_investments_id_seq" OWNED BY "public"."deal_company_investments"."id";



CREATE TABLE IF NOT EXISTS "public"."deal_requirements" (
    "id" integer NOT NULL,
    "deal_type" character varying(255) NOT NULL,
    "document_type" character varying(255) NOT NULL,
    "required" boolean DEFAULT true,
    "order" integer,
    "version" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."deal_requirements" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."deal_requirements_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."deal_requirements_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."deal_requirements_id_seq" OWNED BY "public"."deal_requirements"."id";



CREATE TABLE IF NOT EXISTS "public"."deals" (
    "deal_id" integer NOT NULL,
    "deal_name" character varying(255) NOT NULL,
    "deal_type" "public"."enum_deals_deal_type" NOT NULL,
    "underlying_company_id" integer,
    "holding_entity" integer,
    "deal_date" "date",
    "entry_valuation" numeric(20,2),
    "initial_unit_price" numeric(20,2),
    "exit_price_per_unit" numeric(20,2),
    "deal_exited" boolean DEFAULT false,
    "gross_capital" numeric(20,2),
    "deal_partner_name" character varying(255),
    "deal_currency" character varying(255),
    "initial_net_capital" numeric(20,2),
    "structuring_fee_percent" numeric(5,2),
    "premium_fee_percent" numeric(5,2),
    "performance_fee_partner" numeric(5,2),
    "performance_fee_equitie" numeric(5,2),
    "annual_management_fee_percent" numeric(5,2),
    "holding_entity_units" integer,
    "advisory_shares_earned" integer,
    "partner_llc_agreement" character varying(255),
    "member_operating_agreement" character varying(255),
    "members_side_letter" character varying(255),
    "partner_side_letter" character varying(255),
    "exit_date" "date",
    "exit_price_per_underlying_share" numeric(20,2),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deal_status" character varying(50),
    "description" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "partner_performance_fee_percent" numeric,
    "partner_annual_management_fee_percent" numeric,
    "partner_management_fee_years" integer,
    "subscription_capital" numeric
);


ALTER TABLE "public"."deals" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."deals_deal_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."deals_deal_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."deals_deal_id_seq" OWNED BY "public"."deals"."deal_id";



CREATE TABLE IF NOT EXISTS "public"."deals_underlying_companies" (
    "id" integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deal_id" integer,
    "company_id" integer
);


ALTER TABLE "public"."deals_underlying_companies" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."deals_underlying_companies_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."deals_underlying_companies_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."deals_underlying_companies_id_seq" OWNED BY "public"."deals_underlying_companies"."id";



CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "url" "text",
    "description" "text",
    "investor_id" integer,
    "deal_id" integer,
    "company_id" integer,
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interested_investors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone_number" "text",
    "message" "text",
    "status" "text" DEFAULT 'NEW'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."interested_investors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."investment_snapshots" (
    "snapshot_id" integer NOT NULL,
    "investor_id" integer NOT NULL,
    "deal_id" integer NOT NULL,
    "company_id" integer NOT NULL,
    "snapshot_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_units" integer NOT NULL,
    "net_capital" numeric(20,2) NOT NULL,
    "entry_valuation" numeric(20,2) NOT NULL,
    "last_valuation" numeric(20,2) NOT NULL,
    "moic" numeric(10,4) GENERATED ALWAYS AS (("last_valuation" / NULLIF("entry_valuation", (0)::numeric))) STORED,
    "current_value" numeric(20,2) GENERATED ALWAYS AS (("net_capital" * ("last_valuation" / NULLIF("entry_valuation", (0)::numeric)))) STORED,
    "profit_percent" numeric(10,4) GENERATED ALWAYS AS (((("net_capital" * ("last_valuation" / NULLIF("entry_valuation", (0)::numeric))) - "net_capital") / NULLIF("net_capital", (0)::numeric))) STORED,
    "valuation_source" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."investment_snapshots" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."investment_snapshots_snapshot_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."investment_snapshots_snapshot_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."investment_snapshots_snapshot_id_seq" OWNED BY "public"."investment_snapshots"."snapshot_id";



CREATE TABLE IF NOT EXISTS "public"."investor_analytics" (
    "id" integer NOT NULL,
    "investor_id" integer NOT NULL,
    "calculation_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_committed" numeric(15,2) DEFAULT 0,
    "total_invested" numeric(15,2) DEFAULT 0,
    "current_portfolio_value" numeric(15,2) DEFAULT 0,
    "realized_returns" numeric(15,2) DEFAULT 0,
    "unrealized_returns" numeric(15,2) DEFAULT 0,
    "portfolio_irr" numeric(8,4) DEFAULT 0,
    "number_of_investments" integer DEFAULT 0,
    "average_investment_size" numeric(12,2) DEFAULT 0,
    "investment_diversification_score" numeric(5,2) DEFAULT 0,
    "risk_profile_score" numeric(5,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."investor_analytics" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."investor_analytics_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."investor_analytics_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."investor_analytics_id_seq" OWNED BY "public"."investor_analytics"."id";



CREATE TABLE IF NOT EXISTS "public"."investors" (
    "id" integer NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "primary_email" character varying(255) NOT NULL,
    "secondary_email" character varying(255),
    "phone" character varying(255),
    "nationality" character varying(255),
    "country_of_residence" character varying(255),
    "birthday" "date",
    "address" "text",
    "investor_type" "public"."enum_investors_investor_type" NOT NULL,
    "referred_by" character varying(255),
    "passport_copy" character varying(255),
    "id_checked" boolean DEFAULT false,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "investor_id" "text",
    "residence_city" "text",
    "marital_status" "text",
    "occupation" "text",
    "join_date" "date",
    "source_of_wealth" "text",
    "expected_income_usd" numeric,
    "liquidity_needs" "text",
    "education_background" "text",
    "languages_spoken" "text"[],
    "business_interests" "text",
    "usd_bank_account_details" "text",
    "decision_independence" boolean
);


ALTER TABLE "public"."investors" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."investors_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."investors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."investors_id_seq" OWNED BY "public"."investors"."id";



CREATE TABLE IF NOT EXISTS "public"."portfolio_analytics" (
    "id" integer NOT NULL,
    "calculation_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_aum" numeric(15,2) DEFAULT 0,
    "total_portfolio_value" numeric(15,2) DEFAULT 0,
    "active_deals_count" integer DEFAULT 0,
    "total_investors_count" integer DEFAULT 0,
    "average_moic" numeric(8,2) DEFAULT 0,
    "total_realized_gains" numeric(15,2) DEFAULT 0,
    "total_unrealized_gains" numeric(15,2) DEFAULT 0,
    "irr_portfolio" numeric(8,4) DEFAULT 0,
    "success_rate_percentage" numeric(5,2) DEFAULT 0,
    "geographic_diversification_score" numeric(5,2) DEFAULT 0,
    "sector_diversification_score" numeric(5,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."portfolio_analytics" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."portfolio_analytics_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."portfolio_analytics_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."portfolio_analytics_id_seq" OWNED BY "public"."portfolio_analytics"."id";



CREATE TABLE IF NOT EXISTS "public"."research_types" (
    "id" integer NOT NULL,
    "type_code" character varying(50) NOT NULL,
    "type_name" character varying(100) NOT NULL,
    "description" "text",
    "is_internal" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."research_types" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."research_types_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."research_types_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."research_types_id_seq" OWNED BY "public"."research_types"."id";



CREATE TABLE IF NOT EXISTS "public"."share_types" (
    "id" integer NOT NULL,
    "type_code" character varying(50) NOT NULL,
    "type_name" character varying(100) NOT NULL,
    "description" "text",
    "voting_rights" boolean DEFAULT true,
    "dividend_preference" boolean DEFAULT false,
    "liquidation_preference" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."share_types" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."share_types_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."share_types_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."share_types_id_seq" OWNED BY "public"."share_types"."id";



CREATE TABLE IF NOT EXISTS "public"."transaction_secondaries" (
    "id" integer NOT NULL,
    "deal_name_link" integer NOT NULL,
    "seller_name" integer NOT NULL,
    "subnominee_seller" integer,
    "transaction" integer NOT NULL,
    "unit_price" numeric(20,2) NOT NULL,
    "buyer_name" integer NOT NULL,
    "number_of_unit_sold" integer NOT NULL,
    "transaction_amount" numeric(20,2) NOT NULL,
    "price_per_unit_sold" numeric(20,2) NOT NULL,
    "secondary_transaction_date" "date" NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."transaction_secondaries" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transaction_secondaries_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transaction_secondaries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transaction_secondaries_id_seq" OWNED BY "public"."transaction_secondaries"."id";



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "transaction_id" integer NOT NULL,
    "deal_id" integer NOT NULL,
    "investor_id" integer NOT NULL,
    "transaction_date" "date" NOT NULL,
    "units" integer NOT NULL,
    "unit_price" numeric(20,2) NOT NULL,
    "gross_capital" numeric(20,2) NOT NULL,
    "initial_net_capital" numeric(20,2),
    "admin_fee" numeric(20,2),
    "deal_name" character varying(255),
    "management_fee_percent" numeric(5,2),
    "performance_fee_percent" numeric(5,2),
    "structuring_fee_percent" numeric(5,2),
    "premium_fee_percent" numeric(5,2),
    "source_email_id" character varying(255),
    "source_doc_link" character varying(255),
    "agent_parsed" boolean DEFAULT false,
    "nominee" boolean DEFAULT false,
    "term_sheet" character varying(255),
    "operating_agreement" character varying(255),
    "transfer_due" numeric(20,2),
    "initial_amount_received" numeric(20,2),
    "full_name" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions_advisory" (
    "id" integer NOT NULL,
    "advisory_deal" character varying(255),
    "deal_link" integer NOT NULL,
    "holding_entity" integer,
    "number_of_shares" integer,
    "granted_share_price" numeric(20,2),
    "advisory_cash_revenue" numeric(20,2),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."transactions_advisory" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transactions_advisory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transactions_advisory_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transactions_advisory_id_seq" OWNED BY "public"."transactions_advisory"."id";



CREATE TABLE IF NOT EXISTS "public"."transactions_sub_nominees" (
    "subnominee_id" integer NOT NULL,
    "sub_nominee_investor_link" integer NOT NULL,
    "transaction" integer NOT NULL,
    "nominee_name" character varying(255),
    "deal_name" character varying(255),
    "gross_capital_nominee" numeric(20,2),
    "initial_net_capital_nominee" numeric(20,2),
    "subnominee_share_of_ticket" numeric(5,2),
    "gross_capital_subnominee" numeric(20,2),
    "admin_fee" numeric(20,2),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."transactions_sub_nominees" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transactions_sub_nominees_subnominee_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transactions_sub_nominees_subnominee_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transactions_sub_nominees_subnominee_id_seq" OWNED BY "public"."transactions_sub_nominees"."subnominee_id";



CREATE SEQUENCE IF NOT EXISTS "public"."transactions_transaction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transactions_transaction_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transactions_transaction_id_seq" OWNED BY "public"."transactions"."transaction_id";



CREATE TABLE IF NOT EXISTS "public"."valuations" (
    "valuation_id" integer NOT NULL,
    "company_id" integer NOT NULL,
    "description" "text",
    "valuation_date" "date" NOT NULL,
    "valuation_post_money" numeric(20,2) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "valuation_pre_money" numeric(20,2) NOT NULL,
    "investment_amount" numeric(20,2) NOT NULL
);


ALTER TABLE "public"."valuations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."valuations_valuation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."valuations_valuation_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."valuations_valuation_id_seq" OWNED BY "public"."valuations"."valuation_id";



ALTER TABLE ONLY "public"."agreement_types" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."agreement_types_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."companies" ALTER COLUMN "company_id" SET DEFAULT "nextval"('"public"."companies_company_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."deal_analytics" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."deal_analytics_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."deal_company_investments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."deal_company_investments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."deal_requirements" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."deal_requirements_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."deals" ALTER COLUMN "deal_id" SET DEFAULT "nextval"('"public"."deals_deal_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."deals_underlying_companies" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."deals_underlying_companies_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."investment_snapshots" ALTER COLUMN "snapshot_id" SET DEFAULT "nextval"('"public"."investment_snapshots_snapshot_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."investor_analytics" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."investor_analytics_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."investors" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."investors_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."portfolio_analytics" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."portfolio_analytics_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."research_types" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."research_types_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."share_types" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."share_types_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transaction_secondaries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transaction_secondaries_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transactions" ALTER COLUMN "transaction_id" SET DEFAULT "nextval"('"public"."transactions_transaction_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transactions_advisory" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transactions_advisory_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transactions_sub_nominees" ALTER COLUMN "subnominee_id" SET DEFAULT "nextval"('"public"."transactions_sub_nominees_subnominee_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."valuations" ALTER COLUMN "valuation_id" SET DEFAULT "nextval"('"public"."valuations_valuation_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."agreement_types"
    ADD CONSTRAINT "agreement_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agreement_types"
    ADD CONSTRAINT "agreement_types_type_code_key" UNIQUE ("type_code");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_company_name_unique" UNIQUE ("company_name");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("company_id");



ALTER TABLE ONLY "public"."deal_analytics"
    ADD CONSTRAINT "deal_analytics_deal_id_calculation_date_key" UNIQUE ("deal_id", "calculation_date");



ALTER TABLE ONLY "public"."deal_analytics"
    ADD CONSTRAINT "deal_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deal_company_investments"
    ADD CONSTRAINT "deal_company_investments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deal_company_investments"
    ADD CONSTRAINT "deal_company_investments_unique_deal_company" UNIQUE ("deal_id", "company_id");



ALTER TABLE ONLY "public"."deal_requirements"
    ADD CONSTRAINT "deal_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_pkey" PRIMARY KEY ("deal_id");



ALTER TABLE ONLY "public"."deals_underlying_companies"
    ADD CONSTRAINT "deals_underlying_companies_deal_id_company_id_key" UNIQUE ("deal_id", "company_id");



ALTER TABLE ONLY "public"."deals_underlying_companies"
    ADD CONSTRAINT "deals_underlying_companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interested_investors"
    ADD CONSTRAINT "interested_investors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investment_snapshots"
    ADD CONSTRAINT "investment_snapshots_investor_id_deal_id_company_id_key" UNIQUE ("investor_id", "deal_id", "company_id");



ALTER TABLE ONLY "public"."investment_snapshots"
    ADD CONSTRAINT "investment_snapshots_pkey" PRIMARY KEY ("snapshot_id");



ALTER TABLE ONLY "public"."investor_analytics"
    ADD CONSTRAINT "investor_analytics_investor_id_calculation_date_key" UNIQUE ("investor_id", "calculation_date");



ALTER TABLE ONLY "public"."investor_analytics"
    ADD CONSTRAINT "investor_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investors"
    ADD CONSTRAINT "investors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investors"
    ADD CONSTRAINT "investors_primary_email_key" UNIQUE ("primary_email");



ALTER TABLE ONLY "public"."portfolio_analytics"
    ADD CONSTRAINT "portfolio_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."research_types"
    ADD CONSTRAINT "research_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."research_types"
    ADD CONSTRAINT "research_types_type_code_key" UNIQUE ("type_code");



ALTER TABLE ONLY "public"."share_types"
    ADD CONSTRAINT "share_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."share_types"
    ADD CONSTRAINT "share_types_type_code_key" UNIQUE ("type_code");



ALTER TABLE ONLY "public"."transaction_secondaries"
    ADD CONSTRAINT "transaction_secondaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions_advisory"
    ADD CONSTRAINT "transactions_advisory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id");



ALTER TABLE ONLY "public"."transactions_sub_nominees"
    ADD CONSTRAINT "transactions_sub_nominees_pkey" PRIMARY KEY ("subnominee_id");



ALTER TABLE ONLY "public"."valuations"
    ADD CONSTRAINT "valuations_pkey" PRIMARY KEY ("valuation_id");



CREATE INDEX "idx_deal_company_investments_company_id" ON "public"."deal_company_investments" USING "btree" ("company_id");



CREATE INDEX "idx_deal_company_investments_deal_id" ON "public"."deal_company_investments" USING "btree" ("deal_id");



ALTER TABLE ONLY "public"."deal_analytics"
    ADD CONSTRAINT "deal_analytics_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("deal_id");



ALTER TABLE ONLY "public"."deal_company_investments"
    ADD CONSTRAINT "deal_company_investments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deal_company_investments"
    ADD CONSTRAINT "deal_company_investments_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("deal_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_holding_entity_fkey" FOREIGN KEY ("holding_entity") REFERENCES "public"."companies"("company_id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."deals_underlying_companies"
    ADD CONSTRAINT "deals_underlying_companies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deals_underlying_companies"
    ADD CONSTRAINT "deals_underlying_companies_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("deal_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_underlying_company_fkey" FOREIGN KEY ("underlying_company_id") REFERENCES "public"."companies"("company_id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("deal_id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id");



ALTER TABLE ONLY "public"."investment_snapshots"
    ADD CONSTRAINT "investment_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investment_snapshots"
    ADD CONSTRAINT "investment_snapshots_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("deal_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investment_snapshots"
    ADD CONSTRAINT "investment_snapshots_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investor_analytics"
    ADD CONSTRAINT "investor_analytics_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id");



ALTER TABLE ONLY "public"."transaction_secondaries"
    ADD CONSTRAINT "transaction_secondaries_buyer_name_fkey" FOREIGN KEY ("buyer_name") REFERENCES "public"."investors"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."transaction_secondaries"
    ADD CONSTRAINT "transaction_secondaries_deal_name_link_fkey" FOREIGN KEY ("deal_name_link") REFERENCES "public"."deals"("deal_id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."transaction_secondaries"
    ADD CONSTRAINT "transaction_secondaries_seller_name_fkey" FOREIGN KEY ("seller_name") REFERENCES "public"."investors"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."transaction_secondaries"
    ADD CONSTRAINT "transaction_secondaries_subnominee_seller_fkey" FOREIGN KEY ("subnominee_seller") REFERENCES "public"."transactions_sub_nominees"("subnominee_id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."transaction_secondaries"
    ADD CONSTRAINT "transaction_secondaries_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "public"."transactions"("transaction_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions_advisory"
    ADD CONSTRAINT "transactions_advisory_deal_link_fkey" FOREIGN KEY ("deal_link") REFERENCES "public"."deals"("deal_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions_advisory"
    ADD CONSTRAINT "transactions_advisory_holding_entity_fkey" FOREIGN KEY ("holding_entity") REFERENCES "public"."companies"("company_id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("deal_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."transactions_sub_nominees"
    ADD CONSTRAINT "transactions_sub_nominees_sub_nominee_investor_link_fkey" FOREIGN KEY ("sub_nominee_investor_link") REFERENCES "public"."investors"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."transactions_sub_nominees"
    ADD CONSTRAINT "transactions_sub_nominees_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "public"."transactions"("transaction_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."valuations"
    ADD CONSTRAINT "valuations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON UPDATE CASCADE ON DELETE CASCADE;

