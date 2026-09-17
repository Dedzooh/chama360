-- Initialize PostgreSQL database for Chama Management System

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create additional databases for development and testing
CREATE DATABASE chama_management_system_dev;
CREATE DATABASE chama_management_system_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE chama_management_system TO postgres;
GRANT ALL PRIVILEGES ON DATABASE chama_management_system_dev TO postgres;
GRANT ALL PRIVILEGES ON DATABASE chama_management_system_test TO postgres;