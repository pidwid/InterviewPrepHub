# Infrastructure as Code (IaC)

## Table of Contents

1. [Overview](#1-overview)
2. [Why Infrastructure as Code?](#2-why-infrastructure-as-code)
3. [Declarative vs Imperative](#3-declarative-vs-imperative)
4. [Terraform](#4-terraform)
5. [AWS CloudFormation](#5-aws-cloudformation)
6. [Pulumi](#6-pulumi)
7. [State Management](#7-state-management)
8. [Modules & Reusability](#8-modules--reusability)
9. [Best Practices](#9-best-practices)
10. [Key Takeaways](#10-key-takeaways)

---

## 1. Overview

Infrastructure as Code (IaC) is the practice of managing infrastructure
(servers, networks, databases) using code files rather than manual processes.
It's version-controlled, repeatable, and reviewable — just like application code.

```
Manual provisioning:              Infrastructure as Code:
  
  Console → Click → Click →       main.tf:
  Click → Launch instance           resource "aws_instance" "web" {
  Console → Click → Click →           ami           = "ami-123"
  Create security group                instance_type = "t3.micro"
  Console → Click → Click →         }
  Attach EBS volume                
                                    $ terraform apply
  Undocumented ✗                    → Repeatable ✓
  Unrepeatable ✗                    → Version controlled ✓
  No review process ✗               → Pull request review ✓
```

---

## 2. Why Infrastructure as Code?

| Benefit           | Description                                              |
|------------------|----------------------------------------------------------|
| Repeatability    | Create identical environments (dev, staging, prod)       |
| Version control  | Git history of all infrastructure changes                |
| Code review      | PRs for infra changes, just like app code                |
| Documentation    | The code IS the documentation                            |
| Speed            | Provision entire environments in minutes                 |
| Drift detection  | Detect when real infra differs from code                 |
| Disaster recovery| Rebuild entire infrastructure from code                  |
| Cost tracking    | See what resources exist by reading code                 |

---

## 3. Declarative vs Imperative

```
Declarative (What):                 Imperative (How):
"I want 3 web servers"              "Create server 1"
                                    "Create server 2"
resource "aws_instance" "web" {     "Create server 3"
  count = 3                         
  ami   = "ami-123"                 import boto3
  type  = "t3.micro"               ec2 = boto3.client('ec2')
}                                   for i in range(3):
                                        ec2.run_instances(...)
IaC engine figures out HOW.
                                    YOU figure out how.
Change to 5? Change count=5.        
Terraform adds 2 more.              Add loop for 2 more.
                                    What if some fail? Handle manually.
```

| Approach    | Examples                              | Pros                    | Cons                   |
|------------|---------------------------------------|-------------------------|------------------------|
| Declarative | Terraform, CloudFormation, Pulumi    | Idempotent, predictable | Learning curve         |
| Imperative  | AWS SDK, Ansible (partially), scripts| Flexible, familiar      | Drift-prone, fragile   |

---

## 4. Terraform

The most widely-used multi-cloud IaC tool. Open source by HashiCorp.

### HCL (HashiCorp Configuration Language)

```hcl
# Provider configuration
provider "aws" {
  region = "us-east-1"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "production-vpc"
  }
}

# Subnet
resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id       # Reference another resource
  cidr_block = "10.0.1.0/24"
  
  tags = {
    Name = "public-subnet"
  }
}

# EC2 Instance
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = var.instance_type    # Use a variable
  subnet_id     = aws_subnet.public.id
  
  tags = {
    Name = "web-server"
  }
}

# Variable definition
variable "instance_type" {
  description = "EC2 instance type"
  default     = "t3.micro"
}

# Output
output "server_ip" {
  value = aws_instance.web.public_ip
}
```

### Terraform Workflow

```
$ terraform init      # Download provider plugins
$ terraform plan      # Preview changes (dry run)
$ terraform apply     # Apply changes to real infrastructure
$ terraform destroy   # Tear down all resources

Plan output:
  + aws_instance.web         (create)
  ~ aws_subnet.public        (modify in-place)
  - aws_vpc.old              (destroy)
  
  Plan: 1 to add, 1 to change, 1 to destroy.
  
  Do you want to apply? yes/no
```

### Terraform Dependency Graph

```
Terraform automatically determines the order of operations:

  VPC ──► Subnet ──► Security Group ──► EC2 Instance
                                              │
                         EBS Volume ──────────┘

  No need to specify order — Terraform builds a DAG and applies
  resources in the correct dependency order.
  
  Independent resources are created in parallel.
```

---

## 5. AWS CloudFormation

AWS-native IaC (JSON or YAML). Best for AWS-only shops.

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Simple web server

Parameters:
  InstanceType:
    Type: String
    Default: t3.micro
    AllowedValues: [t3.micro, t3.small, t3.medium]

Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c55b159cbfafe1f0
      InstanceType: !Ref InstanceType
      SecurityGroupIds:
        - !Ref WebSecurityGroup

  WebSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Allow HTTP
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0

Outputs:
  ServerIP:
    Value: !GetAtt WebServer.PublicIp
```

### Terraform vs CloudFormation

| Feature          | Terraform              | CloudFormation          |
|-----------------|------------------------|-------------------------|
| Cloud support   | Multi-cloud            | AWS only                |
| Language        | HCL                    | JSON/YAML               |
| State           | State file (you manage)| AWS-managed             |
| Drift detection | terraform plan         | Drift detection feature |
| Modularity      | Modules + Registry     | Nested stacks + Modules |
| Rollback        | Manual or workspace    | Automatic rollback      |
| Community       | Huge (open source)     | Smaller                 |
| Learning curve  | Moderate               | Moderate                |

---

## 6. Pulumi

IaC using real programming languages (Python, TypeScript, Go, C#).

```typescript
import * as aws from "@pulumi/aws";

// Create a VPC
const vpc = new aws.ec2.Vpc("main", {
    cidrBlock: "10.0.0.0/16",
});

// Create instances in a loop (real programming constructs!)
const instances = [];
for (let i = 0; i < 3; i++) {
    instances.push(new aws.ec2.Instance(`web-${i}`, {
        ami: "ami-0c55b159cbfafe1f0",
        instanceType: "t3.micro",
        vpcSecurityGroupIds: [sg.id],
        tags: { Name: `web-${i}` },
    }));
}

// Export outputs
export const ips = instances.map(i => i.publicIp);
```

**Pros**: Use familiar languages, full IDE support, testing with standard frameworks,
loops/conditionals are native.
**Cons**: Requires programming knowledge, smaller community than Terraform,
state management similar to Terraform.

---

## 7. State Management

IaC tools track the current state of infrastructure to determine what changes
are needed.

```
State file (terraform.tfstate):
{
  "resources": [
    {
      "type": "aws_instance",
      "name": "web",
      "instances": [{
        "attributes": {
          "id": "i-0abcd1234",
          "ami": "ami-0c55b",
          "instance_type": "t3.micro",
          "public_ip": "54.123.45.67"
        }
      }]
    }
  ]
}

terraform plan:
  Compares code (desired state) vs state file (known state)
  vs real infrastructure (actual state)
  
  Code says:  instance_type = "t3.small"
  State says: instance_type = "t3.micro"
  → Plan: modify instance type
```

### Remote State Storage

```
Local state (DON'T do this in teams):
  terraform.tfstate on your laptop
  → No collaboration, no locking, easy to lose

Remote state (best practice):
  ┌────────────┐     ┌──────────────────┐
  │ Developer  │────►│ S3 Bucket        │  State file
  │            │     │ + DynamoDB       │  State locking
  └────────────┘     └──────────────────┘

  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"    # Prevents concurrent modifications
    encrypt        = true
  }
```

### State Locking

```
Without locking:
  Developer A: terraform apply  ──► reads state
  Developer B: terraform apply  ──► reads SAME state
  Both compute changes simultaneously → CONFLICT

With locking (DynamoDB table):
  Developer A: terraform apply → acquires lock → applies → releases lock
  Developer B: terraform apply → lock busy → WAIT → acquires lock → applies
```

---

## 8. Modules & Reusability

### Terraform Modules

```
Modules are reusable infrastructure components:

modules/
  vpc/
    main.tf        # VPC + subnets + route tables
    variables.tf   # Input variables
    outputs.tf     # Output values
  
  web-server/
    main.tf        # EC2 + ALB + ASG
    variables.tf
    outputs.tf

environments/
  prod/
    main.tf        # Uses modules with prod settings
  staging/
    main.tf        # Uses modules with staging settings
```

```hcl
# environments/prod/main.tf
module "vpc" {
  source     = "../../modules/vpc"
  cidr_block = "10.0.0.0/16"
  env        = "production"
}

module "web" {
  source        = "../../modules/web-server"
  vpc_id        = module.vpc.vpc_id
  subnet_ids    = module.vpc.private_subnet_ids
  instance_type = "t3.large"       # Prod gets bigger instances
  min_size      = 3
  max_size      = 10
}
```

---

## 9. Best Practices

| Practice | Description |
|---------|-------------|
| Remote state with locking | S3 + DynamoDB (AWS), GCS + locking (GCP) |
| Use modules | DRY — reuse across environments |
| Separate state per environment | prod, staging, dev each have own state |
| Plan before apply | Always review `terraform plan` output |
| Use variables and tfvars | No hardcoded values |
| Tag everything | Cost tracking, ownership, environment |
| Limit blast radius | Small, focused state files (not one giant one) |
| Automate with CI/CD | Plan in PR, apply on merge |
| Use workspaces or directories | Isolate environments |
| Pin provider versions | Avoid breaking changes from updates |

### IaC in CI/CD

```
PR opened:
  → CI runs `terraform plan`
  → Posts plan output as PR comment
  → Team reviews infrastructure changes

PR merged to main:
  → CD runs `terraform apply -auto-approve`
  → Applies changes to staging
  → After validation, promotes to production

  ┌──────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐
  │ Git  │───►│ CI      │───►│ Plan     │───►│ Apply    │
  │ Push │    │ Pipeline│    │ (review) │    │ (auto)   │
  └──────┘    └─────────┘    └──────────┘    └──────────┘
```

---

## 10. Key Takeaways

| Takeaway | Details |
|----------|---------|
| IaC is non-negotiable for SA roles | Every SA interview expects IaC fluency |
| Terraform is the industry standard | Multi-cloud, huge community, HCL |
| Declarative > imperative | Describe desired state, let the tool figure out how |
| State management is critical | Remote backend, locking, separate state per env |
| Modules enable reuse | Write once, deploy across dev/staging/prod |
| Always `plan` before `apply` | Review changes before touching real infrastructure |
| Treat infra like app code | PRs, code review, CI/CD, testing |
| Keep blast radius small | Small state files → small scope of potential damage |
