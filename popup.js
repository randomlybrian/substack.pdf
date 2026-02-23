const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('save-btn');

// Check if current tab is a Substack article
chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
  if (!tab?.id) {
    showError('No active tab found.');
    return;
  }

  try {
    // First attempt
    let detection = await runDetection(tab.id);

    // Retry once after a short delay (handles pages still loading _preloads)
    if (!detection?.isArticle) {
      await new Promise(r => setTimeout(r, 500));
      detection = await runDetection(tab.id);
    }

    if (detection?.isArticle) {
      statusEl.textContent = detection.title;
      statusEl.className = 'success';
      saveBtn.disabled = false;
    } else {
      showError('Not a Substack article page.');
    }
  } catch (e) {
    showError('Cannot access this page.');
  }
});

async function runDetection(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: detectSubstackArticle
  });
  return results[0]?.result;
}

// Save as PDF button
saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  saveBtn.textContent = 'Extracting...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: extractArticleData
    });

    const data = results[0]?.result;
    if (!data) {
      showError('Failed to extract article content.');
      saveBtn.textContent = 'Save as PDF';
      saveBtn.disabled = false;
      return;
    }

    if (!data.bodyHtml) {
      showError('Article content is empty — it may be behind a paywall.');
      saveBtn.textContent = 'Save as PDF';
      saveBtn.disabled = false;
      return;
    }

    await chrome.storage.local.set({ printData: data });
    await chrome.tabs.create({ url: chrome.runtime.getURL('print.html') });
    window.close();
  } catch (e) {
    showError('Extraction failed: ' + e.message);
    saveBtn.textContent = 'Save as PDF';
    saveBtn.disabled = false;
  }
});

function showError(msg) {
  statusEl.textContent = msg;
  statusEl.className = 'error';
}

// --- Functions injected into the page (MAIN world) ---

function detectSubstackArticle() {
  try {
    // Strategy 1: _preloads (works on full page loads)
    const preloads = window._preloads;
    if (preloads) {
      // Reader view: feedData.initialPost.post
      const readerPost = preloads.feedData?.initialPost?.post;
      if (readerPost?.body_html && readerPost?.title) {
        return { isArticle: true, title: readerPost.title };
      }

      // Publication page: direct post object
      if (preloads.post?.body_html && preloads.post?.title) {
        return { isArticle: true, title: preloads.post.title };
      }
    }

    // Strategy 2: DOM detection (works on SPA-navigated pages)
    // Publication pages have a well-structured article element
    const titleEl = document.querySelector(
      'h1.post-title, article h1, .post-header h1'
    );
    const bodyEl = document.querySelector(
      '.available-content .body.markup, .body.markup'
    );
    if (titleEl && bodyEl) {
      return { isArticle: true, title: titleEl.textContent.trim() };
    }

    // Reader SPA pages: React renders article content dynamically.
    // Look for the reader layout with rendered article content.
    const readerRoot = document.querySelector('.reader-nav-root, .reader2-font-base');
    if (readerRoot) {
      // In the reader, the article title and body are rendered by React.
      // Try common selectors the reader app uses.
      const readerTitle = readerRoot.querySelector(
        'h1.post-title, h1[class*="post-title"], article h1, h1[data-testid]'
      );
      const readerBody = readerRoot.querySelector(
        '.available-content .body.markup, .body.markup, .markup, [class*="body"][class*="markup"]'
      );
      if (readerTitle && readerBody) {
        return { isArticle: true, title: readerTitle.textContent.trim() };
      }

      // Even more generic: any h1 + substantial content in the reader
      if (readerTitle) {
        const anyBody = readerRoot.querySelector(
          '[class*="available-content"], [class*="post-content"], article'
        );
        if (anyBody && anyBody.textContent.trim().length > 200) {
          return { isArticle: true, title: readerTitle.textContent.trim() };
        }
      }
    }

    return { isArticle: false };
  } catch {
    return { isArticle: false };
  }
}

function extractArticleData() {
  try {
    // Strategy 1: _preloads extraction (cleanest structured data)
    const preloads = window._preloads;
    if (preloads) {
      let post, publication;

      // Reader view structure
      const readerPost = preloads.feedData?.initialPost?.post;
      const readerPub = preloads.feedData?.initialPost?.publication;
      if (readerPost?.body_html) {
        post = readerPost;
        publication = readerPub;
      }

      // Publication page structure
      if (!post && preloads.post?.body_html) {
        post = preloads.post;
        publication = preloads.pub;
      }

      if (post) {
        return {
          title: post.title || '',
          subtitle: post.subtitle || '',
          date: post.post_date || '',
          bylines: (post.publishedBylines || []).map(b => b.name),
          publication: publication?.name || '',
          bodyHtml: post.body_html || '',
          coverImage: post.cover_image || '',
          canonicalUrl: post.canonical_url || window.location.href
        };
      }
    }

    // Strategy 2: DOM extraction (fallback for SPA navigation / timing issues)

    // Find the article body content
    let contentEl = document.querySelector(
      '.available-content .body.markup, .body.markup'
    );

    // If no body found, try reader SPA selectors
    if (!contentEl) {
      const readerRoot = document.querySelector('.reader-nav-root, .reader2-font-base');
      if (readerRoot) {
        contentEl = readerRoot.querySelector(
          '.available-content .body.markup, .body.markup, .markup, [class*="body"][class*="markup"]'
        );
        // Broader fallback: find the main content area in the reader
        if (!contentEl) {
          contentEl = readerRoot.querySelector(
            '[class*="available-content"], [class*="post-content"], article'
          );
        }
      }
    }

    if (!contentEl) return null;

    // Extract title
    const titleEl = document.querySelector(
      'h1.post-title, article h1, .post-header h1'
    ) || document.querySelector(
      'h1[class*="post-title"], h1[data-testid]'
    );
    const title = titleEl?.textContent?.trim()
      || document.querySelector('meta[property="og:title"]')?.content
      || document.title
      || '';

    // Extract subtitle
    const subtitleEl = document.querySelector(
      'h3.subtitle, .post-header h3, .subtitle'
    );
    const subtitle = subtitleEl?.textContent?.trim() || '';

    // Extract author
    const authorMeta = document.querySelector('meta[name="author"]')?.content;
    let bylines = [];
    if (authorMeta && authorMeta !== 'Substack') {
      bylines = [authorMeta];
    } else {
      // Try to find author from byline elements in the page
      const bylineEl = document.querySelector('.byline-wrapper a[href*="/@"], .post-header a[href*="/@"]');
      if (bylineEl) {
        bylines = [bylineEl.textContent.trim()];
      }
    }

    // Extract date
    const timeEl = document.querySelector('time[datetime]');
    let date = timeEl?.getAttribute('datetime') || '';
    if (!date) {
      date = document.querySelector('meta[property="article:published_time"]')?.content || '';
    }
    if (!date && preloads) {
      const p = preloads.post || preloads.feedData?.initialPost?.post;
      if (p?.post_date) date = p.post_date;
    }

    // Extract publication name
    const pubNameEl = document.querySelector('.publication-name, [class*="publication-name"]');
    let publication = pubNameEl?.textContent?.trim() || '';
    if (!publication) {
      publication = document.querySelector('meta[property="og:site_name"]')?.content || '';
    }

    // Get body HTML (clone to avoid modifying the live page)
    const bodyClone = contentEl.cloneNode(true);
    const bodyHtml = bodyClone.innerHTML;

    // Canonical URL
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    const canonicalUrl = canonicalLink?.href || window.location.href;

    return {
      title,
      subtitle,
      date,
      bylines,
      publication,
      bodyHtml,
      coverImage: '',
      canonicalUrl
    };
  } catch {
    return null;
  }
}
