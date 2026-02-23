import os

# Point this to where the .dll files actually live
ffmpeg_bin = r"C:\ProgramData\chocolatey\lib\ffmpeg-shared\tools\ffmpeg-8.0.1-full_build-shared\bin"

if os.path.exists(ffmpeg_bin):
    os.add_dll_directory(ffmpeg_bin)
    os.environ["PATH"] = ffmpeg_bin + os.pathsep + os.environ["PATH"]
    print(f"✅ DLLs loaded from: {ffmpeg_bin}")
else:
    print("❌ Binaries not found! Ensure you downloaded the 'Shared' zip, not the source.")