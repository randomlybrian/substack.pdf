chrome.storage.local.get('printData', ({ printData }) => {
  const loadingEl = document.getElementById('loading');
  const articleEl = document.getElementById('article');
  const toolbarEl = document.getElementById('toolbar');

  if (!printData) {
    loadingEl.textContent = 'No article data found. Please try again from a Substack article.';
    return;
  }

  // Build article
  articleEl.innerHTML = buildArticleHTML(printData);
  document.title = printData.title || 'Substack Article';

  // Show article, hide loading
  loadingEl.style.display = 'none';
  articleEl.style.display = 'block';
  toolbarEl.style.display = 'block';

  // Manual print button
  document.getElementById('print-btn').addEventListener('click', () => {
    window.print();
  });

  // Clean up storage
  chrome.storage.local.remove('printData');

  // Auto-trigger print after images load
  waitForImages(articleEl).then(() => {
    window.print();
  });
});

function buildArticleHTML(data) {
  const date = data.date
    ? new Date(data.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : '';

  const byline = data.bylines.join(', ');
  const cleanBody = sanitizeBody(data.bodyHtml);

  let html = '';

  if (data.coverImage) {
    html += `<div class="cover-image"><img src="${esc(data.coverImage)}" alt=""></div>`;
  }

  html += '<header class="article-header">';

  if (data.publication) {
    html += `<div class="publication-name">${esc(data.publication)}</div>`;
  }

  html += `<h1 class="article-title">${esc(data.title)}</h1>`;

  if (data.subtitle) {
    html += `<div class="article-subtitle">${esc(data.subtitle)}</div>`;
  }

  if (byline || date) {
    html += '<div class="article-meta">';
    if (byline) html += `<span class="byline">${esc(byline)}</span>`;
    if (byline && date) html += '<span class="separator">|</span>';
    if (date) html += `<span class="date">${date}</span>`;
    html += '</div>';
  }

  html += '</header>';
  html += `<div class="article-body">${cleanBody}</div>`;
  html += `<footer class="article-footer">`;

  if (data.canonicalUrl) {
    html += `${esc(data.canonicalUrl)}`;
  }

  html += '</footer>';
  return html;
}

function sanitizeBody(bodyHtml) {
  const container = document.createElement('div');
  container.innerHTML = bodyHtml;

  // Remove Substack UI elements
  const removeSelectors = [
    '.subscription-widget-wrap-editor',
    '.subscription-widget',
    '.image-link-expand',
    'script',
    'style',
    '[data-component-name="SubscribeWidgetToDOM"]',
    '[data-component-name="ButtonCreateButton"]',
    '.button-wrapper'
  ];

  removeSelectors.forEach(sel => {
    container.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Remove subscribe buttons (links to /subscribe)
  container.querySelectorAll('a.button').forEach(el => {
    if (el.href && el.href.includes('subscribe')) {
      // Remove the parent paragraph if it only contains this button
      const parent = el.closest('p') || el.parentElement;
      if (parent && parent.children.length <= 1) {
        parent.remove();
      } else {
        el.remove();
      }
    }
  });

  // Clean up image links — unwrap the <a> around images so they're just images
  container.querySelectorAll('a.image-link').forEach(link => {
    const img = link.querySelector('img');
    if (img) {
      // Remove srcset to force highest quality src
      // Actually keep srcset — browser picks best for print
      link.replaceWith(link.querySelector('.image2-inset') || img);
    }
  });

  // Remove empty paragraphs
  container.querySelectorAll('p').forEach(p => {
    if (!p.textContent.trim() && !p.querySelector('img')) {
      p.remove();
    }
  });

  // Remove mention-wrap spans that have no visible content
  container.querySelectorAll('.mention-wrap').forEach(el => {
    if (!el.textContent.trim()) {
      el.remove();
    }
  });

  return container.innerHTML;
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function waitForImages(container) {
  const images = container.querySelectorAll('img');
  if (images.length === 0) return Promise.resolve();

  const promises = Array.from(images).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  });

  // Resolve after all images load, or after 5s timeout
  return Promise.race([
    Promise.all(promises),
    new Promise(resolve => setTimeout(resolve, 5000))
  ]);
}
