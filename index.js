const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
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

// Güvenlik sisteminin açık/kapalı durumunu tutan Hafıza (Bellek)
const guildSecurityStatus = new Map();

client.once('ready', async () => {
    console.log(`Koruma botu aktif ve devrede: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('güvenlik')
            .setDescription('Güvenlik sistemini açar veya kapatır.')
            .addStringOption(option =>
                option.setName('durum')
                    .setDescription('Aktif veya inaktif seçin')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Aktif', value: 'aktif' },
                        { name: 'İnaktif', value: 'inaktif' }
                    )
            ),
        new SlashCommandBuilder()
            .setName('bilgi')
            .setDescription('Botun neler yapabildiğini gösterir.')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Slash komutları başarıyla yüklendi!');
    } catch (error) {
        console.error(error);
    }
});

// --- KOMUT İŞLEYİCİSİ (/güvenlik aktif, /güvenlik inaktif, /bilgi) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild } = interaction;

    if (commandName === 'güvenlik') {
        // Sadece yöneticiler kullanabilsin
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın!', ephemeral: true });
        }

        const durum = options.getString('durum');

        if (durum === 'aktif') {
            guildSecurityStatus.set(guild.id, true);
            return interaction.reply({ content: '🛡️ **Güvenlik sistemi başarıyla AKTİF edildi!** Bot artık sunucuyu koruyor.', ephemeral: true });
        } else {
            guildSecurityStatus.set(guild.id, false);
            return interaction.reply({ content: '⚠️ **Güvenlik sistemi İNAKTİF duruma getirildi!** Koruma özellikleri kapatıldı.', ephemeral: true });
        }
    }

    if (commandName === 'bilgi') {
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('🛡️ Bot Koruma ve Bilgi Sistemi')
            .setDescription('Bu bot sunucunuzu zararlı durumlara ve spam saldırılarına karşı korumak için geliştirilmiştir.')
            .addFields(
                { name: '⚡ Spam Koruması', value: 'Hızlı mesaj atarak spam yapan kişileri otomatik tespit eder ve susturur.' },
                { name: '🚨 Kanal / Rol Koruması', value: 'Sunucuda silinen önemli kanal ve rolleri anında log kanalına bildirir.' },
                { name: '⚠️ Şüpheli Hesap Tespiti', value: 'Sunucuya yeni katılan 3 günden yeni hesapları algılayıp raporlar.' },
                { name: '⚙️ Komutlar', value: '`/güvenlik aktif` veya `/güvenlik inaktif` komutlarıyla korumayı yönetebilirsiniz.' }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// --- 1. SPAM KORUMASI ---
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    // Eğer güvenlik inaktifse korumaları çalıştırma
    const isSecurityActive = guildSecurityStatus.get(message.guild.id) ?? true; // Varsayılan aktif
    if (!isSecurityActive) return;

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
        const isSecurityActive = guildSecurityStatus.get(channel.guild.id) ?? true;
        if (!isSecurityActive) return;

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
        const isSecurityActive = guildSecurityStatus.get(role.guild.id) ?? true;
        if (!isSecurityActive) return;

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
        const isSecurityActive = guildSecurityStatus.get(member.guild.id) ?? true;
        if (!isSecurityActive) return;

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
