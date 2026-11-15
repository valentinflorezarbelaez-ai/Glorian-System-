terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# Enterprise Isolated VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "glorian-${var.environment}-vpc"
    Environment = var.environment
    ManagedBy   = "Glorian-System"
  }
}

# Private Security Group (Restricted Ingress - Internal CIDR Only)
resource "aws_security_group" "database" {
  name        = "glorian-${var.environment}-db-sg"
  description = "Managed private security group for database workloads"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Internal Postgres access from VPC only"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "glorian-${var.environment}-db-sg"
    Environment = var.environment
  }
}

# Encrypted KMS S3 Bucket (Private ACL & Public Access Block)
resource "aws_s3_bucket" "audit_vault" {
  bucket = "glorian-${var.environment}-audit-vault-01"
  acl    = "private"

  tags = {
    Name        = "glorian-${var.environment}-audit-vault"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "audit_vault_pab" {
  bucket = aws_s3_bucket.audit_vault.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_vault_enc" {
  bucket = aws_s3_bucket.audit_vault.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}
