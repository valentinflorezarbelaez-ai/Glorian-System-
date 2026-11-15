package terraform.security

default allowed := false

allowed if {
    count(violations) == 0
}

# Sensitive ports that must NEVER be open to 0.0.0.0/0
sensitive_ports := {22, 3389, 5432, 3306, 6379, 27017}

# Rule 1: No public ingress on sensitive ports in security groups
violations contains {"rule": "no_public_ingress", "resource": rc.address, "message": msg} if {
    some rc in input.resource_changes
    not "delete" in rc.change.actions
    rc.type in ["aws_security_group", "aws_security_group_rule"]
    some rule in collect_ingress_rules(rc)
    is_public_cidr(rule)
    is_sensitive_port(rule)
    msg := sprintf("Resource '%v' allows public ingress (0.0.0.0/0) on sensitive port: %v", [rc.address, rule.from_port])
}

# Rule 2: No public S3 buckets via ACL
violations contains {"rule": "no_public_storage", "resource": rc.address, "message": msg} if {
    some rc in input.resource_changes
    not "delete" in rc.change.actions
    rc.type == "aws_s3_bucket"
    rc.change.after.acl in ["public-read", "public-read-write", "website"]
    msg := sprintf("S3 Bucket '%v' is configured with public ACL: %v", [rc.address, rc.change.after.acl])
}

# Rule 3: Enforce encryption at rest for storage
violations contains {"rule": "enforce_encryption_at_rest", "resource": rc.address, "message": msg} if {
    some rc in input.resource_changes
    not "delete" in rc.change.actions
    rc.type in ["aws_ebs_volume", "aws_db_instance", "aws_rds_cluster"]
    not is_storage_encrypted(rc)
    msg := sprintf("Resource '%v' (%v) does not enable encryption at rest", [rc.address, rc.type])
}

# Rule 4: Disallow destructive deletion on stateful databases without allow_destroy flag
violations contains {"rule": "no_unauthorized_deletion", "resource": rc.address, "message": msg} if {
    some rc in input.resource_changes
    rc.type in ["aws_db_instance", "aws_rds_cluster", "google_sql_database_instance"]
    "delete" in rc.change.actions
    input.allow_destroy != true
    msg := sprintf("Resource '%v' (%v) is scheduled for deletion without explicit authorization", [rc.address, rc.type])
}

# Helper: Collect ingress rules from aws_security_group or aws_security_group_rule
collect_ingress_rules(rc) := rules if {
    rc.type == "aws_security_group"
    rules := [r | some r in rc.change.after.ingress]
}

collect_ingress_rules(rc) := rules if {
    rc.type == "aws_security_group_rule"
    rc.change.after.type == "ingress"
    rules := [rc.change.after]
}

is_public_cidr(rule) if {
    "0.0.0.0/0" in rule.cidr_blocks
}

is_public_cidr(rule) if {
    rule.cidr_block == "0.0.0.0/0"
}

is_sensitive_port(rule) if {
    rule.from_port in sensitive_ports
}

is_sensitive_port(rule) if {
    rule.to_port in sensitive_ports
}

is_sensitive_port(rule) if {
    rule.from_port == 0
    rule.to_port == 0
}

is_storage_encrypted(rc) if {
    rc.type == "aws_ebs_volume"
    rc.change.after.encrypted == true
}

is_storage_encrypted(rc) if {
    rc.type in ["aws_db_instance", "aws_rds_cluster"]
    rc.change.after.storage_encrypted == true
}
