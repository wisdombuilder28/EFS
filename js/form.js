// form.js — owns resetAndCloseForm so neither main.js nor posts.js
// need to import from each other.
//
// WHY THIS FILE EXISTS:
//   main.js  → imports handlePublish from posts.js
//   posts.js → imports resetAndCloseForm from main.js  ← circular!
//   Circular ES module imports cause the entire module graph to fail
//   silently in some environments, meaning window.setActiveFilter,
//   window.toggleDarkMode and all other window.* assignments in ui.js
//   never run, causing "setActiveFilter is not defined" errors.
//   Breaking the circle by putting resetAndCloseForm here fixes all of it.

import { stopRecording, clearAudio } from './recorder.js';

export function resetAndCloseForm() {
    const get = (id) => document.getElementById(id);

    const title    = get('post-title');
    const body     = get('post-body');
    const author   = get('post-author');
    const category = get('post-category');
    const pin      = get('post-pin');
    const image    = get('post-image');
    const expiry   = get('post-expiry');
    const status   = get('upload-status');
    const area     = get('posting-area');

    if (title)    title.value            = '';
    if (body)     body.value             = '';
    if (author)   author.selectedIndex   = 0;
    if (category) category.selectedIndex = 0;
    if (pin)      pin.checked            = false;
    if (image)    image.value            = '';
    if (expiry)   expiry.value           = '';
    if (status)   { status.innerText = ''; status.style.color = ''; }

    clearAudio();
    stopRecording();

    if (area) area.classList.add('hidden');
}
