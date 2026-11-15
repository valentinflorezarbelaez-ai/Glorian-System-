variable "environment" {
  description = "Deployment environment tier (e.g. prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "region" {
  description = "Target AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the enterprise VPC"
  type        = string
  default     = "10.0.0.0/16"
}
