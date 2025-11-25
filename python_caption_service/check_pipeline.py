#!/usr/bin/env python3
"""
Diagnostic script to test pyannote.audio model access
"""

try:
    from pyannote.audio import Pipeline
    print("✓ pyannote.audio imported successfully")
    
    # Test different model versions
    models_to_test = [
        "pyannote/speaker-diarization-3.1",
        "pyannote/speaker-diarization@2.1",
        "pyannote/speaker-diarization",
    ]
    
    for model_name in models_to_test:
        print(f"\nTesting model: {model_name}")
        try:
            pipeline = Pipeline.from_pretrained(model_name)
            print(f"✓ Successfully loaded {model_name}")
            break
        except Exception as e:
            print(f"✗ Failed to load {model_name}: {e}")
    
    # If all models fail, let's try a simpler approach
    print("\n" + "="*50)
    print("If all models failed, we'll implement a fallback solution")
    print("that uses simple speaker change detection based on audio features.")
    
except ImportError as e:
    print(f"✗ Failed to import pyannote.audio: {e}")
    print("Please install: pip install pyannote.audio")

except Exception as e:
    print(f"✗ Unexpected error: {e}")
