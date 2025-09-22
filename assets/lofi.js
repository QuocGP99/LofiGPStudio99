document.addEventListener('DOMContentLoaded', async function () {
  /* ======================== FETCH CONFIG FROM WP REST ======================= */
  async function fetchConfig() {
    try {
      const res = await fetch('/wp-json/gp-lofi/v1/config', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.error('Fetch config failed:', e);
      return { playlist: [], nature: [], instrument: [] };
    }
  }
  const cfg = await fetchConfig();
  const natureSounds = Array.isArray(cfg.nature) ? cfg.nature : [];
  const instrumentSounds = Array.isArray(cfg.instrument) ? cfg.instrument : [];
  let playlist = Array.isArray(cfg.playlist) ? cfg.playlist : [];

  /* ================================ DOM ==================================== */
  const body = document.querySelector('body');

  // Mixer tabs & containers
  const mixerNatureBtn = document.getElementById('mixer-nature-btn');
  const mixerInstrumentBtn = document.getElementById('mixer-instrument-btn');
  const natureSoundsContainer = document.getElementById('nature-sounds-container');
  const instrumentSoundsContainer = document.getElementById('instrument-sounds-container');

  // Timer
  const timeDisplay = document.getElementById('time-display');
  const timerControls = document.getElementById('timer-controls');
  const customTimerInput = document.getElementById('custom-timer-input');
  const startCustomTimerBtn = document.getElementById('start-custom-timer-btn');
  const timerOffBtn = document.getElementById('timer-off-btn');

  // Player
  const musicPlayer = document.getElementById('music-player');
  const musicCover  = document.getElementById('music-cover');
  const musicTitle  = document.getElementById('music-title');
  const musicArtist = document.getElementById('music-artist');

  const prevBtn      = document.getElementById('prev-btn');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const nextBtn      = document.getElementById('next-btn');

  const playIcon  = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');

  const progressBar       = document.getElementById('progress-bar');
  const progressContainer = document.getElementById('progress-container');
  const currentTimeEl     = document.getElementById('current-time');
  const durationEl        = document.getElementById('duration');

  const playlistUl = document.getElementById('playlist-ul');

  // Buttons mới
  const shuffleBtn = document.getElementById('shuffle-btn');
  const repeatBtn  = document.getElementById('repeat-btn');

  /* ============================== STATE ==================================== */
  let currentTrackIndex = 0;
  let isPlaying = false;
  let isShuffle = false; // shuffle on/off
  let repeatMode = 0;    // 0 = off, 1 = repeat all, 2 = repeat one

  // Timer
  let timerInterval = null;
  let timeLeft = 0;

  /* ============================== UTILS ==================================== */
  function formatTime(sec) {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /* ============================ MIXER (SOUNDS) ============================= */
  function createSoundControls(sound, container) {
    const controlDiv = document.createElement('div');
    controlDiv.className = 'flex flex-col items-center space-y-2 w-24';

    const iconDiv = document.createElement('div');
    iconDiv.id = `icon-${sound.id}`;
    iconDiv.className = 'sound-icon text-gray-400 cursor-pointer';
    iconDiv.innerHTML = sound.icon || ''; // SVG inline từ Admin

    const nameP = document.createElement('p');
    nameP.className = 'text-xs font-medium text-gray-300';
    nameP.textContent = sound.name || sound.id || 'Sound';

    const sliderWrapper = document.createElement('div');
    sliderWrapper.id = `slider-wrapper-${sound.id}`;
    sliderWrapper.className = 'volume-slider-wrapper w-full';

    const sliderInput = document.createElement('input');
    sliderInput.id = `${sound.id}-slider`;
    sliderInput.dataset.sound = sound.id;
    sliderInput.type = 'range';
    sliderInput.min = 0;
    sliderInput.max = 100;
    sliderInput.value = 0;
    sliderWrapper.appendChild(sliderInput);

    controlDiv.appendChild(iconDiv);
    controlDiv.appendChild(nameP);
    controlDiv.appendChild(sliderWrapper);
    container.appendChild(controlDiv);

    // audio element
    const audio = document.createElement('audio');
    audio.id = `${sound.id}-audio`;
    audio.src = sound.src || '';
    audio.loop = true;
    body.appendChild(audio);

    // interactions
    iconDiv.addEventListener('click', () => {
      const currentVolume = +sliderInput.value;
      sliderInput.value = currentVolume > 0 ? 0 : 50;
      sliderInput.dispatchEvent(new Event('input'));
    });

    sliderInput.addEventListener('input', function () {
      const volume = this.value / 100;
      audio.volume = volume;
      if (volume > 0) {
        if (audio.paused && audio.src) audio.play().catch(()=>{});
        iconDiv.classList.add('playing');
        sliderWrapper.classList.add('active');
      } else {
        audio.pause();
        iconDiv.classList.remove('playing');
        sliderWrapper.classList.remove('active');
      }
    });
  }

  // render mixer
  natureSounds.forEach(s => createSoundControls(s, natureSoundsContainer));
  instrumentSounds.forEach(s => createSoundControls(s, instrumentSoundsContainer));

  // tabs
  mixerNatureBtn?.addEventListener('click', () => {
    natureSoundsContainer.classList.remove('hidden');
    instrumentSoundsContainer.classList.add('hidden');
    mixerNatureBtn.classList.add('active');
    mixerInstrumentBtn.classList.remove('active');
    mixerInstrumentBtn.classList.add('text-gray-400');
  });
  mixerInstrumentBtn?.addEventListener('click', () => {
    instrumentSoundsContainer.classList.remove('hidden');
    natureSoundsContainer.classList.add('hidden');
    mixerInstrumentBtn.classList.add('active');
    mixerNatureBtn.classList.remove('active');
    mixerInstrumentBtn.classList.remove('text-gray-400');
  });

  /* =============================== TIMER =================================== */
  function updateTimeDisplay() {
    if (timeLeft <= 0) { timeDisplay.textContent = "--:--"; return; }
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    timeDisplay.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }
  function stopAllSounds() {
    document.querySelectorAll('input[type=range]').forEach(slider => {
      slider.value = 0;
      slider.dispatchEvent(new Event('input'));
    });
    pauseTrack();
  }
  function startTimer(minutes) {
    if (isNaN(minutes) || minutes <= 0) return;
    clearInterval(timerInterval);
    timeLeft = minutes * 60;
    updateTimeDisplay();
    timerControls.classList.add('hidden');
    timerOffBtn.classList.remove('hidden');
    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimeDisplay();
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timeDisplay.textContent = "Hết giờ!";
        stopAllSounds();
        setTimeout(stopTimer, 2000);
      }
    }, 1000);
  }
  function stopTimer() {
    clearInterval(timerInterval);
    timeLeft = 0;
    updateTimeDisplay();
    timerControls.classList.remove('hidden');
    timerOffBtn.classList.add('hidden');
    customTimerInput.value = '';
  }
  startCustomTimerBtn?.addEventListener('click', () => startTimer(parseInt(customTimerInput.value)));
  timerOffBtn?.addEventListener('click', stopTimer);

  /* ============================== PLAYLIST ================================= */
  function renderPlaylist() {
    if (!playlistUl) return;
    playlistUl.innerHTML = '';
    if (!playlist.length) {
      const li = document.createElement('li');
      li.className = 'p-2 rounded-md text-gray-400 text-sm';
      li.textContent = 'Chưa có bài hát nào. Thêm trong Admin → GP Lofi Player.';
      playlistUl.appendChild(li);
      return;
    }
    playlist.forEach((song, index) => {
      const li = document.createElement('li');
      li.className = 'p-2 rounded-md cursor-pointer hover:bg-gray-700 transition-colors flex justify-between';
      li.innerHTML = `
        <div>
          <p class="font-semibold text-sm">${song.title || 'Không tên'}</p>
          <p class="text-xs text-gray-400">${song.artist || ''}</p>
        </div>`;
      li.addEventListener('click', () => {
        currentTrackIndex = index;
        loadTrack(currentTrackIndex);
        playTrack();
      });
      playlistUl.appendChild(li);
    });
    updatePlaylistUI();
  }

  function updatePlaylistUI() {
    if (!playlistUl) return;
    [...playlistUl.children].forEach((li, i) => {
      li.classList.toggle('active-song', i === currentTrackIndex);
    });
  }

  function loadTrack(index) {
    const track = playlist[index];
    if (!track) return;
    musicCover.src = track.cover || 'https://placehold.co/150x150/1f2937/e5e7eb?text=Music';
    musicTitle.textContent = track.title || 'Không tên';
    musicArtist.textContent = track.artist || '';
    musicPlayer.src = track.src || '';
    updatePlaylistUI();
  }

  function playTrack() {
    if (!musicPlayer.src) return;
    isPlaying = true;
    musicPlayer.play();
    playIcon?.classList.add('hidden');
    pauseIcon?.classList.remove('hidden');
  }
  function pauseTrack() {
    isPlaying = false;
    musicPlayer.pause();
    playIcon?.classList.remove('hidden');
    pauseIcon?.classList.add('hidden');
  }

  function nextIndexNormal(idx) { return (idx + 1) % playlist.length; }
  function prevIndexNormal(idx) { return (idx - 1 + playlist.length) % playlist.length; }
  function pickRandomIndex(except) {
    if (playlist.length <= 1) return except;
    let r;
    do { r = Math.floor(Math.random() * playlist.length); } while (r === except);
    return r;
    }

  function nextTrack() {
    if (!playlist.length) return;
    if (isShuffle) {
      currentTrackIndex = pickRandomIndex(currentTrackIndex);
    } else {
      currentTrackIndex = nextIndexNormal(currentTrackIndex);
    }
    loadTrack(currentTrackIndex); playTrack();
  }
  function prevTrack() {
    if (!playlist.length) return;
    currentTrackIndex = prevIndexNormal(currentTrackIndex);
    loadTrack(currentTrackIndex); playTrack();
  }

  function updateProgress(e) {
    const { duration, currentTime } = e.srcElement;
    if (duration) {
      progressBar.style.width = `${(currentTime / duration) * 100}%`;
      durationEl.textContent = formatTime(duration);
      currentTimeEl.textContent = formatTime(currentTime);
    } else {
      progressBar.style.width = '0%';
      durationEl.textContent = '0:00';
      currentTimeEl.textContent = '0:00';
    }
  }
  function setProgress(e) {
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const duration = musicPlayer.duration;
    if (duration) musicPlayer.currentTime = (clickX / width) * duration;
  }

  /* ====================== SHUFFLE / REPEAT ICON HANDLERS =================== */
  function refreshShuffleBtnUI() {
    if (!shuffleBtn) return;
    const icons = {
      off: `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor"
          class="bi bi-shuffle text-gray-400" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M12.146 3.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L12.5 4.707l-1.646 1.647a.5.5 0 0 1-.708-.708l2-2z"/>
          <path fill-rule="evenodd" d="M3 3.5a.5.5 0 0 1 .5-.5h3.379a.5.5 0 0 1 .354.146l6.5 6.5a.5.5 0 0 1-.708.708l-6.354-6.354H3.5a.5.5 0 0 1-.5-.5z"/>
          <path fill-rule="evenodd" d="M3.146 12.146a.5.5 0 0 1 .708 0l6.354-6.354H12.5a.5.5 0 0 1 0 1h-2.793l-6.354 6.354a.5.5 0 0 1-.708-.708z"/>
        </svg>`,
      on: `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor"
          class="bi bi-shuffle text-blue-500" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M12.146 3.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L12.5 4.707l-1.646 1.647a.5.5 0 0 1-.708-.708l2-2z"/>
          <path fill-rule="evenodd" d="M3 3.5a.5.5 0 0 1 .5-.5h3.379a.5.5 0 0 1 .354.146l6.5 6.5a.5.5 0 0 1-.708.708l-6.354-6.354H3.5a.5.5 0 0 1-.5-.5z"/>
          <path fill-rule="evenodd" d="M3.146 12.146a.5.5 0 0 1 .708 0l6.354-6.354H12.5a.5.5 0 0 1 0 1h-2.793l-6.354 6.354a.5.5 0 0 1-.708-.708z"/>
        </svg>`
    };
    shuffleBtn.innerHTML = isShuffle ? icons.on : icons.off;
    shuffleBtn.title = isShuffle ? 'Shuffle: On' : 'Shuffle: Off';
  }

  function refreshRepeatBtnUI() {
    if (!repeatBtn) return;
    const icons = {
      off: `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" 
          class="bi bi-repeat text-gray-400" viewBox="0 0 16 16">
          <path d="M11 4.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V6H3.707l.147.146a.5.5 0 0 1-.708.708l-1-1a.5.5 0 0 1 0-.708l1-1a.5.5 0 0 1 .708.708L3.707 5H11z"/>
          <path d="M5 11.5a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 1 0v2.5h7.293l-.147-.146a.5.5 0 1 1 .708-.708l1 1a.5.5 0 0 1 0 .708l-1 1a.5.5 0 0 1-.708-.708l.147-.146H5z"/>
        </svg>`,
      all: `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" 
          class="bi bi-repeat text-blue-500" viewBox="0 0 16 16">
          <path d="M11 4.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V6H3.707l.147.146a.5.5 0 0 1-.708.708l-1-1a.5.5 0 0 1 0-.708l1-1a.5.5 0 0 1 .708.708L3.707 5H11z"/>
          <path d="M5 11.5a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 1 0v2.5h7.293l-.147-.146a.5.5 0 1 1 .708-.708l1 1a.5.5 0 0 1 0 .708l-1 1a.5.5 0 0 1-.708-.708l.147-.146H5z"/>
        </svg>`,
      one: `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" 
          class="bi bi-repeat-1 text-green-500" viewBox="0 0 16 16">
          <path d="M11 4.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V6H3.707l.147.146a.5.5 0 0 1-.708.708l-1-1a.5.5 0 0 1 0-.708l1-1a.5.5 0 0 1 .708.708L3.707 5H11z"/>
          <path d="M5 11.5a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 1 0v2.5h7.293l-.147-.146a.5.5 0 1 1 .708-.708l1 1a.5.5 0 0 1 0 .708l-1 1a.5.5 0 0 1-.708-.708l.147-.146H5z"/>
          <path d="M8.5 8.5v3h1v-4h-1.5v1h.5z"/>
        </svg>`
    };
    if (repeatMode === 1) {
      repeatBtn.innerHTML = icons.all;  repeatBtn.title = 'Repeat All';
    } else if (repeatMode === 2) {
      repeatBtn.innerHTML = icons.one;  repeatBtn.title = 'Repeat One';
    } else {
      repeatBtn.innerHTML = icons.off;  repeatBtn.title = 'Repeat Off';
    }
  }

  /* ================================ EVENTS ================================= */
  // Play controls
  playPauseBtn?.addEventListener('click', () => (isPlaying ? pauseTrack() : playTrack()));
  prevBtn?.addEventListener('click', prevTrack);
  nextBtn?.addEventListener('click', () => {
    if (isShuffle) {
      currentTrackIndex = pickRandomIndex(currentTrackIndex);
      loadTrack(currentTrackIndex); playTrack();
    } else {
      nextTrack();
    }
  });

  // Progress
  musicPlayer?.addEventListener('timeupdate', updateProgress);
  musicPlayer?.addEventListener('loadedmetadata', updateProgress);
  progressContainer?.addEventListener('click', setProgress);

  // Ended
  musicPlayer?.addEventListener('ended', () => {
    if (!playlist.length) return;
    if (repeatMode === 2) { // repeat one
      playTrack(); return;
    }
    if (isShuffle) {
      currentTrackIndex = pickRandomIndex(currentTrackIndex);
      loadTrack(currentTrackIndex); playTrack(); return;
    }
    if (currentTrackIndex < playlist.length - 1) {
      nextTrack();
    } else if (repeatMode === 1) {
      currentTrackIndex = 0; loadTrack(currentTrackIndex); playTrack();
    } else {
      pauseTrack(); musicPlayer.currentTime = 0; progressBar.style.width = '0%';
    }
  });

  // Shuffle / Repeat
  shuffleBtn?.addEventListener('click', () => { isShuffle = !isShuffle; refreshShuffleBtnUI(); });
  repeatBtn?.addEventListener('click', () => { repeatMode = (repeatMode + 1) % 3; refreshRepeatBtnUI(); });

  /* ============================ INITIALIZE UI ============================== */
  renderPlaylist();
  if (playlist.length) loadTrack(currentTrackIndex);
  refreshShuffleBtnUI();
  refreshRepeatBtnUI();
});
