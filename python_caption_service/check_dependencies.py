#!/usr/bin/env python3
"""
Dependency verification script for the Flask backend service.

This script checks for all required dependencies to ensure the Flask backend
can start properly and prevent connection refused errors.

Usage:
    python check_dependencies.py
"""

import sys
import os
import subprocess
import socket
import importlib
import pkg_resources
from pathlib import Path


def print_header(title):
    """Print a formatted header."""
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}")


def print_success(message):
    """Print a success message in green."""
    print(f"✅ {message}")


def print_error(message):
    """Print an error message in red."""
    print(f"❌ {message}")


def print_warning(message):
    """Print a warning message in yellow."""
    print(f"⚠️  {message}")


def print_info(message):
    """Print an info message."""
    print(f"ℹ️  {message}")


def check_virtual_environment():
    """Check if a virtual environment is active."""
    print_header("Virtual Environment Check")
    
    # Check if we're in a virtual environment
    in_venv = (
        hasattr(sys, 'real_prefix') or
        (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix) or
        os.environ.get('VIRTUAL_ENV') is not None
    )
    
    if in_venv:
        venv_path = os.environ.get('VIRTUAL_ENV', sys.prefix)
        print_success(f"Virtual environment is active: {venv_path}")
        return True
    else:
        print_error("No virtual environment detected!")
        print_info("To create and activate a virtual environment:")
        print("  python -m venv venv")
        print("  # On Windows:")
        print("  venv\\Scripts\\activate")
        print("  # On macOS/Linux:")
        print("  source venv/bin/activate")
        return False


def check_python_dependencies():
    """Check if all Python dependencies from requirements.txt are installed."""
    print_header("Python Dependencies Check")
    
    # Read requirements.txt
    requirements_file = Path(__file__).parent / "requirements.txt"
    
    if not requirements_file.exists():
        print_error(f"requirements.txt not found at {requirements_file}")
        return False
    
    try:
        with open(requirements_file, 'r') as f:
            requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]
    except Exception as e:
        print_error(f"Failed to read requirements.txt: {e}")
        return False
    
    all_installed = True
    
    for requirement in requirements:
        # Parse requirement (handle version specifiers)
        package_name = requirement.split('>=')[0].split('==')[0].split('<')[0].split('>')[0].strip()
        
        try:
            # Try to get the installed version
            installed_version = pkg_resources.get_distribution(package_name).version
            print_success(f"{package_name} ({installed_version}) is installed")
        except pkg_resources.DistributionNotFound:
            print_error(f"{package_name} is NOT installed")
            all_installed = False
        except Exception as e:
            print_warning(f"Could not check {package_name}: {e}")
    
    if not all_installed:
        print_info("To install missing dependencies:")
        print("  pip install -r requirements.txt")
    
    return all_installed


def check_system_dependencies():
    """Check if required system dependencies are available in PATH."""
    print_header("System Dependencies Check")
    
    required_tools = ['ffmpeg', 'ffprobe', 'yt-dlp']
    all_available = True
    
    for tool in required_tools:
        try:
            # Try to run the tool with --version or --help
            if tool == 'yt-dlp':
                result = subprocess.run([tool, '--version'], 
                                      capture_output=True, text=True, timeout=10)
            else:
                result = subprocess.run([tool, '-version'], 
                                      capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                # Extract version info from output
                version_line = result.stdout.split('\n')[0] if result.stdout else result.stderr.split('\n')[0]
                print_success(f"{tool} is available: {version_line.strip()}")
            else:
                print_error(f"{tool} is installed but returned error code {result.returncode}")
                all_available = False
                
        except subprocess.TimeoutExpired:
            print_error(f"{tool} command timed out")
            all_available = False
        except FileNotFoundError:
            print_error(f"{tool} is NOT found in PATH")
            all_available = False
            
            # Provide installation instructions
            if tool == 'ffmpeg' or tool == 'ffprobe':
                print_info("To install FFmpeg:")
                print("  Windows: Download from https://ffmpeg.org and add to PATH")
                print("  macOS: brew install ffmpeg")
                print("  Ubuntu/Debian: sudo apt install ffmpeg")
            elif tool == 'yt-dlp':
                print_info("To install yt-dlp:")
                print("  pip install yt-dlp")
        except Exception as e:
            print_warning(f"Could not check {tool}: {e}")
    
    return all_available


def check_port_availability():
    """Check if port 5000 is available for the Flask app."""
    print_header("Port Availability Check")
    
    port = 5000
    host = 'localhost'
    
    try:
        # Try to bind to the port
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(5)
            result = sock.connect_ex((host, port))
            
            if result == 0:
                print_error(f"Port {port} is already in use!")
                print_info("To find what's using the port:")
                print("  Windows: netstat -ano | findstr :5000")
                print("  macOS/Linux: lsof -i :5000")
                print_info("You may need to stop the existing service or use a different port.")
                return False
            else:
                print_success(f"Port {port} is available")
                return True
                
    except Exception as e:
        print_warning(f"Could not check port {port}: {e}")
        return True  # Assume it's available if we can't check


def check_flask_app():
    """Test if the Flask app can be imported without errors."""
    print_header("Flask App Import Check")
    
    try:
        # Add the current directory to Python path
        current_dir = Path(__file__).parent
        if str(current_dir) not in sys.path:
            sys.path.insert(0, str(current_dir))
        
        # Try to import the Flask app
        import app
        print_success("Flask app imported successfully")
        
        # Check if the app object exists
        if hasattr(app, 'app'):
            print_success("Flask app object found")
            return True
        else:
            print_error("Flask app object not found in app.py")
            return False
            
    except ImportError as e:
        print_error(f"Failed to import Flask app: {e}")
        print_info("Make sure app.py exists and all dependencies are installed")
        return False
    except Exception as e:
        print_error(f"Error checking Flask app: {e}")
        return False


def check_file_permissions():
    """Check if we have proper file permissions in the current directory."""
    print_header("File Permissions Check")
    
    current_dir = Path(__file__).parent
    
    # Check if we can read requirements.txt
    requirements_file = current_dir / "requirements.txt"
    if requirements_file.exists():
        try:
            with open(requirements_file, 'r') as f:
                f.read(1)
            print_success("Can read requirements.txt")
        except Exception as e:
            print_error(f"Cannot read requirements.txt: {e}")
            return False
    
    # Check if we can read app.py
    app_file = current_dir / "app.py"
    if app_file.exists():
        try:
            with open(app_file, 'r') as f:
                f.read(1)
            print_success("Can read app.py")
        except Exception as e:
            print_error(f"Cannot read app.py: {e}")
            return False
    else:
        print_error("app.py not found!")
        return False
    
    # Check if we can write to the directory (for temp files, logs, etc.)
    try:
        test_file = current_dir / ".test_write_permission"
        with open(test_file, 'w') as f:
            f.write("test")
        test_file.unlink()  # Delete the test file
        print_success("Can write to current directory")
    except Exception as e:
        print_error(f"Cannot write to current directory: {e}")
        return False
    
    return True


def main():
    """Run all dependency checks."""
    print("🔍 Flask Backend Dependency Checker")
    print("This script verifies all dependencies required for the Flask backend service.")
    
    checks = [
        ("Virtual Environment", check_virtual_environment),
        ("Python Dependencies", check_python_dependencies),
        ("System Dependencies", check_system_dependencies),
        ("Port Availability", check_port_availability),
        ("File Permissions", check_file_permissions),
        ("Flask App Import", check_flask_app),
    ]
    
    results = []
    
    for check_name, check_func in checks:
        try:
            result = check_func()
            results.append((check_name, result))
        except Exception as e:
            print_error(f"Unexpected error in {check_name}: {e}")
            results.append((check_name, False))
    
    # Summary
    print_header("Summary")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for check_name, result in results:
        if result:
            print_success(f"{check_name}: PASSED")
        else:
            print_error(f"{check_name}: FAILED")
    
    print(f"\n📊 Results: {passed}/{total} checks passed")
    
    if passed == total:
        print_success("All checks passed! The Flask backend should start successfully.")
        print_info("You can now run: python app.py")
    else:
        print_error("Some checks failed. Please fix the issues above before starting the Flask backend.")
        print_info("After fixing issues, run this script again to verify.")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)