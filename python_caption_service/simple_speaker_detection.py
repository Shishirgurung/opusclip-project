import numpy as np
import librosa
from typing import List, Dict, Tuple

def detect_speaker_changes_simple(audio_path: str, word_segments: List[Dict], threshold: float = 0.65) -> List[Dict]:
    """
    Voice-based speaker detection using MFCC clustering.
    Identifies actual different voices in the conversation.
    """
    print(f"Starting voice-based speaker detection for 4 speakers")
    
    try:
        # Load audio
        y, sr = librosa.load(audio_path, sr=16000)
        
        # Create segments for each word with audio features
        speaker_segments = []
        window_size = 2.0  # 2 second windows for voice analysis
        
        # Extract features for overlapping windows
        features_list = []
        time_stamps = []
        
        current_time = 0
        while current_time < len(y) / sr:
            start_sample = int(current_time * sr)
            end_sample = int(min((current_time + window_size) * sr, len(y)))
            
            if end_sample - start_sample > sr * 0.5:  # At least 0.5 seconds
                segment_audio = y[start_sample:end_sample]
                
                # Extract MFCC features
                mfccs = librosa.feature.mfcc(y=segment_audio, sr=sr, n_mfcc=13)
                feature_vector = np.mean(mfccs, axis=1)
                
                features_list.append(feature_vector)
                time_stamps.append(current_time)
            
            current_time += 1.0  # Move by 1 second
        
        if len(features_list) < 4:
            print("Not enough audio segments for voice clustering, using fallback")
            return create_artificial_speaker_segments(word_segments)
        
        # Cluster features into 4 speakers using K-means-like approach
        features = np.array(features_list)
        speaker_assignments = cluster_voices_kmeans(features, n_speakers=4)
        
        # Create speaker segments based on clustering
        for i, (timestamp, speaker_id) in enumerate(zip(time_stamps, speaker_assignments)):
            start_time = timestamp
            end_time = timestamp + window_size
            
            speaker_segments.append({
                'start': start_time,
                'end': end_time,
                'speaker': f'SPEAKER_{speaker_id:02d}'
            })
        
        # Merge consecutive segments with same speaker
        merged_segments = merge_consecutive_speakers(speaker_segments)
        
        unique_speakers = len(set(seg['speaker'] for seg in merged_segments))
        print(f"Voice clustering found {unique_speakers} unique speakers")
        
        return merged_segments
        
    except Exception as e:
        print(f"Voice-based detection failed: {e}, using fallback")
        return create_artificial_speaker_segments(word_segments)

def detect_speaker_changes_mfcc(audio_path: str, word_segments: List[Dict], threshold: float = 0.65) -> List[Dict]:
    """
    MFCC-based speaker change detection.
    """
    try:
        # Load audio
        y, sr = librosa.load(audio_path, sr=16000)
        
        # Extract MFCC features (commonly used for speaker recognition)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=512)
        
        # Calculate frame times
        frame_times = librosa.frames_to_time(np.arange(mfccs.shape[1]), sr=sr, hop_length=512)
        
        # Simple speaker change detection using MFCC variance
        speaker_changes = []
        window_size = 20  # frames
        threshold = 0.5   # variance threshold
        
        current_speaker = 0
        speaker_segments = []
        
        for i in range(0, len(frame_times) - window_size, window_size // 2):
            # Get MFCC features for current window
            current_window = mfccs[:, i:i+window_size]
            
            if i > 0:
                # Compare with previous window
                prev_window = mfccs[:, max(0, i-window_size):i]
                
                # Calculate cosine similarity between windows
                current_mean = np.mean(current_window, axis=1)
                prev_mean = np.mean(prev_window, axis=1)
                
                # Normalize vectors
                current_norm = current_mean / (np.linalg.norm(current_mean) + 1e-8)
                prev_norm = prev_mean / (np.linalg.norm(prev_mean) + 1e-8)
                
                # Calculate similarity
                similarity = np.dot(current_norm, prev_norm)
                
                # If similarity is low, assume speaker change
                if similarity < threshold:
                    current_speaker += 1
                    speaker_changes.append(frame_times[i])
                    print(f"Speaker change detected at {frame_times[i]:.2f}s (similarity: {similarity:.3f})")
            
            # Create speaker segment
            start_time = frame_times[i]
            end_time = frame_times[min(i + window_size, len(frame_times) - 1)]
            
            speaker_segments.append({
                'start': start_time,
                'end': end_time,
                'speaker': f'SPEAKER_{current_speaker:02d}'
            })
        
        return speaker_segments
        
    except Exception as e:
        print(f"Simple speaker detection failed: {e}")
        # Fallback: create fake speaker segments based on silence detection
        return create_fallback_speaker_segments(segments)

def create_fallback_speaker_segments(segments: List[Dict]) -> List[Dict]:
    """
    Create fake speaker segments based on pauses in speech.
    Assumes speaker changes happen during longer pauses.
    """
    speaker_segments = []
    current_speaker = 0
    
    for i, segment in enumerate(segments):
        # Check for long pause before this segment
        if i > 0:
            prev_end = segments[i-1]['end']
            current_start = segment['start']
            pause_duration = current_start - prev_end
            
            # If there's a gap > 0.5 second, assume speaker change
            if pause_duration > 0.5:
                current_speaker += 1
                print(f"Speaker change detected at pause: {current_start:.2f}s (pause: {pause_duration:.2f}s)")
        
        speaker_segments.append({
            'start': segment['start'],
            'end': segment['end'],
            'speaker': f'SPEAKER_{current_speaker:02d}'
        })
    
    return speaker_segments

def assign_speaker_colors_simple(speaker_segments: List[Dict]) -> Dict[str, str]:
    """
    Assign colors to speakers based on the segments.
    """
    unique_speakers = list(set(seg['speaker'] for seg in speaker_segments))
    base_colors = ["&H0000FF00&", "&H000000FF&", "&H00FFFFFF&", "&H0000FFFF&", "&H00FF00FF&", "&H0000FFFF&"]
    
    color_map = {}
    for i, speaker in enumerate(unique_speakers):
        color_map[speaker] = base_colors[i % len(base_colors)]
    
    return color_map

def detect_speaker_change_points(word_segments: List[Dict], min_pause: float = 1.0) -> List[float]:
    """
    Detect potential speaker change points based on significant pauses.
    """
    change_points = [0.0]  # Always start with beginning
    
    for i in range(1, len(word_segments)):
        prev_end = word_segments[i-1]['end']
        current_start = word_segments[i]['start']
        pause_duration = current_start - prev_end
        
        if pause_duration > min_pause:
            change_points.append(current_start)
            print(f"Speaker change point at {current_start:.2f}s (pause: {pause_duration:.2f}s)")
    
    return change_points

def extract_segment_features(audio_path: str, word_segments: List[Dict], change_points: List[float]) -> List[Dict]:
    """
    Extract MFCC features for each segment between change points.
    """
    try:
        y, sr = librosa.load(audio_path, sr=16000)
        segments_with_features = []
        
        for i in range(len(change_points)):
            start_time = change_points[i]
            end_time = change_points[i + 1] if i + 1 < len(change_points) else word_segments[-1]['end']
            
            # Extract audio segment
            start_sample = int(start_time * sr)
            end_sample = int(end_time * sr)
            segment_audio = y[start_sample:end_sample]
            
            if len(segment_audio) > 0:
                # Extract MFCC features
                mfccs = librosa.feature.mfcc(y=segment_audio, sr=sr, n_mfcc=13)
                feature_vector = np.mean(mfccs, axis=1)  # Average across time
                
                segments_with_features.append({
                    'start': start_time,
                    'end': end_time,
                    'features': feature_vector,
                    'segment_id': i
                })
        
        return segments_with_features
    except Exception as e:
        print(f"Feature extraction failed: {e}")
        return []

def cluster_speakers(segments_with_features: List[Dict], max_speakers: int = 4) -> List[Dict]:
    """
    Cluster segments based on audio features to identify unique speakers.
    """
    if not segments_with_features:
        return []
    
    # Extract feature matrix
    features = np.array([seg['features'] for seg in segments_with_features])
    
    # Simple clustering using cosine similarity
    n_segments = len(segments_with_features)
    speaker_assignments = [0] * n_segments  # Start with all segments as speaker 0
    current_speaker_id = 0
    
    for i in range(1, n_segments):
        # Compare with all previous speakers
        is_new_speaker = True
        
        for prev_speaker in range(current_speaker_id + 1):
            # Find segments belonging to this speaker
            prev_segments = [j for j, spk in enumerate(speaker_assignments[:i]) if spk == prev_speaker]
            
            if prev_segments:
                # Calculate average similarity with this speaker
                similarities = []
                for prev_idx in prev_segments:
                    # Cosine similarity
                    dot_product = np.dot(features[i], features[prev_idx])
                    norm_product = np.linalg.norm(features[i]) * np.linalg.norm(features[prev_idx])
                    similarity = dot_product / (norm_product + 1e-8)
                    similarities.append(similarity)
                
                avg_similarity = np.mean(similarities)
                
                # If similar enough, assign to existing speaker
                if avg_similarity > 0.5:  # Similarity threshold (lowered for better separation)
                    speaker_assignments[i] = prev_speaker
                    is_new_speaker = False
                    break
        
        # If not similar to any existing speaker and under max limit
        if is_new_speaker and current_speaker_id < max_speakers - 1:
            current_speaker_id += 1
            speaker_assignments[i] = current_speaker_id
        elif is_new_speaker:
            # Assign to most similar existing speaker
            best_speaker = 0
            best_similarity = -1
            for spk in range(current_speaker_id + 1):
                spk_segments = [j for j, s in enumerate(speaker_assignments[:i]) if s == spk]
                if spk_segments:
                    similarities = [np.dot(features[i], features[j]) / 
                                  (np.linalg.norm(features[i]) * np.linalg.norm(features[j]) + 1e-8)
                                  for j in spk_segments]
                    avg_sim = np.mean(similarities)
                    if avg_sim > best_similarity:
                        best_similarity = avg_sim
                        best_speaker = spk
            speaker_assignments[i] = best_speaker
    
    # Create final speaker segments
    result_segments = []
    for i, seg in enumerate(segments_with_features):
        result_segments.append({
            'start': seg['start'],
            'end': seg['end'],
            'speaker': f'SPEAKER_{speaker_assignments[i]:02d}'
        })
    
    return result_segments

def create_artificial_speaker_segments(word_segments: List[Dict]) -> List[Dict]:
    """
    Create artificial speaker segments by dividing the conversation into chunks.
    This ensures we always have multiple speakers for visual variety.
    """
    if not word_segments:
        return []
    
    total_duration = word_segments[-1]['end'] - word_segments[0]['start']
    segment_duration = total_duration / 3  # Divide into 3 speakers
    
    speaker_segments = []
    current_time = word_segments[0]['start']
    speaker_id = 0
    
    print(f"Creating artificial speaker segments (3 speakers over {total_duration:.1f}s)")
    
    for i in range(3):  # Create 3 artificial speakers
        start_time = current_time
        end_time = min(current_time + segment_duration, word_segments[-1]['end'])
        
        if i == 2:  # Last segment goes to the end
            end_time = word_segments[-1]['end']
        
        speaker_segments.append({
            'start': start_time,
            'end': end_time,
            'speaker': f'SPEAKER_{speaker_id:02d}'
        })
        
        print(f"Artificial speaker {speaker_id}: {start_time:.1f}s - {end_time:.1f}s")
        current_time = end_time
        speaker_id += 1
    
    return speaker_segments

def cluster_voices_kmeans(features: np.ndarray, n_speakers: int = 4) -> List[int]:
    """
    Simple K-means clustering for voice features.
    """
    n_samples = features.shape[0]
    
    # Initialize centroids randomly
    np.random.seed(42)  # For reproducible results
    centroids = features[np.random.choice(n_samples, n_speakers, replace=False)]
    
    assignments = [0] * n_samples
    
    # K-means iterations
    for iteration in range(20):  # Max 20 iterations
        # Assign each point to nearest centroid
        new_assignments = []
        for i, feature in enumerate(features):
            distances = [np.linalg.norm(feature - centroid) for centroid in centroids]
            new_assignments.append(np.argmin(distances))
        
        # Check for convergence
        if new_assignments == assignments:
            break
        assignments = new_assignments
        
        # Update centroids
        for k in range(n_speakers):
            cluster_points = [features[i] for i, assign in enumerate(assignments) if assign == k]
            if cluster_points:
                centroids[k] = np.mean(cluster_points, axis=0)
    
    print(f"K-means converged after {iteration + 1} iterations")
    return assignments

def merge_consecutive_speakers(speaker_segments: List[Dict]) -> List[Dict]:
    """
    Merge consecutive segments with the same speaker.
    """
    if not speaker_segments:
        return []
    
    merged = []
    current_segment = speaker_segments[0].copy()
    
    for segment in speaker_segments[1:]:
        if segment['speaker'] == current_segment['speaker']:
            # Extend current segment
            current_segment['end'] = segment['end']
        else:
            # Start new segment
            merged.append(current_segment)
            current_segment = segment.copy()
    
    merged.append(current_segment)
    
    print(f"Merged {len(speaker_segments)} segments into {len(merged)} speaker segments")
    return merged

def map_words_to_speakers_simple(word_segments: List[Dict], speaker_segments: List[Dict]) -> Dict[float, str]:
    """
    Map word timestamps to speaker labels.
    """
    word_to_speaker = {}
    
    for word in word_segments:
        word_start = word['start']
        
        # Find which speaker segment this word belongs to
        for speaker_seg in speaker_segments:
            if speaker_seg['start'] <= word_start <= speaker_seg['end']:
                word_to_speaker[word_start] = speaker_seg['speaker']
                break
        
        # If no match found, assign to first speaker
        if word_start not in word_to_speaker:
            word_to_speaker[word_start] = 'SPEAKER_00'
    
    return word_to_speaker
