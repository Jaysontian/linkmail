// install-success.js
// Load local assets using chrome.runtime.getURL
document.addEventListener('DOMContentLoaded', function() {
    const demoVideo = document.getElementById('demoVideo');
    const linkedinIcon = document.getElementById('linkedinIcon');
    
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        linkedinIcon.src = chrome.runtime.getURL('assets/linkedin.png');
        
        const source = document.createElement('source');
        source.src = chrome.runtime.getURL('assets/demo_small.webm');
        source.type = 'video/webm';
        demoVideo.appendChild(source);
        demoVideo.load(); // Load the video
    } else {
        // Fallback to web URLs if chrome API is not available
        linkedinIcon.src = 'https://www.linkmail.dev/linkedin.png';
        
        const source = document.createElement('source');
        source.src = 'https://www.linkmail.dev/demo_small.webm';
        source.type = 'video/webm';
        demoVideo.appendChild(source);
        demoVideo.load(); // Load the video
    }
});

