# Video Background Files

## Required Files

Place your hero background video files here:

- `hero-background.mp4` - MP4 format (recommended for broad compatibility)
- `hero-background.webm` - WebM format (optional, for better compression)

## Video Specifications

### Recommended Settings:
- **Resolution**: 1920x1080 (Full HD) or 2560x1440 (2K)
- **Frame Rate**: 24-30 fps
- **Duration**: 10-30 seconds (will loop)
- **Codec**: H.264 for MP4
- **File Size**: Keep under 5MB for fast loading
- **Bitrate**: 2-4 Mbps

### Content Suggestions:
- Gaming footage (Fortnite, Valorant, CS:GO, etc.)
- Abstract gaming elements
- Particle effects or animated backgrounds
- Controller/keyboard close-ups
- RGB lighting effects

## Where to Get Free Gaming Videos

1. **Pexels Videos** - https://www.pexels.com/videos/
   - Search: "gaming", "esports", "controller", "keyboard"

2. **Pixabay Videos** - https://pixabay.com/videos/
   - Search: "gaming", "computer games", "gamer"

3. **Coverr** - https://coverr.co/
   - Search: "gaming", "technology"

4. **Videvo** - https://www.videvo.net/
   - Search: "gaming", "game console"

## How to Optimize Your Video

### Using FFmpeg (command line):

```bash
# Convert and compress to MP4 (H.264)
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset medium -vf scale=1920:1080 -r 30 -an hero-background.mp4

# Convert to WebM (VP9) for better compression
ffmpeg -i input.mp4 -c:v libvpx-vp9 -crf 30 -b:v 0 -vf scale=1920:1080 -r 30 -an hero-background.webm
```

### Using Online Tools:
- **CloudConvert** - https://cloudconvert.com/
- **Online Video Converter** - https://www.onlineconverter.com/

## Current Implementation

The video is displayed with:
- **Blur**: 4px (subtle)
- **Brightness**: 50% (darkened)
- **Overlay**: 70% black overlay on top
- **Auto-play**: Yes (muted for browser compatibility)
- **Loop**: Yes (seamless replay)
- **Fallback**: Gradient background if video fails to load

## Testing

After adding your video file:
1. Refresh the homepage at `http://localhost:3000`
2. The video should play automatically in the background
3. If it doesn't load, check the browser console for errors
4. The gradient fallback will show if the video path is incorrect
