#!/usr/bin/env python3
"""
AG Extension Dashboard Deployment Script
Performs remote deployment via SSH instead of local execution.
"""

import os
import sys
import logging
from pathlib import Path
import paramiko

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DeploymentError(Exception):
    """Custom exception for deployment failures"""
    pass

def run_remote_command(ssh, command, cwd=None, check=True):
    """
    Run a command on the remote server via SSH.

    Args:
        ssh: Paramiko SSH client
        command: Command to run (string)
        cwd: Working directory on remote server
        check: Whether to raise exception on non-zero exit code

    Returns:
        tuple: (stdout, stderr)
    """
    try:
        if cwd:
            command = f"cd {cwd} && {command}"

        logger.info(f"Running remote command: {command}")

        stdin, stdout, stderr = ssh.exec_command(command)

        output = stdout.read().decode().strip()
        error = stderr.read().decode().strip()

        if output:
            logger.info(f"Command output: {output}")
        if error:
            logger.warning(f"Command stderr: {error}")

        # Check exit status
        exit_status = stdout.channel.recv_exit_status()
        if exit_status != 0 and check:
            error_msg = f"Remote command failed with exit code {exit_status}"
            if output:
                error_msg += f"\nOutput: {output}"
            if error:
                error_msg += f"\nError: {error}"
            logger.error(error_msg)
            raise DeploymentError(error_msg)

        return output, error

    except Exception as e:
        logger.error(f"SSH command execution failed: {e}")
        if check:
            raise DeploymentError(f"SSH command failed: {e}") from e
        return "", str(e)

def main():
    """Main deployment function"""
    # SSH Configuration
    ssh_host = os.getenv('SSH_HOST')
    ssh_username = os.getenv('SSH_USERNAME', 'root')
    ssh_key_path = os.getenv('SSH_KEY_PATH')
    ssh_password = os.getenv('SSH_PASSWORD')

    if not ssh_host:
        raise DeploymentError("SSH_HOST environment variable is required")

    if not ssh_key_path and not ssh_password:
        raise DeploymentError("Either SSH_KEY_PATH or SSH_PASSWORD environment variable is required")

    # Deployment directory on remote server
    deploy_dir = "/root/ag-extension-dashboard"

    logger.info("Setting up SSH connection...")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        if ssh_key_path:
            try:
                ssh.connect(
                    hostname=ssh_host,
                    username=ssh_username,
                    key_filename=ssh_key_path
                )
                logger.info(f"Connected to {ssh_host} as {ssh_username} using SSH key")
            except Exception as e:
                logger.warning(f"SSH key authentication failed: {e}")
                if not ssh_password:
                    raise
                # Fall back to password
                ssh.connect(
                    hostname=ssh_host,
                    username=ssh_username,
                    password=ssh_password
                )
                logger.info(f"Connected to {ssh_host} as {ssh_username} using password")
        else:
            # No key, use password
            if not ssh_password:
                raise DeploymentError("SSH_PASSWORD is required when SSH_KEY_PATH is not provided")
            ssh.connect(
                hostname=ssh_host,
                username=ssh_username,
                password=ssh_password
            )
            logger.info(f"Connected to {ssh_host} as {ssh_username} using password")

        # Check if deployment directory exists and is a git repository
        logger.info(f"Checking deployment directory: {deploy_dir}")
        output, error = run_remote_command(ssh, f"test -d {deploy_dir}", check=False)
        dir_exists = output == "" and error == ""  # test -d succeeds with no output
        logger.info(f"Directory exists: {dir_exists}")
        if dir_exists:
            # Directory exists, check if it's a git repo
            git_exists, _ = run_remote_command(ssh, f"test -d {deploy_dir}/.git", check=False)
            if not git_exists:
                logger.info("Directory exists but is not a git repository, removing and cloning...")
                # Remove existing directory and clone
                run_remote_command(ssh, f"rm -rf {deploy_dir}")
                run_remote_command(ssh, f"git clone https://github.com/psalmprax/ag_extension_decision_support.git {deploy_dir}")
        else:
            # Directory doesn't exist, clone it
            logger.info("Deployment directory does not exist, cloning repository...")
            run_remote_command(ssh, f"git clone https://github.com/psalmprax/ag_extension_decision_support.git {deploy_dir}")

        logger.info(f"Starting remote deployment in {deploy_dir}")

        # Get current commit hash for rollback capability
        logger.info("Getting current commit hash for rollback...")
        current_commit, _ = run_remote_command(ssh, "git rev-parse HEAD", cwd=deploy_dir)
        logger.info(f"Current commit: {current_commit.strip()}")

        deployment_started = False

        try:
            # Step 1: Git pull
            logger.info("Pulling latest changes from git...")
            run_remote_command(ssh, "git pull", cwd=deploy_dir)
            deployment_started = True

            # Step 2: Install dependencies
            logger.info("Installing dependencies...")
            run_remote_command(ssh, "npm install", cwd=f"{deploy_dir}/ag-extension-dashboard/src/backend")

            # Step 3: Generate Prisma client
            logger.info("Generating Prisma client...")
            run_remote_command(ssh, "npx prisma generate", cwd=f"{deploy_dir}/ag-extension-dashboard/src/backend")

            # Step 4: Build the application
            logger.info("Building the application...")
            run_remote_command(ssh, "npm run build", cwd=f"{deploy_dir}/ag-extension-dashboard/src/backend")

            # Step 5: Ensure PM2 is installed and restart processes
            logger.info("Checking PM2 installation...")
            pm2_check, _ = run_remote_command(ssh, "which pm2", check=False)
            if not pm2_check.strip():
                logger.info("Installing PM2...")
                run_remote_command(ssh, "npm install -g pm2")

            # Step 6: Restart PM2 processes
            logger.info("Restarting PM2 processes...")
            run_remote_command(ssh, "pm2 restart all")

            logger.info("Deployment completed successfully!")
        except Exception as e:
            # Rollback git changes if deployment was started
            if deployment_started:
                logger.warning("Deployment failed after git pull, rolling back to previous commit...")
                try:
                    run_remote_command(ssh, f"git reset --hard {current_commit}", cwd=deploy_dir, check=False)
                    logger.info("Rollback completed successfully")
                except Exception as rollback_error:
                    logger.error(f"Failed to rollback git changes: {rollback_error}")
            raise  # Re-raise the original exception

    except DeploymentError as e:
        logger.error(f"Deployment failed: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error during deployment: {e}")
        sys.exit(1)
    finally:
        ssh.close()
        logger.info("SSH connection closed")

if __name__ == "__main__":
    main()