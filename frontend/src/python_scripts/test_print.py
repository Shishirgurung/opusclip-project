import sys

sys.stdout.write("Test: Hello from stdout!\n")
sys.stdout.flush()
sys.stderr.write("Test: Hello from stderr!\n")
sys.stderr.flush()
sys.exit(0)
