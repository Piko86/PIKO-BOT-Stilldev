const settings = require('../settings');
const fs = require('fs');
const path = require('path');

// Enhanced state storage with persistent memory
let menuReplyState = {};

// Auto cleanup function - runs every minute
setInterval(() => {
  const now = Date.now();
  Object.keys(menuReplyState).forEach(number => {
    // Remove states older than 8 minutes (480,000 ms)
    if (now - menuReplyState[number].timestamp > 480000) {
      console.log(`🧹 Cleaning up menu state for ${number} (expired after 8 minutes)`);
      delete menuReplyState[number];
    }
  });
}, 60000); // Check every minute

// Main interactive menu command
async function interactiveMenuCommand(sock, chatId, message, pushname) {
  try {
    let uptime = (process.uptime() / 60).toFixed(2);
    let used = process.memoryUsage().heapUsed / 1024 / 1024;
    let totalRam = Math.round(require('os').totalmem() / 1024 / 1024);
    let ramUsage = `${Math.round(used * 100) / 100}MB / ${totalRam}MB`;

    // Convert uptime to hours, minutes, seconds
    let uptimeSeconds = Math.floor(process.uptime());
    let hours = Math.floor(uptimeSeconds / 3600);
    let minutes = Math.floor((uptimeSeconds % 3600) / 60);
    let seconds = uptimeSeconds % 60;
    let formattedUptime = hours > 0 ? `${hours} hours, ${minutes} minutes, ${seconds} seconds` : `${minutes} minutes, ${seconds} seconds`;

    // Get sender info
    const senderId = message.key.participant || message.key.remoteJid;
    const senderNumber = senderId.replace('@s.whatsapp.net', '');

    let madeMenu = `👋 *HELLO ${pushname || 'User'}*
*╭─「 ᴄᴏᴍᴍᴀɴᴅꜱ ᴘᴀɴᴇʟ」*
*│◈ 𝚁𝙰𝙼 𝚄𝚂𝙰𝙶𝙴 -* ${ramUsage}
*│◈ 𝚁𝚄𝙽𝚃𝙸𝙼𝙴 -* ${formattedUptime}
*│◈ 𝚅𝙴𝚁𝚂𝙸𝙾𝙽 -* v${settings.version}
*╰──────────●●►*

*╭──────────●●►*
*│⛵ LIST MENU*
*│   ───────*
*│ 1   GENERAL*
*│ 2   ADMIN*
*│ 3   OWNER*
*│ 4   DOWNLOAD*
*│ 5   AI & SEARCH*
*│ 6   IMAGE & STICKER*
*│ 7   FUN & GAMES*
*│ 8   TEXTMAKER*
*│ 9   ANIME*
*│ 10  MISC*
*╰───────────●●►*

*🌟 Reply with the Number you want to select*

*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 ${settings.botOwner || 'Mr Unique Hacker'} 〽️*`;

    // Use local bot image
    const imagePath = path.join(__dirname, '../assets/bot_image.jpg');
    let menuMessage;

    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      menuMessage = await sock.sendMessage(
        chatId,
        {
          image: imageBuffer,
          caption: madeMenu,
          contextInfo: {
            mentionedJid: [`${senderNumber}@s.whatsapp.net`],
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: '120363161513685998@newsletter',
              newsletterName: 'KnightBot MD',
              serverMessageId: -1
            }
          }
        },
        { quoted: message }
      );
    } else {
      menuMessage = await sock.sendMessage(
        chatId,
        {
          text: madeMenu,
          contextInfo: {
            mentionedJid: [`${senderNumber}@s.whatsapp.net`],
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: '120363161513685998@newsletter',
              newsletterName: 'KnightBot MD',
              serverMessageId: -1
            }
          }
        },
        { quoted: message }
      );
    }

    // Store menu state with persistent memory
    menuReplyState[senderNumber] = {
      expecting: true,
      timestamp: Date.now(),
      messageId: menuMessage.key.id,
      type: 'main_menu',
      chatId: chatId,
      lastMenuMessageId: menuMessage.key.id
    };

    console.log(`📋 Interactive menu activated for ${senderNumber} - Active for 8 minutes`);

  } catch (e) {
    console.error('Error in interactive menu:', e);
    await sock.sendMessage(chatId, { 
      text: `Error: ${e.message}`,
      contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363161513685998@newsletter',
          newsletterName: 'KnightBot MD',
          serverMessageId: -1
        }
      }
    });
  }
}

// Enhanced menu navigation handler - REPLY ONLY
async function handleMenuNavigation(sock, chatId, message, userMessage, senderId) {
  try {
    // Check if user has an active menu state
    const senderNumber = senderId.replace('@s.whatsapp.net', '');
    const userState = menuReplyState[senderNumber];
    if (!userState || !userState.expecting) return false;

    // Check if this is a reply
    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMessage) return false;

    // Check if replying to any menu message
    const quotedId = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const isReplyToMenu = quotedId === userState.messageId || 
                         quotedId === userState.lastMenuMessageId;
    
    if (!isReplyToMenu) return false;

    // Parse the user input
    const userInput = userMessage.trim();
    const selected = parseInt(userInput);

    // Validate number selection (1-10)
    if (!isNaN(selected) && selected >= 1 && selected <= 10) {
      // Send the appropriate submenu
      const submenuMessage = await sendSubMenu(sock, chatId, selected, message, senderNumber);
      
      // Update user state but KEEP expecting more replies
      userState.timestamp = Date.now(); // Refresh the 8-minute timer
      userState.expecting = true; // Keep expecting replies!
      userState.lastMenuMessageId = submenuMessage.key.id; // Track latest message
      
      console.log(`📋 User ${senderNumber} selected menu ${selected} via REPLY - Menu still active`);
      return true;
    } else {
      await sock.sendMessage(chatId, {
        text: "❌ Please reply with a valid number (1-10) to select a category.",
        contextInfo: {
          forwardingScore: 1,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: '120363161513685998@newsletter',
            newsletterName: 'KnightBot MD',
            serverMessageId: -1
          }
        }
      }, { quoted: message });
      return true;
    }
  } catch (e) {
    console.error("Menu navigation error:", e);
    return false;
  }
}

// Enhanced submenu function that returns message info
async function sendSubMenu(sock, chatId, categoryNumber, message, senderNumber) {
  let uptime = (process.uptime() / 60).toFixed(2);
  let used = process.memoryUsage().heapUsed / 1024 / 1024;
  let totalRam = Math.round(require('os').totalmem() / 1024 / 1024);
  let ramUsage = `${Math.round(used * 100) / 100}MB / ${totalRam}MB`;

  // Convert uptime to hours, minutes, seconds
  let uptimeSeconds = Math.floor(process.uptime());
  let hours = Math.floor(uptimeSeconds / 3600);
  let minutes = Math.floor((uptimeSeconds % 3600) / 60);
  let seconds = uptimeSeconds % 60;
  let formattedUptime = hours > 0 ? `${hours} hours, ${minutes} minutes, ${seconds} seconds` : `${minutes} minutes, ${seconds} seconds`;

  const subMenus = {
    1: {
      title: "GENERAL",
      image: "https://raw.githubusercontent.com/Manmitha96/BOT-PHOTOS/refs/heads/main/BotMenuPhoto/Main.png",
      commands: [
        { name: "help", use: ".help or .menu" },
        { name: "ping", use: ".ping" },
        { name: "alive", use: ".alive" },
        { name: "owner", use: ".owner" },
        { name: "tts", use: ".tts <text>" },
        { name: "joke", use: ".joke" },
        { name: "quote", use: ".quote" },
        { name: "fact", use: ".fact" },
        { name: "weather", use: ".weather <city>" },
        { name: "news", use: ".news" },
        { name: "lyrics", use: ".lyrics <song_title>" },
        { name: "8ball", use: ".8ball <question>" },
        { name: "groupinfo", use: ".groupinfo" },
        { name: "staff", use: ".staff or .admins" },
        { name: "vv", use: ".vv" },
        { name: "translate", use: ".trt <text> <lang>" },
        { name: "screenshot", use: ".ss <link>" }
      ]
    },
    2: {
      title: "ADMIN",
      image: "https://raw.githubusercontent.com/Manmitha96/BOT-PHOTOS/refs/heads/main/BotMenuPhoto/Group.png",
      commands: [
        { name: "ban", use: ".ban @user" },
        { name: "unban", use: ".unban @user" },
        { name: "promote", use: ".promote @user" },
        { name: "demote", use: ".demote @user" },
        { name: "mute", use: ".mute <minutes>" },
        { name: "unmute", use: ".unmute" },
        { name: "delete", use: ".delete or .del" },
        { name: "kick", use: ".kick @user" },
        { name: "warnings", use: ".warnings @user" },
        { name: "warn", use: ".warn @user" },
        { name: "antilink", use: ".antilink <on/off>" },
        { name: "antibadword", use: ".antibadword <on/off>" },
        { name: "clear", use: ".clear" },
        { name: "tag", use: ".tag <message>" },
        { name: "tagall", use: ".tagall" },
        { name: "chatbot", use: ".chatbot <on/off>" },
        { name: "resetlink", use: ".resetlink" },
        { name: "antitag", use: ".antitag <on/off>" },
        { name: "welcome", use: ".welcome <on/off>" },
        { name: "goodbye", use: ".goodbye <on/off>" },
        { name: "setgdesc", use: ".setgdesc <description>" },
        { name: "setgname", use: ".setgname <new name>" },
        { name: "setgpp", use: ".setgpp (reply to image)" }
      ]
    },
    3: {
      title: "OWNER",
      image: "https://raw.githubusercontent.com/Manmitha96/BOT-PHOTOS/refs/heads/main/BotMenuPhoto/Owner.png",
      commands: [
        { name: "mode", use: ".mode <public/private>" },
        { name: "clearsession", use: ".clearsession" },
        { name: "antidelete", use: ".antidelete <on/off>" },
        { name: "cleartmp", use: ".cleartmp" },
        { name: "update", use: ".update" },
        { name: "settings", use: ".settings" },
        { name: "setpp", use: ".setpp <reply to image>" },
        { name: "autoreact", use: ".autoreact <on/off>" },
        { name: "autostatus", use: ".autostatus <on/off>" },
        { name: "autotyping", use: ".autotyping <on/off>" },
        { name: "autoread", use: ".autoread <on/off>" },
        { name: "anticall", use: ".anticall <on/off>" },
        { name: "pmblocker", use: ".pmblocker <on/off/status>" }
      ]
    },
    4: {
      title: "DOWNLOAD",
      image: "https://raw.githubusercontent.com/Manmitha96/BOT-PHOTOS/refs/heads/main/BotMenuPhoto/Download.png",
      commands: [
        { name: "play", use: ".play <song_name>" },
        { name: "song", use: ".song <song_name>" },
        { name: "instagram", use: ".instagram <link>" },
        { name: "facebook", use: ".facebook <link>" },
        { name: "tiktok", use: ".tiktok <link>" },
        { name: "video", use: ".video <song name>" },
        { name: "ytmp4", use: ".ytmp4 <Link>" }
      ]
    },
    5: {
      title: "AI & SEARCH",
      image: "https://raw.githubusercontent.com/Manmitha96/BOT-PHOTOS/refs/heads/main/BotMenuPhoto/Al.png",
      commands: [
        { name: "gpt", use: ".gpt <question>" },
        { name: "gemini", use: ".gemini <question>" },
        { name: "imagine", use: ".imagine <prompt>" },
        { name: "flux", use: ".flux <prompt>" },
        { name: "github", use: ".github or .git" }
      ]
    },
    6: {
      title: "IMAGE & STICKER",
      image: "https://raw.githubusercontent.com/Manmitha96/BOT-PHOTOS/refs/heads/main/BotMenuPhoto/Convert.png",
      commands: [
        { name: "blur", use: ".blur <image>" },
        { name: "simage", use: ".simage <reply to sticker>" },
        { name: "sticker", use: ".sticker <reply to image>" },
        { name: "removebg", use: ".removebg" },
        { name: "remini", use: ".remini" },
        { name: "crop", use: ".crop <reply to image>" },
        { name: "tgsticker", use: ".tgsticker <Link>" },
        { name: "meme", use: ".meme" },
        { name: "take", use: ".take <packname>" },
        { name: "emojimix", use: ".emojimix <emj1>+<emj2>" },
        { name: "igs", use: ".igs <insta link>" },
        { name: "pies", use: ".pies <country>" },
        { name: "china", use: ".china" },
        { name: "indonesia", use: ".indonesia" },
        { name: "japan", use: ".japan" },
        { name: "korea", use: ".korea" },
        { name: "hijab", use: ".hijab" }
      ]
    },
    7: {
      title: "FUN & GAMES",
      image: "https://raw.githubusercontent.com/Manmitha96/BOT-PHOTOS/refs/heads/main/BotMenuPhoto/Fun.png",
      commands: [
        { name: "tictactoe", use: ".tictactoe @user" },
        { name: "hangman", use: ".hangman" },
        { name: "guess", use: ".guess <letter>" },
        { name: "trivia", use: ".trivia" },
        { name: "answer", use: ".answer <answer>" },
        { name: "truth", use: ".truth" },
        { name: "dare", use: ".dare" },
        { name: "compliment", use: ".compliment @user" },
        { name: "insult", use: ".insult @user" },
        { name: "flirt", use: ".flirt" },
        { name: "shayari", use: ".shayari" },
        { name: "goodnight", use: ".goodnight" },
        { name: "roseday", use: ".roseday" },
        { name: "character", use: ".character @user" },
        { name: "wasted", use: ".wasted @user" },
        { name: "ship", use: ".ship @user" },
        { name: "simp", use: ".simp @user" },
        { name: "stupid", use: ".stupid @user [text]" }
      ]
    },
    8: {
      title: "TEXTMAKER",
      image: "https://raw.githubusercontent.com/Manmitha96/BOT-PHOTOS/refs/heads/main/BotMenuPhoto/Other.png",
      commands: [
        { name: "metallic", use: ".metallic <text>" },
        { name: "ice", use: ".ice <text>" },
        { name: "snow", use: ".snow <text>" },
        { name: "impressive", use: ".impressive <text>" },
        { name: "matrix", use: ".matrix <text>" },
        { name: "light", use: ".light <text>" },
        { name: "neon", use: ".neon <text>" },
        { name: "devil", use: ".devil <text>" },
        { name: "purple", use: ".purple <text>" },
        { name: "thunder", use: ".thunder <text>" },
        { name: "leaves", use: ".leaves <text>" },
        { name: "1917", use: ".1917 <text>" },
        { name: "arena", use: ".arena <text>" },
        { name: "hacker", use: ".hacker <text>" },
        { name: "sand", use: ".sand <text>" },
        { name: "blackpink", use: ".blackpink <text>" },
        { name: "glitch", use: ".glitch <text>" },
        { name: "fire", use: ".fire <text>" }
      ]
    },
    9: {
      title: "ANIME",
      image: "https://raw.githubusercontent.com/Manmitha96/BOT-PHOTOS/refs/heads/main/BotMenuPhoto/Anemi.png",
      commands: [
        { name: "neko", use: ".neko" },
        { name: "waifu", use: ".waifu" },
        { name: "loli", use: ".loli" },
        { name: "nom", use: ".nom" },
        { name: "poke", use: ".poke" },
        { name: "cry", use: ".cry" },
        { name: "kiss", use: ".kiss" },
        { name: "pat", use: ".pat" },
        { name: "hug", use: ".hug" },
        { name: "wink", use: ".wink" },
        { name: "facepalm", use: ".facepalm" }
      ]
    },
    10: {
      title: "MISC",
      image: "https://raw.githubusercontent.com/Manmitha96/BOT-PHOTOS/refs/heads/main/BotMenuPhoto/Search.png",
      commands: [
        { name: "heart", use: ".heart" },
        { name: "horny", use: ".horny" },
        { name: "circle", use: ".circle" },
        { name: "lgbt", use: ".lgbt" },
        { name: "lolice", use: ".lolice" },
        { name: "its-so-stupid", use: ".its-so-stupid" },
        { name: "namecard", use: ".namecard" },
        { name: "oogway", use: ".oogway" },
        { name: "tweet", use: ".tweet" },
        { name: "ytcomment", use: ".ytcomment" },
        { name: "comrade", use: ".comrade" },
        { name: "gay", use: ".gay" },
        { name: "glass", use: ".glass" },
        { name: "jail", use: ".jail" },
        { name: "passed", use: ".passed" },
        { name: "triggered", use: ".triggered" },
        { name: "viewonce", use: ".viewonce" },
        { name: "attp", use: ".attp <text>" }
      ]
    }
  };

  const selectedMenu = subMenus[categoryNumber];
  if (selectedMenu) {
    let commandList = "";
    selectedMenu.commands.forEach(cmd => {
      commandList += `*╭──────────●●►*\n*│Command:* ${cmd.name}\n*│Use:* ${cmd.use}\n*╰──────────●●►*\n\n`;
    });

    const menuText = `👋 *HELLO*
*╭─「 ᴄᴏᴍᴍᴀɴᴅꜱ ᴘᴀɴᴇʟ」*
*│◈ 𝚁𝙰𝙼 𝚄𝚂𝙰𝙶𝙴 -* ${ramUsage}
*│◈ 𝚁𝚄𝙽𝚃𝙸𝙼𝙴 -* ${formattedUptime}
*│◈ 𝚅𝙴𝚁𝚂𝙸𝙾𝙽 -* v${settings.version}
*╰──────────●●►*

*╭──────────●●►*
*│⚜️ ${selectedMenu.title} Command List:*
*╰──────────●●►*

${commandList}➠ *Total Commands in ${selectedMenu.title}*: ${selectedMenu.commands.length}

*Reply with another number (1-10) for more categories!*

*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 ${settings.botOwner || 'Mr Unique Hacker'} 〽️*`;

    const submenuMessage = await sock.sendMessage(
      chatId,
      {
        image: { url: selectedMenu.image },
        caption: menuText,
        contextInfo: {
          mentionedJid: [`${senderNumber}@s.whatsapp.net`],
          forwardingScore: 1,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: '120363161513685998@newsletter',
            newsletterName: 'KnightBot MD',
            serverMessageId: -1
          }
        }
      },
      { quoted: message }
    );

    return submenuMessage; // Return message info for tracking
  }
}

// Command to check menu status (for debugging)
async function menuStatusCommand(sock, chatId, message) {
  try {
    const senderId = message.key.participant || message.key.remoteJid;
    const senderNumber = senderId.replace('@s.whatsapp.net', '');
    const userState = menuReplyState[senderNumber];
    
    if (userState) {
      const timeLeft = Math.max(0, 480000 - (Date.now() - userState.timestamp));
      const minutesLeft = Math.floor(timeLeft / 60000);
      const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
      
      await sock.sendMessage(chatId, {
        text: `📋 *Menu Status:* Active\n⏰ *Time Left:* ${minutesLeft}m ${secondsLeft}s\n🎯 *Reply to menu with a number (1-10) to navigate!*`,
        contextInfo: {
          forwardingScore: 1,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: '120363161513685998@newsletter',
            newsletterName: 'KnightBot MD',
            serverMessageId: -1
          }
        }
      }, { quoted: message });
    } else {
      await sock.sendMessage(chatId, {
        text: `📋 *Menu Status:* Inactive\n💡 *Type .imenu to activate!*`,
        contextInfo: {
          forwardingScore: 1,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: '120363161513685998@newsletter',
            newsletterName: 'KnightBot MD',
            serverMessageId: -1
          }
        }
      }, { quoted: message });
    }
  } catch (e) {
    console.error(e);
    await sock.sendMessage(chatId, { 
      text: `Error: ${e.message}`,
      contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363161513685998@newsletter',
          newsletterName: 'KnightBot MD',
          serverMessageId: -1
        }
      }
    });
  }
}

module.exports = {
  interactiveMenuCommand,
  handleMenuNavigation,
  menuStatusCommand
};