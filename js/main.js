import { unlockAdmin }                          from './auth.js';
import { startRecording, stopRecording, clearAudio } from './recorder.js';
import { listenToPostsRealtime }                from './ui.js';
import { handlePublish }                        from './posts.js';
import { resetAndCloseForm }                    from './form.js';

// Re-export so any existing import from main.js still works
export { resetAndCloseForm };

// ── Button wiring ─────────────────────────────────────────────────────────────
document.getElementById('staff-login').addEventListener('click', unlockAdmin);

document.getElementById('start-btn').addEventListener('click', startRecording);
document.getElementById('stop-btn').addEventListener('click', stopRecording);

document.getElementById('publish-btn').addEventListener('click', handlePublish);
document.getElementById('cancel-btn').addEventListener('click', resetAndCloseForm);
document.getElementById('back-arrow-btn').addEventListener('click', resetAndCloseForm);

// Start the live Firestore feed
listenToPostsRealtime();
