# Hunch privacy policy

Hunch is a browser extension that finds the paragraph on a web page that answers a question you type. This page describes what it does with data.

## What is sent, and when

When you open the Hunch bar on a page and type a search, the text of that page and your search are sent to the provider you chose in settings — either TypeSafe AI (`api.typesafe.ai`) or OpenRouter (`openrouter.ai`) — so that its model can score each paragraph. Nothing is sent before you open the bar, and nothing is sent from pages where you have not opened it. Closing the bar stops any request in flight.

The page's URL and title are included with the text so the model has context. Your API key is sent in the request's authorization header.

The provider's handling of that data is governed by their own policies (TypeSafe: <https://typesafe.ai/legal/privacy-policy>; OpenRouter: <https://openrouter.ai/privacy>). Hunch has no server of its own: requests go directly from your browser to the provider you chose.

## What is stored

Your chosen provider, API key, and model are stored in the browser's extension storage on your device. They are not synced anywhere by Hunch and are not sent to anyone other than that provider.

## What is not collected

Hunch has no analytics, no telemetry, no crash reporting, no accounts, and no tracking. It does not read your browsing history, other tabs, cookies, or form contents. It does not run on pages you have not opened it on.

## Permissions

- **Access to `api.typesafe.ai` or `openrouter.ai`**: to send searches to your chosen provider. Requested the first time you save a key or open the bar.
- **Active tab and scripting**: to read the text of the page you invoked Hunch on and draw the highlights.
- **Storage**: to keep your key and model choice.

## Contact

Questions about this policy: open an issue at <https://github.com/tymscar/hunch>.
