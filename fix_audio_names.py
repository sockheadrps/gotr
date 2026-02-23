import os
import json
from pathlib import Path

chapters_dir = Path("static/chapters")
generated_dir = Path("audio/generated")

if not generated_dir.exists():
    print(f"Error: {generated_dir} not found.")
    exit()

for chapter_folder in chapters_dir.iterdir():
    if not chapter_folder.is_dir() or not chapter_folder.name.startswith("chapter-"):
        continue
    
    json_path = chapter_folder / "audio_chunks.json"
    if not json_path.exists():
        continue
        
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
            ch_num = data.get("chapter")
            ch_id = chapter_folder.name # e.g., "chapter-01-the-shepherds-lie"
            
        # Find files like ch1_chunk0.wav and rename to chapter-01-the-shepherds-lie_chunk0.wav
        # We handle both "ch1" and "ch01" cases just in case
        for prefix in [f"ch{ch_num}_", f"ch{int(ch_num):02d}_"]:
            for old_file in generated_dir.glob(f"{prefix}chunk*.wav"):
                new_name = old_file.name.replace(prefix, f"{ch_id}_")
                old_file.rename(generated_dir / new_name)
                print(f"Renamed: {old_file.name} -> {new_name}")
    except Exception as e:
        print(f"Error processing {chapter_folder.name}: {e}")

print("Migration complete.")