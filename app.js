// Register Service Worker for PWA / Web Share Target
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const qualityOptions = document.querySelectorAll(".quality-option");
const sourceChips = document.querySelectorAll(".source-chip");
const detectButton = document.querySelector("#detectButton");
const downloadButton = document.querySelector("#downloadButton");
const clearQueueButton = document.querySelector("#clearQueueButton");
const mediaUrl = document.querySelector("#mediaUrl");
const queueList = document.querySelector("#queueList");

function activateView(target) {
  views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === target);
  });

  navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.target === target);
  });
}

function selectButton(buttons, selected) {
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button === selected);
  });
}

function addQueueItem(label, detail, type, downloadUrl) {
  const item = document.createElement("article");
  item.className = "queue-item";
  const iconSvg = type === 'audio' 
    ? `<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>` 
    : `<rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="m10 9 5 3-5 3V9Z"></path>`;
    
  item.innerHTML = `
    <span class="file-icon ${type === 'audio' ? 'audio' : 'video'}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${iconSvg}</svg>
    </span>
    <div>
      <h3>${label}</h3>
      <p class="queue-detail">${detail}</p>
      <div class="progress-track"><span style="width: 10%"></span></div>
    </div>
    <strong class="queue-percent">10%</strong>
  `;

  queueList.prepend(item);
  const progress = item.querySelector(".progress-track span");
  const percent = item.querySelector(".queue-percent");
  const detailText = item.querySelector(".queue-detail");
  
  // Start actual download process
  fetch('http://localhost:3000/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: downloadUrl, type: type })
  }).then(async response => {
    if (!response.ok) throw new Error('Download failed');
    
    // Fake progress while waiting for backend blob to download
    let current = 10;
    const timer = setInterval(() => {
      current += 10;
      if (current >= 90) clearInterval(timer);
      else {
        percent.textContent = `${current}%`;
        progress.style.width = `${current}%`;
      }
    }, 500);

    const blob = await response.blob();
    clearInterval(timer);
    
    percent.textContent = "Done";
    progress.style.width = "100%";
    detailText.textContent = detail.replace("downloading", "complete");

    // Trigger browser download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `antipink_${Date.now()}.${type === 'audio' ? 'mp3' : 'mp4'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    
  }).catch(error => {
    console.error(error);
    percent.textContent = "Error";
    progress.style.backgroundColor = "#ff2a70";
    detailText.textContent = "Download failed.";
  });
}

async function processUrl(url) {
  if (!url) return;
  mediaUrl.value = url;
  
  const titleEl = document.querySelector(".media-info h2");
  const durationEl = document.querySelector(".media-preview .duration");
  const previewEl = document.querySelector(".media-preview");
  
  titleEl.textContent = "Fetching info...";
  
  // Animate the card
  document.querySelector(".media-card").animate(
    [
      { transform: "translateY(0)", boxShadow: "0 12px 30px rgba(26, 37, 61, 0.08)" },
      { transform: "translateY(-4px)", boxShadow: "0 18px 38px rgba(69, 92, 232, 0.18)" },
      { transform: "translateY(0)", boxShadow: "0 12px 30px rgba(26, 37, 61, 0.08)" }
    ],
    { duration: 520, easing: "ease-out" }
  );

  try {
    const res = await fetch('http://localhost:3000/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });
    
    if (res.ok) {
      const info = await res.json();
      titleEl.textContent = info.title || "Unknown Media";
      if (info.duration) durationEl.textContent = info.duration;
      if (info.thumbnail) {
        previewEl.style.backgroundImage = `url('${info.thumbnail}')`;
        previewEl.style.backgroundSize = 'cover';
        previewEl.style.backgroundPosition = 'center';
      }
    } else {
      titleEl.textContent = "Ready to download";
    }
  } catch (e) {
    console.error(e);
    titleEl.textContent = "Ready to download";
  }
}

navItems.forEach((item) => {
  item.addEventListener("click", () => activateView(item.dataset.target));
});

qualityOptions.forEach((option) => {
  option.addEventListener("click", () => selectButton(qualityOptions, option));
});

sourceChips.forEach((chip) => {
  chip.addEventListener("click", () => selectButton(sourceChips, chip));
});

detectButton.addEventListener("click", () => {
  const value = mediaUrl.value.trim();
  if (value) processUrl(value);
});

downloadButton.addEventListener("click", () => {
  const url = mediaUrl.value.trim();
  if (!url) {
    alert("Please paste a valid URL first.");
    return;
  }
  const quality = document.querySelector(".quality-option.is-active span").textContent;
  const source = document.querySelector(".source-chip.is-selected").textContent.trim();
  const type = source.toLowerCase() === "music" ? "audio" : "video";
  const extension = type === "audio" ? "MP3" : "MP4";
  
  const titleEl = document.querySelector(".media-info h2");
  const actualTitle = (titleEl.textContent && titleEl.textContent !== "Fetching info..." && titleEl.textContent !== "Ready to download") 
    ? titleEl.textContent 
    : "New Download";
  
  addQueueItem(actualTitle, `${quality} ${extension} · downloading`, type, url);
});

clearQueueButton.addEventListener("click", () => {
  queueList.replaceChildren();
});

// Web Share Target API Auto-Download Logic
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  let sharedUrl = params.get('url') || params.get('text');
  
  if (sharedUrl) {
    const urlMatch = sharedUrl.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      sharedUrl = urlMatch[0];
      processUrl(sharedUrl);
      
      // Auto-trigger download
      setTimeout(() => {
        downloadButton.click();
      }, 500);
      
      // Clean up URL so it doesn't re-trigger on refresh
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
});
