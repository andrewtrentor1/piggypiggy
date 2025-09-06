# MBE Jukebox Music Folder

This folder contains MP3 files for the MBE Pig Points jukebox system.

## How to Add Songs (SUPER EASY!)

1. **Just drop MP3 files here**: Simply copy your MP3 files into this `music/` directory.

2. **That's it!** The jukebox will automatically detect new MP3 files when:
   - The page loads
   - Users click the "🔄 REFRESH" button in the jukebox
   - You can manually refresh by running `refreshJukeboxSongs()` in console

3. **No console commands needed**: Songs are automatically detected and added to the jukebox!

## Current Songs

- **Adele - Hello** (`Adele - Hello.mp3`) - Starts at 5 seconds to skip intro

Note: `danger-zone.mp3` is used for a different function and should NOT be in this music folder.

## Features

- **Automatic Playlist**: Click jukebox to start playing through all songs automatically
- **Playback Controls**: Pause, stop, skip to next, skip to previous
- **Auto-advance**: Songs automatically play through the entire playlist
- **No Song Selection**: Just plays through all songs in order (no choosing individual songs)

## File Requirements

- **Format**: MP3 files only
- **Location**: Must be in the `music/` folder
- **Naming**: Use descriptive filenames (avoid special characters)

## Adding Songs via Console

You can add songs dynamically using the browser console:

```javascript
// Add a new song
addSongToJukebox("Artist - Song Name", "filename.mp3");

// Add a song with a start time (to skip intro)
addSongToJukebox("Artist - Song Name", "filename.mp3", 10);

// View current songs
console.log(jukeboxSongs);
```

Enjoy your pig vibes! 🐷🎵
