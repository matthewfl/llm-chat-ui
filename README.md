# LLM Chat UI

This is a static HTML webpage that can be used to chat with LLMs using the [Anthropic API](https://docs.anthropic.com/en/api/messages) or the [OpenRouter API](https://openrouter.ai/docs/requests) using CORS requets.  State is saved locally in the browser using IndexedDB.

This code was 97% written by the `claude-3-5-sonnet-20241022` model from Anthropic, using the [cline](https://github.com/cline/cline) plugin for VSCode.


### LLM messages to build this app


```
Make a single index.html file that includes Javascript and CSS inline that can be used to chat with the Claude LLM.  Support having multiple chats.  Use the javascript fetch API to directly interact with the anthropic http API.  Store the states of the chats using local storage.  Also include support for defining custom system promps and going back and editing and deleting past messages.

No, please use the claude-3-5-sonnet-20241022 model

It seems that the anthropic api is being used incorrectly. There should be a top level system parameter not a system input message

Can you add an edit and delete button to the user messages and to the assistant messages

for the edit button, can you make the edit action happen in place using a textbox and then have a save button rather than using a javascript prompt

can you add a feature to delete, archive and reorder the chats

Sometimes claude will respond to messages with markdown, what options are there to render this markdown into nice html? (This includes code formatting)

Can we create a settings option menu and then put the system prompt in that menu instead of having it at the top of the chat. Also can we have an option in the settings menu to create a message from the agent or user directly (rather than prompting the api) so that a chat can be "imported" by copying and pasting each message.

NOTE: I have refactored the code myself to move the javascript and css into seperate files as the program was starting to get long.

There is an issue where the settings button is hidden after the first chat message is created

can you update the api usage to stream the response

The event types used for the streaming are incorrect. The documentation for anthropic streaming lists the event types as follows:
Each stream uses the following event flow:
message_start: contains a Message object with empty content.
A series of content blocks, each of which have a content_block_start, one or more content_block_delta events, and a content_block_stop event. Each content block will have an index that corresponds to its index in the final Message content array.
One or more message_delta events, indicating top-level changes to the final Message object.
A final message_stop event.

Can you add a global settings button to the lower left that can be used to configure the api key

can you change the storage to use indexedDB instead of localStorage

Can you add a text input option to the per-chat settings to configure which agent is being used.  By default prefill the field with the claude-3-5-sonnet-20241022 agent

Can you add support for also using openrouter as an option for querying the LLM.  
The global settings dialog will require two different api key fields (one for anthropic directly that already exists, and the other for open router).
Then there should be a ratio button in the per-chat dialog that allows for selecting between openrouter and anthropic.
The default model for openrouter should be anthropic/claude-3.5-sonnet
For context, an example using the open router api is...

can you make the ui responsive, so that it can be used on a phone.  The width of the application should support going down to 200px width, and when on a small device, hide the different chats on the left using a hamburge menu option at the top left

```