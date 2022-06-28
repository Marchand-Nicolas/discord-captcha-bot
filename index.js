const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Intents, Permissions, MessageAttachment, MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { token, clientId } = require('./config.json');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES] });
const fs = require('node:fs');
const Captcha = require("@haileybot/captcha-generator");
client.login(token);

const everyonePerms = {
	permission: false,
};

let verifyCollectors = {

}

const commands = [
	{
		name: 'captcha',
		description: 'set up the captcha system in the specified channel to protect your server',
		permissions: [everyonePerms],
		options: [
			{
				name: 'channel',
				description: 'where users will enter the captcha',
				type: 7,
				required: true,
				channelTypes:0,
			},
			{
				name: 'role',
				description: 'role given to verified users',
				type: 8,
				required: true,
			},
		]
	},
];

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
	console.log('Started refreshing application (/) commands.');

	await rest.put(Routes.applicationCommands(clientId), {
		body: commands,
	});

	console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
	console.error(error);
	}
})();

client.on('interactionCreate', async (interaction) => {
	if (interaction.isCommand()) {
		if (interaction.commandName === 'captcha') {
			if (!interaction.memberPermissions.has(Permissions.FLAGS.ADMINISTRATOR)) return;
			const channel = interaction.options.get("channel").channel
			const role = interaction.options.get("role").role
			const row = new MessageActionRow()
				.addComponents(
					new MessageButton()
						.setCustomId(`Verify-${role.id}`)
						.setLabel('Verify')
						.setStyle('SUCCESS'),
			);
			const embed = new MessageEmbed()
			.setColor('#32a852')
			.setTitle('Captcha')
			.setDescription('The server is protected against bots using a Captcha, click on **Verify** to access the server.')
			channel.send({ 
				embeds: [embed],
				components: [row]
			})
			channel.permissionOverwrites.edit(interaction.guild.id, { SEND_MESSAGES: false});
			channel.permissionOverwrites.create(role.id, { VIEW_CHANNEL: false});
			await interaction.reply(
				`✅ Everything has been successfully set up in <#${channel.id}>`
			);
		}
	}
	else if (interaction.isButton()) {
		const roleId = interaction.customId.split('Verify-')[1];
		if (roleId) {
			const member = interaction.member;
			const role = member.guild.roles.cache.get(roleId);
			let captcha = new Captcha();
			const embed = new MessageEmbed()
			.setColor('#32a852')
			.setTitle('Captcha')
			.setDescription(`<@${member.id}> please enter the letters you see in the image (Captcha) to access the server.`)
			interaction.reply({
				embeds: [embed],
				files: [new MessageAttachment(captcha.JPEGStream, "captcha.jpeg")],
				ephemeral: true  }).then(() => {
				const filter = message => message.author.id === member.id
				if (verifyCollectors[member.id]) {
					verifyCollectors[member.id].stop();
				}
				verifyCollectors[member.id] = interaction.channel.createMessageCollector({ filter, time: 150000 });
				verifyCollectors[member.id].on("collect", message => {
					if (message.content.toUpperCase() === captcha.value) {
						verifyCollectors[member.id].stop();
						interaction.channel.permissionOverwrites.delete(member.id);
						message.delete();
						member.roles.add(role).catch(console.error);
						return;
					}
					message.react('❌');
					setTimeout(() => {
						message.delete()
					}, 1000);
				});
				verifyCollectors[member.id].on("end", () => {
					delete verifyCollectors[member.id];
				})
				interaction.channel.permissionOverwrites.edit(member.id, { SEND_MESSAGES: true });
				setTimeout(() => {
					interaction.channel.permissionOverwrites.delete(member.id);
				}, 140000);
			});
		}
	}
});