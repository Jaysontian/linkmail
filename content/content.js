// content/content.js
(function() {
    console.log("LinkedIn Email Scraper Content Script running");


    // const button = document.createElement('button');
    // button.innerText = 'AI Outreach';
    // const mainHolder = document.querySelector('main.CNzQNSoOWHkGDsvsJzqZhpdBjkkUvYsGLA');
    // if (mainHolder){
    //     mainHolder.prepend(button);
    // }


    // Injection
    const injectedDiv = document.createElement('div');

    // Set some content for the div
    // injectedDiv.innerHTML = "<p>Generate an outreach email to " + document.querySelector('h1').innerText + " with AI instantly.</p> <button style={}>Send</button>";

    injectedDiv.innerHTML = "<p>Generate an outreach email to " + document.querySelector('h1').innerText + " with AI instantly.</p> <button style='background-color: rgb(0, 106, 255); margin-top:8px; border-radius: 16px; color: white; padding: 8px 16px; border: none;'>Send</button>";


    Object.assign(injectedDiv.style, {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        textAlign: 'center',
        alignItems: 'center',
        boxShadow: '0 0 10px rgba(0,0,0,0.15)',
        padding: '16px',
        minHeight: '300px',
        borderRadius: '8px',
        backgroundColor: 'white',
        marginBottom:'20px',
    });

    // Locate the <aside> element by its class
    const asideElement = document.querySelector('aside.scaffold-layout__aside');

    if (asideElement) {
        // Prepend the injectedDiv as the first child of the aside element
        asideElement.prepend(injectedDiv);
    } else {
        console.error('Target aside element not found.');
    }



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
