const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const {
  Client,
  Intents,
  Permissions,
  MessageAttachment,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
} = require("discord.js");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
  ],
});
const fs = require("node:fs");
const Captcha = require("@haileybot/captcha-generator");
const fetch = require("isomorphic-fetch");
const { createCanvas, loadImage, registerFont } = require("canvas");
const { sendImagesCaptcha } = require("./captchas/imagesCaptcha");
const { maxInteractionDuration } = require("./globalConfig.json");
const path = require("node:path");

console.log("Dir:", __dirname);

registerFont(path.join(__dirname, "fonts/PfennigBoldItalic.ttf"), {
  family: "PfennigBoldItalic",
});

let verifyCollectors = {};
let captchaDatas = {};

let token = process.env.TOKEN;
let clientId = process.env.CLIENT_ID;
try {
  token = require("./config.json").token;
  clientId = require("./config.json").clientId;
} catch {}

client.login(token);

process.on("uncaughtException", (err, origin) => {
  console.log(err, origin);
});

const cache = {
  guilds: {},
};

client.on("ready", () => {
  const time = 12 * 60 * 60 * 1000;
  const update = () => {
    console.log(`Bot on ${client.guilds.cache.size} servers`);
    client.user.setActivity("/help | captcha-b.vercel.app", {
      type: "WATCHING",
    });
  };
  setInterval(update, time);
  update();
});

// Clear cached interactions older than 12 hours
const time = 12 * 60 * 60 * 1000;
setInterval(() => {
  for (const guildId in cache.guilds) {
    for (const userId in cache.guilds[guildId].members) {
      cache.guilds[guildId].members[userId].interactions = cache.guilds[
        guildId
      ].members[userId].interactions.filter(
        (interaction) => interaction > new Date().getTime() - time
      );
    }
  }
}, time);
const commands = [
  {
    name: "captcha",
    description:
      "set up the captcha system in the specified channel to protect your server",
    options: [
      {
        name: "channel",
        description: "where users will enter the captcha",
        type: 7,
        channelTypes: 0,
      },
      {
        name: "role",
        description: "role given to verified users",
        type: 8,
      },
      {
        name: "type",
        description: "captcha type, not required",
        type: 4,
        choices: [
          {
            name: "Find the image in the right orientation (recommended)",
            value: 1,
          },
          {
            name: "Write the displayed text",
            value: 2,
          },
        ],
      },
      {
        name: "custom-avatar",
        description: "custom avatar for the bot, not required",
        type: 11,
        required: false,
      },
      {
        name: "custom-name",
        description: "custom name for the bot, not required",
        type: 3,
        required: false,
      },
      {
        name: "custom-title",
        description: "custom title for the embed, not required",
        type: 3,
        required: false,
      },
      {
        name: "custom-description",
        description: "custom description for the embed, not required",
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: "help",
    description: "More informations about how to use the bot",
  },
];

const totalImages = fs.readdirSync(path.join(__dirname, "images"));

//downloadImages(0)
async function downloadImages(counter) {
  const images = await (
    await fetch(
      "https://api.thedogapi.com/v1/images/search?size=med&mime_types=jpg&format=json&order=RANDOM&limit=100"
    )
  ).json();
  for (let index = 0; index < images.length; index++) {
    const image = images[index];
    const canvas = createCanvas(70, 70);
    const ctx = canvas.getContext("2d");
    await loadImage(image.url).then((image) => {
      ctx.drawImage(image, 0, 0, 70, 70);
    });
    const out = fs.createWriteStream(
      `images/${image.id}.${image.url.split(".").pop()}`
    );
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    counter++;
  }
  downloadImages(counter);
}

const rest = new REST({ version: "9" }).setToken(token);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();

function checkBotRolePosition(role, guild) {
  return role.position < guild.me.roles.highest.position;
}

function replyError(interaction, error) {
  const embed = new MessageEmbed()
    .setColor("#f54242")
    .setTitle("ERROR")
    .setDescription(`❌ ${error}`)
    .setFooter({
      text: "For more help, please join our support server : https://discord.gg/Edb5UUsnTy",
    });
  interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

const captchaTypes = {
  text: "T2",
};

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    if (interaction.commandName === "captcha") {
      if (!interaction.memberPermissions.has(Permissions.FLAGS.ADMINISTRATOR))
        return;
      let missingPermissions = [];
      const botRole = interaction.guild.me.roles.highest;
      const type = interaction.options.get("type")
        ? interaction.options.get("type").value
        : 1 || 1;
      const customBotAvatar = interaction.options.get("custom-avatar");
      const customBotName = interaction.options.get("custom-name");
      const customTitle = interaction.options.get("custom-title");
      const customDescription = interaction.options.get("custom-description");
      if (!botRole.permissions.has(Permissions.FLAGS.VIEW_CHANNEL))
        missingPermissions.push("View Channel");
      if (!botRole.permissions.has(Permissions.FLAGS.SEND_MESSAGES))
        missingPermissions.push("Send Messages");
      if (!botRole.permissions.has(Permissions.FLAGS.USE_EXTERNAL_EMOJIS))
        missingPermissions.push("Use External Emojis");
      if (!botRole.permissions.has(Permissions.FLAGS.ATTACH_FILES))
        missingPermissions.push("Attach Files");
      if (!botRole.permissions.has(Permissions.FLAGS.EMBED_LINKS))
        missingPermissions.push("Embed Links");
      if (!botRole.permissions.has(Permissions.FLAGS.READ_MESSAGE_HISTORY))
        missingPermissions.push("Read Message History");
      if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES))
        missingPermissions.push("Manage Messages");
      if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_ROLES))
        missingPermissions.push("Manage Roles");
      if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS))
        missingPermissions.push("Manage Channels");
      if (!botRole.permissions.has(Permissions.FLAGS.ADD_REACTIONS))
        missingPermissions.push("Add Reactions");
      if (
        (customBotAvatar || customBotName) &&
        !botRole.permissions.has(Permissions.FLAGS.MANAGE_WEBHOOKS)
      )
        missingPermissions.push(
          "Manage Webhooks (only required for custom avatar and custom name)"
        );
      if (missingPermissions.length > 0)
        return replyError(
          interaction,
          `These permissions are missing for the role <@&${
            botRole.id
          }> : \`${missingPermissions.join(", ")}\``
        );
      let channel = interaction.options.get("channel");
      if (channel) channel = channel.channel;
      else {
        channel = await interaction.guild.channels.create("✅-captcha", {
          type: "GUILD_TEXT",
          topic: "Captcha verification",
          permissionOverwrites: [
            {
              id: interaction.guild.roles.everyone,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.READ_MESSAGE_HISTORY,
              ],
              deny: [Permissions.FLAGS.SEND_MESSAGES],
            },
            {
              id: client.user.id,
              allow: [
                Permissions.FLAGS.VIEW_CHANNEL,
                Permissions.FLAGS.SEND_MESSAGES,
              ],
            },
          ],
        });
      }
      if (channel.type != "GUILD_TEXT")
        return replyError(interaction, "Please specify a text channel");
      let role = interaction.options.get("role")
        ? interaction.options.get("role").role
        : null;
      if (role) {
        if (!checkBotRolePosition(role, interaction.guild))
          return replyError(
            interaction,
            "My role need to be higher than the role you specified."
          );
      } else {
        role = await interaction.guild.roles.create({
          name: "Member",
          color: "#0b994c",
          permissions: ["VIEW_CHANNEL"],
        });
      }
      missingChannelPermissions = [];
      if (!channel.permissionsFor(client.user.id).has(["VIEW_CHANNEL"]))
        missingChannelPermissions.push("View Channel");
      if (!channel.permissionsFor(client.user.id).has(["SEND_MESSAGES"]))
        missingChannelPermissions.push("Send Messages");
      if (!channel.permissionsFor(client.user.id).has(["USE_EXTERNAL_EMOJIS"]))
        missingChannelPermissions.push("Use External Emojis");
      if (!channel.permissionsFor(client.user.id).has(["ATTACH_FILES"]))
        missingChannelPermissions.push("Attach Files");
      if (!channel.permissionsFor(client.user.id).has(["EMBED_LINKS"]))
        missingChannelPermissions.push("Embed Links");
      if (!channel.permissionsFor(client.user.id).has(["READ_MESSAGE_HISTORY"]))
        missingChannelPermissions.push("Read Message History");
      if (!channel.permissionsFor(client.user.id).has(["MANAGE_MESSAGES"]))
        missingChannelPermissions.push("Manage Messages");
      if (!channel.permissionsFor(client.user.id).has(["MANAGE_ROLES"]))
        missingChannel.push("Manage Roles");
      if (!channel.permissionsFor(client.user.id).has(["MANAGE_CHANNELS"]))
        missingChannelPermissions.push("Manage Channel");

      if (missingChannelPermissions.length > 0)
        return replyError(
          interaction,
          `The global permissions for my role are correct, however, some of the permissions I need in this channel are missing. Please add the following permissions for me in the targeted channel: \`${missingChannelPermissions.join(
            ", "
          )}\`\n
			If the problem persists, please give me the administrator permissions or contact my support team`
        );
      let additionalDatas = "";
      switch (type) {
        case 2:
          additionalDatas = captchaTypes.text;
          break;
      }
      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId(`${additionalDatas}Verify-${role.id}`)
          .setLabel("Verify")
          .setStyle("SUCCESS")
      );
      channel.permissionOverwrites
        .edit(clientId, { SEND_MESSAGES: true, VIEW_CHANNEL: true })
        .catch();
      const embed = new MessageEmbed()
        .setColor("#74d579")
        .setTitle(customTitle ? customTitle.value : "Are you a robot ?")
        .setDescription(
          customDescription
            ? customDescription.value
            : "The server is protected against bots using a Captcha, click on **Verify** to access the server."
        );
      if (customBotAvatar || customBotName) {
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find((wh) => wh.token);
        if (!webhook) {
          webhook = await channel.createWebhook("Captcha");
        }
        webhook.send({
          username: customBotName ? customBotName.value : "Captcha",
          avatarURL: customBotAvatar
            ? customBotAvatar.attachment.url
            : client.user.avatarURL(),
          embeds: [embed],
          components: [row],
        });
      } else
        channel.send({
          embeds: [embed],
          components: [row],
        });
      channel.permissionOverwrites.create(role.id, { VIEW_CHANNEL: false });
      // Update role permissions
      role.permissions.add(Permissions.FLAGS.VIEW_CHANNEL);
      // Show the channel and message history to everyone
      const everyoneRole = interaction.guild.roles.everyone;
      channel.permissionOverwrites.edit(everyoneRole.id, {
        VIEW_CHANNEL: true,
        READ_MESSAGE_HISTORY: true,
        SEND_MESSAGES: false,
      });
      // Hide other channels for everyone
      everyoneRole.setPermissions([]);
      await interaction.reply({
        content: `✅ Everything has been successfully set up in <#${channel.id}>`,
        ephemeral: true,
      });
    } else if (interaction.commandName === "help") {
      const embed = new MessageEmbed().setColor("#74d579").setTitle("Help")
        .setDescription(`
					**Setup the Captcha system :**
					\`\`\`
/catpcha [role] [channel] [title] [description] [bot avatar] [bot name]
					\`\`\`
					**Optional parameters :**
						role: The role that will be used to verify the user.
						channel: The channel where the captcha will be displayed.
						title: The title of the captcha.
						description: The description of the captcha.
						bot avatar: The avatar of the bot.
						bot name: The name of the bot.

						● [Website](https://discord-captcha-web.vercel.app/)
						● [Documentation](https://discord-captcha-web.vercel.app/docs)
						● [Dashboard](https://discord-captcha-web.vercel.app/dashboard)
				`);
      interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } else if (interaction.isButton()) {
    const roleId = interaction.customId.split("Verify-")[1];
    const imageId = interaction.customId.split("CaptchaImages_")[1];
    const type =
      interaction.customId.split(captchaTypes.text).length > 1 ? 2 : 1;
    const member = interaction.member;
    if (roleId) {
      const role = member.guild.roles.cache.get(roleId);
      /*fetch(`https://captcha-api.heyko.org/status`, {
        method: "POST",
        body: `{ "guildId": "${interaction.guild.id}" }`,
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.result) {
            if (interaction.message.author.id === client.user.id) {
              if (res.status) {
                if (interaction.message.embeds.length > 1) {
                  interaction.message.edit({
                    embeds: [interaction.message.embeds[0]],
                  });
                }
              } else {
                const embed = new MessageEmbed()
                  .setColor("#fc0303")
                  .setTitle(
                    "You are currently using the free version of the bot"
                  )
                  .setDescription(`❌ To guarantee the uptime of our service, as well as its quality, it is necessary that the bot is paid. However, **your server does not currently have a licence**. More information [here](https://discord-captcha-web.vercel.app/).
							
							__To buy the license__: [Click here](https://discord-captcha-web.vercel.app/dashboard?guild=${interaction.guild.id})

							This message will be removed the next time someone clicks on "Verify", assuming that one of the server administrators has purchased a licence for it.
							`);
                interaction.message.edit({
                  embeds: [interaction.message.embeds[0], embed],
                });
              }
            } else {
              const embed = new MessageEmbed()
                .setColor("#fc0303")
                .setTitle("You are currently using the free version of the bot")
                .setDescription(`❌ To guarantee the uptime of our service, as well as its quality, it is necessary that the bot is paid. However, **your server does not currently have a licence**. More information [here](https://discord-captcha-web.vercel.app/).
						
						__To buy the license__: [Click here](https://discord-captcha-web.vercel.app/dashboard?guild=${interaction.guild.id})

						**You can't use a custom username or avatar for the bot with the free version! Try again without setting its options, or buy the license.**
						`);
              interaction.channel.send({ embeds: [embed] });
              interaction.message.delete();
            }
          }
        });*/
      if (!checkBotRolePosition(role, interaction.guild))
        return replyError(
          interaction,
          "My role must be higher than the role specified by the administrator. Please contact him/her."
        );
      let missingPermissions = [];
      const botRole = interaction.guild.me.roles.highest;
      if (!botRole.permissions.has(Permissions.FLAGS.VIEW_CHANNEL))
        missingPermissions.push("View Channel");
      if (
        !botRole.permissions.has(Permissions.FLAGS.SEND_MESSAGES) &&
        type !== 1
      )
        missingPermissions.push("Send Messages");
      if (
        !botRole.permissions.has(Permissions.FLAGS.USE_EXTERNAL_EMOJIS) &&
        type !== 1
      )
        missingPermissions.push("Use External Emojis");
      if (!botRole.permissions.has(Permissions.FLAGS.ATTACH_FILES))
        missingPermissions.push("Attach Files");
      if (!botRole.permissions.has(Permissions.FLAGS.EMBED_LINKS))
        missingPermissions.push("Embed Links");
      if (
        !botRole.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES) &&
        type !== 1
      )
        missingPermissions.push("Manage Messages");
      if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_ROLES))
        missingPermissions.push("Manage Roles");
      if (!botRole.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS))
        missingPermissions.push("Manage Channels");

      if (missingPermissions.length > 0)
        return replyError(
          interaction,
          `These permissions are missing for the role <@&${
            botRole.id
          }> : \`${missingPermissions.join(
            ", "
          )}\`. Please contact the server administrator.`
        );
      let captcha = new Captcha();
      const date = (
        new Date(new Date().getTime() + maxInteractionDuration).getTime() / 1000
      ).toFixed(0);
      const embed = new MessageEmbed()
        .setColor("#74d579")
        .setTitle("Captcha")
        .setThumbnail("https://i.imgur.com/m2jRNLg.png");
      switch (type) {
        case 2:
          embed.setDescription(`
					<a:Loading:991374833541718156> <@${member.id}> please enter the letters you see in the image (Captcha) to access the server.\n
					Expires <t:${date}:R>
					`);
          interaction
            .reply({
              embeds: [embed],
              files: [
                new MessageAttachment(captcha.JPEGStream, "captcha.jpeg"),
              ],
              ephemeral: true,
            })
            .then(() => {
              const filter = (message) => message.author.id === member.id;
              if (verifyCollectors[member.id]) {
                verifyCollectors[member.id].stop();
              }
              verifyCollectors[member.id] =
                interaction.channel.createMessageCollector({
                  filter,
                  time: maxInteractionDuration + 1000,
                });
              verifyCollectors[member.id].on("collect", (message) => {
                if (message.content.toUpperCase() === captcha.value) {
                  verifyCollectors[member.id].stop();
                  interaction.channel.permissionOverwrites.delete(member.id);
                  member.roles.add(role).catch(console.error);
                  message.react("✅");
                  setTimeout(() => {
                    message.delete();
                  }, 1000);
                } else {
                  message.react("❌");
                  setTimeout(() => {
                    message.delete();
                  }, 1000);
                }
              });
              verifyCollectors[member.id].on("end", () => {
                delete verifyCollectors[member.id];
              });
              interaction.channel.permissionOverwrites.edit(member.id, {
                SEND_MESSAGES: true,
              });
              setTimeout(() => {
                interaction.channel.permissionOverwrites.delete(member.id);
              }, maxInteractionDuration);
            });
          break;
        default:
          sendImagesCaptcha(
            cache,
            interaction,
            totalImages,
            captchaDatas,
            roleId
          );
          break;
      }
    } else if (imageId) {
      const step = parseInt(
        interaction.message.embeds[0].description.split("Step ")[1][0]
      );
      const maxSteps = parseInt(
        interaction.message.embeds[0].description.split("Step ")[1][2]
      );
      const roleId = interaction.customId.split("role_")[1].split("_")[0];
      const datas = captchaDatas[interaction.member];
      if (!datas) return;
      if (imageId == datas.selectedImage) {
        if (step >= maxSteps) {
          const role = member.guild.roles.cache.get(roleId);
          interaction.reply({ content: "✅ Success.", ephemeral: true });
          interaction.member.roles.add(role).catch(() => {});
        } else {
          sendImagesCaptcha(
            cache,
            interaction,
            totalImages,
            captchaDatas,
            roleId,
            step + 1
          );
        }
      } else {
        sendImagesCaptcha(
          cache,
          interaction,
          totalImages,
          captchaDatas,
          roleId,
          1,
          "❌ <@" +
            member.id +
            "> You have not selected the right image. Please try again from the begining."
        );
      }
    }
  }
});

clearCaptchaDatas();
function clearCaptchaDatas() {
  const keys = Object.keys(captchaDatas);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const element = captchaDatas[key];
    if (element.date < Date.now() - maxInteractionDuration)
      delete captchaDatas[key];
  }
  setTimeout(clearCaptchaDatas, 10000);
}
