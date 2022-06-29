const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Intents, Permissions, MessageAttachment, MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES] });
const fs = require('node:fs');
const Captcha = require("@haileybot/captcha-generator");

let verifyCollectors = {}

let token = process.env.TOKEN;
let clientId = process.env.CLIENT_ID;
try {
	token = require('./config.json').token;
	clientId = require('./config.json').clientId;
}
catch {}

client.login(token);

process.on('uncaughtException', (err, origin) => {
	console.log(err, origin)
})

const commands = [
	{
		name: 'captcha',
		description: 'set up the captcha system in the specified channel to protect your server',
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

const maxInteractionDuration = 1400000;

function checkBotRolePosition(role, guild) {
	return role.position < guild.me.roles.highest.position;
}

function replyError(interaction, error) {
	const embed = new MessageEmbed()
	.setColor('#f54242')
	.setTitle('ERROR')
	.setDescription(`❌ ${error}`)
	.setFooter({text: 'For more help, please join our support server : https://discord.gg/Edb5UUsnTy'})
	interaction.reply({ 
		embeds: [embed]
	});
}

client.on('interactionCreate', async (interaction) => {
	if (interaction.isCommand()) {
		if (interaction.commandName === 'captcha') {
			if (!interaction.memberPermissions.has(Permissions.FLAGS.ADMINISTRATOR)) return;
			const channel = interaction.options.get("channel").channel
			if (channel.type != "GUILD_TEXT") return replyError(interaction, 'Please specify a text channel');
			const role = interaction.options.get("role").role
			if (!checkBotRolePosition(role, interaction.guild)) return replyError(interaction, 'My role need to be higher than the role you specified.');
			let missingPermissions = []
			const botRole = interaction.guild.me.roles.highest
			if (!botRole.permissions.has(Permissions.FLAGS.VIEW_CHANNEL)) missingPermissions.push("View Channel")
			if (!botRole.permissions.has(Permissions.FLAGS.SEND_MESSAGES)) missingPermissions.push("Send Messages")
			if (!botRole.permissions.has(Permissions.FLAGS.USE_EXTERNAL_EMOJIS)) missingPermissions.push("Use External Emojis")
			if (!botRole.permissions.has(Permissions.FLAGS.ATTACH_FILES)) missingPermissions.push("Attach Files")
			if (!botRole.permissions.has(Permissions.FLAGS.EMBED_LINKS)) missingPermissions.push("Embed Links")
			if (!botRole.permissions.has(Permissions.FLAGS.READ_MESSAGE_HISTORY)) missingPermissions.push("Read Message History")
			if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) missingPermissions.push("Manage Messages")
			if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) missingPermissions.push("Manage Roles")
			if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS)) missingPermissions.push("Manage Channels")
			if (!botRole.permissions.has(Permissions.FLAGS.ADD_REACTIONS)) missingPermissions.push("Add Reactions")
			if (missingPermissions.length > 0) return replyError(interaction, `These permissions are missing for the role <@&${botRole.id}> : \`${missingPermissions.join(', ')}\``);
			missingChannelPermissions = []
			if(!channel.permissionsFor(client.user.id).has(['VIEW_CHANNEL'])) missingChannelPermissions.push("View Channel")
			if(!channel.permissionsFor(client.user.id).has(['SEND_MESSAGES'])) missingChannelPermissions.push("Send Messages")
			if(!channel.permissionsFor(client.user.id).has(['USE_EXTERNAL_EMOJIS'])) missingChannelPermissions.push("Use External Emojis")
			if(!channel.permissionsFor(client.user.id).has(['ATTACH_FILES'])) missingChannelPermissions.push("Attach Files")
			if(!channel.permissionsFor(client.user.id).has(['EMBED_LINKS'])) missingChannelPermissions.push("Embed Links")
			if(!channel.permissionsFor(client.user.id).has(['READ_MESSAGE_HISTORY'])) missingChannelPermissions.push("Read Message History")
			if(!channel.permissionsFor(client.user.id).has(['MANAGE_MESSAGES'])) missingChannelPermissions.push("Manage Messages")
			if(!channel.permissionsFor(client.user.id).has(['MANAGE_ROLES'])) missingChannel.push("Manage Roles")
			if(!channel.permissionsFor(client.user.id).has(['MANAGE_CHANNELS'])) missingChannelPermissions.push("Manage Channel")
			console.log(channel.permissionsFor(client.user.id))

			if (missingChannelPermissions.length > 0) return replyError(interaction, 
			`The global permissions for my role are correct, however, some of the permissions I need in this channel are missing. Please add the following permissions for me in the targeted channel: \`${missingChannelPermissions.join(', ')}\`\n
			If the problem persists, please give me the administrator permissions or contact my support team`);
			const row = new MessageActionRow()
				.addComponents(
					new MessageButton()
						.setCustomId(`Verify-${role.id}`)
						.setLabel('Verify')
						.setStyle('SUCCESS'),
			);
			channel.permissionOverwrites.edit(clientId, { SEND_MESSAGES: true, VIEW_CHANNEL: true}).catch()
			const embed = new MessageEmbed()
			.setColor('#74d579')
			.setTitle('Are you a robot ?')
			.setDescription('The server is protected against bots using a Captcha, click on **Verify** to access the server.')
			.setAuthor({name:'Captcha', iconURL:'https://i.imgur.com/m2jRNLg.png'})
			channel.send({ 
				embeds: [embed],
				components: [row]
			})
			channel.permissionOverwrites.edit(interaction.guild.id, { SEND_MESSAGES: false, VIEW_CHANNEL: true, READ_MESSAGE_HISTORY: true });
			channel.permissionOverwrites.create(role.id, { VIEW_CHANNEL: false});
			interaction.guild.roles.everyone.setPermissions(Permissions.FLAGS.VIEW_CHANNEL, false);
			role.setPermissions(Permissions.FLAGS.VIEW_CHANNEL);
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
			if (!checkBotRolePosition(role, interaction.guild)) return replyError(interaction, 'My role must be higher than the role specified by the administrator. Please contact him/her.');
			let missingPermissions = []
			const botRole = interaction.guild.me.roles.highest
			if (!botRole.permissions.has(Permissions.FLAGS.VIEW_CHANNEL)) missingPermissions.push("View Channel")
			if (!botRole.permissions.has(Permissions.FLAGS.SEND_MESSAGES)) missingPermissions.push("Send Messages")
			if (!botRole.permissions.has(Permissions.FLAGS.USE_EXTERNAL_EMOJIS)) missingPermissions.push("Use External Emojis")
			if (!botRole.permissions.has(Permissions.FLAGS.ATTACH_FILES)) missingPermissions.push("Attach Files")
			if (!botRole.permissions.has(Permissions.FLAGS.EMBED_LINKS)) missingPermissions.push("Embed Links")
			if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) missingPermissions.push("Manage Messages")
			if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) missingPermissions.push("Manage Roles")
			if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS)) missingPermissions.push("Manage Channels")

			if (missingPermissions.length > 0) return replyError(interaction, `These permissions are missing for the role <@&${botRole.id}> : \`${missingPermissions.join(', ')}\`. Please contact the server administrator.`);
			let captcha = new Captcha();
			const date = (new Date(new Date().getTime()+(maxInteractionDuration)).getTime() / 1000).toFixed(0);
			const embed = new MessageEmbed()
			.setColor('#74d579')
			.setTitle('Captcha')
			.setDescription(`
			<a:Loading:991374833541718156> <@${member.id}> please enter the letters you see in the image (Captcha) to access the server.\n
			Expires <t:${date}:R>
			`)
			interaction.reply({
				embeds: [embed],
				files: [new MessageAttachment(captcha.JPEGStream, "captcha.jpeg")],
				ephemeral: true  }).then(() => {
				const filter = message => message.author.id === member.id
				if (verifyCollectors[member.id]) {
					verifyCollectors[member.id].stop();
				}
				verifyCollectors[member.id] = interaction.channel.createMessageCollector({ filter, time: maxInteractionDuration + 1000 });
				verifyCollectors[member.id].on("collect", message => {
					if (message.content.toUpperCase() === captcha.value) {
						verifyCollectors[member.id].stop();
						interaction.channel.permissionOverwrites.delete(member.id);
						member.roles.add(role).catch(console.error);
						message.react('✅');
						setTimeout(() => {
							message.delete()
						}, 1000);
					}
					else {
						message.react('❌');
						setTimeout(() => {
							message.delete()
						}, 1000);
					}
				});
				verifyCollectors[member.id].on("end", () => {
					delete verifyCollectors[member.id];
				})
				interaction.channel.permissionOverwrites.edit(member.id, { SEND_MESSAGES: true });
				setTimeout(() => {
					interaction.channel.permissionOverwrites.delete(member.id);
				}, maxInteractionDuration);
			});
		}
	}
});