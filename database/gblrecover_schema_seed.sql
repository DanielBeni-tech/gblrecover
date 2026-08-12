-- Script PostgreSQL pour matérialiser la base GBLRecover
-- Basé sur le schéma officiel du projet et sur les données de démonstration du frontend
-- À exécuter dans PostgreSQL 16 : psql -d gblrecover -f database/gblrecover_schema_seed.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS payment_allocations CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS managers CASCADE;
DROP TABLE IF EXISTS agencies CASCADE;
DROP TABLE IF EXISTS centres CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

DROP TYPE IF EXISTS payment_method_enum CASCADE;
DROP TYPE IF EXISTS payment_status_enum CASCADE;
DROP TYPE IF EXISTS invoice_status_enum CASCADE;
DROP TYPE IF EXISTS subscription_status_enum CASCADE;
DROP TYPE IF EXISTS billing_frequency_enum CASCADE;
DROP TYPE IF EXISTS service_status_enum CASCADE;
DROP TYPE IF EXISTS account_status_enum CASCADE;
DROP TYPE IF EXISTS client_status_enum CASCADE;
DROP TYPE IF EXISTS client_type_enum CASCADE;

CREATE TYPE client_type_enum AS ENUM ('INDIVIDUAL', 'ORGANIZATION');
CREATE TYPE client_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED');
CREATE TYPE account_status_enum AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED');
CREATE TYPE service_status_enum AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE billing_frequency_enum AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME');
CREATE TYPE subscription_status_enum AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');
CREATE TYPE invoice_status_enum AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE payment_status_enum AS ENUM ('RECEIVED', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'REVERSED', 'REJECTED');
CREATE TYPE payment_method_enum AS ENUM ('BANK', 'CASH', 'MOBILE_MONEY', 'CARD', 'TRANSFER', 'OTHER');

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(100) NOT NULL UNIQUE,
    client_type client_type_enum NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    tax_identifier VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    status client_status_enum NOT NULL,
    source_system VARCHAR(80) NOT NULL,
    source_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE centres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id UUID NOT NULL REFERENCES centres(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    employee_number VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
    manager_id UUID REFERENCES managers(id),
    external_id VARCHAR(100) NOT NULL UNIQUE,
    account_number VARCHAR(80) NOT NULL UNIQUE,
    currency CHAR(3) NOT NULL DEFAULT 'XAF',
    status account_status_enum NOT NULL,
    opened_at DATE,
    closed_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    billing_frequency billing_frequency_enum NOT NULL,
    unit_price NUMERIC(14,2),
    currency CHAR(3),
    status service_status_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    external_id VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE,
    unit_price NUMERIC(14,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    status subscription_status_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    invoice_number VARCHAR(80) NOT NULL UNIQUE,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal_amount NUMERIC(14,2) NOT NULL,
    tax_amount NUMERIC(14,2) NOT NULL,
    total_amount NUMERIC(14,2) NOT NULL,
    paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    outstanding_amount NUMERIC(14,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    status invoice_status_enum NOT NULL,
    source_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (due_date >= issue_date)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    payment_reference VARCHAR(100) NOT NULL UNIQUE,
    payment_date DATE NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    allocated_amount NUMERIC(14,2) NOT NULL,
    unallocated_amount NUMERIC(14,2) NOT NULL,
    payment_method payment_method_enum NOT NULL,
    currency CHAR(3) NOT NULL,
    status payment_status_enum NOT NULL,
    source_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(14,2) NOT NULL CHECK (allocated_amount > 0),
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (payment_id, invoice_id)
);

-- Données de référence inspirées des données de démonstration du projet
INSERT INTO centres (id, code, name, status) VALUES
    ('7d0d43ea-8f2d-48fe-9d50-27ea09a6d8d7', 'CG-ENT', 'CG Entreprises', 'ACTIVE'),
    ('6be57d3d-b7f4-4b61-b7d2-8380cb5f2d9b', 'CG-PME', 'CG PME', 'ACTIVE'),
    ('7dd49d46-d74a-4d1d-9201-12be1a929084', 'CG-VIP', 'CG Particuliers VIP', 'ACTIVE'),
    ('f58f8233-2d34-4e95-9d1e-ea8964d45db0', 'CG-ETAT', 'CG État', 'ACTIVE');

INSERT INTO agencies (id, centre_id, code, name, address, status) VALUES
    ('ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', '7d0d43ea-8f2d-48fe-9d50-27ea09a6d8d7', 'AG-YDE', 'Yaoundé Centre', 'Route de l''Aéroport, BP 412', 'ACTIVE'),
    ('f9f09f5d-df5e-4c66-95a3-bbc4715a2a92', '6be57d3d-b7f4-4b61-b7d2-8380cb5f2d9b', 'AG-DLA', 'Douala Akwa', 'Zone industrielle Bassa, BP 372', 'ACTIVE'),
    ('5ab5b7da-86c2-4f58-b380-61d89f2c4c70', '7d0d43ea-8f2d-48fe-9d50-27ea09a6d8d7', 'AG-BAF', 'Bafoussam', 'Route de Bafoussam, BP 510', 'ACTIVE'),
    ('11e79f4b-9d73-4fb6-a0eb-fd7b6fefaf80', 'f58f8233-2d34-4e95-9d1e-ea8964d45db0', 'AG-GAR', 'Garoua', 'Avenue de la République, BP 145', 'ACTIVE'),
    ('3b32d0bb-1631-4749-a426-f2f47f72f8c6', '6be57d3d-b7f4-4b61-b7d2-8380cb5f2d9b', 'AG-LIM', 'Limbé', 'Quartier de la gare, BP 89', 'ACTIVE');

INSERT INTO managers (id, agency_id, external_id, employee_number, full_name, email, status) VALUES
    ('6f0c3d3f-ec72-4a8f-9df5-4c1f6d49f2fc', 'ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', 'EXT-MGR-001', 'MAT-001', 'M. Essomba', 'essomba@gblrecover.cm', 'ACTIVE'),
    ('9c1a1c6a-5432-4f86-b6e7-0d1dd05d8d20', 'f9f09f5d-df5e-4c66-95a3-bbc4715a2a92', 'EXT-MGR-002', 'MAT-002', 'C. Njoya', 'njoya@gblrecover.cm', 'ACTIVE'),
    ('d7f2f0fb-af57-46ea-a6a4-8cb4d8c7dec9', '5ab5b7da-86c2-4f58-b380-61d89f2c4c70', 'EXT-MGR-003', 'MAT-003', 'P. Kamga', 'kamga@gblrecover.cm', 'ACTIVE'),
    ('2d27145f-6fe8-4e0f-b538-d8ec29d4e663', 'ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', 'EXT-MGR-004', 'MAT-004', 'A. Leroux', 'leroux@gblrecover.cm', 'ACTIVE');

INSERT INTO clients (id, external_id, client_type, legal_name, tax_identifier, phone, email, address, status, source_system, source_updated_at) VALUES
    ('b6f72fae-5d74-4c8d-8d6a-102adb0ef9d2', 'CAM-23901-B', 'ORGANIZATION', 'Société Forestière de l''Est', 'TAX-SFE-23901', '+237 698 45 12 30', 'comptabilite@sfe.cm', 'Route de l''Aéroport, BP 412', 'BLOCKED', 'CRM_CAMTEL', '2026-07-31 23:59:00+00'),
    ('29bcd721-127f-49b8-a9a4-d8d5a5b1e166', 'CAM-10442-A', 'ORGANIZATION', 'Ministère des Finances (MINFI)', 'TAX-MINFI-10442', '+237 222 22 10 45', 'tresorerie@minfi.cm', 'Avenue Mgr Vogt, BP 164', 'BLOCKED', 'ERP_CAMTEL', '2026-07-31 23:59:00+00'),
    ('731fce87-d34d-485d-b06a-1d9d5081a0ea', 'CAM-88321-C', 'ORGANIZATION', 'Brasseries du Cameroun', 'TAX-BRASS-88321', '+237 233 42 80 11', 'compta@brasseries.cm', 'Zone industrielle Bassa, BP 372', 'ACTIVE', 'CRM_CAMTEL', '2026-07-31 23:59:00+00'),
    ('8f5e8a77-c55f-4bf2-a3b7-ed3ddcd6f3ce', 'CAM-44512-D', 'ORGANIZATION', 'Ets Mballa & Fils', 'TAX-MBALLA-44512', '+237 677 88 90 21', 'gestion@mballa-fils.cm', 'Rue des Dipo, BP 811', 'BLOCKED', 'CRM_CAMTEL', '2026-07-31 23:59:00+00'),
    ('6ea2c1cc-5441-4f68-be64-0fe24b1692ed', 'CAM-11209-E', 'ORGANIZATION', 'Hôpital Général de Yaoundé', 'TAX-HGY-11209', '+237 222 21 40 55', 'comptabilite@hgy.cm', 'Rue Henri Dunant, BP 5408', 'BLOCKED', 'ERP_CAMTEL', '2026-07-31 23:59:00+00'),
    ('48465b21-e0d7-4b52-8d87-5115d9e99dba', 'CL-2024-089', 'ORGANIZATION', 'Société Générale Cameroun', 'TAX-SGC-2024', '+237 233 43 70 00', 'contact.sgc@socgen.cm', 'Avenue du Général de Gaulle, BP 244', 'BLOCKED', 'CRM_CAMTEL', '2026-07-31 23:59:00+00'),
    ('a79b7d2d-2d2b-47ef-b901-1034191c938b', 'CAM-55671-F', 'INDIVIDUAL', 'Mme Ngo Bassa Clotilde', 'TAX-NGO-55671', '+237 691 22 45 78', 'c.ngobassa@gmail.com', 'Quartier Mvog-Ada, BP 900', 'BLOCKED', 'CRM_CAMTEL', '2026-07-31 23:59:00+00'),
    ('0a5d61bd-e98b-447b-9a46-e45f499ef9c8', 'CAM-33210-G', 'ORGANIZATION', 'Université de Buea', 'TAX-UBUEA-33210', '+237 233 32 21 34', 'bursar@ubuea.cm', 'Molyko, Buea', 'ACTIVE', 'ERP_CAMTEL', '2026-07-31 23:59:00+00'),
    ('3f85b8ef-ecdb-4d41-8136-95eedc3595a6', 'CAM-77124-H', 'INDIVIDUAL', 'M. Ntone Jean-Pierre', 'TAX-NTONE-77124', '+237 677 40 18 62', 'jp.ntone@yahoo.fr', 'Quartier Bonapriso, BP 45', 'ARCHIVED', 'CRM_CAMTEL', '2026-07-31 23:59:00+00'),
    ('d017d3e2-2dd4-4c9e-b268-f6d3d0c22c29', 'CAM-66401-J', 'ORGANIZATION', 'Clinique de la Cité', 'TAX-CLINIQUE-66401', '+237 233 44 27 90', 'facturation@cliniquecite.cm', 'Carrefour Warda, BP 1123', 'BLOCKED', 'CRM_CAMTEL', '2026-07-31 23:59:00+00');

INSERT INTO accounts (id, client_id, agency_id, manager_id, external_id, account_number, currency, status, opened_at, created_at) VALUES
    ('e1819d4a-70d1-4d32-b0e3-8ba88e7f7f32', 'b6f72fae-5d74-4c8d-8d6a-102adb0ef9d2', 'ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', '6f0c3d3f-ec72-4a8f-9df5-4c1f6d49f2fc', 'ACC-SFE-01', 'CAM-23901-B-01', 'XAF', 'ACTIVE', '2023-02-14', '2026-07-31 23:59:00+00'),
    ('e08dc3d5-8395-421a-9f50-2c64a29e9de2', '29bcd721-127f-49b8-a9a4-d8d5a5b1e166', 'ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', '6f0c3d3f-ec72-4a8f-9df5-4c1f6d49f2fc', 'ACC-MINFI-01', 'CAM-10442-A-01', 'XAF', 'ACTIVE', '2022-11-02', '2026-07-31 23:59:00+00'),
    ('48c7f9b9-370d-4f32-8e0e-efb8c0b5d0eb', '731fce87-d34d-485d-b06a-1d9d5081a0ea', 'f9f09f5d-df5e-4c66-95a3-bbc4715a2a92', '9c1a1c6a-5432-4f86-b6e7-0d1dd05d8d20', 'ACC-BRASS-01', 'CAM-88321-C-01', 'XAF', 'ACTIVE', '2021-06-19', '2026-07-31 23:59:00+00'),
    ('33aa4b42-f355-4f8a-9c3a-b67f95e721c7', '8f5e8a77-c55f-4bf2-a3b7-ed3ddcd6f3ce', 'ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', '6f0c3d3f-ec72-4a8f-9df5-4c1f6d49f2fc', 'ACC-MBALLA-01', 'CAM-44512-D-01', 'XAF', 'ACTIVE', '2024-01-27', '2026-07-31 23:59:00+00'),
    ('82e2a5a8-cce5-4cd3-8b0a-13afd77d52fe', '6ea2c1cc-5441-4f68-be64-0fe24b1692ed', 'ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', '2d27145f-6fe8-4e0f-b538-d8ec29d4e663', 'ACC-HGY-01', 'CAM-11209-E-01', 'XAF', 'ACTIVE', '2022-08-03', '2026-07-31 23:59:00+00'),
    ('3c80bc93-5312-4d1b-a317-7c0263f5658e', '48465b21-e0d7-4b52-8d87-5115d9e99dba', 'ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', '2d27145f-6fe8-4e0f-b538-d8ec29d4e663', 'ACC-SGC-01', 'CL-2024-089-01', 'XAF', 'ACTIVE', '2022-03-30', '2026-07-31 23:59:00+00'),
    ('ea0ee1bd-3874-49a4-b638-991d3f36f367', '48465b21-e0d7-4b52-8d87-5115d9e99dba', 'ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', '2d27145f-6fe8-4e0f-b538-d8ec29d4e663', 'ACC-SGC-02', 'CL-2024-089-02', 'XAF', 'ACTIVE', '2022-03-30', '2026-07-31 23:59:00+00'),
    ('0f3af0e8-93b0-4d60-b007-ac13d1d0f74d', 'a79b7d2d-2d2b-47ef-b901-1034191c938b', 'ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', '6f0c3d3f-ec72-4a8f-9df5-4c1f6d49f2fc', 'ACC-NGO-01', 'CAM-55671-F-01', 'XAF', 'ACTIVE', '2025-04-11', '2026-07-31 23:59:00+00'),
    ('6771cd61-c860-46ec-8a6b-78b036f0ea7d', '0a5d61bd-e98b-447b-9a46-e45f499ef9c8', '3b32d0bb-1631-4749-a426-f2f47f72f8c6', '9c1a1c6a-5432-4f86-b6e7-0d1dd05d8d20', 'ACC-UBUEA-01', 'CAM-33210-G-01', 'XAF', 'ACTIVE', '2023-09-15', '2026-07-31 23:59:00+00'),
    ('571e0b06-c7a8-4c9e-b51e-bb1fe8ee65f9', '3f85b8ef-ecdb-4d41-8136-95eedc3595a6', 'f9f09f5d-df5e-4c66-95a3-bbc4715a2a92', '9c1a1c6a-5432-4f86-b6e7-0d1dd05d8d20', 'ACC-NTONE-01', 'CAM-77124-H-01', 'XAF', 'SUSPENDED', '2021-12-08', '2026-07-31 23:59:00+00'),
    ('ad456530-89aa-4f03-b46d-b53573f59363', 'd017d3e2-2dd4-4c9e-b268-f6d3d0c22c29', 'f9f09f5d-df5e-4c66-95a3-bbc4715a2a92', 'd7f2f0fb-af57-46ea-a6a4-8cb4d8c7dec9', 'ACC-CLINIQUE-01', 'CAM-66401-J-01', 'XAF', 'ACTIVE', '2024-06-22', '2026-07-31 23:59:00+00'),
    ('961d4eef-4e4b-4025-a874-4fddfd26113b', 'b6f72fae-5d74-4c8d-8d6a-102adb0ef9d2', 'ab2f5db0-84ff-4712-bf6d-7c8dd6d7ea44', '6f0c3d3f-ec72-4a8f-9df5-4c1f6d49f2fc', 'ACC-SFE-02', 'CAM-23901-B-02', 'XAF', 'ACTIVE', '2024-01-15', '2026-07-31 23:59:00+00');

INSERT INTO services (id, code, name, description, billing_frequency, unit_price, currency, status) VALUES
    ('e7e92f96-0ef1-42e0-8f8d-7b1d6f99d2dd', 'INTERNET', 'Connexion Internet', 'Accès haut débit fixe', 'MONTHLY', 120000.00, 'XAF', 'ACTIVE'),
    ('0b4cccec-331d-4b0d-bd1d-e2c7d1a1188d', 'MOBILE', 'Mobile voice/data', 'Service de téléphonie mobile', 'MONTHLY', 15000.00, 'XAF', 'ACTIVE'),
    ('6e65e4f9-6e5d-4d23-b37d-31d4d727e7d0', 'TV', 'Télévision numérique', 'Abonnement TV', 'MONTHLY', 25000.00, 'XAF', 'ACTIVE'),
    ('f6cf5d7d-4f12-4912-b5f6-5ca1d9fa9b84', 'ENTERPRISE', 'Accès entreprise', 'Service dédié aux clients entreprise', 'QUARTERLY', 450000.00, 'XAF', 'ACTIVE'),
    ('2d0b1d9a-2d2c-4c12-b884-7c3ca4a8d441', 'STATE', 'Contrat public', 'Service public ou institutionnel', 'ANNUAL', 800000.00, 'XAF', 'ACTIVE');

INSERT INTO subscriptions (id, account_id, service_id, external_id, start_date, end_date, unit_price, currency, status) VALUES
    ('1a546a2d-d73a-41d7-a0d1-7d45c4d1f91b', 'e1819d4a-70d1-4d32-b0e3-8ba88e7f7f32', 'e7e92f96-0ef1-42e0-8f8d-7b1d6f99d2dd', 'SUB-SFE-001', '2024-01-01', NULL, 120000.00, 'XAF', 'ACTIVE'),
    ('4eac6b9a-9cce-4418-a7f4-2d2b8c344512', 'e08dc3d5-8395-421a-9f50-2c64a29e9de2', '2d0b1d9a-2d2c-4c12-b884-7c3ca4a8d441', 'SUB-MINFI-001', '2023-01-01', NULL, 800000.00, 'XAF', 'ACTIVE'),
    ('3e650d4e-5fc9-41a0-8db2-1cc3fe1f0d90', '48c7f9b9-370d-4f32-8e0e-efb8c0b5d0eb', 'f6cf5d7d-4f12-4912-b5f6-5ca1d9fa9b84', 'SUB-BRASS-001', '2024-06-01', NULL, 450000.00, 'XAF', 'ACTIVE'),
    ('d2d6d5f4-f530-4d06-9e39-c91d5d48030b', '0f3af0e8-93b0-4d60-b007-ac13d1d0f74d', '0b4cccec-331d-4b0d-bd1d-e2c7d1a1188d', 'SUB-NGO-001', '2025-04-11', NULL, 15000.00, 'XAF', 'ACTIVE'),
    ('53d69980-8634-4dff-8dc3-a9c1086ef38d', '6771cd61-c860-46ec-8a6b-78b036f0ea7d', '2d0b1d9a-2d2c-4c12-b884-7c3ca4a8d441', 'SUB-UBUEA-001', '2023-09-15', NULL, 800000.00, 'XAF', 'ACTIVE');

INSERT INTO invoices (id, account_id, external_id, invoice_number, issue_date, due_date, subtotal_amount, tax_amount, total_amount, paid_amount, outstanding_amount, currency, status) VALUES
    ('ea6a6732-b0f9-48eb-bf80-3178dca6f843', 'e1819d4a-70d1-4d32-b0e3-8ba88e7f7f32', 'EXT-INV-0412', 'FAC-2026-0412', '2026-05-10', '2026-05-20', 18500000.00, 0.00, 18500000.00, 6000000.00, 12500000.00, 'XAF', 'PARTIALLY_PAID'),
    ('432a1921-d0ff-4ca6-8d87-b8766b548731', 'e1819d4a-70d1-4d32-b0e3-8ba88e7f7f32', 'EXT-INV-0390', 'FAC-2026-0390', '2026-03-12', '2026-03-22', 12400000.00, 0.00, 12400000.00, 4900000.00, 7500000.00, 'XAF', 'PARTIALLY_PAID'),
    ('0d331c76-3dbf-4a11-865c-1e6f49ee7dd7', 'e1819d4a-70d1-4d32-b0e3-8ba88e7f7f32', 'EXT-INV-0331', 'FAC-2026-0331', '2026-01-15', '2026-01-25', 15200000.00, 0.00, 15200000.00, 0.00, 15200000.00, 'XAF', 'OVERDUE'),
    ('701c95d7-1a2d-4a88-8e44-e2f7823d63d0', 'e08dc3d5-8395-421a-9f50-2c64a29e9de2', 'EXT-INV-0408', 'FAC-2026-0408', '2026-04-10', '2026-04-20', 48000000.00, 0.00, 48000000.00, 18000000.00, 30000000.00, 'XAF', 'PARTIALLY_PAID'),
    ('7d7b91de-d053-4656-8c7a-4b895e49fd27', '48c7f9b9-370d-4f32-8e0e-efb8c0b5d0eb', 'EXT-INV-0420', 'FAC-2026-0420', '2026-06-05', '2026-06-15', 12000000.00, 0.00, 12000000.00, 12000000.00, 0.00, 'XAF', 'PAID'),
    ('84122c4a-0aa6-4215-8261-51b089d60de8', '33aa4b42-f355-4f8a-9c3a-b67f95e721c7', 'EXT-INV-0415', 'FAC-2026-0415', '2026-05-18', '2026-05-28', 5200000.00, 0.00, 5200000.00, 2000000.00, 3200000.00, 'XAF', 'PARTIALLY_PAID'),
    ('2b4e4bdc-1a57-483d-a845-6ba1d07b2c5b', '82e2a5a8-cce5-4cd3-8b0a-13afd77d52fe', 'EXT-INV-0388', 'FAC-2026-0388', '2026-04-20', '2026-04-30', 11000000.00, 0.00, 11000000.00, 2000000.00, 9000000.00, 'XAF', 'PARTIALLY_PAID'),
    ('1cd1b84a-a8b9-4d85-ab28-9b3f0ec8c7b5', '3c80bc93-5312-4d1b-a317-7c0263f5658e', 'EXT-INV-0395', 'FAC-2026-0395', '2026-04-15', '2026-04-25', 9000000.00, 0.00, 9000000.00, 2500000.00, 6500000.00, 'XAF', 'PARTIALLY_PAID'),
    ('1ec51351-be89-47c6-9c6d-7a5e37a9cde8', '0f3af0e8-93b0-4d60-b007-ac13d1d0f74d', 'EXT-INV-0405', 'FAC-2026-0405', '2026-04-20', '2026-04-30', 840000.00, 0.00, 840000.00, 300000.00, 540000.00, 'XAF', 'PARTIALLY_PAID'),
    ('4c2bc10d-cbd5-4811-9fbd-dd6e4a6f86a0', '571e0b06-c7a8-4c9e-b51e-bb1fe8ee65f9', 'EXT-INV-9981', 'FAC-2025-9981', '2025-09-01', '2025-09-11', 2150000.00, 0.00, 2150000.00, 0.00, 2150000.00, 'XAF', 'OVERDUE');

INSERT INTO payments (id, account_id, external_id, payment_reference, payment_date, amount, allocated_amount, unallocated_amount, payment_method, currency, status) VALUES
    ('5c7a3e9b-40d8-44ef-9a0d-84f4c5c72867', 'e1819d4a-70d1-4d32-b0e3-8ba88e7f7f32', 'EXT-PAY-11882', 'PAY-2026-11882', '2026-07-16', 6000000.00, 6000000.00, 0.00, 'BANK', 'XAF', 'ALLOCATED'),
    ('ed0fa0d6-6de0-4d76-b0ea-c2f60fa8cb29', 'e1819d4a-70d1-4d32-b0e3-8ba88e7f7f32', 'EXT-PAY-10441', 'PAY-2026-10441', '2026-02-05', 4900000.00, 4900000.00, 0.00, 'BANK', 'XAF', 'ALLOCATED'),
    ('cf3d5d19-4df5-4831-a532-77963b9ec115', 'e08dc3d5-8395-421a-9f50-2c64a29e9de2', 'EXT-PAY-11770', 'PAY-2026-11770', '2026-07-11', 18000000.00, 18000000.00, 0.00, 'TRANSFER', 'XAF', 'ALLOCATED'),
    ('b947aaea-5696-4b8e-a88a-5ab7f7d96d8d', '48c7f9b9-370d-4f32-8e0e-efb8c0b5d0eb', 'EXT-PAY-11905', 'PAY-2026-11905', '2026-07-29', 12000000.00, 12000000.00, 0.00, 'BANK', 'XAF', 'ALLOCATED'),
    ('8efb29d5-1d1e-4817-9f7e-8b68d8f0f750', '33aa4b42-f355-4f8a-9c3a-b67f95e721c7', 'EXT-PAY-11831', 'PAY-2026-11831', '2026-07-19', 2000000.00, 2000000.00, 0.00, 'BANK', 'XAF', 'ALLOCATED'),
    ('ac768ae1-0ef4-4c67-a4dc-1065f4a7f2b2', '82e2a5a8-cce5-4cd3-8b0a-13afd77d52fe', 'EXT-PAY-11601', 'PAY-2026-11601', '2026-07-05', 2000000.00, 2000000.00, 0.00, 'BANK', 'XAF', 'ALLOCATED'),
    ('7348ca08-4a62-4d79-beb5-7e3c9d6f0daa', '3c80bc93-5312-4d1b-a317-7c0263f5658e', 'EXT-PAY-11554', 'PAY-2026-11554', '2026-07-06', 2500000.00, 2500000.00, 0.00, 'TRANSFER', 'XAF', 'ALLOCATED'),
    ('67beb7d1-7551-4b0a-b01f-bbdc4ea7897f', '0f3af0e8-93b0-4d60-b007-ac13d1d0f74d', 'EXT-PAY-11720', 'PAY-2026-11720', '2026-07-10', 300000.00, 300000.00, 0.00, 'MOBILE_MONEY', 'XAF', 'ALLOCATED'),
    ('5fa2c6bf-fa0b-4c0e-857f-7b6c73d4d267', '6771cd61-c860-46ec-8a6b-78b036f0ea7d', 'EXT-PAY-11990', 'PAY-2026-11990', '2026-07-26', 6400000.00, 6400000.00, 0.00, 'BANK', 'XAF', 'ALLOCATED'),
    ('efcf6dc9-6e1b-4ed1-b7f7-edfe9c87091b', 'ad456530-89aa-4f03-b46d-b53573f59363', 'EXT-PAY-11795', 'PAY-2026-11795', '2026-07-13', 1400000.00, 1400000.00, 0.00, 'BANK', 'XAF', 'ALLOCATED');

INSERT INTO payment_allocations (id, payment_id, invoice_id, allocated_amount, allocated_at) VALUES
    ('f94182f5-dc65-4d3a-8c6d-bea70e1b8a5c', '5c7a3e9b-40d8-44ef-9a0d-84f4c5c72867', 'ea6a6732-b0f9-48eb-bf80-3178dca6f843', 6000000.00, '2026-07-16 09:35:00+00'),
    ('36e7fd27-6f73-46b2-bd62-b51a7ae14bdf', 'ed0fa0d6-6de0-4d76-b0ea-c2f60fa8cb29', '432a1921-d0ff-4ca6-8d87-b8766b548731', 4900000.00, '2026-02-05 10:15:00+00'),
    ('b781c280-88ef-4d6d-a4d7-d054c8a7ca32', 'cf3d5d19-4df5-4831-a532-77963b9ec115', '701c95d7-1a2d-4a88-8e44-e2f7823d63d0', 18000000.00, '2026-07-11 08:00:00+00'),
    ('b4d9c45f-b5ef-4f6e-9220-6f8af0f31079', 'b947aaea-5696-4b8e-a88a-5ab7f7d96d8d', '7d7b91de-d053-4656-8c7a-4b895e49fd27', 12000000.00, '2026-07-29 12:15:00+00'),
    ('a1bb3d5a-b5cf-477c-a487-0df8f72a8f93', '8efb29d5-1d1e-4817-9f7e-8b68d8f0f750', '84122c4a-0aa6-4215-8261-51b089d60de8', 2000000.00, '2026-07-19 15:45:00+00'),
    ('6f9d9fb9-06ff-4475-b0da-5272044eb012', 'ac768ae1-0ef4-4c67-a4dc-1065f4a7f2b2', '2b4e4bdc-1a57-483d-a845-6ba1d07b2c5b', 2000000.00, '2026-07-05 13:00:00+00'),
    ('395e4d00-7b1a-42ec-a252-6d8c3197abdd', '7348ca08-4a62-4d79-beb5-7e3c9d6f0daa', '1cd1b84a-a8b9-4d85-ab28-9b3f0ec8c7b5', 2500000.00, '2026-07-06 09:20:00+00'),
    ('7753497e-7366-47cb-9c0f-64b1d7dfd103', '67beb7d1-7551-4b0a-b01f-bbdc4ea7897f', '1ec51351-be89-47c6-9c6d-7a5e37a9cde8', 300000.00, '2026-07-10 11:00:00+00'),
    ('7bba4239-5f0d-47a1-b261-a7174f2bd053', '5fa2c6bf-fa0b-4c0e-857f-7b6c73d4d267', '7d7b91de-d053-4656-8c7a-4b895e49fd27', 6400000.00, '2026-07-26 16:35:00+00'),
    ('ca0ec786-7ce1-4d3c-aa0e-f38f6ec1f6d7', 'efcf6dc9-6e1b-4ed1-b7f7-edfe9c87091b', '1cd1b84a-a8b9-4d85-ab28-9b3f0ec8c7b5', 1400000.00, '2026-07-13 17:00:00+00');

-- Index utiles pour la recherche métier
CREATE INDEX idx_accounts_client_id ON accounts(client_id);
CREATE INDEX idx_accounts_manager_id ON accounts(manager_id);
CREATE INDEX idx_invoices_account_id ON invoices(account_id);
CREATE INDEX idx_payments_account_id ON payments(account_id);
CREATE INDEX idx_payment_allocations_invoice_id ON payment_allocations(invoice_id);
CREATE INDEX idx_subscriptions_account_id ON subscriptions(account_id);
