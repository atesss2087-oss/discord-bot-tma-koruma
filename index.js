// --- MAKSİMUM SUNUCU GÜVENLİK VE KORUMA MODÜLÜ ---

// 1. Kanal ve Rol Koruma (Silinirse veya açılırsa anında loglar)
client.on('channelDelete', async (channel) => {
    const logChannel = channel.guild.channels.cache.find(c => c.name === 'güvenlik-log' || c.name === 'bot-log');
    if (logChannel) {
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 TEHLİKE: Kanal Silindi!')
            .setDescription(`Silinen Kanal: **#${channel.name}**\nSunucuda kritik bir kanal silindi, yetkileri kontrol edin!`)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
});

client.on('roleDelete', async (role) => {
    const logChannel = role.guild.channels.cache.find(c => c.name === 'güvenlik-log' || c.name === 'bot-log');
    if (logChannel) {
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 TEHLİKE: Rol Silindi!')
            .setDescription(`Silinen Rol: **${role.name}**\nSunucuda önemli bir rol silindi!`)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
});

// 2. Şüpheli Hesap / Raid Koruması (Yeni açılan hesapları yakalar)
client.on('guildMemberAdd', async (member) => {
    const hesapYasiGun = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    
    // 3 günden yeni açılmış hesaplar şüphelidir
    if (hesapYasiGun < 3) {
        const logChannel = member.guild.channels.cache.find(c => c.name === 'güvenlik-log' || c.name === 'bot-log');
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Şüpheli / Yeni Hesap Tespit Edildi!')
                .setDescription(`**Üye:** ${member.user.tag} (${member})\n**Hesap Yaşı:** ${Math.floor(hesapYasiGun)} gün önce açılmış.\nBu hesap bir bot veya raid (saldırı) hesabı olabilir!`)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
    }
});
