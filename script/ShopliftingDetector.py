
# Este proyecto usa python 3.11 . Lo ideal es descargar todas las dependencias en un .venv para evitar conflictos con otras librerías que puedas tener instaladas globalmente. 
# python3.11 -m venv .venv

import cv2
import time
import os
from datetime import datetime
from collections import deque
from inference_sdk import InferenceHTTPClient

# ==========================================
# 1. SETTINGS & CONFIGURATION
# ==========================================
# IMPORTANT: Replace with your actual API key
API_KEY = "apikey"
MODEL_ID = "shoplifting-yefyu/1"

FRAME_SKIP_RATE = 10        # Send 1 out of every 10 frames to the API
CONFIDENCE_THRESHOLD = 0.60  # Only trigger if the AI is 60%+ sure
SHOPLIFTING_CLASS = '1'      # The class name the model uses for shoplifting (might be '1' or 'shoplifting')

SAVE_DIR = "evidence"        # Folder where screenshots will be saved
SAVE_COOLDOWN = 3.0          # Wait 3 seconds before saving another screenshot

# VIDEO CLIP SETTINGS
CLIP_DURATION_BEFORE = 5     # Seconds to capture before detection
CLIP_DURATION_AFTER = 5      # Seconds to capture after detection
TARGET_FPS = 30              # Target FPS for video recording

# ==========================================
# 2. INITIALIZATION
# ==========================================
# NEW BLAZING FAST LOCAL VERSION
CLIENT = InferenceHTTPClient(
    api_url="http://127.0.0.1:9001",
    api_key=API_KEY
)

# Create the evidence directory if it doesn't exist
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)
    print(f"Created directory: {SAVE_DIR}/")

cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)

if not cap.isOpened():
    print("Error: Could not open webcam.")
    exit()

# Get actual FPS and frame dimensions
actual_fps = cap.get(cv2.CAP_PROP_FPS) or TARGET_FPS
frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

print(f"Webcam FPS: {actual_fps}, Resolution: {frame_width}x{frame_height}")
print("Shoplifting Detector Started. Press 'q' to quit.")

# State variables
frame_counter = 0
last_predictions = []
last_save_time = 0

# Video clip recording variables
frame_buffer = deque(maxlen=int(actual_fps * CLIP_DURATION_BEFORE))  # Store frames before detection
detection_active = False
post_detection_counter = 0
detection_frame_list = []  # Will store all frames for the clip (before + during + after)

def degrade_frame(frame):
    # 1. Shrink the frame to a tiny CCTV resolution (causes pixelation)
    small_frame = cv2.resize(frame, (320, 240), interpolation=cv2.INTER_LINEAR)
    
    # 2. Add a slight blur to mimic a cheap, dirty lens
    blurred_frame = cv2.GaussianBlur(small_frame, (5, 5), 0)
    
    # 3. Stretch it back out to the original size
    h, w = frame.shape[:2]
    ugly_frame = cv2.resize(blurred_frame, (w, h), interpolation=cv2.INTER_NEAREST)
    
    return ugly_frame

def save_video_clip(frames_list, fps):
    """Save a list of frames as an MP4 video file."""
    if len(frames_list) == 0:
        print("No frames to save.")
        return
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(SAVE_DIR, f"Alert_Clip_{timestamp}.mp4")
    
    # Use H.264 codec for MP4
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(filename, fourcc, fps, (frame_width, frame_height))
    
    if not out.isOpened():
        print(f"Error: Could not create video writer for {filename}")
        return
    
    for frame in frames_list:
        out.write(frame)
    
    out.release()
    print(f"✅ Video clip saved: {filename} ({len(frames_list)} frames, {len(frames_list)/fps:.1f}s)")


# ==========================================
# 3. MAIN VIDEO LOOP
# ==========================================
while True:
    ret, frame = cap.read()
    if not ret:
        break
        
    frame_counter += 1
    
    # 🚨 Uglify the frame before the AI sees it!
    processed_frame = degrade_frame(frame)
    
    # Add current frame to the rolling buffer (for pre-detection clip)
    frame_buffer.append(processed_frame)

    # Send the UGLY frame to the local Docker server
    if frame_counter % FRAME_SKIP_RATE == 0:
        try:
            # Note: We send 'processed_frame', not 'frame'
            result = CLIENT.infer(processed_frame, model_id=MODEL_ID) 
            last_predictions = result.get('predictions', [])
        except Exception as e:
            print(f"API Error: {e}")

    # ... (Keep the rest of your drawing loop the exact same)

    # Draw the predictions
    is_shoplifting_happening = False
    for pred in last_predictions:
        x = int(pred['x'])
        y = int(pred['y'])
        width = int(pred['width'])
        height = int(pred['height'])
        class_name = str(pred['class'])  # Convert to string just in case
        confidence = pred['confidence']

        # Calculate bounding box corners
        x1 = int(x - width / 2)
        y1 = int(y - height / 2)
        x2 = int(x + width / 2)
        y2 = int(y + height / 2)

        # TRIGGER LOGIC
        if class_name == SHOPLIFTING_CLASS and confidence >= CONFIDENCE_THRESHOLD:
            is_shoplifting_happening = True

            # Draw a thick RED box
            cv2.rectangle(processed_frame, (x1, y1), (x2, y2), (0, 0, 255), 4)
            label = f"WARNING: SHOPLIFTING ({confidence:.2f})"
            cv2.putText(processed_frame, label, (x1, max(10, y1 - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 3)
        else:
            # Draw a standard GREEN box
            cv2.rectangle(processed_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            label = f"Class {class_name} ({confidence:.2f})"
            cv2.putText(processed_frame, label, (x1, max(10, y1 - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    # ==========================================
    # 4. VIDEO CLIP RECORDING LOGIC
    # ==========================================
    # Start recording when shoplifting is detected and we're not already recording
    if is_shoplifting_happening and not detection_active:
        detection_active = True
        post_detection_counter = int(actual_fps * CLIP_DURATION_AFTER)
        detection_frame_list = list(frame_buffer)  # Add all pre-detection frames
        print(f"🚨 SHOPLIFTING DETECTED! Starting clip recording... ({len(detection_frame_list)} pre-detection frames)")
    
    # If detection is active, continue adding frames
    if detection_active:
        detection_frame_list.append(processed_frame)
        post_detection_counter -= 1
        
        # When post-detection window expires, save the clip
        if post_detection_counter <= 0:
            save_video_clip(detection_frame_list, actual_fps)
            detection_active = False
            detection_frame_list = []
            last_save_time = time.time()  # Reset cooldown
    
    # Display status on frame
    status = "RECORDING CLIP" if detection_active else "Monitoring..."
    cv2.putText(processed_frame, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 
                0.7, (255, 255, 0) if detection_active else (0, 200, 0), 2)

    # Display the video feed
    cv2.imshow('Shoplifting MVP Detector', processed_frame)

    # Listen for the 'q' key to quit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Clean up
cap.release()
cv2.destroyAllWindows()
print("System shut down securely.")