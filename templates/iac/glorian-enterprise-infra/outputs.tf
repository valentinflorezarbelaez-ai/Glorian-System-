output "vpc_id" {
  description = "ID of the sovereign VPC"
  value       = aws_vpc.main.id
}

output "database_security_group_id" {
  description = "ID of the private database security group"
  value       = aws_security_group.database.id
}

output "vault_bucket_arn" {
  description = "ARN of the encrypted audit vault bucket"
  value       = aws_s3_bucket.audit_vault.arn
}
