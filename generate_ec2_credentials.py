#!/usr/bin/env python3
"""
Script to generate EC2 credentials from Infomaniak OpenStack.
These credentials can be used as S3 Access Key ID and Secret Access Key.

Usage:
    python generate_ec2_credentials.py
"""

import requests
import json
import sys
import getpass

# Configuration from openrc file
OS_AUTH_URL = "https://api.pub1.infomaniak.cloud/identity/v3"
OS_PROJECT_NAME = "PCP-7LNN6ZO"
OS_PROJECT_DOMAIN_NAME = "default"
OS_USERNAME = "PCU-7LNN6ZO"
OS_USER_DOMAIN_NAME = "default"
OS_PROJECT_ID = "b45e6f3c29a34aa6b99cea829122a734"
OS_REGION_NAME = "dc3-a"

def get_keystone_token(password):
    """Authenticate and get a Keystone token"""
    auth_data = {
        "auth": {
            "identity": {
                "methods": ["password"],
                "password": {
                    "user": {
                        "name": OS_USERNAME,
                        "domain": {"name": OS_USER_DOMAIN_NAME},
                        "password": password
                    }
                }
            },
            "scope": {
                "project": {
                    "id": OS_PROJECT_ID,
                    "domain": {"name": OS_PROJECT_DOMAIN_NAME}
                }
            }
        }
    }
    
    try:
        response = requests.post(
            f"{OS_AUTH_URL}/auth/tokens",
            json=auth_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 201:
            print(f"Error authenticating: {response.status_code}")
            print(response.text)
            return None
        
        token = response.headers.get('X-Subject-Token')
        # Get user ID from the token response
        token_data = response.json()
        user_id = token_data['token']['user']['id']
        
        return token, user_id
    except Exception as e:
        print(f"Error during authentication: {e}")
        return None, None

def get_user_id_from_token(token):
    """Get user information from token"""
    try:
        response = requests.get(
            f"{OS_AUTH_URL}/auth/tokens",
            headers={
                "X-Auth-Token": token,
                "X-Subject-Token": token
            }
        )
        
        if response.status_code == 200:
            token_info = response.json()
            return token_info.get('token', {}).get('user', {}).get('id')
    except Exception as e:
        print(f"Error getting user ID: {e}")
    return None

def list_ec2_credentials(token, user_id):
    """List existing EC2 credentials"""
    try:
        response = requests.get(
            f"{OS_AUTH_URL}/users/{user_id}/credentials/OS-EC2",
            headers={"X-Auth-Token": token}
        )
        
        if response.status_code == 200:
            return response.json().get('credentials', [])
        else:
            print(f"Error listing credentials: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Error listing credentials: {e}")
    return []

def create_ec2_credentials(token, user_id):
    """Create new EC2 credentials for the project"""
    ec2_data = {
        "tenant_id": OS_PROJECT_ID
    }
    
    try:
        response = requests.post(
            f"{OS_AUTH_URL}/users/{user_id}/credentials/OS-EC2",
            json=ec2_data,
            headers={
                "X-Auth-Token": token,
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code in [200, 201]:
            return response.json().get('credential')
        else:
            print(f"Error creating EC2 credentials: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Error creating credentials: {e}")
    return None

def main():
    print("Infomaniak OpenStack EC2 Credentials Generator")
    print("=" * 50)
    print(f"Project: {OS_PROJECT_NAME}")
    print(f"Region: {OS_REGION_NAME}")
    print(f"Username: {OS_USERNAME}")
    print()
    
    # Get password
    password = getpass.getpass("Enter your OpenStack password: ")
    
    # Authenticate
    print("\nAuthenticating...")
    token, user_id = get_keystone_token(password)
    
    if not token or not user_id:
        print("Failed to authenticate. Please check your password.")
        return 1
    
    print("✓ Authentication successful!")
    print(f"User ID: {user_id}")
    print()
    
    # Check existing credentials
    print("Checking existing EC2 credentials...")
    existing = list_ec2_credentials(token, user_id)
    
    if existing:
        print(f"Found {len(existing)} existing EC2 credential(s):")
        for cred in existing:
            print(f"  - Access Key: {cred.get('access')}")
        print()
        create_new = input("Create new credentials? (y/n): ").lower().strip()
        if create_new != 'y':
            print("\nUsing existing credentials:")
            if existing:
                cred = existing[0]
                print(f"Access Key ID: {cred.get('access')}")
                print(f"Secret Access Key: {cred.get('secret')}")
                print("\nAdd these to ~/.aws/credentials under [infomaniak] profile")
            return 0
    
    # Create new credentials
    print("Creating new EC2 credentials...")
    credential = create_ec2_credentials(token, user_id)
    
    if credential:
        print("\n✓ EC2 credentials created successfully!")
        print("=" * 50)
        print("\nAdd these to your AWS CLI credentials file:")
        print(f"\nAccess Key ID: {credential.get('access')}")
        print(f"Secret Access Key: {credential.get('secret')}")
        print("\nThese can be used as S3 credentials for Infomaniak Object Storage.")
        print("\nTo update ~/.aws/credentials, run:")
        print(f'  aws configure set aws_access_key_id {credential.get("access")} --profile infomaniak')
        print(f'  aws configure set aws_secret_access_key {credential.get("secret")} --profile infomaniak')
        return 0
    else:
        print("Failed to create EC2 credentials.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
