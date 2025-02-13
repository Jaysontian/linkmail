// content/content.js
(function() {
  console.log("LinkedIn Email Scraper Content Script running");

  // Example of scraping emails from page content (customize the selector as needed)
  const emails = [];
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi;
  const bodyText = document.body.innerText;
  const foundEmails = bodyText.match(emailRegex);

  if (foundEmails) {
    foundEmails.forEach(email => {
      if (!emails.includes(email)) {
        emails.push(email);
      }
    });
  }

  // Send scraped emails to popup or storage if needed
  chrome.storage.local.set({ scrapedEmails: emails }, () => {
    console.log("Scraped emails saved: ", emails);
  });
})();
