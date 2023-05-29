const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const { promisify } = require('util');
require('dotenv').config();

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = 'token.json';

async function authorize() {
  
  const oAuth2Client = new google.auth.OAuth2("940286499630-ijgq5opkcc1v6chho76kkbg7hbn4a9do.apps.googleusercontent.com", "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", "http://localhost:3000/oauth2callback");

  try {
    const token = await readFile(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch (error) {
    return getNewToken(oAuth2Client);
  }
}

async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app by visiting this URL:', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('Enter the code from that page here: ', async (code) => {
      rl.close();

      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        await writeFile(TOKEN_PATH, JSON.stringify(tokens));
        console.log('Token stored to', TOKEN_PATH);

        resolve(oAuth2Client);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function listMessages(auth) {
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    q: 'is:unread',
  });

  return res.data.messages;
}

async function getThread(auth, threadId) {
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
  });

  return res.data;
}

async function sendEmail(auth, to, subject, message) {
  const gmail = google.gmail({ version: 'v1', auth });

  const headers = {
    To: to,
    'Content-Type': 'text/html; charset=utf-8',
    Subject: subject,
  };

  const email = [];
  for (let header in headers) {
    email.push(`${header}: ${headers[header]}`);
  }
  email.push('', message);

  const raw = Buffer.from(email.join('\r\n')).toString('base64');
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return res.data;
}

async function labelAndMoveMessage(auth, messageId, labelId) {
  const gmail = google.gmail({ version: 'v1', auth });

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    resource: {
      addLabelIds: [labelId],
      removeLabelIds: ['UNREAD'],
    },
  });
}

(async () => {
  try {
    const auth = await authorize();
    setInterval(async () => {
      const messages = await listMessages(auth);
      for (const message of messages) {
        const thread = await getThread(auth, message.threadId);
        const { messages: threadMessages } = thread;

        if (threadMessages.length === 1 && threadMessages[0].labelIds.includes('INBOX')) {
          const replyContent = 'Thank you for your email. I am currently on vacation and will respond to you upon my return.';
          await sendEmail(auth, threadMessages[0].payload.headers.find(header => header.name === 'From').value, 'Vacation Reply', replyContent);
          await labelAndMoveMessage(auth, threadMessages[0].id, 'INBOX');
        }
      }
    }, Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000);
  } catch (error) {
    console.error('Error:', error);
  }
})();

function getRandomDelay(min, max) {
  // Generate a random delay between min and max in milliseconds
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function runCode() {
  // Your code to check for new emails, send replies, and apply labels goes here

  // Schedule the next execution with a random delay
  const delay = getRandomDelay(45000, 120000); // Random delay between 45 and 120 seconds
  setTimeout(runCode, delay);
}

// Start the initial execution
runCode();

