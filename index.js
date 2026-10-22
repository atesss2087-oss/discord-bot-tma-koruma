const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Protection bot is running!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

const LOG_CHANNEL_ID = '1562784881140961281';
const userMessageMap = new Map();

client.once('ready', () => {
    console.log(`Koruma botu aktif ve devrede: ${client.user.tag}`);
});

// --- 1. SPAM VE ARD ARDA MESAJ KORUMASI ---
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    const userId = message.author.id;

    if (message.member && !message.member.permissions.has('Administrator')) {
        const now = Date.now();
        if (!userMessageMap.has(userId)) userMessageMap.set(userId, []);
        const timestamps = userMessageMap.get(userId);
        timestamps.push(now);
        const recentMessages = timestamps.filter(time => now - time < 3000);
        userMessageMap.set(userId, recentMessages);
        
        if (recentMessages.length >= 3) {
            try {
                await message.delete();
                if (message.member.moderatable) {
                    await message.member.timeout(3 * 60 * 1000, "Spam koruması");
                }
                
                const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('⚡ Spam Tespit Edildi!')
                        .setDescription(`**Üye:** ${message.author.tag} (${message.author})\n**Kanal:** ${message.channel}\n3 saniyede 3+ mesaj attığı için susturuldu.`)
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
                return;
            } catch (err) {}
        }
    }
});

// --- 2. SUNUCU GÜVENLİK VE RİSK KORUMASI ---
client.on('channelDelete', async (channel) => {
    try {
        const logChannel = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 TEHLİKE: Kanal Silindi!')
                .setDescription(`Silinen Kanal: **#${channel.name}**`)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {}
});

client.on('roleDelete', async (role) => {
    try {
        const logChannel = role.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 TEHLİKE: Rol Silindi!')
                .setDescription(`Silinen Rol: **${role.name}**`)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {}
});

client.on('guildMemberAdd', async (member) => {
    try {
        const hesapYasiGun = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        if (hesapYasiGun < 3) {
            const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('⚠️ Şüpheli Yeni Hesap Tespit Edildi!')
                    .setDescription(`**Üye:** ${member.user.tag} (${member})\n**Hesap Yaşı:** ${Math.floor(hesapYasiGun)} gün önce açılmış.`)
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }
        }
    } catch (err) {}
});

client.login(process.env.DISCORD_TOKEN);
