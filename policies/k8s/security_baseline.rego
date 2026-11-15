package k8s.security

default allowed := false

allowed if {
    count(violations) == 0
}

# Rule 1: Disallow privileged containers
violations contains {"rule": "no_privileged", "container": c.name, "message": msg} if {
    some c in input_containers
    c.securityContext.privileged == true
    msg := sprintf("Container '%v' must not run in privileged mode", [c.name])
}

# Rule 2: Require runAsNonRoot
violations contains {"rule": "run_as_non_root", "container": c.name, "message": msg} if {
    some c in input_containers
    not is_non_root(c)
    msg := sprintf("Container '%v' must set securityContext.runAsNonRoot=true and non-zero UID", [c.name])
}

# Rule 3: Require CPU and Memory resource limits
violations contains {"rule": "require_resource_limits", "container": c.name, "message": msg} if {
    some c in input_containers
    not has_resource_limits(c)
    msg := sprintf("Container '%v' must declare both CPU and Memory resource limits", [c.name])
}

# Rule 4: Disallow :latest image tag or untagged images
violations contains {"rule": "disallow_latest_tag", "container": c.name, "message": msg} if {
    some c in input_containers
    is_latest_or_untagged(c.image)
    msg := sprintf("Container '%v' uses an unpinned or latest image tag: %v", [c.name, c.image])
}

# Helper: Collect all containers from Pod, Deployment, DaemonSet, StatefulSet, Job
input_containers contains c if {
    some c in input.spec.containers
}

input_containers contains c if {
    some c in input.spec.template.spec.containers
}

input_containers contains c if {
    some c in input.spec.jobTemplate.spec.template.spec.containers
}

is_non_root(c) if {
    c.securityContext.runAsNonRoot == true
}

is_non_root(c) if {
    c.securityContext.runAsUser > 0
}

# Also allow pod-level securityContext
is_non_root(_) if {
    input.spec.securityContext.runAsNonRoot == true
}

is_non_root(_) if {
    input.spec.securityContext.runAsUser > 0
}

is_non_root(_) if {
    input.spec.template.spec.securityContext.runAsNonRoot == true
}

is_non_root(_) if {
    input.spec.template.spec.securityContext.runAsUser > 0
}

has_resource_limits(c) if {
    c.resources.limits.cpu
    c.resources.limits.memory
}

is_latest_or_untagged(image) if {
    not contains(image, ":")
}

is_latest_or_untagged(image) if {
    endswith(image, ":latest")
}
