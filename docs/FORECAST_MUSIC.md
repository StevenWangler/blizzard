# Forecast music

Blizzard plays **Fireside Romance** by Albert Behar. About → Music credits displays the supplied attribution.

> Music: 'Fireside Romance' by Albert Behar on #Uppbeat https://uppbeat.io/c/albert-behar

The site owner supplied the track under an Uppbeat Creator subscription for this self-published app. The track is licensed separately from the application code. [Uppbeat license](https://uppbeat.io/uppbeat-basic-license)

The release workflow retrieves a pinned commit from a private media repository using a read-only deploy key. The build expects `.local-assets/music/fireside-romance.mp3` and checks its size and SHA-256 against `config/release-assets.json`. Keep the original file, key and account details out of the public source tree. The built site serves the audio for in-app playback.

The music control remembers a listener’s choice on their device. When autoplay is blocked, tap Play. An ordinary development build can run without the MP3. The release build requires the licensed track.
