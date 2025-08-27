# 🚨 DANGER ZONE Audio Setup 🚨

## How to Add Your MP3 File

1. **Get your MP3 file** (the hilarious one you mentioned)

2. **Rename it to one of these names:**
   - `danger-zone.mp3` (recommended)
   - `dangerzone.mp3`
   - `danger_zone.mp3`

3. **Place it in your MBE project folder** (same folder as index.html)

4. **That's it!** The system will automatically detect and play it when someone hits DANGER ZONE

## Supported Audio Locations

The system will automatically search for audio files in these locations:
- `danger-zone.mp3` (root folder)
- `dangerzone.mp3` (root folder)  
- `danger_zone.mp3` (root folder)
- `audio/danger-zone.mp3` (in audio subfolder)
- `sounds/danger-zone.mp3` (in sounds subfolder)

## How It Works

When someone rolls DANGER ZONE in HOGWASH:

1. 🚨 **Broadcasts to ALL connected devices** via Firebase
2. 🔊 **Plays your MP3 file** on everyone's device
3. 💀 **Shows dramatic warning popup** with animations
4. ⚠️ **Auto-closes after 10 seconds** or when user clicks "ACKNOWLEDGE DANGER"

## Testing

1. Open the app on multiple devices/browsers
2. Have someone roll HOGWASH until they get DANGER ZONE
3. Watch the chaos unfold on all screens! 😈

## Troubleshooting

- **No audio playing?** Check browser console for audio file errors
- **Popup not showing on other devices?** Check Firebase connection
- **Audio blocked?** Some browsers require user interaction before playing audio

Enjoy the mayhem! 🐷💀⚠️
